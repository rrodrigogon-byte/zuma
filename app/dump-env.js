import fetch from 'node-fetch';
import * as wp from './core/whatsapp-provider.js';

export function addDumpEnv(app) {
  app.get('/api/bypass/send-rodrigo', async (req, res) => {
    try {
      const cfg = wp.chatbotBackendConfig();
      const payload = {
        instanceName: cfg.instance || 'dino',
        chat_id: '5514997462929',
        message: '🦕 Seguem os áudios gerados com a voz do T-Rex para validação!\n\n🎂 *Áudio de Aniversário*:\nhttps://files.manuscdn.com/user_upload_by_module/session_file/310519663220350968/dAilDOBMyBeTgJHF.wav\n\n📢 *Áudio de Promoção*:\nhttps://files.manuscdn.com/user_upload_by_module/session_file/310519663220350968/IyocxisbaOFZoCrc.wav'
      };

      const resp = await fetch(`${cfg.baseUrl}${cfg.apiBase}/send`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cfg.key}`,
          'api-key': cfg.key,
          'x-api-key': cfg.key,
          'apikey': cfg.key
        },
        body: JSON.stringify(payload)
      });

      const body = await resp.text();
      res.json({ ok: resp.ok, status: resp.status, body, payload, cfg });
    } catch (e) {
      res.json({ error: String(e) });
    }
  });
}
