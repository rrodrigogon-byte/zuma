import { assertDinoMixScope, normalizeAvecRevenueMix, loadAvecMix, saveAvecMix } from './core/avec-revenue-mix.js';
// Exportação 0186 conferida na origem Dino / Avec 102577 em 23/10/2026.
// Outros arquivos exigem nova conferência de proveniência antes de liberação.
export const AUDITED_AVEC_MIX_HASH = 'c85a47340f646fbb6d8f6571c32e4ed452159a3b14828e56948a69e282e89aac';
export function registerAvecMixRoutes(app, { jsonParser, requirePlatformAdmin, empresaIdFor, lojaIdFor, acquireClient, releaseClient }) {
  const base = '/api/admin/barbearia/avec-mix';
  for (const action of ['preview', 'apply']) app.post(`${base}/${action}`, requirePlatformAdmin, jsonParser, async (req, res) => {
    let client;
    res.set('Cache-Control', 'private, no-store');
    try {
      const empresaId = empresaIdFor(req), lojaId = lojaIdFor(req);
      assertDinoMixScope(empresaId, lojaId);
      const snapshot = normalizeAvecRevenueMix(req.body?.report);
      if (snapshot.reportHash !== AUDITED_AVEC_MIX_HASH) throw Object.assign(new Error('Arquivo diferente da exportação Dino já auditada. Nenhum dado foi aplicado.'), { code: 'AVEC_MIX_SOURCE_NOT_AUDITED' });
      client = await acquireClient();
      const previous = await loadAvecMix(client, empresaId, lojaId);
      let result = {};
      if (action === 'apply') {
        if (req.body?.confirm !== true) throw new Error('Confirme a prévia para aplicar.');
        result = await saveAvecMix(client, snapshot, { empresaId, lojaId, expectedPreviousHash: req.body.expectedPreviousHash, expectedReportHash: req.body.expectedReportHash });
      }
      res.json({ ok: true, ...result, reportHash: snapshot.reportHash, previousHash: previous?.reportHash || null, alreadyApplied: previous?.reportHash === snapshot.reportHash, summary: snapshot.summary, financialEntriesCreated: 0, stockMovementsCreated: 0, basis: 'Valor da linha menos desconto, por data de venda; não é uma nova receita de caixa.' });
    } catch (error) {
      res.status(error.code === 'AVEC_MIX_CONFLICT' ? 409 : 400).json({ error: error.message, code: error.code || 'AVEC_MIX_UNAVAILABLE' });
    } finally { if (client) releaseClient(client); }
  });
}
