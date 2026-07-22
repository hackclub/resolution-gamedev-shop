import { error, redirect } from '@sveltejs/kit';
import {
	SESSION_COOKIE,
	STATE_COOKIE,
	createSession,
	exchangeCode,
	fetchProfile
} from '$lib/server/auth';
import { db } from '$lib/server/db';
import * as table from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const oauthError = url.searchParams.get('error');
	if (oauthError) {
		error(400, `Hack Club Auth returned an error: ${oauthError}`);
	}

	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const expectedState = cookies.get(STATE_COOKIE);
	cookies.delete(STATE_COOKIE, { path: '/' });

	if (!code || !state || !expectedState || state !== expectedState) {
		error(400, 'Invalid OAuth state. Please try logging in again.');
	}

	const accessToken = await exchangeCode(code);
	const { email, name } = await fetchProfile(accessToken);

	db.insert(table.user)
		.values({ email, name })
		.onConflictDoUpdate({ target: table.user.email, set: { name } })
		.run();

	const { token, expiresAt } = createSession(email);
	cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		expires: expiresAt
	});

	redirect(302, '/');
};
