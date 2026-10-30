
import { Router } from 'express';
export const router = Router();
router.get('/create-sf', async (req, res) => {
  try {
    const dbPg = (await import('../core/database.js')).db;
    const empresaId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
    const lj = await dbPg.queryRead("SELECT id FROM lojas WHERE empresa_id = $1", [empresaId]);
    if (lj.rows.length === 0) return res.json({ error: 'No loja' });
    const lojaId = lj.rows[0].id;
    const sf = await dbPg.queryRead("SELECT * FROM commerce_storefronts WHERE empresa_id = $1", [empresaId]);
    if (sf.rows.length === 0) {
      await dbPg.query("INSERT INTO commerce_storefronts (empresa_id, loja_id, nome, moeda, timezone, status, criado_por, criado_em, atualizado_em) VALUES ($1, $2, 'Dino Barbearia', 'BRL', 'America/Cuiaba', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)", [empresaId, lojaId]);
      res.json({ success: true, action: 'created' });
    } else {
      await dbPg.query("UPDATE commerce_storefronts SET status = 'active' WHERE empresa_id = $1", [empresaId]);
      res.json({ success: true, action: 'activated', rows: sf.rows });
    }
  } catch(e) {
    res.json({ error: e.message });
  }
});
