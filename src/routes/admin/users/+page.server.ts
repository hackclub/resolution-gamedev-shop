import { fail } from '@sveltejs/kit';
import { TransactionRollbackError, asc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return { users: db.select().from(table.user).orderBy(asc(table.user.name)).all() };
};

export const actions: Actions = {
	issue: async ({ request }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '');
		const amount = Number(form.get('amount'));
		if (!Number.isInteger(amount) || amount === 0) {
			return fail(400, { message: 'Amount must be a whole number (negative to deduct).' });
		}

		const result = db.transaction((tx) => {
			const [u] = tx.select().from(table.user).where(eq(table.user.email, email)).all();
			if (!u) return { error: 'Unknown user.' };
			const balance = u.balance + amount;
			if (balance < 0) return { error: `${u.name} only has ${u.balance} ✦.` };
			tx.update(table.user).set({ balance }).where(eq(table.user.email, email)).run();
			return { name: u.name, balance };
		});

		if ('error' in result) return fail(400, { message: result.error });
		return {
			success: `${amount > 0 ? 'Issued' : 'Deducted'} ${Math.abs(amount)} ✦ ${amount > 0 ? 'to' : 'from'} ${result.name} — new balance: ${result.balance} ✦.`
		};
	},

	bulkIssue: async ({ request }) => {
		const form = await request.formData();
		const text = String(form.get('rows') ?? '');

		// One entry per line: "email,amount" — comma, semicolon, or tab delimited.
		const entries: { line: number; email: string; amount: number }[] = [];
		const errors: string[] = [];
		text.split(/\r?\n/).forEach((raw, i) => {
			const line = raw.trim();
			if (!line || line.startsWith('#')) return;
			if (i === 0 && /email/i.test(line) && !line.includes('@')) return; // header row
			const parts = line.split(/[,;\t]/).map((p) => p.trim().replace(/^"|"$/g, ''));
			const email = parts[0]?.toLowerCase();
			const amount = Number(parts[1]);
			if (!email?.includes('@') || parts.length < 2) {
				errors.push(`Line ${i + 1}: expected “email,amount”, got “${line}”`);
			} else if (!Number.isInteger(amount) || amount === 0) {
				errors.push(`Line ${i + 1}: amount must be a nonzero whole number (got “${parts[1]}”)`);
			} else {
				entries.push({ line: i + 1, email, amount });
			}
		});

		if (entries.length === 0 && errors.length === 0) {
			return fail(400, { message: 'Paste at least one “email,amount” line.' });
		}

		// All-or-nothing: validate every row against the database, apply only if
		// the whole batch is clean.
		if (errors.length === 0) {
			try {
				db.transaction((tx) => {
					for (const e of entries) {
						const [u] = tx.select().from(table.user).where(eq(table.user.email, e.email)).all();
						if (!u) {
							errors.push(
								`Line ${e.line}: no user with email ${e.email} (they must log in once first)`
							);
							continue;
						}
						const balance = u.balance + e.amount;
						if (balance < 0) {
							errors.push(
								`Line ${e.line}: ${u.name} only has ${u.balance} ✦, can’t deduct ${-e.amount}`
							);
							continue;
						}
						tx.update(table.user).set({ balance }).where(eq(table.user.email, e.email)).run();
					}
					if (errors.length > 0) tx.rollback();
				});
			} catch (e) {
				if (!(e instanceof TransactionRollbackError)) throw e;
			}
		}

		if (errors.length > 0) {
			return fail(400, {
				message: `Nothing was applied — fix these rows and try again:\n${errors.join('\n')}`
			});
		}
		const total = entries.reduce((sum, e) => sum + e.amount, 0);
		return {
			success: `Updated ${entries.length} ${entries.length === 1 ? 'user' : 'users'} (net ${total >= 0 ? '+' : ''}${total} ✦).`
		};
	}
};
