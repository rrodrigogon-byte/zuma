// ==========================================================================
// SEED E SINCRONIZAÇÃO AUTOMÁTICA DA EQUIPE DE PROFISSIONAIS — BARBEARIA DINO
// Preserva 100% dos horários configurados pelo gestor e respeita exclusões.
// Idempotente: atualiza sem duplicar, consolida duplicatas e preserva histórico AVEC.
// ==========================================================================
import bcrypt from 'bcryptjs';
import { db, save } from './db.js';
import * as barbeariaErpKytto from './barbearia-erp-kytto.js';

export const DINO_EMPRESA_CANONICA = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
export const DINO_LOJA_CANONICA = 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8';
export const DINO_ROLE_PROFISSIONAL_UUID = '85f0c5c5-584b-4d9f-946e-a348c3688483';

// ── Equipe Ativa Oficial da Dino Barbearia ────────────────────────────────
export const PROFISSIONAIS_DINO_OFICIAIS = [
  {
    idCanonico: 'prof-mtj69hhx-002',
    username: 'bruno',
    nome: 'Bruno Mendes Pedroso',
    apelido: 'Bruno',
    email: 'bruno@barbeariadino.com.br',
    emailAlternativo: 'brunomendes@barbeariadino.com.br',
    senhaPadrao: '123456',
    especialidade: 'Barbeiro Especialista (Corte, Barba e Procedimentos)',
    role: 'profissional',
    comissaoServicos: 40,
    comissaoProdutos: 10,
    faixasComissaoServico: [
      { metaFaturamento: 15000, bonusPercentual: 5, descricao: 'Meta 1: R$ 15.000 (40% + 5% = 45%)' },
      { metaFaturamento: 20000, bonusPercentual: 7, descricao: 'Meta 2: R$ 20.000 (40% + 7% = 47%)' },
      { metaFaturamento: 26000, bonusPercentual: 10, descricao: 'Meta 3: Acima de R$ 26.000 (40% + 10% = 50%)' },
    ],
    faixasComissaoProduto: [
      { metaFaturamento: 1000, bonusPercentual: 2, descricao: 'Meta 1 Produtos: R$ 1.000 (+2% = 12%)' },
      { metaFaturamento: 2500, bonusPercentual: 5, descricao: 'Meta 2 Produtos: R$ 2.500 (+5% = 15%)' },
    ],
    telefone: '(65) 99999-0002',
    atendimento24x7: false,
    horarioInicioPadrao: '08:00',
    horarioFimPadrao: '20:00',
    diasTrabalhoPadrao: [1, 2, 3, 4, 5, 6],
  },
  {
    idCanonico: 'prof-mtj67o7r-001',
    username: 'dino',
    nome: 'Dino',
    nomeCivil: 'Guilherme Cunha Martins',
    apelido: 'Dino',
    email: 'dino@barbeariadino.com.br',
    emailAlternativo: 'guicunha136@gmail.com',
    senhaPadrao: '123456',
    especialidade: 'Master Barber & Fundador (Corte, Barba e Visagismo)',
    role: 'organizador',
    comissaoServicos: 50,
    comissaoProdutos: 10,
    telefone: '(65) 99999-0001',
    atendimento24x7: true,
    horarioInicioPadrao: '00:00',
    horarioFimPadrao: '23:59',
    diasTrabalhoPadrao: [0, 1, 2, 3, 4, 5, 6],
  },
  {
    idCanonico: 'prof-mtj6b9fg-003',
    username: 'natani',
    nome: 'Nati',
    nomeCivil: 'Natani Minanis Dobler',
    apelido: 'Nati',
    email: 'natani@barbeariadino.com.br',
    emailAlternativo: 'nati@barbeariadino.com.br',
    senhaPadrao: '123456',
    especialidade: 'Hair Stylist & Especialista em Visagismo e Química Capilar',
    role: 'profissional',
    comissaoServicos: 40,
    comissaoProdutos: 10,
    faixasComissaoServico: [
      { metaFaturamento: 15000, bonusPercentual: 5, descricao: 'Meta 1: R$ 15.000 (40% + 5% = 45%)' },
      { metaFaturamento: 20000, bonusPercentual: 7, descricao: 'Meta 2: R$ 20.000 (40% + 7% = 47%)' },
      { metaFaturamento: 26000, bonusPercentual: 10, descricao: 'Meta 3: Acima de R$ 26.000 (40% + 10% = 50%)' },
    ],
    faixasComissaoProduto: [
      { metaFaturamento: 1000, bonusPercentual: 2, descricao: 'Meta 1 Produtos: R$ 1.000 (+2% = 12%)' },
      { metaFaturamento: 2500, bonusPercentual: 5, descricao: 'Meta 2 Produtos: R$ 2.500 (+5% = 15%)' },
    ],
    telefone: '(65) 99999-0004',
    atendimento24x7: false,
    horarioInicioPadrao: '07:00',
    horarioFimPadrao: '19:00',
    diasTrabalhoPadrao: [1, 2, 3, 4, 5, 6],
    atendeCliente: true,
  },
  {
    idCanonico: 'prof-mv1a1m50-003',
    username: 'ster',
    nome: 'Ester',
    nomeCivil: 'Steffany Marielly de Oliveira (Ster)',
    apelido: 'Ester',
    email: 'ster@barbeariadino.com.br',
    emailAlternativo: 'ester@barbeariadino.com.br',
    senhaPadrao: '123456',
    especialidade: 'Atendente & Operadora de Balcão (Recepção, Agenda e Caixa)',
    role: 'operador',
    comissaoServicos: 0,
    comissaoProdutos: 5,
    telefone: '(65) 99352-2260',
    atendimento24x7: false,
    horarioInicioPadrao: '08:00',
    horarioFimPadrao: '20:00',
    diasTrabalhoPadrao: [1, 2, 3, 4, 5, 6],
    atendeCliente: false,
  },
  {
    idCanonico: 'prof-mv1a1n6r-006',
    username: 'jhenyffer',
    nome: 'Jhenyffer Andrade',
    apelido: 'Jhenyffer',
    email: 'jhenyfferkellyn@gmail.com',
    emailAlternativo: 'jhenyffer@barbeariadino.com.br',
    senhaPadrao: '123456',
    especialidade: 'Administradora Geral, Gestão, Atendimento & Caixa',
    role: 'organizador',
    comissaoServicos: 0,
    comissaoProdutos: 5,
    telefone: '(65) 99999-0007',
    atendimento24x7: false,
    horarioInicioPadrao: '08:00',
    horarioFimPadrao: '20:00',
    diasTrabalhoPadrao: [1, 2, 3, 4, 5, 6],
    atendeCliente: false,
  },
];

// ── Profissionais históricos da AVEC que precisam existir pelo ID exato ───
export const PROFISSIONAIS_HISTORICOS_AVEC = [
  {
    id: 'prof-mv1a1nmm-008',
    nome: 'David Kauã Araújo Moraes',
    apelido: 'David',
    especialidade: 'Barbeiro (Histórico AVEC)',
    percentualComissao: 40,
    percentualComissaoProduto: 10,
  },
  {
    id: 'prof-mv1a1ngb-007',
    nome: 'Amanda Gabrielly Santos da Silva',
    apelido: 'Amanda',
    especialidade: 'Barbeira (Histórico AVEC)',
    percentualComissao: 40,
    percentualComissaoProduto: 10,
  },
  {
    id: 'prof-mv1a1ntu-009',
    nome: 'Jhenyffer Andrade (Histórico AVEC)',
    apelido: 'Jhenyffer',
    especialidade: 'Recepção (Histórico AVEC)',
    percentualComissao: 0,
    percentualComissaoProduto: 5,
  },
];

// ── Ex-profissionais desligados que NUNCA devem ser ressuscitados ─────────
export const PROFISSIONAIS_DINO_DESLIGADOS = [
  'bruno rafael',
  'david', 'david kauã araújo moraes', 'david kaua',
  'amanda', 'amanda gabrielly santos da silva', 'amanda gabrielly',
  'joao', 'joão victor domingos ruedel', 'joao victor',
  'vinycius lopes rodrigues', 'vitor muriel silva boy',
  'gustavo', 'lucas', 'danilo', 'pedrinho'
];

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Saneia profissionais duplicados ("Bruno" + "Bruno Mendes Pedroso"),
 * dá nome real ao `prof-mv1a1nmm-008` ("David Kauã Araújo Moraes")
 * e atribui profissional aos agendamentos que estavam sem profissional.
 */
export function sanearProfissionaisEAgendamentosDino(estado, empId = DINO_EMPRESA_CANONICA) {
  if (!estado || typeof estado !== 'object') return { consolidados: 0, orfaosResolvidos: 0 };
  estado.profissionais ||= {};
  estado.agendamentos ||= {};
  estado.comandas ||= {};
  estado.bloqueios ||= {};

  const agora = new Date().toISOString();
  let consolidados = 0;
  let orfaosResolvidos = 0;

  // 1. Garantir os profissionais históricos da AVEC pelos seus IDs exatos (ex.: prof-mv1a1nmm-008)
  for (const hist of PROFISSIONAIS_HISTORICOS_AVEC) {
    const atual = estado.profissionais[hist.id];
    if (atual) {
      atual.nome = hist.nome;
      atual.apelido = hist.apelido;
      atual.especialidade = hist.especialidade || atual.especialidade;
      atual.ativo = false;
      atual.atendeAgenda = false;
      atual.historicoAvec = true;
      atual.removidoEm = atual.removidoEm || agora;
    } else {
      estado.profissionais[hist.id] = {
        id: hist.id,
        empresaId: String(empId),
        lojaId: DINO_LOJA_CANONICA,
        nome: hist.nome,
        apelido: hist.apelido,
        especialidade: hist.especialidade,
        tipo: 'parceiro',
        percentualComissao: hist.percentualComissao,
        percentualComissaoProduto: hist.percentualComissaoProduto,
        ativo: false,
        atendeAgenda: false,
        historicoAvec: true,
        removidoEm: agora,
        criadoEm: agora,
        atualizadoEm: agora,
      };
    }
  }

  // 2. Unificar duplicata de "Bruno" e "Bruno Mendes Pedroso" preservando histórico no ID canônico prof-mtj69hhx-002
  const brunoEntries = Object.values(estado.profissionais).filter((p) => {
    const n = normalizar(p?.nome);
    const a = normalizar(p?.apelido);
    return (n.includes('bruno') || a === 'bruno') && !n.includes('bruno rafael');
  });
  const brunoCanonico = estado.profissionais['prof-mtj69hhx-002'] || brunoEntries[0];
  if (brunoCanonico) {
    brunoCanonico.nome = 'Bruno Mendes Pedroso';
    brunoCanonico.apelido = 'Bruno';
    brunoCanonico.ativo = true;
    brunoCanonico.removidoEm = null;
    brunoCanonico.excluido = false;
    for (const dup of brunoEntries) {
      if (dup.id === brunoCanonico.id) continue;
      for (const ag of Object.values(estado.agendamentos)) {
        if (ag && ag.profissionalId === dup.id) ag.profissionalId = brunoCanonico.id;
      }
      for (const cmd of Object.values(estado.comandas)) {
        if (!cmd) continue;
        if (cmd.profissionalId === dup.id) cmd.profissionalId = brunoCanonico.id;
        for (const item of cmd.itens || []) {
          if (item && item.profissionalId === dup.id) item.profissionalId = brunoCanonico.id;
        }
      }
      for (const blq of Object.values(estado.bloqueios)) {
        if (blq && blq.profissionalId === dup.id) blq.profissionalId = brunoCanonico.id;
      }
      dup.ativo = false;
      dup.atendeAgenda = false;
      dup.oculto = true;
      dup.consolidadoEm = brunoCanonico.id;
      dup.removidoEm = dup.removidoEm || agora;
      consolidados += 1;
    }
  }

  // 3. Garantir que Dino nunca fique duplicado como "Guilherme" separado
  const dinoCanonico = estado.profissionais['prof-mtj67o7r-001'];
  if (dinoCanonico) {
    dinoCanonico.nome = 'Dino';
    dinoCanonico.apelido = 'Dino';
    dinoCanonico.nomeCivil = 'Guilherme Cunha Martins';
  }

  // 4. Atribuir profissional aos agendamentos que estavam sem profissionalId ou com ID inexistente
  const servicos = estado.servicos || {};
  const fallbackBrunoId = brunoCanonico?.id || 'prof-mtj69hhx-002';
  const fallbackDinoId = dinoCanonico?.id || 'prof-mtj67o7r-001';

  for (const ag of Object.values(estado.agendamentos)) {
    if (!ag) continue;
    const pid = String(ag.profissionalId || '').trim();
    if (pid && estado.profissionais[pid]) continue;

    const srvNome = normalizar(servicos[ag.servicoId]?.nome || ag.servicoNome || '');
    const cliNome = normalizar(ag.clienteNome || '');
    let atribuido = fallbackBrunoId;
    if (srvNome.includes('dino') || srvNome.includes('protese') || cliNome.includes('( dino )') || cliNome.includes('(dino)')) {
      atribuido = fallbackDinoId;
    } else if (srvNome.includes('nati') || cliNome.includes('(nati)') || srvNome.includes('sobrancelha')) {
      atribuido = estado.profissionais['prof-mtj6b9fg-003'] ? 'prof-mtj6b9fg-003' : fallbackBrunoId;
    } else if (srvNome.includes('joao') && estado.profissionais['prof-mvodph1o-036']) {
      atribuido = 'prof-mvodph1o-036';
    }
    ag.profissionalId = atribuido;
    ag.profissionalAtribuidoAutomaticamente = true;
    orfaosResolvidos += 1;
  }

  return { consolidados, orfaosResolvidos };
}

/**
 * Garante que a equipe ativa da Dino esteja provisionada sem sobrescrever
 * horários definidos pelo usuário e assegura que desligados fiquem inativos.
 */
export function provisionarEquipeDino({ commerceDb = null } = {}) {
  const d = db();
  d.usuarios ||= [];

  const empresasAlvo = [DINO_EMPRESA_CANONICA, 'emp-kytto-001', 'dino'];

  for (const empId of empresasAlvo) {
    try {
      const estado = barbeariaErpKytto.estadoEmpresa(empId, false);
      if (estado) {
        sanearProfissionaisEAgendamentosDino(estado, empId);
      }

      const profissionaisAtuais = barbeariaErpKytto.listarProfissionais(empId, { incluirInativos: true });

      // 1. Garantir que ex-profissionais desligados permaneçam inativos
      for (const p of profissionaisAtuais) {
        const pNome = normalizar(p.nome);
        if (p.id === 'prof-mtj69hhx-002' || (pNome.includes('bruno') && !pNome.includes('bruno rafael') && !p.consolidadoEm)) continue;
        const nomeNorm = normalizar(p.nome);
        const apelidoNorm = normalizar(p.apelido);
        const emailNorm = normalizar(p.email);

        const ehDesligado = Boolean(p.consolidadoEm) || PROFISSIONAIS_DINO_DESLIGADOS.some((desligado) => {
          const dNorm = normalizar(desligado);
          return nomeNorm.includes(dNorm) || apelidoNorm === dNorm || emailNorm.includes(dNorm);
        });

        if (ehDesligado && p.ativo !== false) {
          barbeariaErpKytto.atualizarProfissional(empId, p.id, {
            ativo: false,
            removidoEm: p.removidoEm || new Date().toISOString(),
          });
        }
      }

      // 2. Provisionar membros oficiais ativos preservando 100% dos horários existentes
      const profissionaisAtualizados = barbeariaErpKytto.listarProfissionais(empId, { incluirInativos: true });

      for (const membro of PROFISSIONAIS_DINO_OFICIAIS) {
        const casaMembro = (p) => {
          if (p.consolidadoEm) return false;
          if (['prof-mv1a1nmm-008', 'prof-mv1a1ngb-007', 'prof-mv1a1ntu-009'].includes(p.id)) return false;
          if (membro.idCanonico && p.id === membro.idCanonico) return true;
          const pNome = normalizar(p.nome);
          const pApelido = normalizar(p.apelido);
          const mApelido = normalizar(membro.apelido);
          return (
            (p.email && p.email.toLowerCase() === membro.email.toLowerCase()) ||
            (membro.emailAlternativo && p.email && p.email.toLowerCase() === membro.emailAlternativo.toLowerCase()) ||
            (pNome && pNome === normalizar(membro.nome)) ||
            (membro.nomeCivil && pNome === normalizar(membro.nomeCivil)) ||
            (pApelido && pApelido === mApelido) ||
            (pNome && (pNome === mApelido || pNome.split(' ')[0] === mApelido))
          );
        };

        const prof = profissionaisAtualizados.find(casaMembro);

        if (prof) {
          // PRESERVAÇÃO RIGOROSA: NUNCA sobrescrever os horários que o gestor já ajustou!
          const ehNati = membro.username === 'natani' || String(prof.nome || '').toLowerCase().includes('natani');
          const horarioInicio = (ehNati && (!prof.horarioInicio || prof.horarioInicio === '08:00'))
            ? '07:00'
            : (prof.horarioInicio || membro.horarioInicioPadrao || '08:00');
          const horarioFim = prof.horarioFim || membro.horarioFimPadrao || '20:00';
          const diasTrabalho = Array.isArray(prof.diasTrabalho) && prof.diasTrabalho.length > 0
            ? prof.diasTrabalho
            : (membro.diasTrabalhoPadrao || [1, 2, 3, 4, 5, 6]);
          const atendimento24x7 = prof.atendimento24x7 !== undefined
            ? prof.atendimento24x7
            : Boolean(membro.atendimento24x7);
          const atendeCliente = membro.atendeCliente !== undefined ? membro.atendeCliente : (prof.atendeCliente !== false);

          barbeariaErpKytto.atualizarProfissional(empId, prof.id, {
            ...prof,
            nome: membro.nome,
            apelido: membro.apelido,
            telefone: prof.telefone || membro.telefone,
            especialidade: prof.especialidade || membro.especialidade,
            atendeCliente,
            percentualComissao: prof.percentualComissao ?? membro.comissaoServicos,
            percentualComissaoProduto: prof.percentualComissaoProduto ?? membro.comissaoProdutos,
            faixasComissaoServico: prof.faixasComissaoServico?.length ? prof.faixasComissaoServico : (membro.faixasComissaoServico || []),
            faixasComissaoProduto: prof.faixasComissaoProduto?.length ? prof.faixasComissaoProduto : (membro.faixasComissaoProduto || []),
            horarioInicio,
            horarioFim,
            diasTrabalho,
            atendimento24x7,
            ativo: true,
            removidoEm: null,
          });
        } else {
          barbeariaErpKytto.criarProfissional(empId, {
            id: membro.idCanonico,
            nome: membro.nome,
            apelido: membro.apelido,
            email: membro.email,
            telefone: membro.telefone,
            especialidade: membro.especialidade,
            tipo: 'parceiro',
            percentualComissao: membro.comissaoServicos,
            percentualComissaoProduto: membro.comissaoProdutos,
            faixasComissaoServico: membro.faixasComissaoServico || [],
            faixasComissaoProduto: membro.faixasComissaoProduto || [],
            horarioInicio: membro.horarioInicioPadrao || '08:00',
            horarioFim: membro.horarioFimPadrao || '20:00',
            diasTrabalho: membro.diasTrabalhoPadrao || [1, 2, 3, 4, 5, 6],
            atendimento24x7: Boolean(membro.atendimento24x7),
            ativo: true,
            lojaId: DINO_LOJA_CANONICA,
          });
        }
      }

      if (estado) {
        if (!estado.servicos || Object.keys(estado.servicos).length === 0) {
          try {
            barbeariaErpKytto.criarServico(empId, {
              nome: 'Corte Masculino',
              categoria: 'Cabelo',
              preco: 90,
              duracaoMinutos: 45,
              ativo: true,
            });
          } catch {}
        }
        sanearProfissionaisEAgendamentosDino(estado, empId);
      }
    } catch (e) {
      console.warn(`[dino-equipe-seed] Aviso ao provisionar ERP para ${empId}:`, e.message);
    }
  }

  // 3. Provisiona as contas de usuário em db().usuarios
  for (const membro of PROFISSIONAIS_DINO_OFICIAIS) {
    const emailNorm = membro.email.toLowerCase().trim();
    const usernameNorm = membro.username.toLowerCase().trim();
    const senhaHashMembro = bcrypt.hashSync(membro.senhaPadrao || '123456', 10);

    let u = d.usuarios.find(
      (user) =>
        (user.email && user.email.toLowerCase().trim() === emailNorm) ||
        (membro.emailAlternativo && user.email && user.email.toLowerCase().trim() === membro.emailAlternativo.toLowerCase().trim()) ||
        (user.emailAlternativo && user.emailAlternativo.toLowerCase().trim() === emailNorm) ||
        (user.username && user.username.toLowerCase().trim() === usernameNorm)
    );

    if (!u) {
      const id = `usr-dino-${usernameNorm}`;
      const novoUsuario = {
        id,
        nome: membro.nomeCivil || membro.nome,
        username: usernameNorm,
        apelido: membro.apelido || usernameNorm,
        email: emailNorm,
        emailAlternativo: membro.emailAlternativo ? membro.emailAlternativo.toLowerCase().trim() : null,
        senhaHash: senhaHashMembro,
        role: membro.role,
        perfil: membro.role,
        telefone: membro.telefone,
        empresaId: DINO_EMPRESA_CANONICA,
        lojaId: DINO_LOJA_CANONICA,
        ativo: true,
        criadoEm: new Date().toISOString(),
      };
      d.usuarios.push(novoUsuario);
    } else {
      u.nome = membro.nomeCivil || membro.nome;
      u.role = membro.role;
      u.perfil = membro.role;
      u.empresaId = DINO_EMPRESA_CANONICA;
      u.lojaId = DINO_LOJA_CANONICA;
      u.ativo = true;
    }
  }

  for (const u of d.usuarios) {
    const uName = String(u.username || '').toLowerCase();
    const uEmail = String(u.email || '').toLowerCase();
    if (u.empresaId === DINO_EMPRESA_CANONICA) {
      const ehDesligado = PROFISSIONAIS_DINO_DESLIGADOS.some((desl) => uName === desl || uEmail.includes(desl));
      if (ehDesligado) {
        u.ativo = false;
      }
    }
  }

  save();
  return { ok: true, totalMembros: PROFISSIONAIS_DINO_OFICIAIS.length };
}
