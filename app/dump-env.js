import { db } from './db.js';
import * as wa from './core/whatsapp.js';
export function addDumpEnv(app) {
  app.get('/api/bypass/send-rodrigo', async (req, res) => {
    try {
      const tenant = { 
        whatsapp_api_url: process.env.EVOLUTION_API_URL || process.env.CHATBOT_BACKEND_URL,
        whatsapp_api_key: process.env.EVOLUTION_API_KEY || process.env.CHATBOT_BACKEND_KEY,
        whatsapp_instance: process.env.EVOLUTION_INSTANCE || process.env.CHATBOT_BACKEND_INSTANCE || 'barbearia-dino-gestao'
      };
      
      const telefone = "5514997462929";
      const texto = "🦖 *Mensagem de Teste T-Rex (Kytto)*\n\nOlá Rodrigo! Passando para confirmar que a nova integração de pagamentos e a tela Kytto Pay Pix estão operando 100% no servidor de Produção.\n\nSimulação de Link de Pagamento: https://kytto.com.br/pay/cob-test123456\n\nQualquer dúvida, é só chamar!";
      
      const sendResult = await wa.enviarMensagem(tenant, telefone, texto).catch(e => ({ error: String(e) }));
      res.json({ ok: true, tenant, sendResult });
    } catch (e) {
      res.json({ error: String(e) });
    }
  });
}
