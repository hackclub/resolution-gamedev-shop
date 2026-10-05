import { fail } from '@sveltejs/kit';
import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { deleteImage, saveImage } from '$lib/server/files';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const items = db.select().from(table.item).orderBy(desc(table.item.createdAt)).all();
	const users = db
		.select({ email: table.user.email, name: table.user.name })
		.from(table.user)
		.orderBy(asc(table.user.name))
		.all();
	const nameByEmail = new Map(users.map((u) => [u.email, u.name]));
	const access = db.select().from(table.itemAccess).all();
	const accessByItem = new Map<number, (table.ItemAccess & { name: string })[]>();
	for (const a of access) {
		const list = accessByItem.get(a.itemId) ?? [];
		list.push({ ...a, name: nameByEmail.get(a.userEmail) ?? a.userEmail });
		accessByItem.set(a.itemId, list);
	}

	return {
		items: items.map((it) => ({ ...it, access: accessByItem.get(it.id) ?? [] })),
		users
	};
};

function parseFields(
	form: FormData
): { name: string; description: string; price: number; stock: number | null; restricted: boolean } | null {
	const name = String(form.get('name') ?? '').trim();
	const description = String(form.get('description') ?? '').trim();
	const price = Number(form.get('price'));
	if (!name || !Number.isInteger(price) || price < 0) return null;
	const rawStock = String(form.get('stock') ?? '').trim();
	const stock = rawStock === '' ? null : Number(rawStock);
	if (stock !== null && (!Number.isInteger(stock) || stock < 0)) return null;
	const restricted = form.get('restricted') === 'on';
	return { name, description, price, stock, restricted };
}

async function processImage(form: FormData): Promise<{ path: string } | { error: string } | null> {
	const file = form.get('image');
	if (!(file instanceof File) || file.size === 0) return null;
	return saveImage(file);
}

export const actions: Actions = {
	create: async ({ request }) => {
		const form = await request.formData();
		const fields = parseFields(form);
		if (!fields) {
			return fail(400, { message: 'An item needs a name and a whole-number price of 0 or more.' });
		}
		const image = await processImage(form);
		if (image && 'error' in image) return fail(400, { message: image.error });

		db.insert(table.item)
			.values({ ...fields, image: image?.path ?? null })
			.run();
		return { success: `Added “${fields.name}”.` };
	},

	update: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		const fields = parseFields(form);
		if (!Number.isInteger(id) || !fields) {
			return fail(400, { message: 'An item needs a name and a whole-number price of 0 or more.' });
		}
		const [existing] = db.select().from(table.item).where(eq(table.item.id, id)).all();
		if (!existing) return fail(404, { message: 'That item no longer exists.' });

		const image = await processImage(form);
		if (image && 'error' in image) return fail(400, { message: image.error });
		if (image) await deleteImage(existing.image);

		db.update(table.item)
			.set({ ...fields, image: image?.path ?? existing.image })
			.where(eq(table.item.id, id))
			.run();
		return { success: `Updated “${fields.name}”.` };
	},

	delete: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		const [existing] = db.select().from(table.item).where(eq(table.item.id, id)).all();
		if (!existing) return fail(404, { message: 'That item no longer exists.' });

		await deleteImage(existing.image);
		db.delete(table.item).where(eq(table.item.id, id)).run();
		return { success: `Deleted “${existing.name}”.` };
	},

	// Unlocks (allowed=true) or locks (allowed=false) one item for one person,
	// overriding the item's default (public, or restricted) for just them.
	setAccess: async ({ request }) => {
		const form = await request.formData();
		const itemId = Number(form.get('itemId'));
		const email = String(form.get('email') ?? '').toLowerCase();
		const allowed = form.get('allowed') === '1';
		if (!Number.isInteger(itemId) || !email.includes('@')) {
			return fail(400, { message: 'Pick an item and a person.' });
		}

		const [it] = db.select().from(table.item).where(eq(table.item.id, itemId)).all();
		if (!it) return fail(404, { message: 'That item no longer exists.' });
		const [u] = db.select().from(table.user).where(eq(table.user.email, email)).all();
		if (!u) return fail(400, { message: 'Unknown user.' });

		db.insert(table.itemAccess)
			.values({ itemId, userEmail: email, allowed })
			.onConflictDoUpdate({
				target: [table.itemAccess.itemId, table.itemAccess.userEmail],
				set: { allowed }
			})
			.run();
		return { success: `${allowed ? 'Unlocked' : 'Locked'} “${it.name}” for ${u.name}.` };
	},

	clearAccess: async ({ request }) => {
		const form = await request.formData();
		const itemId = Number(form.get('itemId'));
		const email = String(form.get('email') ?? '').toLowerCase();
		db.delete(table.itemAccess)
			.where(and(eq(table.itemAccess.itemId, itemId), eq(table.itemAccess.userEmail, email)))
			.run();
		return { success: 'Reset to the default for everyone.' };
	}
};
