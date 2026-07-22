import { redirect } from '@sveltejs/kit';
import { SESSION_COOKIE, deleteSession } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
	const token = cookies.get(SESSION_COOKIE);
	if (token) deleteSession(token);
	cookies.delete(SESSION_COOKIE, { path: '/' });
	// Everything is auth-gated, so this redirect immediately bounces back to
	// Hack Club Auth — which is the intended "logged out" experience.
	redirect(302, '/');
};
