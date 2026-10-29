import { db as pgDb } from './core/database.js';
import fetch from 'node-fetch';
import * as wp from './core/whatsapp-provider.js';

export function addDumpEnv(app) {
  app.get('/api/bypass/send-rodrigo', async (req, res) => {
    try {
      const cfg = wp.chatbotBackendConfig();
      const payload = {
        instanceName: cfg.instance || 'dino',
        chat_id: '5514997462929@s.whatsapp.net',
        message: 'Teste Final Kytto - T-Rex Chatbot Backend 🦕'
      };

      const resp = await fetch(`${cfg.baseUrl.replace(/\/$/, '')}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const body = await resp.text();
      res.json({ ok: resp.ok, status: resp.status, body, payload, cfg });
    } catch (e) {
      res.json({ error: String(e) });
    }
  });
}
