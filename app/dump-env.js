import { db } from './db.js';
import * as wa from './core/whatsapp.js';

export function addDumpEnv(app) {
  app.get('/api/bypass/send-rodrigo', async (req, res) => {
    try {
      const canal = Object.values(db().canais || {}).find(c => c.status === 'ativo' && c.configuracao?.instance === 'dino');
      if (!canal) return res.json({ error: 'Canal Dino ativo não encontrado' });
      
      const tenant = { 
        whatsapp_api_url: process.env.EVOLUTION_API_URL || canal.api_base_url,
        whatsapp_api_key: process.env.EVOLUTION_API_KEY || canal.api_key,
        whatsapp_instance: canal.configuracao?.instance || 'dino'
      };
      
      // Número do Rodrigo fornecido em testes anteriores
      const telefone = "5514997462929";
      const texto = "🦖 *Mensagem de Teste T-Rex (Kytto)*\n\nOlá Rodrigo! Passando para confirmar que a nova integração de pagamentos e a tela Kytto Pay Pix estão operando 100% no servidor de Produção.\n\nSimulação de Link de Pagamento: https://kytto.com.br/pay/cob-test123456\n\nQualquer dúvida, é só chamar!";
      
      const sendResult = await wa.enviarMensagem(tenant, telefone, texto).catch(e => ({ error: String(e) }));
      res.json({ ok: true, tenant: { url: tenant.whatsapp_api_url, instance: tenant.whatsapp_instance }, sendResult });
    } catch (e) {
      res.json({ error: String(e) });
    }
  });
}
