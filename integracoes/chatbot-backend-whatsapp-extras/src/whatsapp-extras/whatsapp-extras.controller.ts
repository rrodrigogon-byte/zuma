import { Body, Controller, Get, Header, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { WhatsappExtrasApiKeyGuard } from './api-key.guard';
import { MediaPayload, WhatsappExtrasService } from './whatsapp-extras.service';

/**
 * Rotas novas, no MESMO prefixo do /send (padrão do SetPoint: /api/v1/whats-app).
 * Se o app já usa app.setGlobalPrefix('api/v1'), troque o caminho abaixo por 'whats-app'.
 */
export const WHATSAPP_EXTRAS_ROUTE = 'api/v1/whats-app';

@Controller(WHATSAPP_EXTRAS_ROUTE)
@UseGuards(WhatsappExtrasApiKeyGuard)
export class WhatsappExtrasController {
  constructor(private readonly service: WhatsappExtrasService) {}

  /** Figurinha WebP (T-Rex). Corpo: { instanceName, chat_id, sticker: { base64 | url, mimetype } } */
  @Post('send-sticker')
  @HttpCode(200)
  sendSticker(@Body() body: { instanceName?: string; chat_id?: string; sticker?: MediaPayload }) {
    return this.service.sendSticker(body);
  }

  /** Áudio/foto recebidos do cliente. Resposta: { base64, mimetype } — nada é gravado nem logado. */
  @Get('messages/:id/media')
  @Header('Cache-Control', 'no-store')
  getMedia(@Param('id') id: string, @Query('instance') instance?: string, @Query('chatId') chatId?: string) {
    return this.service.getMedia(id, { instance, chatId });
  }

  /** Foto de perfil da linha. Corpo: { base64 | url } (JPEG ou PNG, 640x640 recomendado). */
  @Post('instances/:name/profile-picture')
  @HttpCode(200)
  setProfilePicture(@Param('name') name: string, @Body() body: { picture?: MediaPayload } & MediaPayload) {
    return this.service.setProfilePicture(name, body);
  }
}
