import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

export const user = sqliteTable('user', {
	email: text('email').primaryKey(),
	name: text('name').notNull(),
	balance: integer('balance').notNull().default(0),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

export const session = sqliteTable('session', {
	tokenHash: text('token_hash').primaryKey(),
	userEmail: text('user_email')
		.notNull()
		.references(() => user.email),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull()
});

export const item = sqliteTable('item', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	description: text('description').notNull().default(''),
	price: integer('price').notNull(),
	image: text('image'),
	// null = unlimited stock
	stock: integer('stock'),
	// Hidden from everyone except the people explicitly unlocked for it in itemAccess.
	restricted: integer('restricted', { mode: 'boolean' }).notNull().default(false),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

// Per-user overrides of an item's default visibility: `allowed: true` unlocks a
// restricted item for just this person, `allowed: false` locks a public item away
// from just this person. No row here means "use the item's default."
export const itemAccess = sqliteTable(
	'item_access',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		itemId: integer('item_id')
			.notNull()
			.references(() => item.id, { onDelete: 'cascade' }),
		userEmail: text('user_email').notNull(),
		allowed: integer('allowed', { mode: 'boolean' }).notNull()
	},
	(t) => [unique().on(t.itemId, t.userEmail)]
);

export const cartItem = sqliteTable(
	'cart_item',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userEmail: text('user_email').notNull(),
		itemId: integer('item_id')
			.notNull()
			.references(() => item.id, { onDelete: 'cascade' }),
		qty: integer('qty').notNull().default(1)
	},
	(t) => [unique().on(t.userEmail, t.itemId)]
);

// One order per checkout; fulfillment and cancellation apply to the whole order.
export const order = sqliteTable('orders', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	userEmail: text('user_email').notNull(),
	total: integer('total').notNull(),
	// Admin notes shown to the buyer (tracking URLs and such).
	comments: text('comments'),
	fulfilledAt: integer('fulfilled_at', { mode: 'timestamp' }),
	cancelledAt: integer('cancelled_at', { mode: 'timestamp' }),
	cancelledBy: text('cancelled_by'),
	cancelReason: text('cancel_reason'),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

// Lines snapshot the item name/unit price so history survives item deletion.
export const orderItem = sqliteTable('order_item', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	orderId: integer('order_id')
		.notNull()
		.references(() => order.id, { onDelete: 'cascade' }),
	itemId: integer('item_id').references(() => item.id, { onDelete: 'set null' }),
	itemName: text('item_name').notNull(),
	price: integer('price').notNull(),
	qty: integer('qty').notNull().default(1)
});

export type CartItem = typeof cartItem.$inferSelect;
export type Item = typeof item.$inferSelect;
export type ItemAccess = typeof itemAccess.$inferSelect;
export type Order = typeof order.$inferSelect;
export type OrderItem = typeof orderItem.$inferSelect;
export type User = typeof user.$inferSelect;
