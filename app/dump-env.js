import { db } from './db.js';
export function addDumpEnv(app) {
  app.get('/api/bypass/stats', (req, res) => {
    try {
      const cobrancas = Object.values(db().barbeariaCobranca['d0d0ac01-8e50-4b61-8c79-de4aaa916da6']?.cobrancas || {});
      const pendentesClube = cobrancas.filter(c => c.tipo === 'assinatura' && c.status === 'pendente');
      const ativas = Object.values(db().empresas['d0d0ac01-8e50-4b61-8c79-de4aaa916da6']?.assinaturas || {}).filter(a => a.status === 'ativa');
      res.json({
        totalAtivas: ativas.length,
        pendentesClube: pendentesClube.length,
        exemploPendentes: pendentesClube.slice(0, 2)
      });
    } catch (e) {
      res.json({ error: String(e) });
    }
  });
}
