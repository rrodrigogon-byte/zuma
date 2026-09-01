import crypto from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Storage } from '@google-cloud/storage';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MIME_EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
const LOCAL_STORAGE_PREFIX = 'commerce-local/';
const GCS_STORAGE_PREFIX = 'commerce-media/';

let bucketCache = null;

function getBucketName() {
  return String(process.env.GCS_BUCKET || '').trim();
}

function getLocalMediaRoot() {
  const explicit = String(process.env.COMMERCE_MEDIA_DIR || '').trim();
  const dbPath = String(process.env.DB_PATH || '').trim();
  const root = explicit || (dbPath ? path.join(path.dirname(path.resolve(dbPath)), 'commerce-media') : '');
  if (!root) {
    const error = new Error('armazenamento de imagens não configurado no ambiente seguro');
    error.code = 'MEDIA_STORAGE_NOT_CONFIGURED';
    throw error;
  }
  return path.resolve(root);
}

function getBucket() {
  const bucketName = getBucketName();
  if (!bucketName) {
    const error = new Error('bucket de imagens não configurado');
    error.code = 'MEDIA_STORAGE_NOT_CONFIGURED';
    throw error;
  }
  if (!bucketCache || bucketCache.name !== bucketName) bucketCache = new Storage().bucket(bucketName);
  return bucketCache;
}

function localPathForStorageKey(storageKey) {
  const key = String(storageKey || '').trim();
  if (!key.startsWith(LOCAL_STORAGE_PREFIX)) {
    const error = new Error('mídia não pertence ao armazenamento local Commerce');
    error.code = 'MEDIA_NOT_FOUND';
    throw error;
  }
  const segments = key.slice(LOCAL_STORAGE_PREFIX.length).split('/');
  if (!segments.length || segments.some(segment => !/^[a-zA-Z0-9._-]+$/.test(segment) || segment === '.' || segment === '..')) {
    const error = new Error('chave de mídia local inválida');
    error.code = 'MEDIA_NOT_FOUND';
    throw error;
  }
  const root = getLocalMediaRoot();
  const target = path.resolve(root, ...segments);
  if (!target.startsWith(`${root}${path.sep}`)) {
    const error = new Error('chave de mídia local fora do diretório permitido');
    error.code = 'MEDIA_NOT_FOUND';
    throw error;
  }
  return target;
}

export function detectCommerceImageMime(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))) return 'image/gif';
  return null;
}

export function normalizeCommerceImage(buffer, requestedMime = '') {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    const error = new Error('arquivo de imagem vazio');
    error.code = 'MEDIA_UPLOAD_EMPTY';
    throw error;
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    const error = new Error('imagem excede o limite de 8 MB');
    error.code = 'MEDIA_UPLOAD_TOO_LARGE';
    throw error;
  }
  const detectedMime = detectCommerceImageMime(buffer);
  if (!detectedMime) {
    const error = new Error('formato de imagem não suportado; use JPEG, PNG, WebP ou GIF');
    error.code = 'MEDIA_IMAGE_INVALID';
    throw error;
  }
  const normalizedRequested = String(requestedMime || '').split(';')[0].trim().toLowerCase();
  if (normalizedRequested && normalizedRequested !== 'application/octet-stream' && normalizedRequested !== detectedMime) {
    const error = new Error('o tipo declarado não corresponde ao conteúdo da imagem');
    error.code = 'MEDIA_IMAGE_INVALID';
    throw error;
  }
  return { mimeType: detectedMime, extension: MIME_EXTENSIONS[detectedMime], size: buffer.length };
}

export async function uploadCommerceImage({ empresaId, productId, mediaId, buffer, mimeType }) {
  const normalized = normalizeCommerceImage(buffer, mimeType);
  if (getBucketName()) {
    const key = `${GCS_STORAGE_PREFIX}${String(empresaId)}/${String(productId)}/${String(mediaId)}.${normalized.extension}`;
    const bucket = getBucket();
    await bucket.file(key).save(buffer, {
      resumable: false,
      validation: 'md5',
      metadata: {
        contentType: normalized.mimeType,
        cacheControl: 'public,max-age=3600',
      },
    });
    return { storageKey: key, storageProvider: 'gcs', mimeType: normalized.mimeType, size: normalized.size };
  }

  const key = `${LOCAL_STORAGE_PREFIX}${String(empresaId)}/${String(productId)}/${String(mediaId)}.${normalized.extension}`;
  const target = localPathForStorageKey(key);
  await mkdir(path.dirname(target), { recursive: true, mode: 0o750 });
  const temporary = `${target}.${crypto.randomUUID()}.tmp`;
  try {
    await writeFile(temporary, buffer, { mode: 0o640 });
    await rename(temporary, target);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
  return { storageKey: key, storageProvider: 'local', mimeType: normalized.mimeType, size: normalized.size };
}

export function newCommerceMediaId() {
  return crypto.randomUUID();
}

export function commerceMediaIdForIdempotencyKey({ empresaId, productId, idempotencyKey }) {
  const tenant = String(empresaId || '').trim();
  const product = String(productId || '').trim();
  const key = String(idempotencyKey || '').trim();
  if (!tenant || !product || !key) {
    const error = new Error('tenant, produto e chave de idempotência são obrigatórios');
    error.code = 'MEDIA_IDEMPOTENCY_REQUIRED';
    throw error;
  }
  if (key.length > 200) {
    const error = new Error('chave de idempotência excede 200 caracteres');
    error.code = 'MEDIA_IDEMPOTENCY_INVALID';
    throw error;
  }
  const hex = crypto.createHash('sha256').update(`commerce-media:v1:${tenant}:${product}:${key}`).digest('hex').slice(0, 32).split('');
  hex[12] = '5';
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20, 32).join('')}`;
}

export async function streamCommerceImage({ storageKey, mimeType, res }) {
  const key = String(storageKey || '').trim();
  res.setHeader('Content-Type', MIME_EXTENSIONS[String(mimeType || '').toLowerCase()] ? String(mimeType).toLowerCase() : 'application/octet-stream');
  res.setHeader('Cache-Control', 'public, max-age=3600');

  if (key.startsWith(LOCAL_STORAGE_PREFIX)) {
    const target = localPathForStorageKey(key);
    try {
      await stat(target);
    } catch {
      const error = new Error('arquivo de mídia não encontrado');
      error.code = 'MEDIA_NOT_FOUND';
      throw error;
    }
    createReadStream(target).on('error', error => {
      if (!res.headersSent) res.status(404).json({ error: 'arquivo de mídia não encontrado', code: 'MEDIA_NOT_FOUND' });
      else res.destroy(error);
    }).pipe(res);
    return;
  }

  if (!key.startsWith(GCS_STORAGE_PREFIX)) {
    const error = new Error('mídia não pertence ao armazenamento Commerce');
    error.code = 'MEDIA_NOT_FOUND';
    throw error;
  }
  const file = getBucket().file(key);
  const [exists] = await file.exists();
  if (!exists) {
    const error = new Error('arquivo de mídia não encontrado');
    error.code = 'MEDIA_NOT_FOUND';
    throw error;
  }
  file.createReadStream().on('error', error => {
    if (!res.headersSent) res.status(404).json({ error: 'arquivo de mídia não encontrado', code: 'MEDIA_NOT_FOUND' });
    else res.destroy(error);
  }).pipe(res);
}

export { MAX_IMAGE_BYTES };
