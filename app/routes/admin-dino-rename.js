
import { estadoEmpresa } from '../barbearia-erp-kytto.js';
import { save } from '../db.js';
import { Router } from 'express';
export const router = Router();
router.get('/rename-prof', async (req, res) => {
  try {
    const estado = estadoEmpresa('dino', false);
    let count = 0;
    for (const pId in estado.profissionais) {
      if (estado.profissionais[pId].nome === 'Guilherme Cunha Martins') {
        estado.profissionais[pId].nome = 'Robson Gonçalves Rocha (Dino)';
        count++;
      }
    }
    save();
    
    const dbPg = (await import('../core/database.js')).db;
    const empresaId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
    const lojaId = (await dbPg.queryRead("SELECT id FROM lojas WHERE empresa_id = $1", [empresaId])).rows[0].id;
    const sf = await dbPg.queryRead("SELECT id FROM commerce_storefronts WHERE empresa_id = $1", [empresaId]);
    if (sf.rows.length === 0) {
      await dbPg.query("INSERT INTO commerce_storefronts (empresa_id, loja_id, nome, moeda, timezone, status, criado_por, criado_em, atualizado_em) VALUES ($1, $2, 'Dino Barbearia', 'BRL', 'America/Cuiaba', 'active', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)", [empresaId, lojaId]);
    } else {
      await dbPg.query("UPDATE commerce_storefronts SET status = 'active' WHERE empresa_id = $1", [empresaId]);
    }
    res.json({ success: true, storefronts: (await import('../core/database.js')).db.queryRead(`SELECT * FROM commerce_storefronts WHERE empresa_id = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6'`).then(r => r.rows).catch(e => e.message) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});
