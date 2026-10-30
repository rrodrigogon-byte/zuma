import { estadoEmpresa } from '../barbearia-erp-kytto.js';
import { save } from '../db.js';
import { Router } from 'express';
export const router = Router();
router.get('/rename-prof', async (req, res) => {
  try {
    const db = (await import('../db.js')).db();
    let count = 0;
    for (const key of Object.keys(db.barbearias || {})) {
      const estado = db.barbearias[key];
      for (const pId in estado.profissionais || {}) {
        if (estado.profissionais[pId].nome === 'Guilherme Cunha Martins') {
          estado.profissionais[pId].nome = 'Robson Gonçalves Rocha (Dino)';
          count++;
        }
      }
    }
    save();
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});
