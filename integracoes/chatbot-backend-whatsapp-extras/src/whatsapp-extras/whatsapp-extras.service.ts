import { HttpException, HttpStatus, Inject, Injectable, Optional } from '@nestjs/common';
import { BaileysMediaStore } from './baileys-media-store';
import {
  BaileysSocketLike,
  WHATSAPP_EXTRAS_OPTIONS,
  WhatsappClient,
  WhatsappExtrasOptions,
  WwebjsClientLike,
  WwebjsMessageLike,
} from './whatsapp-extras.types';

const INSTANCE_RE = /^[a-z0-9][a-z0-9_-]{1,63}$/;
const DEFAULT_HOSTS = ['setpoint.kytto.com.br', 'dino.kytto.com.br'];
const MAX_STICKER_B64 = 700_000; // ~512 KB; as figurinhas do T-Rex têm < 30 KB
// Até ~2 MB de áudio (respostas curtas de voz).
const MAX_AUDIO_B64 = 2_800_000;
const MAX_PICTURE_B64 = 3_000_000; // ~2,2 MB

export interface MediaPayload { base64?: string; url?: string; mimetype?: string }

function fail(status: HttpStatus, error: string): never {
  throw new HttpException({ success: false, error }, status);
}

export function isWwebjs(client: WhatsappClient): client is WwebjsClientLike {
  return typeof (client as WwebjsClientLike).getChatById === 'function'
    || typeof (client as WwebjsClientLike).getMessageById === 'function';
}

export function isBaileys(client: WhatsappClient): client is BaileysSocketLike {
  return !isWwebjs(client) && typeof (client as BaileysSocketLike).sendMessage === 'function' && 'ev' in (client as object);
}

/** Normaliza para dígitos com DDI 55 (10–11 dígitos nacionais) ou outros DDI de 10–15 dígitos. */
export function normalizeNumber(raw: unknown): string {
  let digits = String(raw ?? '').split('@')[0].split(':')[0].replace(/\D/g, '');
  if (/^\d{10,11}$/.test(digits)) digits = `55${digits}`;
  return /^\d{12,15}$/.test(digits) ? digits : '';
}

function cleanBase64(value: string): string {
  const s = String(value || '').trim();
  const m = s.match(/^data:([^;,]+)?(?:;[^,]*)?,(.*)$/s);
  return (m ? m[2] : s).replace(/\s+/g, '');
}

function isBase64(s: string): boolean {
  return s.length > 0 && s.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(s);
}

/** Assinaturas: WebP = "RIFF....WEBP"; PNG = 89 50 4E 47; JPEG = FF D8 FF. */
export function sniffImage(buf: Buffer): 'image/webp' | 'image/png' | 'image/jpeg' | '' {
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  return '';
}

@Injectable()
export class WhatsappExtrasService {
  private readonly hosts: Set<string>;
  private readonly maxMediaBytes: number;

  constructor(
    @Inject(WHATSAPP_EXTRAS_OPTIONS) private readonly options: WhatsappExtrasOptions,
    @Optional() private readonly baileysStore?: BaileysMediaStore,
  ) {
    this.hosts = new Set((options.allowedMediaHosts?.length ? options.allowedMediaHosts : DEFAULT_HOSTS).map((h) => h.toLowerCase()));
    this.maxMediaBytes = options.maxMediaBytes ?? 16 * 1024 * 1024;
  }

  // ---------- comum ----------

  async client(instanceName?: string): Promise<WhatsappClient> {
    const name = instanceName ? String(instanceName).trim().toLowerCase() : undefined;
    if (name !== undefined && !INSTANCE_RE.test(name)) fail(HttpStatus.BAD_REQUEST, 'instanceName inválido');
    if ((this.options.requireInstanceName ?? true) && !name) fail(HttpStatus.BAD_REQUEST, 'instanceName obrigatório');
    const client = await this.options.resolveClient(name);
    if (!client) fail(HttpStatus.NOT_FOUND, 'instância não encontrada');
    if (this.options.isConnected && !(await this.options.isConnected(name))) fail(HttpStatus.CONFLICT, 'instância sem sessão aberta');
    return client;
  }

  /** Aceita base64 (preferido) ou URL https de host permitido; devolve os bytes e o mimetype detectado. */
  async loadImage(payload: MediaPayload | undefined, maxB64: number): Promise<{ buffer: Buffer; mimetype: string }> {
    if (!payload || (!payload.base64 && !payload.url)) fail(HttpStatus.BAD_REQUEST, 'mídia vazia');
    let buffer: Buffer;
    if (payload.base64) {
      const b64 = cleanBase64(payload.base64);
      if (b64.length > maxB64) fail(HttpStatus.PAYLOAD_TOO_LARGE, 'mídia acima do limite');
      if (!isBase64(b64)) fail(HttpStatus.BAD_REQUEST, 'base64 inválido');
      buffer = Buffer.from(b64, 'base64');
    } else {
      let url: URL;
      try { url = new URL(String(payload.url)); } catch { fail(HttpStatus.BAD_REQUEST, 'url inválida'); }
      if (url.protocol !== 'https:' || !this.hosts.has(url.hostname.toLowerCase())) fail(HttpStatus.BAD_REQUEST, 'host da url não permitido');
      const res = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15_000) }).catch(() => null);
      if (!res || !res.ok) fail(HttpStatus.BAD_GATEWAY, 'não foi possível baixar a mídia');
      const declared = Number(res.headers.get('content-length') || 0);
      if (declared > (maxB64 * 3) / 4) fail(HttpStatus.PAYLOAD_TOO_LARGE, 'mídia acima do limite');
      buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length > (maxB64 * 3) / 4) fail(HttpStatus.PAYLOAD_TOO_LARGE, 'mídia acima do limite');
    }
    const mimetype = sniffImage(buffer);
    if (!mimetype) fail(HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'formato não suportado');
    return { buffer, mimetype };
  }

  private messageMedia(mimetype: string, base64: string, filename: string): unknown {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Ctor = this.options.wwebjsMessageMedia ?? require('whatsapp-web.js').MessageMedia;
    return new Ctor(mimetype, base64, filename);
  }

  // ---------- POST /send-sticker ----------

  async sendSticker(body: { instanceName?: string; chat_id?: string; sticker?: MediaPayload }) {
    const number = normalizeNumber(body?.chat_id);
    if (!number) fail(HttpStatus.BAD_REQUEST, 'chat_id inválido');
    const { buffer, mimetype } = await this.loadImage(body?.sticker, MAX_STICKER_B64);
    if (mimetype !== 'image/webp') fail(HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'figurinha precisa ser WebP');
    const client = await this.client(body?.instanceName);

    if (isWwebjs(client)) {
      const media = this.messageMedia('image/webp', buffer.toString('base64'), 'figurinha.webp');
      const sent: any = await client.sendMessage(`${number}@c.us`, media, {
        sendMediaAsSticker: true,
        stickerName: 'T-Rex',
        stickerAuthor: 'Dino Barbearia',
      });
      return { success: true, messageId: sent?.id?._serialized ?? sent?.id?.id ?? null };
    }
    if (isBaileys(client)) {
      const sent = await client.sendMessage(`${number}@s.whatsapp.net`, { sticker: buffer });
      return { success: true, messageId: sent?.key?.id ?? null };
    }
    return fail(HttpStatus.NOT_IMPLEMENTED, 'cliente de WhatsApp não reconhecido');
  }

  // ---------- POST /send-audio ----------

  /** Voz do T-Rex: OGG/Opus (Google Text-to-Speech) enviado como áudio gravado (PTT). */
  async sendAudio(body: { instanceName?: string; chat_id?: string; audio?: MediaPayload }) {
    const number = normalizeNumber(body?.chat_id);
    if (!number) fail(HttpStatus.BAD_REQUEST, 'chat_id inválido');
    const b64 = cleanBase64(body?.audio?.base64 || '');
    if (!b64) fail(HttpStatus.BAD_REQUEST, 'áudio vazio');
    if (b64.length > MAX_AUDIO_B64) fail(HttpStatus.PAYLOAD_TOO_LARGE, 'áudio acima do limite');
    if (!isBase64(b64)) fail(HttpStatus.BAD_REQUEST, 'base64 inválido');
    const buffer = Buffer.from(b64, 'base64');
    // OGG começa com "OggS"; MP3 com "ID3" ou 0xFFEx. Só esses dois formatos.
    const ogg = buffer.subarray(0, 4).toString('latin1') === 'OggS';
    const mp3 = buffer.subarray(0, 3).toString('latin1') === 'ID3' || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
    if (!ogg && !mp3) fail(HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'áudio precisa ser OGG/Opus ou MP3');
    const mimetype = ogg ? 'audio/ogg; codecs=opus' : 'audio/mpeg';
    const client = await this.client(body?.instanceName);

    if (isWwebjs(client)) {
      const media = this.messageMedia(mimetype, b64, ogg ? 'resposta.ogg' : 'resposta.mp3');
      const sent: any = await client.sendMessage(`${number}@c.us`, media, { sendAudioAsVoice: true });
      return { success: true, messageId: sent?.id?._serialized ?? sent?.id?.id ?? null };
    }
    if (isBaileys(client)) {
      const sent = await client.sendMessage(`${number}@s.whatsapp.net`, { audio: buffer, mimetype, ptt: ogg });
      return { success: true, messageId: sent?.key?.id ?? null };
    }
    return fail(HttpStatus.NOT_IMPLEMENTED, 'cliente de WhatsApp não reconhecido');
  }

  // ---------- GET /messages/:id/media ----------

  async getMedia(id: string, query: { instance?: string; chatId?: string }) {
    const messageId = String(id || '').trim();
    if (!messageId || messageId.length > 300) fail(HttpStatus.BAD_REQUEST, 'id inválido');
    const client = await this.client(query?.instance);

    let base64 = '';
    let mimetype = '';
    if (isWwebjs(client)) {
      const msg = await this.findWwebjsMessage(client, messageId, query?.chatId);
      if (!msg || msg.hasMedia === false) fail(HttpStatus.NOT_FOUND, 'not found');
      const media = await msg.downloadMedia().catch(() => null);
      if (!media?.data) fail(HttpStatus.NOT_FOUND, 'not found');
      base64 = media.data;
      mimetype = media.mimetype || '';
    } else if (isBaileys(client)) {
      const msg = this.baileysStore?.get(query?.instance, messageId);
      if (!msg?.message) fail(HttpStatus.NOT_FOUND, 'not found');
      mimetype = msg.message.audioMessage?.mimetype || msg.message.imageMessage?.mimetype || '';
      if (!/^(audio|image)\//.test(mimetype)) fail(HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'unsupported');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const download = this.options.baileysDownload ?? require('@whiskeysockets/baileys').downloadMediaMessage;
      const buffer: Buffer = await download(msg, 'buffer', {}, { reuploadRequest: client.updateMediaMessage }).catch(() => null);
      if (!buffer?.length) fail(HttpStatus.NOT_FOUND, 'not found');
      base64 = Buffer.from(buffer).toString('base64');
    } else {
      fail(HttpStatus.NOT_IMPLEMENTED, 'cliente de WhatsApp não reconhecido');
    }

    if (!/^(audio|image)\//.test(mimetype)) fail(HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'unsupported');
    if (Math.floor((base64.length * 3) / 4) > this.maxMediaBytes) fail(HttpStatus.PAYLOAD_TOO_LARGE, 'mídia acima do limite');
    return { base64, mimetype };
  }

  private async findWwebjsMessage(client: WwebjsClientLike, id: string, chatId?: string): Promise<WwebjsMessageLike | null> {
    if (client.getMessageById) {
      const direct = await client.getMessageById(id).catch(() => null);
      if (direct) return direct;
    }
    const number = normalizeNumber(chatId);
    if (!number || !client.getChatById) return null;
    const chat = await client.getChatById(`${number}@c.us`).catch(() => null);
    if (!chat) return null;
    const recent = await chat.fetchMessages({ limit: 50 }).catch(() => [] as WwebjsMessageLike[]);
    return recent.find((m) => m.id?._serialized === id || m.id?.id === id) ?? null;
  }

  // ---------- POST /instances/:name/profile-picture ----------

  async setProfilePicture(instanceName: string, body: { picture?: MediaPayload } & MediaPayload) {
    const payload = body?.picture ?? body;
    const { buffer, mimetype } = await this.loadImage(payload, MAX_PICTURE_B64);
    if (mimetype !== 'image/jpeg' && mimetype !== 'image/png') fail(HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'foto precisa ser JPEG ou PNG');
    const client = await this.client(instanceName);

    if (isWwebjs(client)) {
      if (!client.setProfilePicture) fail(HttpStatus.NOT_IMPLEMENTED, 'whatsapp-web.js sem setProfilePicture (atualize para ≥ 1.21)');
      const ok = await client.setProfilePicture(this.messageMedia(mimetype, buffer.toString('base64'), 'perfil'));
      if (ok === false) fail(HttpStatus.BAD_GATEWAY, 'WhatsApp recusou a foto');
      return { success: true };
    }
    if (isBaileys(client)) {
      if (!client.updateProfilePicture || !client.user?.id) fail(HttpStatus.NOT_IMPLEMENTED, 'socket sem updateProfilePicture');
      const jid = `${String(client.user.id).split(':')[0].split('@')[0]}@s.whatsapp.net`;
      await client.updateProfilePicture(jid, buffer);
      return { success: true };
    }
    return fail(HttpStatus.NOT_IMPLEMENTED, 'cliente de WhatsApp não reconhecido');
  }
}
