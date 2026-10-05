import { fail } from '@sveltejs/kit';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { accessOverrides, canAccess } from '$lib/server/access';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { attachLines, cancelOrder, hasPurchased } from '$lib/server/orders';
import type { Actions, PageServerLoad } from './$types';

function loadCart(email: string) {
	return db
		.select({
			id: table.cartItem.id,
			qty: table.cartItem.qty,
			item: table.item
		})
		.from(table.cartItem)
		.innerJoin(table.item, eq(table.cartItem.itemId, table.item.id))
		.where(eq(table.cartItem.userEmail, email))
		.all();
}

export const load: PageServerLoad = async ({ locals }) => {
	const email = locals.user!.email;
	const overrides = accessOverrides(email);
	// Restricted items still show up for everyone — just greyed out and
	// unpurchasable for anyone who isn't unlocked for them.
	const items = db
		.select()
		.from(table.item)
		.orderBy(asc(table.item.price), desc(table.item.createdAt))
		.all()
		.map((it) => ({
			...it,
			locked: !canAccess(it, overrides),
			alreadyPurchased: it.limitOne && hasPurchased(email, it.id)
		}));
	const orders = attachLines(
		db
			.select()
			.from(table.order)
			.where(eq(table.order.userEmail, email))
			.orderBy(desc(table.order.createdAt))
			.limit(10)
			.all()
	);
	const cart = loadCart(email);
	return {
		items,
		orders,
		cart,
		cartTotal: cart.reduce((sum, l) => sum + l.item.price * l.qty, 0)
	};
};

class CheckoutError extends Error {}

export const actions: Actions = {
	addToCart: async ({ request, locals }) => {
		const email = locals.user!.email;
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (!Number.isInteger(id)) return fail(400, { message: 'Invalid item.' });

		const [it] = db.select().from(table.item).where(eq(table.item.id, id)).all();
		if (!it) return fail(400, { message: 'That item no longer exists.' });
		if (!canAccess(it, accessOverrides(email))) {
			return fail(400, { message: 'That item isn’t available to you.' });
		}

		if (it.limitOne) {
			if (hasPurchased(email, id)) {
				return fail(400, { message: `You’ve already bought “${it.name}” — limit one per person.` });
			}
			const [existing] = db
				.select()
				.from(table.cartItem)
				.where(and(eq(table.cartItem.userEmail, email), eq(table.cartItem.itemId, id)))
				.all();
			if ((existing?.qty ?? 0) >= 1) {
				return fail(400, { message: `“${it.name}” is limited to one per person.` });
			}
		}

		db.insert(table.cartItem)
			.values({ userEmail: email, itemId: id, qty: 1 })
			.onConflictDoUpdate({
				target: [table.cartItem.userEmail, table.cartItem.itemId],
				set: { qty: sql`${table.cartItem.qty} + 1` }
			})
			.run();
	},

	setQty: async ({ request, locals }) => {
		const email = locals.user!.email;
		const form = await request.formData();
		const id = Number(form.get('id'));
		const qty = Number(form.get('qty'));
		if (!Number.isInteger(id) || !Number.isInteger(qty) || qty < 0 || qty > 999) {
			return fail(400, { message: 'Quantity must be between 0 and 999.' });
		}
		const where = and(eq(table.cartItem.id, id), eq(table.cartItem.userEmail, email));
		if (qty === 0) {
			db.delete(table.cartItem).where(where).run();
			return;
		}
		const [line] = db
			.select({ cart: table.cartItem, item: table.item })
			.from(table.cartItem)
			.innerJoin(table.item, eq(table.cartItem.itemId, table.item.id))
			.where(where)
			.all();
		if (!line) return fail(400, { message: 'That item is no longer in your cart.' });
		if (line.item.limitOne && qty > 1) {
			return fail(400, { message: `“${line.item.name}” is limited to one per person.` });
		}
		db.update(table.cartItem).set({ qty }).where(where).run();
	},

	remove: async ({ request, locals }) => {
		const email = locals.user!.email;
		const form = await request.formData();
		const id = Number(form.get('id'));
		db.delete(table.cartItem)
			.where(and(eq(table.cartItem.id, id), eq(table.cartItem.userEmail, email)))
			.run();
	},

	checkout: async ({ locals }) => {
		const email = locals.user!.email;
		try {
			const total = db.transaction((tx) => {
				const lines = tx
					.select({ qty: table.cartItem.qty, item: table.item })
					.from(table.cartItem)
					.innerJoin(table.item, eq(table.cartItem.itemId, table.item.id))
					.where(eq(table.cartItem.userEmail, email))
					.all();
				if (lines.length === 0) throw new CheckoutError('Your cart is empty.');

				const overrides = accessOverrides(email);
				for (const l of lines) {
					if (!canAccess(l.item, overrides)) {
						throw new CheckoutError(`“${l.item.name}” is no longer available to you.`);
					}
					if (l.item.limitOne && (l.qty > 1 || hasPurchased(email, l.item.id))) {
						throw new CheckoutError(`“${l.item.name}” is limited to one per person.`);
					}
				}

				const sum = lines.reduce((acc, l) => acc + l.item.price * l.qty, 0);
				const [u] = tx.select().from(table.user).where(eq(table.user.email, email)).all();
				if (!u || u.balance < sum) {
					throw new CheckoutError('Not enough credits to complete this order.');
				}

				tx.update(table.user)
					.set({ balance: u.balance - sum })
					.where(eq(table.user.email, email))
					.run();
				const created = tx
					.insert(table.order)
					.values({ userEmail: email, total: sum })
					.returning({ id: table.order.id })
					.get();
				for (const l of lines) {
					tx.insert(table.orderItem)
						.values({
							orderId: created.id,
							itemId: l.item.id,
							itemName: l.item.name,
							price: l.item.price,
							qty: l.qty
						})
						.run();
				}
				tx.delete(table.cartItem).where(eq(table.cartItem.userEmail, email)).run();
				return sum;
			});
			return { success: `Order placed! You spent ${total} ✦.` };
		} catch (e) {
			if (e instanceof CheckoutError) return fail(400, { message: e.message });
			throw e;
		}
	},

	cancel: async ({ request, locals }) => {
		const user = locals.user!;
		const form = await request.formData();
		const id = Number(form.get('id'));
		const reason = String(form.get('reason') ?? '').slice(0, 500);
		if (!Number.isInteger(id)) return fail(400, { message: 'Invalid order.' });

		const result = cancelOrder(id, user, reason);
		if ('error' in result) return fail(400, { message: result.error });
		return { success: 'Order cancelled — your credits have been refunded.' };
	}
};
