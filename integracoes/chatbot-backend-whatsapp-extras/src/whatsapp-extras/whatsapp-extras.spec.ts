import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { BaileysMediaStore } from './baileys-media-store';
import { WhatsappExtrasModule } from './whatsapp-extras.module';
import { normalizeNumber, sniffImage } from './whatsapp-extras.service';

const KEY = 'chave-de-teste-com-mais-de-20-caracteres';
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x10, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.alloc(16, 1)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16, 2)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16, 3)]);

class FakeMessageMedia {
  constructor(public mimetype: string, public data: string, public filename?: string) {}
}

function wwebjsClient(over: Record<string, any> = {}) {
  return {
    sendMessage: jest.fn(async () => ({ id: { _serialized: 'true_5565999990001@c.us_ABC' } })),
    getMessageById: jest.fn(async (id: string) => (id === 'MSG-AUDIO'
      ? { id: { _serialized: 'MSG-AUDIO' }, hasMedia: true, downloadMedia: async () => ({ mimetype: 'audio/ogg; codecs=opus', data: Buffer.from('ogg').toString('base64') }) }
      : null)),
    getChatById: jest.fn(async () => ({ fetchMessages: async () => [] })),
    setProfilePicture: jest.fn(async () => true),
    ...over,
  };
}

function baileysSocket() {
  return {
    ev: {},
    user: { id: '5565966604681:12@s.whatsapp.net' },
    sendMessage: jest.fn(async () => ({ key: { id: 'BAE5' } })),
    updateMediaMessage: jest.fn(),
    updateProfilePicture: jest.fn(async () => undefined),
  };
}

async function app(client: any, extra: Record<string, any> = {}) {
  const mod = await Test.createTestingModule({
    imports: [WhatsappExtrasModule.forRoot({
      apiKey: KEY,
      resolveClient: (name) => (name === 'dino' ? client : null),
      wwebjsMessageMedia: FakeMessageMedia as any,
      baileysDownload: async () => Buffer.from('imagem-jpeg'),
      ...extra,
    })],
  }).compile();
  const a = mod.createNestApplication();
  await a.init();
  return { app: a as INestApplication, store: mod.get(BaileysMediaStore) };
}

const auth = { 'x-api-key': KEY };

describe('utilitários', () => {
  test('normalizeNumber aceita DDD sem 55 e rejeita lixo', () => {
    expect(normalizeNumber('65999990001')).toBe('5565999990001');
    expect(normalizeNumber('5565999990001@c.us')).toBe('5565999990001');
    expect(normalizeNumber('123')).toBe('');
  });
  test('sniffImage reconhece WebP, PNG e JPEG', () => {
    expect(sniffImage(WEBP)).toBe('image/webp');
    expect(sniffImage(PNG)).toBe('image/png');
    expect(sniffImage(JPG)).toBe('image/jpeg');
    expect(sniffImage(Buffer.from('texto'))).toBe('');
  });
});

describe('autenticação', () => {
  test('sem chave → 401; Bearer e apikey também valem', async () => {
    const { app: a } = await app(wwebjsClient());
    const body = { instanceName: 'dino', chat_id: '5565999990001', sticker: { base64: WEBP.toString('base64') } };
    await request(a.getHttpServer()).post('/api/v1/whats-app/send-sticker').send(body).expect(401);
    await request(a.getHttpServer()).post('/api/v1/whats-app/send-sticker').set('x-api-key', 'errada-errada-errada-errada').send(body).expect(401);
    await request(a.getHttpServer()).post('/api/v1/whats-app/send-sticker').set('authorization', `Bearer ${KEY}`).send(body).expect(200);
    await request(a.getHttpServer()).post('/api/v1/whats-app/send-sticker').set('apikey', KEY).send(body).expect(200);
    await a.close();
  });
});

describe('POST /send-sticker', () => {
  test('whatsapp-web.js: envia como figurinha para @c.us', async () => {
    const client = wwebjsClient();
    const { app: a } = await app(client);
    const res = await request(a.getHttpServer()).post('/api/v1/whats-app/send-sticker').set(auth)
      .send({ instanceName: 'dino', chat_id: '5565999990001', sticker: { base64: WEBP.toString('base64'), mimetype: 'image/webp' } }).expect(200);
    expect(res.body).toEqual({ success: true, messageId: 'true_5565999990001@c.us_ABC' });
    const [chatId, media, opts] = client.sendMessage.mock.calls[0] as any[];
    expect(chatId).toBe('5565999990001@c.us');
    expect(media).toBeInstanceOf(FakeMessageMedia);
    expect(opts).toMatchObject({ sendMediaAsSticker: true, stickerName: 'T-Rex' });
    await a.close();
  });

  test('Baileys: envia { sticker: Buffer } para @s.whatsapp.net', async () => {
    const sock = baileysSocket();
    const { app: a } = await app(sock);
    await request(a.getHttpServer()).post('/api/v1/whats-app/send-sticker').set(auth)
      .send({ instanceName: 'dino', chat_id: '65999990001', sticker: { base64: WEBP.toString('base64') } }).expect(200);
    const [jid, content] = sock.sendMessage.mock.calls[0] as any[];
    expect(jid).toBe('5565999990001@s.whatsapp.net');
    expect(Buffer.isBuffer(content.sticker)).toBe(true);
    await a.close();
  });

  test('recusas: não-WebP 415, sem instância 400, instância errada 404, url de host estranho 400', async () => {
    const { app: a } = await app(wwebjsClient());
    const s = a.getHttpServer();
    await request(s).post('/api/v1/whats-app/send-sticker').set(auth).send({ instanceName: 'dino', chat_id: '5565999990001', sticker: { base64: PNG.toString('base64') } }).expect(415);
    await request(s).post('/api/v1/whats-app/send-sticker').set(auth).send({ chat_id: '5565999990001', sticker: { base64: WEBP.toString('base64') } }).expect(400);
    await request(s).post('/api/v1/whats-app/send-sticker').set(auth).send({ instanceName: 'isa', chat_id: '5565999990001', sticker: { base64: WEBP.toString('base64') } }).expect(404);
    await request(s).post('/api/v1/whats-app/send-sticker').set(auth).send({ instanceName: 'dino', chat_id: '5565999990001', sticker: { url: 'https://evil.example/x.webp' } }).expect(400);
    await request(s).post('/api/v1/whats-app/send-sticker').set(auth).send({ instanceName: 'dino', chat_id: 'abc', sticker: { base64: WEBP.toString('base64') } }).expect(400);
    await a.close();
  });

  test('instância sem sessão → 409', async () => {
    const { app: a } = await app(wwebjsClient(), { isConnected: () => false });
    await request(a.getHttpServer()).post('/api/v1/whats-app/send-sticker').set(auth)
      .send({ instanceName: 'dino', chat_id: '5565999990001', sticker: { base64: WEBP.toString('base64') } }).expect(409);
    await a.close();
  });
});

const OGG = Buffer.concat([Buffer.from('OggS'), Buffer.alloc(60, 4)]);

describe('POST /send-audio', () => {
  test('whatsapp-web.js: envia OGG como áudio gravado (sendAudioAsVoice)', async () => {
    const client = wwebjsClient();
    const { app: a } = await app(client);
    const res = await request(a.getHttpServer()).post('/api/v1/whats-app/send-audio').set(auth)
      .send({ instanceName: 'dino', chat_id: '5565999990001', audio: { base64: OGG.toString('base64'), mimetype: 'audio/ogg; codecs=opus' } }).expect(200);
    expect(res.body.success).toBe(true);
    const [chatId, media, opts] = client.sendMessage.mock.calls[0] as any[];
    expect(chatId).toBe('5565999990001@c.us');
    expect(media).toBeInstanceOf(FakeMessageMedia);
    expect((media as FakeMessageMedia).mimetype).toBe('audio/ogg; codecs=opus');
    expect(opts).toMatchObject({ sendAudioAsVoice: true });
    await a.close();
  });

  test('Baileys: envia { audio, mimetype, ptt: true } para @s.whatsapp.net', async () => {
    const sock = baileysSocket();
    const { app: a } = await app(sock);
    await request(a.getHttpServer()).post('/api/v1/whats-app/send-audio').set(auth)
      .send({ instanceName: 'dino', chat_id: '65999990001', audio: { base64: OGG.toString('base64') } }).expect(200);
    const [jid, content] = sock.sendMessage.mock.calls[0] as any[];
    expect(jid).toBe('5565999990001@s.whatsapp.net');
    expect(Buffer.isBuffer(content.audio)).toBe(true);
    expect(content).toMatchObject({ mimetype: 'audio/ogg; codecs=opus', ptt: true });
    await a.close();
  });

  test('recusas: formato estranho 415, vazio 400, sem chave 401', async () => {
    const { app: a } = await app(wwebjsClient());
    const s = a.getHttpServer();
    await request(s).post('/api/v1/whats-app/send-audio').set(auth).send({ instanceName: 'dino', chat_id: '5565999990001', audio: { base64: PNG.toString('base64') } }).expect(415);
    await request(s).post('/api/v1/whats-app/send-audio').set(auth).send({ instanceName: 'dino', chat_id: '5565999990001', audio: {} }).expect(400);
    await request(s).post('/api/v1/whats-app/send-audio').send({ instanceName: 'dino', chat_id: '5565999990001', audio: { base64: OGG.toString('base64') } }).expect(401);
    await a.close();
  });
});

describe('GET /messages/:id/media', () => {
  test('whatsapp-web.js: devolve base64 + mimetype, sem cache', async () => {
    const { app: a } = await app(wwebjsClient());
    const res = await request(a.getHttpServer()).get('/api/v1/whats-app/messages/MSG-AUDIO/media?instance=dino').set(auth).expect(200);
    expect(res.body).toEqual({ base64: Buffer.from('ogg').toString('base64'), mimetype: 'audio/ogg; codecs=opus' });
    expect(res.headers['cache-control']).toBe('no-store');
    await request(a.getHttpServer()).get('/api/v1/whats-app/messages/NAO-EXISTE/media?instance=dino').set(auth).expect(404);
    await a.close();
  });

  test('whatsapp-web.js sem getMessageById: procura no chat pelo chatId', async () => {
    const msg = { id: { _serialized: 'false_5565@c.us_X', id: 'X' }, hasMedia: true, downloadMedia: async () => ({ mimetype: 'image/jpeg', data: 'AAAA' }) };
    const client = wwebjsClient({ getMessageById: undefined, getChatById: jest.fn(async () => ({ fetchMessages: async () => [msg] })) });
    const { app: a } = await app(client);
    const res = await request(a.getHttpServer()).get('/api/v1/whats-app/messages/X/media?instance=dino&chatId=5565999990001').set(auth).expect(200);
    expect(res.body.mimetype).toBe('image/jpeg');
    await a.close();
  });

  test('vídeo/documento → 415', async () => {
    const client = wwebjsClient({ getMessageById: async () => ({ hasMedia: true, downloadMedia: async () => ({ mimetype: 'video/mp4', data: 'AAAA' }) }) });
    const { app: a } = await app(client);
    await request(a.getHttpServer()).get('/api/v1/whats-app/messages/V/media?instance=dino').set(auth).expect(415);
    await a.close();
  });

  test('Baileys: usa o BaileysMediaStore', async () => {
    const sock = baileysSocket();
    const { app: a, store } = await app(sock);
    await request(a.getHttpServer()).get('/api/v1/whats-app/messages/IMG1/media?instance=dino').set(auth).expect(404);
    store.rememberAll('dino', [
      { key: { id: 'IMG1', fromMe: false }, message: { imageMessage: { mimetype: 'image/jpeg' } } },
      { key: { id: 'TXT1', fromMe: false }, message: { conversation: 'oi' } as any },
    ]);
    expect(store.size).toBe(1);
    const res = await request(a.getHttpServer()).get('/api/v1/whats-app/messages/IMG1/media?instance=dino').set(auth).expect(200);
    expect(res.body).toEqual({ base64: Buffer.from('imagem-jpeg').toString('base64'), mimetype: 'image/jpeg' });
    await a.close();
  });
});

describe('POST /instances/:name/profile-picture', () => {
  test('whatsapp-web.js: setProfilePicture com PNG', async () => {
    const client = wwebjsClient();
    const { app: a } = await app(client);
    await request(a.getHttpServer()).post('/api/v1/whats-app/instances/dino/profile-picture').set(auth).send({ base64: PNG.toString('base64') }).expect(200, { success: true });
    expect((client.setProfilePicture.mock.calls[0] as any[])[0]).toMatchObject({ mimetype: 'image/png' });
    await a.close();
  });

  test('Baileys: updateProfilePicture no JID da própria linha', async () => {
    const sock = baileysSocket();
    const { app: a } = await app(sock);
    await request(a.getHttpServer()).post('/api/v1/whats-app/instances/dino/profile-picture').set(auth).send({ picture: { base64: JPG.toString('base64') } }).expect(200);
    expect((sock.updateProfilePicture.mock.calls[0] as any[])[0]).toBe('5565966604681@s.whatsapp.net');
    await a.close();
  });

  test('WebP como foto de perfil → 415', async () => {
    const { app: a } = await app(wwebjsClient());
    await request(a.getHttpServer()).post('/api/v1/whats-app/instances/dino/profile-picture').set(auth).send({ base64: WEBP.toString('base64') }).expect(415);
    await a.close();
  });
});

describe('BaileysMediaStore', () => {
  test('respeita limite de itens e ignora mensagens próprias', () => {
    const s = new BaileysMediaStore(2);
    s.remember('dino', { key: { id: 'A', fromMe: true }, message: { audioMessage: {} } });
    ['1', '2', '3'].forEach((id) => s.remember('dino', { key: { id }, message: { audioMessage: { mimetype: 'audio/ogg' } } }));
    expect(s.size).toBe(2);
    expect(s.get('dino', '1')).toBeUndefined();
    expect(s.get('dino', '3')).toBeDefined();
    expect(s.get('isa', '3')).toBeUndefined();
  });
});
