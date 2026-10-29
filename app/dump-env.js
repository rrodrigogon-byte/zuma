import { db } from './db.js';
export function addDumpEnv(app) {
  app.get('/api/bypass/send-test', async (req, res) => {
    try {
      const empresaId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
      
      const cobrancaKytto = await import('./dino-cobranca-kytto.js');
      
      // Inject config
      const raiz = db();
      raiz.barbeariaCobranca ||= {};
      raiz.barbeariaCobranca[empresaId] ||= {};
      raiz.barbeariaCobranca[empresaId].configuracao ||= {};
      const config = raiz.barbeariaCobranca[empresaId].configuracao;
      config.pix = {
         chave: '12345678909',
         nomeRecebedor: 'Rodrigo Kytto',
         cidade: 'SAO PAULO'
      };
      
      const cobranca = await cobrancaKytto.criarCobranca(empresaId, {
        tipo: 'assinatura',
        referencia: 'test:' + Date.now(),
        valor: 19.99,
        descricao: 'Teste Pix Kytto',
        clienteId: 'teste-123',
        clienteNome: 'Rodrigo Ribeiro Gonçalves',
        telefone: '5514997462929',
        lojaId: 'unit-b'
      }, { lojaId: 'unit-b' });
      
      const { queueChargeNotification } = await import('./core/barbershop-appointment-notifications.js');
      const result = await queueChargeNotification({ empresaId, lojaId: 'unit-b', legacyEmpresaId: empresaId }, cobranca);
      res.json({ ok: true, cobrancaId: cobranca.id, url: `https://kytto.com.br/pay/${cobranca.id}`, result });
    } catch(e) {
      res.status(500).json({ error: String(e.message), stack: e.stack });
    }
  });
}
