// ============================================================================
// ROTAS DE GESTÃO E WEBHOOK DO WHATSAPP BUSINESS CLOUD API (META OFICIAL)
// ============================================================================

import { db, save } from './db.js';
import {
  getCloudApiConfig,
  getCloudApiPhoneNumberInfo,
  listCloudApiTemplates,
  sendCloudApiTextMessage,
  sendCloudApiInteractiveButtons,
  verifyMetaWebhookChallenge,
  parseMetaWebhookEvent,
  parseCloudApiMessage,
} from './core/whatsapp-cloud-api.js';
import crypto from 'node:crypto';
import { db as pgDb } from './core/database.js';

function store() {
  const state = db();
  state.whatsappCloudApi ||= { empresas: {} };
  return state.whatsappCloudApi.empresas;
}

export function registerWhatsappCloudRoutes(app, { isPlatformAdmin = () => false } = {}) {
  // 1. Consulta de status da conexão oficial Meta
  app.get('/api/admin/whatsapp-cloud/status', async (req, res) => {
    const empresaId = String(req.query?.empresaId || req.user?.empresa_id || req.user?.empresaId || '').trim();
    if (!empresaId) return res.status(400).json({ ok: false, error: 'empresaId obrigatório' });
    const empresas = store();
    const configSalva = empresas[empresaId] || {};
    const config = getCloudApiConfig(configSalva);

    if (!config.token || !config.phoneNumberId) {
      return res.json({
        ok: true,
        conectado: false,
        status: 'nao_configurado',
        provedor: 'meta_cloud_api',
        mensagem: 'Credenciais da Meta Cloud API não configuradas para esta empresa.',
        config: {
          hasToken: Boolean(config.token),
          phoneNumberId: config.phoneNumberId || '',
          wabaId: config.wabaId || '',
          webhookUrl: `${req.protocol}://${req.get('host')}/api/webhooks/whatsapp-cloud`,
          verifyToken: config.verifyToken,
        },
      });
    }

    // Consulta à Meta para verificar se a linha está ativa e de boa qualidade
    const info = await getCloudApiPhoneNumberInfo({
      phoneNumberId: config.phoneNumberId,
      token: config.token,
    });

    if (!info.ok) {
      return res.json({
        ok: true,
        conectado: false,
        status: 'erro_autenticacao',
        provedor: 'meta_cloud_api',
        erro: info.error,
        config: {
          hasToken: true,
          phoneNumberId: config.phoneNumberId,
          wabaId: config.wabaId,
          webhookUrl: `${req.protocol}://${req.get('host')}/api/webhooks/whatsapp-cloud`,
          verifyToken: config.verifyToken,
        },
      });
    }

    const data = info.data || {};
    return res.json({
      ok: true,
      conectado: true,
      status: 'ativo_oficial',
      provedor: 'meta_cloud_api',
      detalhes: {
        verifiedName: data.verified_name || 'Nome verificado na Meta',
        displayPhoneNumber: data.display_phone_number || '',
        qualityRating: data.quality_rating || 'GREEN',
        codeVerificationStatus: data.code_verification_status || 'VERIFIED',
      },
      config: {
        hasToken: true,
        phoneNumberId: config.phoneNumberId,
        wabaId: config.wabaId,
        webhookUrl: `${req.protocol}://${req.get('host')}/api/webhooks/whatsapp-cloud`,
        verifyToken: config.verifyToken,
      },
    });
  });

  // 2. Salvar credenciais oficiais da Meta para a empresa
  app.post('/api/admin/whatsapp-cloud/config', async (req, res) => {
    const empresaId = String(req.body?.empresaId || req.user?.empresa_id || req.user?.empresaId || '').trim();
    if (!empresaId) return res.status(400).json({ ok: false, error: 'empresaId obrigatório' });
    const { token, phoneNumberId, wabaId, verifyToken, ativo } = req.body || {};

    const empresas = store();
    empresas[empresaId] ||= {};

    if (token) empresas[empresaId].meta_access_token = String(token).trim();
    if (phoneNumberId) empresas[empresaId].meta_phone_number_id = String(phoneNumberId).trim();
    if (wabaId) empresas[empresaId].meta_waba_id = String(wabaId).trim();
    if (verifyToken) empresas[empresaId].meta_verify_token = String(verifyToken).trim();
    if (ativo !== undefined) empresas[empresaId].ativo = Boolean(ativo);
    empresas[empresaId].atualizadoEm = new Date().toISOString();

    save();

    res.json({
      ok: true,
      mensagem: 'Configurações oficiais da Meta Cloud API salvas com sucesso.',
      empresaId,
    });
  });

  // 3. Listar templates aprovados na WABA
  app.get('/api/admin/whatsapp-cloud/templates', async (req, res) => {
    const empresaId = String(req.query?.empresaId || req.user?.empresa_id || req.user?.empresaId || '').trim();
    if (!empresaId) return res.status(400).json({ ok: false, error: 'empresaId obrigatório' });
    const empresas = store();
    const config = getCloudApiConfig(empresas[empresaId] || {});

    if (!config.token || !config.wabaId) {
      return res.status(400).json({
        ok: false,
        error: 'WABA ID ou Token da Meta não configurados para consultar templates.',
      });
    }

    const result = await listCloudApiTemplates({
      wabaId: config.wabaId,
      token: config.token,
    });

    if (!result.ok) {
      return res.status(result.status || 500).json(result);
    }

    res.json({
      ok: true,
      templates: result.data?.data || [],
    });
  });

  // 4. Envio de mensagem de teste oficial
  app.post('/api/admin/whatsapp-cloud/teste', async (req, res) => {
    const empresaId = String(req.body?.empresaId || req.user?.empresa_id || req.user?.empresaId || '').trim();
    if (!empresaId) return res.status(400).json({ ok: false, error: 'empresaId obrigatório' });
    const { telefone, mensagem, comBotoes } = req.body || {};

    if (!telefone) {
      return res.status(400).json({ ok: false, error: 'Telefone para teste é obrigatório.' });
    }

    const empresas = store();
    const config = getCloudApiConfig(empresas[empresaId] || {});

    if (!config.token || !config.phoneNumberId) {
      return res.status(400).json({
        ok: false,
        error: 'Configure o Token e Phone Number ID da Meta antes de testar.',
      });
    }

    let result;
    if (comBotoes) {
      result = await sendCloudApiInteractiveButtons({
        phoneNumberId: config.phoneNumberId,
        token: config.token,
        to: telefone,
        bodyText: mensagem || 'Mensagem de teste interativa da Meta Cloud API.',
        buttons: [
          { id: 'btn_confirmar', title: 'CONFIRMAR' },
          { id: 'btn_remarcar', title: 'REMARCAR' },
          { id: 'btn_ajuda', title: 'FALAR COM HUMANO' },
        ],
        headerText: 'Kytto • WhatsApp Oficial',
        footerText: 'Toque para responder instantaneamente',
      });
    } else {
      result = await sendCloudApiTextMessage({
        phoneNumberId: config.phoneNumberId,
        token: config.token,
        to: telefone,
        text: mensagem || 'Teste de envio da Meta WhatsApp Business Cloud API Oficial via Kytto.',
      });
    }

    if (!result.ok) {
      return res.status(result.status || 500).json(result);
    }

    res.json({
      ok: true,
      mensagem: 'Mensagem oficial enviada com sucesso!',
      messageId: result.messageId,
      recipient: result.recipient,
    });
  });

  // 5. Webhook GET: Handshake de validação da Meta
  app.get('/api/webhooks/whatsapp-cloud', (req, res) => {
    const expectedToken = process.env.META_WEBHOOK_VERIFY_TOKEN || 'kytto_meta_webhook_2026';
    const check = verifyMetaWebhookChallenge(req.query, expectedToken);

    if (check.verified) {
      return res.status(200).type('text/plain').send(check.challenge);
    }
    return res.status(403).send('Forbidden: Token de verificação inválido.');
  });

  // 6. Webhook POST: Eventos de mensagens e status recebidos da Meta
  app.post('/api/webhooks/whatsapp-cloud', async (req, res) => {
    // A Meta exige resposta 200 rápida para não reenviar eventos
    res.status(200).send('EVENT_RECEIVED');

    try {
      const parsed = parseMetaWebhookEvent(req.body);
      if (!parsed || !Array.isArray(parsed.messages) || !parsed.messages.length) return;

      // Buscar canal de integração do WhatsApp ativo
      let channel = null;
      if (process.env.DATABASE_URL || process.env.POSTGRES_URL) {
        try {
          const channelResult = await pgDb.query(
            `SELECT * FROM canais_integracao
              WHERE provedor = 'whatsapp' AND status = 'ativo'
              ORDER BY configuracao->>'meta_access_token' IS NOT NULL DESC, id LIMIT 1`
          );
          channel = channelResult.rows[0];
        } catch {
          channel = null;
        }
      }

      for (const msg of parsed.messages) {
        console.log(`[META_CLOUD_API] Mensagem recebida de ${msg.from} (${msg.senderName}): "${msg.text}" ${msg.buttonId ? `[Botão: ${msg.buttonId}]` : ''}`);

        if (!channel) continue;

        const parsedMsg = parseCloudApiMessage(msg);
        if (parsedMsg.ignored) continue;

        const hash = crypto.createHash('sha256').update(`${parsedMsg.externalId}|${parsedMsg.text}`).digest('hex');

        try {
          const { ingestInboundWhatsappMessage } = await import('./core/whatsapp-ai-routes.js');
          const resultado = await ingestInboundWhatsappMessage(channel, parsedMsg, { hash, providerPayload: req.body });
          if (!resultado?.duplicate && !resultado?.ignored) {
            const { wakeWhatsappAiWorker } = await import('./core/whatsapp-ai-wake.js');
            wakeWhatsappAiWorker?.();
          }
        } catch (ingestErr) {
          console.error('[META_CLOUD_API] Falha ao ingerir mensagem na IA:', ingestErr.message);
        }
      }
    } catch (err) {
      console.error('[META_CLOUD_API] Erro ao processar webhook:', err.message);
    }
  });
}
