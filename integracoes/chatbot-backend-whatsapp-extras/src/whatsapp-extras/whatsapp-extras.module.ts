import { DynamicModule, Module } from '@nestjs/common';
import { WhatsappExtrasApiKeyGuard } from './api-key.guard';
import { BaileysMediaStore } from './baileys-media-store';
import { WhatsappExtrasController } from './whatsapp-extras.controller';
import { WhatsappExtrasService } from './whatsapp-extras.service';
import { WHATSAPP_EXTRAS_OPTIONS, WhatsappExtrasOptions } from './whatsapp-extras.types';

/**
 * Uso (no AppModule ou no módulo de WhatsApp existente):
 *
 *   WhatsappExtrasModule.forRootAsync({
 *     imports: [WhatsAppModule],
 *     inject: [WhatsAppService],
 *     useFactory: (wa: WhatsAppService) => ({
 *       apiKey: process.env.API_KEY,                       // a mesma do /send
 *       resolveClient: (name) => wa.getClient(name),       // o mesmo que o /send usa
 *       isConnected: (name) => wa.isAuthenticated(name),   // opcional
 *     }),
 *   })
 *
 * Baileys: injete BaileysMediaStore no serviço que trata messages.upsert e chame
 *   store.rememberAll(instanceName, messages)
 */
@Module({})
export class WhatsappExtrasModule {
  static forRoot(options: WhatsappExtrasOptions): DynamicModule {
    return {
      module: WhatsappExtrasModule,
      controllers: [WhatsappExtrasController],
      providers: [
        { provide: WHATSAPP_EXTRAS_OPTIONS, useValue: options },
        BaileysMediaStore,
        WhatsappExtrasService,
        WhatsappExtrasApiKeyGuard,
      ],
      exports: [BaileysMediaStore, WhatsappExtrasService],
    };
  }

  static forRootAsync(cfg: { imports?: any[]; inject?: any[]; useFactory: (...args: any[]) => WhatsappExtrasOptions | Promise<WhatsappExtrasOptions> }): DynamicModule {
    return {
      module: WhatsappExtrasModule,
      imports: cfg.imports ?? [],
      controllers: [WhatsappExtrasController],
      providers: [
        { provide: WHATSAPP_EXTRAS_OPTIONS, useFactory: cfg.useFactory, inject: cfg.inject ?? [] },
        BaileysMediaStore,
        WhatsappExtrasService,
        WhatsappExtrasApiKeyGuard,
      ],
      exports: [BaileysMediaStore, WhatsappExtrasService],
    };
  }
}
