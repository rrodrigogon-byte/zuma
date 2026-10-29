import { db } from './db.js';
import { limparTelefone } from './core/whatsapp-ai-normalize.js';
export function addDumpEnv(app) {
  app.get('/api/bypass/test-trex', async (req, res) => {
    try {
      const { empresaId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6', nome = 'rodrigo ribeiro goncalves' } = req.query;
      let clienteEncontrado = null;
      for (const emp of Object.values(db().empresas || {})) {
        for (const c of Object.values(emp.clientes || {})) {
          if (c.nome && c.nome.toLowerCase().includes(nome.toLowerCase())) {
            clienteEncontrado = c;
            break;
          }
        }
        if (clienteEncontrado) break;
      }
      if (!clienteEncontrado) return res.json({ error: 'Cliente não encontrado', nome });
      const telefone = limparTelefone(clienteEncontrado.telefone);
      if (!telefone) return res.json({ error: 'Cliente sem telefone válido', clienteEncontrado });
      const valor = `R$ 100,00`;
      const tentativa = 2;
      const primeiroNome = clienteEncontrado.nome.split(' ')[0];
      const isDino = true;
      const saudacao = 'Opa';
      const assistente = 'o T-Rex da ';
      const emoji = ' 🦖';
      const nomeBarbearia = 'Barbearia Dino';
      const abertura = `${saudacao}, ${primeiroNome}! Tudo bem? Aqui é ${assistente}${nomeBarbearia}${emoji} Sua mensalidade do plano (${valor}) venceu e ainda está em aberto. Que tal aproveitar para agendar seu próximo atendimento e já regularizar?`;
      const comoPagar = `Você prefere pagar via Pix ou Cartão de Crédito? Para sua comodidade, já deixei o link seguro aqui:\nhttps://kytto.com.br/pay/test-123`;
      const texto = `${abertura}\n\n${comoPagar}\n\nSe precisar de ajuda ou quiser agendar, é só me chamar! (Para não receber mais avisos de cobrança, responda SAIR).`;
      const wa = await import('./core/whatsapp.js');
      const tenant = {
         whatsapp_api_url: process.env.EVOLUTION_API_URL,
         whatsapp_api_key: process.env.EVOLUTION_API_KEY,
         whatsapp_instance: 'dino' // USE THE ACTUAL ACTIVE INSTANCE!
      };
      const sendResult = await wa.enviarMensagem(tenant, telefone, texto).catch(e => ({ error: e.message }));
      res.json({ ok: true, clienteEncontrado, telefone, texto, sendResult });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
}
