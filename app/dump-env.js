import { db as pgDb } from './core/database.js';
import * as wa from './core/whatsapp.js';

export function addDumpEnv(app) {
  app.get('/api/bypass/send-rodrigo', async (req, res) => {
    try {
      const result = await pgDb.query("SELECT * FROM canais_integracao WHERE empresa_id = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6' AND status = 'ativo'");
      const canal = result.rows[0];
      if (!canal) return res.json({ error: 'Canal ativo não encontrado no Postgres' });
      
      const tenant = { 
        whatsapp_api_url: process.env.EVOLUTION_API_URL || canal.api_base_url,
        whatsapp_api_key: process.env.EVOLUTION_API_KEY || canal.api_key,
        whatsapp_instance: canal.configuracao?.instance || 'dino'
      };
      
      const telefone = "5514997462929";
      const texto = "🦖 *Mensagem de Teste T-Rex (Kytto)*\n\nOlá Rodrigo! Passando para confirmar que a nova integração de pagamentos e a tela Kytto Pay Pix estão operando 100% no servidor de Produção.\n\nSimulação de Link de Pagamento: https://kytto.com.br/pay/cob-test123456\n\nQualquer dúvida, é só chamar!";
      
      const sendResult = await wa.enviarMensagem(tenant, telefone, texto).catch(e => ({ error: String(e) }));
      res.json({ ok: true, tenant: { url: tenant.whatsapp_api_url, instance: tenant.whatsapp_instance }, sendResult });
    } catch (e) {
      res.json({ error: String(e) });
    }
  });
}
