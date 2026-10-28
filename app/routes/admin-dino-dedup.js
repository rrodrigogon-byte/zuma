import express from 'express';
import { estadoEmpresa } from '../barbearia-erp-kytto.js';
import { save } from '../db.js';

export const router = express.Router();

router.get('/deduplicate-profissionais', (req, res) => {
  const empresaId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  const estado = estadoEmpresa(empresaId, false);
  const profissionais = Object.values(estado.profissionais);
  
  const agendamentos = Object.values(estado.agendamentos || {});
  const historico = Object.values(estado.historicoAtendimentos || {});
  const comissoes = Object.values(estado.movimentosComissao || {});
  const log = [];
  
  // Função auxiliar para checar se tem registro
  const temRegistro = (profId) => {
    return agendamentos.some(a => a.profissionalId === profId) ||
           historico.some(h => h.profissionalId === profId) ||
           comissoes.some(c => c.profissionalId === profId);
  };
  
  // 1. Unificar duplicados
  const profissionaisPorNome = {};
  for (const p of profissionais) {
    const nome = p.nome.trim().toLowerCase();
    if (!profissionaisPorNome[nome]) profissionaisPorNome[nome] = [];
    profissionaisPorNome[nome].push(p);
  }
  
  let unificados = 0;
  for (const [nome, lista] of Object.entries(profissionaisPorNome)) {
    if (lista.length > 1) {
      // Ordena para manter o mais antigo ou o que tem registros como "principal"
      lista.sort((a, b) => {
        const aTem = temRegistro(a.id) ? 1 : 0;
        const bTem = temRegistro(b.id) ? 1 : 0;
        if (aTem !== bTem) return bTem - aTem; // Com registro vem primeiro
        return new Date(a.criadoEm || 0) - new Date(b.criadoEm || 0); // Mais antigo
      });
      
      const principal = lista[0];
      for (let i = 1; i < lista.length; i++) {
        const duplicado = lista[i];
        
        // Unifica registros
        agendamentos.filter(a => a.profissionalId === duplicado.id).forEach(a => { a.profissionalId = principal.id; });
        historico.filter(h => h.profissionalId === duplicado.id).forEach(h => { h.profissionalId = principal.id; });
        comissoes.filter(c => c.profissionalId === duplicado.id).forEach(c => { c.profissionalId = principal.id; });
        
        log.push(`Unificado: ${duplicado.nome} (${duplicado.id}) -> ${principal.nome} (${principal.id})`);
        
        // Remove o duplicado
        delete estado.profissionais[duplicado.id];
        unificados++;
      }
    }
  }
  
  // 2. Excluir sem registro
  const restantes = Object.values(estado.profissionais);
  let excluidos = 0;
  for (const p of restantes) {
    if (!temRegistro(p.id)) {
      log.push(`Excluído (sem registros): ${p.nome} (${p.id})`);
      delete estado.profissionais[p.id];
      excluidos++;
    }
  }
  
  save();
  
  res.json({ ok: true, unificados, excluidos, log });
});

router.get('/list', (req, res) => {
  const empresaId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  const estado = estadoEmpresa(empresaId, false);
  res.json({ profissionais: Object.values(estado.profissionais).map(p => ({ id: p.id, nome: p.nome })) });
});
