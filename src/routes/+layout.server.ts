import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	// hooks.server.ts guarantees a logged-in user on every rendered page.
	return { user: locals.user! };
};
