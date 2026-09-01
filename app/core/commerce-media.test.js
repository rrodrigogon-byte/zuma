import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import { finished } from 'node:stream/promises';
import test from 'node:test';
import { commerceMediaIdForIdempotencyKey, detectCommerceImageMime, normalizeCommerceImage, streamCommerceImage, uploadCommerceImage } from './commerce-media.js';

const PNG_1X1 = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360f8cf00000003000100c18db3b10000000049454e44ae426082', 'hex');
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);


test('detecta assinaturas de imagem suportadas sem confiar no MIME do cliente', () => {
  assert.equal(detectCommerceImageMime(PNG_1X1), 'image/png');
  assert.equal(detectCommerceImageMime(JPEG_HEADER), 'image/jpeg');
  assert.equal(detectCommerceImageMime(Buffer.from('not-an-image')), null);
});

test('normaliza imagem e rejeita MIME declarado incompatível', () => {
  assert.deepEqual(normalizeCommerceImage(PNG_1X1, 'image/png'), { mimeType: 'image/png', extension: 'png', size: PNG_1X1.length });
  assert.throws(() => normalizeCommerceImage(PNG_1X1, 'image/jpeg'), error => error.code === 'MEDIA_IMAGE_INVALID');
  assert.throws(() => normalizeCommerceImage(Buffer.alloc(0), 'image/png'), error => error.code === 'MEDIA_UPLOAD_EMPTY');
});

test('gera ID de mídia determinístico e segregado por tenant e produto', () => {
  const base = { empresaId: '11111111-1111-4111-8111-111111111111', productId: '22222222-2222-4222-8222-222222222222', idempotencyKey: 'enrichment-manifest-sku-sha' };
  const first = commerceMediaIdForIdempotencyKey(base);
  const replay = commerceMediaIdForIdempotencyKey(base);
  assert.equal(first, replay);
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(first, commerceMediaIdForIdempotencyKey({ ...base, empresaId: '33333333-3333-4333-8333-333333333333' }));
  assert.notEqual(first, commerceMediaIdForIdempotencyKey({ ...base, productId: '44444444-4444-4444-8444-444444444444' }));
});

test('rejeita idempotência de mídia sem escopo completo ou acima do limite', () => {
  assert.throws(() => commerceMediaIdForIdempotencyKey({ empresaId: 'tenant', productId: 'product', idempotencyKey: '' }), error => error.code === 'MEDIA_IDEMPOTENCY_REQUIRED');
  assert.throws(() => commerceMediaIdForIdempotencyKey({ empresaId: 'tenant', productId: 'product', idempotencyKey: 'x'.repeat(201) }), error => error.code === 'MEDIA_IDEMPOTENCY_INVALID');
});

test('grava imagem validada no diretório persistente tenant-scoped quando não há bucket', async () => {
  const previousBucket = process.env.GCS_BUCKET;
  const previousDir = process.env.COMMERCE_MEDIA_DIR;
  const root = await mkdtemp(path.join(os.tmpdir(), 'commerce-media-'));
  delete process.env.GCS_BUCKET;
  process.env.COMMERCE_MEDIA_DIR = root;
  try {
    const result = await uploadCommerceImage({ empresaId: 'tenant-a', productId: 'product-b', mediaId: 'media-c', buffer: PNG_1X1, mimeType: 'image/png' });
    assert.equal(result.storageProvider, 'local');
    assert.equal(result.storageKey, 'commerce-local/tenant-a/product-b/media-c.png');
    assert.deepEqual(await readFile(path.join(root, 'tenant-a', 'product-b', 'media-c.png')), PNG_1X1);
    const chunks = [];
    const headers = {};
    const response = new Writable({ write(chunk, encoding, callback) { chunks.push(Buffer.from(chunk)); callback(); } });
    response.setHeader = (name, value) => { headers[name] = value; };
    await streamCommerceImage({ storageKey: result.storageKey, mimeType: result.mimeType, res: response });
    await finished(response);
    assert.deepEqual(Buffer.concat(chunks), PNG_1X1);
    assert.equal(headers['Content-Type'], 'image/png');
    assert.equal(headers['Cache-Control'], 'public, max-age=3600');
  } finally {
    await rm(root, { recursive: true, force: true });
    if (previousBucket === undefined) delete process.env.GCS_BUCKET;
    else process.env.GCS_BUCKET = previousBucket;
    if (previousDir === undefined) delete process.env.COMMERCE_MEDIA_DIR;
    else process.env.COMMERCE_MEDIA_DIR = previousDir;
  }
});

test('não tenta upload sem armazenamento seguro configurado', async () => {
  const previousBucket = process.env.GCS_BUCKET;
  const previousDir = process.env.COMMERCE_MEDIA_DIR;
  const previousDbPath = process.env.DB_PATH;
  delete process.env.GCS_BUCKET;
  delete process.env.COMMERCE_MEDIA_DIR;
  delete process.env.DB_PATH;
  try {
    await assert.rejects(
      () => uploadCommerceImage({ empresaId: 'tenant', productId: 'product', mediaId: 'media', buffer: PNG_1X1, mimeType: 'image/png' }),
      error => error.code === 'MEDIA_STORAGE_NOT_CONFIGURED',
    );
  } finally {
    if (previousBucket === undefined) delete process.env.GCS_BUCKET;
    else process.env.GCS_BUCKET = previousBucket;
    if (previousDir === undefined) delete process.env.COMMERCE_MEDIA_DIR;
    else process.env.COMMERCE_MEDIA_DIR = previousDir;
    if (previousDbPath === undefined) delete process.env.DB_PATH;
    else process.env.DB_PATH = previousDbPath;
  }
});
