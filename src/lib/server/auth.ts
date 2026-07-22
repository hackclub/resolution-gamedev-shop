import { createHash, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';

export const SESSION_COOKIE = 'session';
export const STATE_COOKIE = 'hca_oauth_state';

const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

function issuer() {
	return env.HCA_ISSUER ?? 'https://auth.hackclub.com';
}

export function isAdmin(email: string): boolean {
	return (env.ADMIN_EMAILS ?? '')
		.split(',')
		.map((e) => e.trim().toLowerCase())
		.filter(Boolean)
		.includes(email.toLowerCase());
}

export function authorizeUrl(state: string): string {
	const url = new URL('/oauth/authorize', issuer());
	url.searchParams.set('client_id', env.HCA_CLIENT_ID ?? '');
	url.searchParams.set('redirect_uri', env.HCA_REDIRECT_URI ?? '');
	url.searchParams.set('response_type', 'code');
	url.searchParams.set('scope', 'openid profile email');
	url.searchParams.set('state', state);
	return url.toString();
}

export async function exchangeCode(code: string): Promise<string> {
	const res = await fetch(new URL('/oauth/token', issuer()), {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			grant_type: 'authorization_code',
			code,
			client_id: env.HCA_CLIENT_ID ?? '',
			client_secret: env.HCA_CLIENT_SECRET ?? '',
			redirect_uri: env.HCA_REDIRECT_URI ?? ''
		})
	});
	if (!res.ok) {
		throw new Error(`Hack Club Auth token exchange failed (${res.status}): ${await res.text()}`);
	}
	const data = (await res.json()) as { access_token?: string };
	if (!data.access_token) throw new Error('Hack Club Auth did not return an access token');
	return data.access_token;
}

export async function fetchProfile(accessToken: string): Promise<{ email: string; name: string }> {
	const res = await fetch(new URL('/oauth/userinfo', issuer()), {
		headers: { authorization: `Bearer ${accessToken}` }
	});
	if (!res.ok) {
		throw new Error(`Hack Club Auth userinfo request failed (${res.status}): ${await res.text()}`);
	}
	const claims = (await res.json()) as {
		email?: string;
		email_verified?: boolean;
		name?: string;
	};
	if (typeof claims.email !== 'string' || claims.email_verified === false) {
		throw new Error('Hack Club Auth did not return a verified email address');
	}
	const email = claims.email.toLowerCase();
	return { email, name: claims.name?.trim() || email.split('@')[0] };
}

function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export function createSession(userEmail: string): { token: string; expiresAt: Date } {
	const token = randomBytes(32).toString('hex');
	const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
	db.insert(table.session).values({ tokenHash: hashToken(token), userEmail, expiresAt }).run();
	return { token, expiresAt };
}

export function getSessionUser(token: string): table.User | null {
	const tokenHash = hashToken(token);
	const [row] = db
		.select({ session: table.session, user: table.user })
		.from(table.session)
		.innerJoin(table.user, eq(table.session.userEmail, table.user.email))
		.where(eq(table.session.tokenHash, tokenHash))
		.all();
	if (!row) return null;
	if (row.session.expiresAt.getTime() < Date.now()) {
		db.delete(table.session).where(eq(table.session.tokenHash, tokenHash)).run();
		return null;
	}
	return row.user;
}

export function deleteSession(token: string): void {
	db.delete(table.session).where(eq(table.session.tokenHash, hashToken(token))).run();
}
