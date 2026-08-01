import { randomBytes } from 'node:crypto';
import { error, redirect, type Handle } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import {
	SESSION_COOKIE,
	STATE_COOKIE,
	authorizeUrl,
	getSessionUser,
	isAdmin
} from '$lib/server/auth';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';

// Only honored under `vite dev`, never in a production build.
const bypassAuth = () => dev && ['1', 'true'].includes(env.DEV_BYPASS_AUTH ?? '');

// Every response gets these regardless of auth state, so the app (and its
// session-cookie-authenticated actions) can't be framed by another origin.
function withSecurityHeaders(response: Response): Response {
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Content-Security-Policy', "frame-ancestors 'none'");
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	return response;
}

function devUser(): App.Locals['user'] {
	const email = 'dev@localhost';
	db.insert(table.user).values({ email, name: 'Dev Admin' }).onConflictDoNothing().run();
	const [u] = db.select().from(table.user).where(eq(table.user.email, email)).all();
	return { email, name: u.name, balance: u.balance, isAdmin: true };
}

export const handle: Handle = async ({ event, resolve }) => {
	if (bypassAuth()) {
		event.locals.user = devUser();
		return withSecurityHeaders(await resolve(event));
	}

	const token = event.cookies.get(SESSION_COOKIE);
	const user = token ? getSessionUser(token) : null;
	event.locals.user = user
		? { email: user.email, name: user.name, balance: user.balance, isAdmin: isAdmin(user.email) }
		: null;

	const path = event.url.pathname;

	// The OAuth callback (and logout) must be reachable without a session;
	// everything else is gated behind Hack Club Auth.
	if (path === '/auth/callback' || path === '/auth/logout') {
		return withSecurityHeaders(await resolve(event));
	}

	if (!event.locals.user) {
		const state = randomBytes(16).toString('hex');
		event.cookies.set(STATE_COOKIE, state, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 10
		});
		redirect(302, authorizeUrl(state));
	}

	if (path.startsWith('/admin') && !event.locals.user.isAdmin) {
		error(403, 'This page is for admins only.');
	}

	return withSecurityHeaders(await resolve(event));
};
