import { readFile } from 'node:fs/promises';
import { error } from '@sveltejs/kit';
import { resolveImage } from '$lib/server/files';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const resolved = resolveImage(params.file);
	if (!resolved) error(404, 'Not found');
	try {
		const data = await readFile(resolved.filePath);
		return new Response(new Uint8Array(data), {
			headers: {
				'content-type': resolved.mime,
				'cache-control': 'private, max-age=86400, immutable'
			}
		});
	} catch {
		error(404, 'Not found');
	}
};
