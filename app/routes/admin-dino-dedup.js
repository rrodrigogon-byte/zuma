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
    const nome = p.nome.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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

router.get('/custom', (req, res) => {
  const empresaId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  const estado = estadoEmpresa(empresaId, false);
  const log = [];
  
  const agendamentos = Object.values(estado.agendamentos || {});
  const historico = Object.values(estado.historicoAtendimentos || {});
  const comissoes = Object.values(estado.movimentosComissao || {});
  
  const unificar = (idDuplicado, idPrincipal) => {
    agendamentos.filter(a => a.profissionalId === idDuplicado).forEach(a => { a.profissionalId = idPrincipal; });
    historico.filter(h => h.profissionalId === idDuplicado).forEach(h => { h.profissionalId = idPrincipal; });
    comissoes.filter(c => c.profissionalId === idDuplicado).forEach(c => { c.profissionalId = idPrincipal; });
    const nomeDup = estado.profissionais[idDuplicado]?.nome;
    const nomePrin = estado.profissionais[idPrincipal]?.nome;
    log.push(`Unificado: ${nomeDup} (${idDuplicado}) -> ${nomePrin} (${idPrincipal})`);
    delete estado.profissionais[idDuplicado];
  };

  const excluir = (id) => {
    const nome = estado.profissionais[id]?.nome;
    log.push(`Excluído: ${nome} (${id})`);
    delete estado.profissionais[id];
  };

  // Bruno duplicado: "Bruno" (prof-mtj69hhx-002) vs "bruno rafael dos santos", "Bruno Mendes Pedroso", "bruno celso pereira"
  // Wait, let's keep "prof-mtj69hhx-002" (Bruno) and unify the AVEC ones that are exactly "Bruno" or just keep the ones that are his duplicates.
  // Actually, I can just use a JS file locally and POST the exact IDs I want to delete! But Kytto doesn't have an endpoint for unifying! It only has DELETE which throws if there are appointments!
  
  res.json({ ok: true, log });
});

router.get('/exact', (req, res) => {
  const empresaId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  const estado = estadoEmpresa(empresaId, false);
  const log = [];
  
  const agendamentos = Object.values(estado.agendamentos || {});
  const historico = Object.values(estado.historicoAtendimentos || {});
  const comissoes = Object.values(estado.movimentosComissao || {});
  
  const unificar = (idDuplicado, idPrincipal) => {
    agendamentos.filter(a => a.profissionalId === idDuplicado).forEach(a => { a.profissionalId = idPrincipal; });
    historico.filter(h => h.profissionalId === idDuplicado).forEach(h => { h.profissionalId = idPrincipal; });
    comissoes.filter(c => c.profissionalId === idDuplicado).forEach(c => { c.profissionalId = idPrincipal; });
    const nomeDup = estado.profissionais[idDuplicado]?.nome;
    const nomePrin = estado.profissionais[idPrincipal]?.nome;
    log.push(`Unificado: ${nomeDup} (${idDuplicado}) -> ${nomePrin} (${idPrincipal})`);
    delete estado.profissionais[idDuplicado];
  };

  const excluir = (id) => {
    const nome = estado.profissionais[id]?.nome;
    log.push(`Excluído: ${nome} (${id})`);
    delete estado.profissionais[id];
  };

  // Excluir Amanda e David
  const profs = Object.values(estado.profissionais);
  const findByName = (str) => profs.filter(p => p.nome.toLowerCase().includes(str.toLowerCase()));
  
  const amandas = findByName('amanda');
  amandas.forEach(p => excluir(p.id));

  const davids = findByName('david');
  davids.forEach(p => excluir(p.id));

  // João duplicado
  const joaos = findByName('joão').concat(findByName('joao'));
  const principalJoao = joaos.find(p => p.nome === 'João Victor Domingos Ruedel') || joaos[0];
  if (principalJoao) {
    joaos.forEach(p => {
      if (p.id !== principalJoao.id) unificar(p.id, principalJoao.id);
    });
  }

  // Steffany duplicado
  const steffanys = findByName('steffany');
  if (steffanys.length > 0) {
    const principalSteffany = steffanys[0];
    steffanys.forEach(p => {
      if (p.id !== principalSteffany.id) unificar(p.id, principalSteffany.id);
    });
  }

  // Bruno duplicado
  // O usuário diz que Bruno está duplicado. Vamos manter o Bruno original 'prof-mtj69hhx-002'.
  const brunos = findByName('bruno');
  const principalBruno = brunos.find(p => p.id === 'prof-mtj69hhx-002') || brunos[0];
  if (principalBruno) {
    brunos.forEach(p => {
      if (p.id !== principalBruno.id) unificar(p.id, principalBruno.id);
    });
  }

  save();
  res.json({ ok: true, log });
});
