import assert from 'node:assert/strict';
import test from 'node:test';
import { detectCommerceImageMime, normalizeCommerceImage, uploadCommerceImage } from './commerce-media.js';

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

test('não tenta upload sem bucket seguro configurado', async () => {
  const previous = process.env.GCS_BUCKET;
  delete process.env.GCS_BUCKET;
  try {
    await assert.rejects(
      () => uploadCommerceImage({ empresaId: 'tenant', productId: 'product', mediaId: 'media', buffer: PNG_1X1, mimeType: 'image/png' }),
      error => error.code === 'MEDIA_STORAGE_NOT_CONFIGURED',
    );
  } finally {
    if (previous === undefined) delete process.env.GCS_BUCKET;
    else process.env.GCS_BUCKET = previous;
  }
});
