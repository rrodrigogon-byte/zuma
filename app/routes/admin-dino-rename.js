
import { estadoEmpresa } from '../barbearia-erp-kytto.js';
import { save } from '../db.js';
import { Router } from 'express';
export const router = Router();
router.get('/rename-prof', (req, res) => {
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
    res.json({ success: true, count, names: Object.values(estado.profissionais).map(p => p.nome) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});
