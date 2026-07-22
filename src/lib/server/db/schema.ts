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
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

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
export type Order = typeof order.$inferSelect;
export type OrderItem = typeof orderItem.$inferSelect;
export type User = typeof user.$inferSelect;
