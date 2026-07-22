/// <reference types="bun" />
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { env } from '$env/dynamic/private';
import * as schema from './schema';

const url = env.DATABASE_URL ?? './data/shop.db';
mkdirSync(dirname(url), { recursive: true });

const client = new Database(url, { create: true });
client.exec('PRAGMA journal_mode = WAL;');
client.exec('PRAGMA foreign_keys = ON;');

client.exec(`
	CREATE TABLE IF NOT EXISTS user (
		email TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		balance INTEGER NOT NULL DEFAULT 0,
		created_at INTEGER NOT NULL DEFAULT (unixepoch())
	);
	CREATE TABLE IF NOT EXISTS session (
		token_hash TEXT PRIMARY KEY,
		user_email TEXT NOT NULL REFERENCES user(email),
		expires_at INTEGER NOT NULL
	);
	CREATE TABLE IF NOT EXISTS item (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		description TEXT NOT NULL DEFAULT '',
		price INTEGER NOT NULL,
		image TEXT,
		stock INTEGER,
		created_at INTEGER NOT NULL DEFAULT (unixepoch())
	);
	CREATE TABLE IF NOT EXISTS orders (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_email TEXT NOT NULL,
		total INTEGER NOT NULL,
		comments TEXT,
		fulfilled_at INTEGER,
		cancelled_at INTEGER,
		cancelled_by TEXT,
		cancel_reason TEXT,
		created_at INTEGER NOT NULL DEFAULT (unixepoch())
	);
	CREATE TABLE IF NOT EXISTS order_item (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
		item_id INTEGER REFERENCES item(id) ON DELETE SET NULL,
		item_name TEXT NOT NULL,
		price INTEGER NOT NULL,
		qty INTEGER NOT NULL DEFAULT 1
	);
	CREATE TABLE IF NOT EXISTS cart_item (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_email TEXT NOT NULL,
		item_id INTEGER NOT NULL REFERENCES item(id) ON DELETE CASCADE,
		qty INTEGER NOT NULL DEFAULT 1,
		UNIQUE(user_email, item_id)
	);
`);

// Upgrade databases created before these columns existed.
for (const ddl of ['ALTER TABLE item ADD COLUMN stock INTEGER']) {
	try {
		client.exec(ddl);
	} catch {
		// column already exists
	}
}

export const db = drizzle(client, { schema });
