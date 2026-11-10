// ==========================================================================
// SEED E SINCRONIZAÇÃO AUTOMÁTICA DA EQUIPE DE PROFISSIONAIS — BARBEARIA DINO
// Preserva 100% dos horários configurados pelo gestor e respeita exclusões.
// Idempotente: atualiza sem duplicar e preserva senhas e horários já alterados.
// ==========================================================================
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db, save } from './db.js';
import * as barbeariaErpKytto from './barbearia-erp-kytto.js';
import { CATALOGO_OFICIAL_SUPERMERCADO } from './modules/varejo/servico.js';

export const DINO_EMPRESA_CANONICA = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
export const DINO_LOJA_CANONICA = 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8';
export const DINO_ROLE_PROFISSIONAL_UUID = '85f0c5c5-584b-4d9f-946e-a348c3688483';

// ── Equipe Ativa Oficial da Dino Barbearia ────────────────────────────────
export const PROFISSIONAIS_DINO_OFICIAIS = [
  {
    username: 'dino',
    nome: 'Guilherme Cunha Martins',
    apelido: 'Dino',
    email: 'dino@barbeariadino.com.br',
    emailAlternativo: 'guicunha136@gmail.com',
    senhaPadrao: '123456',
    especialidade: 'Master Barber & Fundador (Corte, Barba e Visagismo)',
    role: 'organizador', // Dono / Gestor da Barbearia
    comissaoServicos: 50,
    comissaoProdutos: 10,
    telefone: '(65) 99999-0001',
    atendimento24x7: true,
    horarioInicioPadrao: '00:00',
    horarioFimPadrao: '23:59',
    diasTrabalhoPadrao: [0, 1, 2, 3, 4, 5, 6], // Todos os dias 24h
  },
  {
    username: 'natani',
    nome: 'Natani Minanis Dobler',
    apelido: 'Natani',
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
    horarioInicioPadrao: '08:00',
    horarioFimPadrao: '20:00',
    diasTrabalhoPadrao: [1, 2, 3, 4, 5, 6],
  },
  {
    username: 'ster',
    nome: 'Steffany Marielly de Oliveira (Ster)',
    apelido: 'Ster',
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
  },
  {
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
  },
];

// ── Ex-profissionais desligados que NUNCA devem ser ressuscitados ─────────
export const PROFISSIONAIS_DINO_DESLIGADOS = [
  'bruno', 'bruno mendes pedroso',
  'david', 'david kauã araújo moraes', 'david kaua',
  'amanda', 'amanda gabrielly santos da silva', 'amanda gabrielly',
  'joao', 'joão victor domingos ruedel', 'joao victor',
  'vinycius lopes rodrigues', 'vitor muriel silva boy'
];

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
      const profissionaisAtuais = barbeariaErpKytto.listarProfissionais(empId, { incluirInativos: true });

      // 1. Garantir que ex-profissionais desligados permaneçam inativos
      for (const p of profissionaisAtuais) {
        const nomeNorm = String(p.nome || '').trim().toLowerCase();
        const apelidoNorm = String(p.apelido || '').trim().toLowerCase();
        const emailNorm = String(p.email || '').trim().toLowerCase();

        const ehDesligado = PROFISSIONAIS_DINO_DESLIGADOS.some((desligado) => {
          const dNorm = desligado.toLowerCase();
          return nomeNorm.includes(dNorm) || apelidoNorm === dNorm || emailNorm.includes(dNorm);
        });

        if (ehDesligado && p.ativo !== false) {
          barbeariaErpKytto.atualizarProfissional(empId, p.id, {
            ativo: false,
            removidoEm: p.removidoEm || new Date().toISOString()
          });
          console.log(`[dino-equipe-seed] Ex-profissional inativado com sucesso: ${p.nome} (${p.id})`);
        }
      }

      // 2. Provisionar membros oficiais ativos preservando 100% dos horários existentes
      const profissionaisAtualizados = barbeariaErpKytto.listarProfissionais(empId, { incluirInativos: true });

      for (const membro of PROFISSIONAIS_DINO_OFICIAIS) {
        const casaMembro = (p) => {
          const pNome = String(p.nome || '').trim().toLowerCase();
          const pApelido = String(p.apelido || '').trim().toLowerCase();
          const mApelido = membro.apelido.trim().toLowerCase();
          return (
            (p.email && p.email.toLowerCase() === membro.email.toLowerCase()) ||
            (membro.emailAlternativo && p.email && p.email.toLowerCase() === membro.emailAlternativo.toLowerCase()) ||
            (pNome && pNome === membro.nome.trim().toLowerCase()) ||
            (pApelido && pApelido === mApelido) ||
            (pNome && (pNome === mApelido || pNome.split(' ')[0] === mApelido))
          );
        };

        const prof = profissionaisAtualizados.find(casaMembro);

        if (prof) {
          // Se o profissional foi inativado manualmente pelo gestor, NÃO ressuscita!
          if (prof.ativo === false || prof.removidoEm) {
            continue;
          }

          // PRESERVAÇÃO RIGOROSA: NUNCA sobrescrever os horários que o gestor já ajustou!
          const horarioInicio = prof.horarioInicio || membro.horarioInicioPadrao || '08:00';
          const horarioFim = prof.horarioFim || membro.horarioFimPadrao || '20:00';
          const diasTrabalho = Array.isArray(prof.diasTrabalho) && prof.diasTrabalho.length > 0
            ? prof.diasTrabalho
            : (membro.diasTrabalhoPadrao || [1, 2, 3, 4, 5, 6]);
          const atendimento24x7 = prof.atendimento24x7 !== undefined
            ? prof.atendimento24x7
            : Boolean(membro.atendimento24x7);

          barbeariaErpKytto.atualizarProfissional(empId, prof.id, {
            ...prof,
            nome: prof.nome || membro.nome,
            apelido: prof.apelido || membro.apelido,
            telefone: prof.telefone || membro.telefone,
            especialidade: prof.especialidade || membro.especialidade,
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
          // Só cria se NUNCA tiver existido
          barbeariaErpKytto.criarProfissional(empId, {
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
    } catch (e) {
      console.warn(`[dino-equipe-seed] Aviso ao provisionar ERP para ${empId}:`, e.message);
    }
  }

  // 3. Provisiona as contas de usuário em db().usuarios (apenas os 4 oficiais)
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
        nome: membro.nome,
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
      // Atualiza apenas dados neutros de autenticação, mantendo a senha existente se já foi alterada
      u.nome = membro.nome;
      u.role = membro.role;
      u.perfil = membro.role;
      u.empresaId = DINO_EMPRESA_CANONICA;
      u.lojaId = DINO_LOJA_CANONICA;
      u.ativo = true;
    }
  }

  // Desativa usuários de ex-funcionários no db().usuarios
  for (const u of d.usuarios) {
    const uName = String(u.username || '').toLowerCase();
    const uEmail = String(u.email || '').toLowerCase();
    if (u.empresaId === DINO_EMPRESA_CANONICA) {
      const ehDesligado = PROFISSIONAIS_DINO_DESLIGADOS.some(d => uName === d || uEmail.includes(d));
      if (ehDesligado) {
        u.ativo = false;
      }
    }
  }

  save();
  return { ok: true };
}
