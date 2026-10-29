import { db } from './db.js';
export function addDumpEnv(app) {
  app.get('/api/bypass/send-test', async (req, res) => {
    try {
      const empresaId = 'emp-kytto-001';
      
      const config = db().empresas?.[empresaId]?.configuracao;
      if (config && !config.pix?.chave) {
         if (!config.pix) config.pix = {};
         config.pix.chave = '12345678909';
         config.pix.nomeRecebedor = 'Kytto Test';
         config.pix.cidade = 'SAO PAULO';
      }
      
      const cobrancaKytto = await import('./dino-cobranca-kytto.js');
      const cobranca = await cobrancaKytto.criarCobranca(empresaId, {
        tipo: 'assinatura',
        referencia: 'test:' + Date.now(),
        valor: 19.99,
        descricao: 'Teste Pix Kytto',
        clienteId: 'teste-123',
        clienteNome: 'Rodrigo Ribeiro Gonçalves',
        telefone: '5514997462929',
        lojaId: 'loja1'
      }, { lojaId: 'loja1' });
      
      const { queueChargeNotification } = await import('./core/barbershop-appointment-notifications.js');
      const result = await queueChargeNotification({ empresaId, lojaId: 'loja1', legacyEmpresaId: empresaId }, cobranca);
      res.json({ ok: true, cobrancaId: cobranca.id, url: `https://kytto.com.br/pay/${cobranca.id}`, result });
    } catch(e) {
      res.status(500).json({ error: String(e.message), stack: e.stack });
    }
  });
}
