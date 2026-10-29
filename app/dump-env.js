import { db as pgDb } from './core/database.js';
import fetch from 'node-fetch';
export function addDumpEnv(app) {
  app.get('/api/bypass/send-rodrigo', async (req, res) => {
    try {
      const result = await pgDb.query("SELECT * FROM canais_integracao WHERE empresa_id = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6' AND status = 'ativo'");
      const canal = result.rows[0];
      if (!canal) return res.json({ error: 'Canal Dino ativo não encontrado no Postgres' });
      
      const apiUrl = process.env.CHATBOT_BACKEND_URL || process.env.EVOLUTION_API_URL || canal.api_base_url;
      const apiKey = process.env.CHATBOT_BACKEND_KEY || process.env.EVOLUTION_API_KEY || canal.api_key;
      const instance = canal.configuracao?.instance || 'dino';
      
      const body = {
        instanceName: instance,
        chat_id: "5514997462929@c.us",
        message: "🦖 *Mensagem de Teste T-Rex (Kytto)*\n\nOlá Rodrigo! Passando para confirmar que a nova integração de pagamentos e a tela Kytto Pay Pix estão operando 100% no servidor de Produção.\n\nSimulação de Link de Pagamento: https://kytto.com.br/pay/cob-test123456\n\nQualquer dúvida, é só chamar!"
      };

      const evolutionRes = await fetch(`${apiUrl}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: apiKey },
        body: JSON.stringify(body)
      });
      const data = await evolutionRes.text();
      
      res.json({ ok: evolutionRes.ok, status: evolutionRes.status, data, instance, url: apiUrl });
    } catch (e) {
      res.json({ error: String(e) });
    }
  });
}
