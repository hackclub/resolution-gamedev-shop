import { fail } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { deleteImage, saveImage } from '$lib/server/files';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return { items: db.select().from(table.item).orderBy(desc(table.item.createdAt)).all() };
};

function parseFields(
	form: FormData
): { name: string; description: string; price: number; stock: number | null } | null {
	const name = String(form.get('name') ?? '').trim();
	const description = String(form.get('description') ?? '').trim();
	const price = Number(form.get('price'));
	if (!name || !Number.isInteger(price) || price < 0) return null;
	const rawStock = String(form.get('stock') ?? '').trim();
	const stock = rawStock === '' ? null : Number(rawStock);
	if (stock !== null && (!Number.isInteger(stock) || stock < 0)) return null;
	return { name, description, price, stock };
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
	}
};
