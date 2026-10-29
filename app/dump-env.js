import { db as pgDb } from './core/database.js';
import * as wa from './core/whatsapp.js';
export function addDumpEnv(app) {
  app.get('/api/bypass/test-trex-5', async (req, res) => {
    try {
      const telefone = "5514997462929";
      const valor = `R$ 100,00`;
      const tentativa = 2;
      const primeiroNome = "Rodrigo";
      const isDino = true;
      const saudacao = 'Opa';
      const assistente = 'o T-Rex da ';
      const emoji = ' 🦖';
      const nomeBarbearia = 'Barbearia Dino';
      const abertura = `${saudacao}, ${primeiroNome}! Tudo bem? Aqui é ${assistente}${nomeBarbearia}${emoji} Sua mensalidade do plano (${valor}) venceu e ainda está em aberto. Que tal aproveitar para agendar seu próximo atendimento e já regularizar?`;
      const comoPagar = `Você prefere pagar via Pix ou Cartão de Crédito? Para sua comodidade, já deixei o link seguro aqui:\nhttps://kytto.com.br/pay/test-123`;
      const texto = `${abertura}\n\n${comoPagar}\n\nSe precisar de ajuda ou quiser agendar, é só me chamar! (Para não receber mais avisos de cobrança, responda SAIR).`;
      
      const channelResult = await pgDb.query("SELECT * FROM canais_integracao WHERE empresa_id = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6' AND provedor='whatsapp' AND status='ativo' LIMIT 1");
      const canal = channelResult.rows[0];
      
      const tenant = {
         whatsapp_api_url: process.env.EVOLUTION_API_URL || canal.api_base_url,
         whatsapp_api_key: process.env.EVOLUTION_API_KEY,
         whatsapp_instance: canal.configuracao?.instance || process.env.EVOLUTION_INSTANCE,
         empresa_id: canal.empresa_id, loja_id: canal.loja_id, canal_id: canal.id
      };
      
      const sendResult = await wa.enviarMensagem(tenant, telefone, texto).catch(e => ({ error: String(e) }));
      res.json({ ok: true, telefone, texto, tenant, sendResult });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
}
