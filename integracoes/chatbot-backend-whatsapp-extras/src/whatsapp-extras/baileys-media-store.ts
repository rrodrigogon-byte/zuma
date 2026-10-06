import { BaileysWAMessageLike } from './whatsapp-extras.types';

/**
 * Guarda em memória as mensagens de ÁUDIO e IMAGEM recebidas pelo Baileys, para que
 * GET /messages/:id/media consiga baixar a mídia depois (o Baileys não tem getMessageById).
 * - Só a mensagem (chaves de mídia), nunca os bytes; nada vai para disco nem para log.
 * - Limite por quantidade e por idade (padrão: 2.000 mensagens, 24 h).
 *
 * Ligação (uma vez por socket, no mesmo lugar onde o backend já trata messages.upsert):
 *   sock.ev.on('messages.upsert', ({ messages }) => store.rememberAll(instanceName, messages));
 */
export class BaileysMediaStore {
  private readonly items = new Map<string, { msg: BaileysWAMessageLike; at: number }>();

  constructor(private readonly maxItems = 2000, private readonly maxAgeMs = 24 * 60 * 60 * 1000) {}

  private key(instance: string | undefined, id: string) {
    return `${instance || '_'}::${id}`;
  }

  remember(instance: string | undefined, msg: BaileysWAMessageLike): void {
    const id = msg?.key?.id;
    if (!id || msg.key?.fromMe) return;
    if (!msg.message?.audioMessage && !msg.message?.imageMessage) return;
    const k = this.key(instance, id);
    this.items.delete(k);
    this.items.set(k, { msg, at: Date.now() });
    while (this.items.size > this.maxItems) {
      const oldest = this.items.keys().next().value as string;
      this.items.delete(oldest);
    }
  }

  rememberAll(instance: string | undefined, msgs: BaileysWAMessageLike[] = []): void {
    for (const m of msgs) this.remember(instance, m);
  }

  get(instance: string | undefined, id: string): BaileysWAMessageLike | undefined {
    const k = this.key(instance, id);
    const hit = this.items.get(k);
    if (!hit) return undefined;
    if (Date.now() - hit.at > this.maxAgeMs) {
      this.items.delete(k);
      return undefined;
    }
    return hit.msg;
  }

  get size(): number {
    return this.items.size;
  }
}
