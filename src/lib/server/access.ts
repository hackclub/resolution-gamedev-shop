import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';

/** This user's per-item overrides, keyed by item id. */
export function accessOverrides(email: string): Map<number, boolean> {
	const rows = db
		.select({ itemId: table.itemAccess.itemId, allowed: table.itemAccess.allowed })
		.from(table.itemAccess)
		.where(eq(table.itemAccess.userEmail, email))
		.all();
	return new Map(rows.map((r) => [r.itemId, r.allowed]));
}

/**
 * Whether a user can see/buy an item: an explicit per-user override always
 * wins; otherwise restricted items are hidden and public items are visible.
 */
export function canAccess(
	item: Pick<table.Item, 'id' | 'restricted'>,
	overrides: Map<number, boolean>
): boolean {
	return overrides.get(item.id) ?? !item.restricted;
}
