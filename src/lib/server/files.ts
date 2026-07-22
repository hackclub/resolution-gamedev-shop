import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '$env/dynamic/private';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const EXT_BY_TYPE: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/webp': 'webp',
	'image/gif': 'gif'
};

const MIME_BY_EXT: Record<string, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	webp: 'image/webp',
	gif: 'image/gif'
};

export function uploadsDir(): string {
	const dir = env.UPLOADS_DIR ?? './data/uploads';
	mkdirSync(dir, { recursive: true });
	return dir;
}

/** Saves an uploaded image and returns its public path, or an error message. */
export async function saveImage(file: File): Promise<{ path: string } | { error: string }> {
	const ext = EXT_BY_TYPE[file.type];
	if (!ext) return { error: 'Image must be a PNG, JPEG, WebP, or GIF' };
	if (file.size > MAX_IMAGE_BYTES) return { error: 'Image must be 5 MB or smaller' };
	const name = `${randomBytes(16).toString('hex')}.${ext}`;
	await writeFile(path.join(uploadsDir(), name), new Uint8Array(await file.arrayBuffer()));
	return { path: `/uploads/${name}` };
}

export async function deleteImage(publicPath: string | null): Promise<void> {
	if (!publicPath?.startsWith('/uploads/')) return;
	const name = publicPath.slice('/uploads/'.length);
	if (!/^[a-f0-9]+\.[a-z0-9]+$/.test(name)) return;
	await unlink(path.join(uploadsDir(), name)).catch(() => {});
}

/** Resolves a stored image filename to disk path + mime type, or null if invalid. */
export function resolveImage(name: string): { filePath: string; mime: string } | null {
	const match = /^[a-f0-9]+\.([a-z0-9]+)$/.exec(name);
	const mime = match && MIME_BY_EXT[match[1]];
	if (!mime) return null;
	return { filePath: path.join(uploadsDir(), name), mime };
}
