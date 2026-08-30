import crypto from 'node:crypto';
import { Storage } from '@google-cloud/storage';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MIME_EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

let bucketCache = null;

function getBucketName() {
  return String(process.env.GCS_BUCKET || '').trim();
}

function getBucket() {
  const bucketName = getBucketName();
  if (!bucketName) {
    const error = new Error('armazenamento de imagens não configurado no ambiente seguro');
    error.code = 'MEDIA_STORAGE_NOT_CONFIGURED';
    throw error;
  }
  if (!bucketCache || bucketCache.name !== bucketName) bucketCache = new Storage().bucket(bucketName);
  return bucketCache;
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
  const key = `commerce-media/${String(empresaId)}/${String(productId)}/${String(mediaId)}.${normalized.extension}`;
  const bucket = getBucket();
  await bucket.file(key).save(buffer, {
    resumable: false,
    validation: 'md5',
    metadata: {
      contentType: normalized.mimeType,
      cacheControl: 'public,max-age=3600',
    },
  });
  return { storageKey: key, mimeType: normalized.mimeType, size: normalized.size };
}

export function newCommerceMediaId() {
  return crypto.randomUUID();
}

export async function streamCommerceImage({ storageKey, mimeType, res }) {
  const key = String(storageKey || '').trim();
  if (!key.startsWith('commerce-media/')) {
    const error = new Error('mídia não pertence ao armazenamento Commerce');
    error.code = 'MEDIA_NOT_FOUND';
    throw error;
  }
  const bucket = getBucket();
  const file = bucket.file(key);
  const [exists] = await file.exists();
  if (!exists) {
    const error = new Error('arquivo de mídia não encontrado');
    error.code = 'MEDIA_NOT_FOUND';
    throw error;
  }
  res.setHeader('Content-Type', MIME_EXTENSIONS[String(mimeType || '').toLowerCase()] ? String(mimeType).toLowerCase() : 'application/octet-stream');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  file.createReadStream().on('error', error => {
    if (!res.headersSent) res.status(404).json({ error: 'arquivo de mídia não encontrado', code: 'MEDIA_NOT_FOUND' });
    else res.destroy(error);
  }).pipe(res);
}

export { MAX_IMAGE_BYTES };
