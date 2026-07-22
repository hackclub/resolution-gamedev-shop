import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';

export type OrderWithLines = table.Order & { lines: table.OrderItem[] };

export function attachLines(orders: table.Order[]): OrderWithLines[] {
	const ids = orders.map((o) => o.id);
	const lines = ids.length
		? db.select().from(table.orderItem).where(inArray(table.orderItem.orderId, ids)).all()
		: [];
	return orders.map((o) => ({ ...o, lines: lines.filter((l) => l.orderId === o.id) }));
}

/**
 * Cancels a pending order: marks it cancelled, refunds the credits, and puts
 * the stock back (when an item still exists and tracks stock).
 * Admins can cancel anyone's order; users only their own.
 */
export function cancelOrder(
	orderId: number,
	actor: { email: string; isAdmin: boolean },
	reason: string
): { error: string } | { ok: true } {
	return db.transaction((tx) => {
		const [o] = tx.select().from(table.order).where(eq(table.order.id, orderId)).all();
		if (!o) return { error: 'Order not found.' };
		if (!actor.isAdmin && o.userEmail !== actor.email) {
			return { error: 'You can only cancel your own orders.' };
		}
		if (o.cancelledAt) return { error: 'That order is already cancelled.' };
		if (o.fulfilledAt) return { error: 'Fulfilled orders can’t be cancelled.' };

		tx.update(table.order)
			.set({
				cancelledAt: new Date(),
				cancelledBy: actor.email,
				cancelReason: reason.trim() || null
			})
			.where(eq(table.order.id, orderId))
			.run();

		tx.update(table.user)
			.set({ balance: sql`${table.user.balance} + ${o.total}` })
			.where(eq(table.user.email, o.userEmail))
			.run();

		const lines = tx.select().from(table.orderItem).where(eq(table.orderItem.orderId, orderId)).all();
		for (const line of lines) {
			if (line.itemId === null) continue;
			const [it] = tx.select().from(table.item).where(eq(table.item.id, line.itemId)).all();
			if (it && it.stock !== null) {
				tx.update(table.item)
					.set({ stock: it.stock + line.qty })
					.where(eq(table.item.id, line.itemId))
					.run();
			}
		}
		return { ok: true };
	});
}
