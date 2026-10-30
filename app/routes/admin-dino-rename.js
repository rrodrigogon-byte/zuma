
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
    res.json({ success: true, storefronts: (await import('../core/database.js')).db.queryRead(`SELECT * FROM commerce_storefronts WHERE empresa_id = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6'`).then(r => r.rows).catch(e => e.message) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});
