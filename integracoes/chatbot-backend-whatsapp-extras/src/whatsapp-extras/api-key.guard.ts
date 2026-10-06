import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { WHATSAPP_EXTRAS_OPTIONS, WhatsappExtrasOptions } from './whatsapp-extras.types';

/** Mesma autenticação do /send: X-API-KEY, apikey ou Authorization: Bearer <chave>. */
@Injectable()
export class WhatsappExtrasApiKeyGuard implements CanActivate {
  constructor(@Inject(WHATSAPP_EXTRAS_OPTIONS) private readonly options: WhatsappExtrasOptions) {}

  canActivate(ctx: ExecutionContext): boolean {
    if (this.options.useOwnGuard === false) return true;
    const expected = String(this.options.apiKey || '');
    if (expected.length < 20) throw new UnauthorizedException({ success: false, error: 'chave do backend não configurada' });
    const req = ctx.switchToHttp().getRequest();
    const h = req.headers || {};
    const bearer = String(h.authorization || '').replace(/^Bearer\s+/i, '');
    const candidates = [h['x-api-key'], h.apikey, bearer].map((v) => String(v || '')).filter(Boolean);
    const ok = candidates.some((given) => {
      const a = Buffer.from(given);
      const b = Buffer.from(expected);
      return a.length === b.length && timingSafeEqual(a, b);
    });
    if (!ok) throw new UnauthorizedException({ success: false, error: 'não autorizado' });
    return true;
  }
}
