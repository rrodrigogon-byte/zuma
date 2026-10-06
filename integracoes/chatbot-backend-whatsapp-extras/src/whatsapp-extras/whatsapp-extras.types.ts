/**
 * Tipos estruturais dos dois clientes de WhatsApp que o chatbot-backend-nestjs pode usar.
 * Não importamos 'whatsapp-web.js' nem '@whiskeysockets/baileys' em tempo de tipo, para o
 * módulo compilar em qualquer um dos dois projetos.
 */

/** Cliente do whatsapp-web.js (só o que este módulo usa). */
export interface WwebjsClientLike {
  sendMessage(chatId: string, content: unknown, options?: Record<string, unknown>): Promise<{ id?: { _serialized?: string; id?: string } } | unknown>;
  getMessageById?(id: string): Promise<WwebjsMessageLike | null | undefined>;
  getChatById?(chatId: string): Promise<{ fetchMessages(o: { limit: number }): Promise<WwebjsMessageLike[]> }>;
  setProfilePicture?(media: unknown): Promise<boolean>;
  info?: { wid?: { _serialized?: string } } | null;
}

export interface WwebjsMessageLike {
  id?: { _serialized?: string; id?: string };
  hasMedia?: boolean;
  type?: string;
  downloadMedia(): Promise<{ mimetype?: string; data?: string } | undefined | null>;
}

/** Socket do Baileys (só o que este módulo usa). */
export interface BaileysSocketLike {
  ev: unknown;
  user?: { id?: string } | null;
  sendMessage(jid: string, content: Record<string, unknown>): Promise<{ key?: { id?: string } } | undefined>;
  updateMediaMessage?: (msg: unknown) => Promise<unknown>;
  updateProfilePicture?(jid: string, content: Buffer | { url: string }): Promise<void>;
}

export type WhatsappClient = WwebjsClientLike | BaileysSocketLike;

/** Mensagem do Baileys como chega em messages.upsert. */
export interface BaileysWAMessageLike {
  key?: { id?: string | null; remoteJid?: string | null; fromMe?: boolean | null };
  message?: {
    audioMessage?: { mimetype?: string | null } | null;
    imageMessage?: { mimetype?: string | null } | null;
    [k: string]: unknown;
  } | null;
}

export interface WhatsappExtrasOptions {
  /**
   * Devolve o cliente conectado da instância (ex.: 'dino'). Use a MESMA resolução que o /send já usa.
   * Backend de instância única: ignore o nome e devolva o cliente único.
   * Devolva null/undefined quando a instância não existir.
   */
  resolveClient(instanceName: string | undefined): WhatsappClient | null | undefined | Promise<WhatsappClient | null | undefined>;
  /** Diz se a instância está com sessão aberta. Opcional: sem ele, assume conectada se o cliente existir. */
  isConnected?(instanceName: string | undefined): boolean | Promise<boolean>;
  /**
   * Chave aceita pelas rotas (X-API-KEY, apikey ou Authorization: Bearer). Use a MESMA chave do /send.
   * Se o backend já tem um guard de API key, prefira aplicá-lo no controller e deixe isto vazio
   * com `useOwnGuard: false`.
   */
  apiKey?: string;
  /** Usa o ApiKeyGuard deste módulo. Padrão: true. */
  useOwnGuard?: boolean;
  /** Exige instanceName no corpo/rota (backend multi-instância). Padrão: true. */
  requireInstanceName?: boolean;
  /** Hosts aceitos quando a figurinha/foto vier por URL em vez de base64. Padrão: setpoint e dino.kytto. */
  allowedMediaHosts?: string[];
  /** Limite de mídia devolvida em GET /messages/:id/media. Padrão: 16 MB. */
  maxMediaBytes?: number;
  /** Função de download do Baileys (injete `downloadMediaMessage` de '@whiskeysockets/baileys'). */
  baileysDownload?: (msg: unknown, type: 'buffer', options: Record<string, unknown>, ctx: Record<string, unknown>) => Promise<Buffer>;
  /** Construtor MessageMedia do whatsapp-web.js (injete `MessageMedia` de 'whatsapp-web.js'). */
  wwebjsMessageMedia?: new (mimetype: string, data: string, filename?: string | null) => unknown;
}

export const WHATSAPP_EXTRAS_OPTIONS = Symbol('WHATSAPP_EXTRAS_OPTIONS');
