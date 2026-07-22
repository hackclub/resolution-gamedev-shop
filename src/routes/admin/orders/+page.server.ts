import { fail } from '@sveltejs/kit';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import { attachLines, cancelOrder } from '$lib/server/orders';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const rows = db
		.select({ order: table.order, userName: table.user.name })
		.from(table.order)
		.leftJoin(table.user, eq(table.order.userEmail, table.user.email))
		.orderBy(
			// Pending first, then fulfilled, then cancelled; newest first within each.
			sql`CASE
				WHEN ${table.order.cancelledAt} IS NOT NULL THEN 2
				WHEN ${table.order.fulfilledAt} IS NOT NULL THEN 1
				ELSE 0
			END`,
			desc(table.order.createdAt)
		)
		.all();
	const withLines = attachLines(rows.map((r) => r.order));
	return {
		orders: withLines.map((o, i) => ({ ...o, userName: rows[i].userName }))
	};
};

export const actions: Actions = {
	fulfill: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		const comments = String(form.get('comments') ?? '')
			.trim()
			.slice(0, 1000);
		if (!Number.isInteger(id)) return fail(400, { message: 'Invalid order.' });
		db.update(table.order)
			.set({ fulfilledAt: new Date(), comments: comments || null })
			.where(and(eq(table.order.id, id), isNull(table.order.cancelledAt)))
			.run();
	},

	unfulfill: async ({ request }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (!Number.isInteger(id)) return fail(400, { message: 'Invalid order.' });
		db.update(table.order).set({ fulfilledAt: null }).where(eq(table.order.id, id)).run();
	},

	cancel: async ({ request, locals }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		const reason = String(form.get('reason') ?? '').slice(0, 500);
		if (!Number.isInteger(id)) return fail(400, { message: 'Invalid order.' });

		const result = cancelOrder(id, locals.user!, reason);
		if ('error' in result) return fail(400, { message: result.error });
	}
};
