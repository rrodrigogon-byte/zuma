import { estadoEmpresa, db } from '../barbearia-erp-kytto.js';
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
    // trigger save
    const r = db();
    if (r.save) r.save();
    
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
