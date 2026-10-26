// ==========================================================================
// SEED E SINCRONIZAÇÃO AUTOMÁTICA DA EQUIPE DE PROFISSIONAIS — BARBEARIA DINO
// Provisiona os 8 profissionais oficiais da Dino com login, senha e perfil no ERP.
// Idempotente: atualiza sem duplicar e preserva senhas já alteradas.
// ==========================================================================
import bcrypt from 'bcryptjs';
import { db, save } from './db.js';
import * as barbeariaErpKytto from './barbearia-erp-kytto.js';

export const DINO_EMPRESA_CANONICA = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
export const DINO_LOJA_CANONICA = 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8';
export const DINO_ROLE_PROFISSIONAL_UUID = '85f0c5c5-584b-4d9f-946e-a348c3688483';

export const PROFISSIONAIS_DINO_OFICIAIS = [
  {
    username: 'dino',
    nome: 'Guilherme Cunha Martins',
    apelido: 'Dino',
    email: 'dino@barbeariadino.com.br',
    emailAlternativo: 'guicunha136@gmail.com',
    senhaPadrao: 'Dino@2026!',
    especialidade: 'Master Barber & Fundador (Corte, Barba e Visagismo)',
    role: 'organizador', // Dono / Gestor da Barbearia
    comissaoServicos: 50,
    comissaoProdutos: 10,
    telefone: '(65) 99999-0001',
  },
  {
    username: 'bruno',
    nome: 'Bruno Mendes Pedroso',
    apelido: 'Bruno',
    email: 'bruno@barbeariadino.com.br',
    emailAlternativo: '',
    senhaPadrao: 'Bruno@2026!',
    especialidade: 'Barbeiro Especialista em Cortes Clássicos & Barba',
    role: 'profissional',
    comissaoServicos: 50,
    comissaoProdutos: 10,
    telefone: '(65) 99999-0002',
  },
  {
    username: 'david',
    nome: 'David Kauã Araújo Moraes',
    apelido: 'David',
    email: 'david@barbeariadino.com.br',
    emailAlternativo: '',
    senhaPadrao: 'David@2026!',
    especialidade: 'Barbeiro Especialista em Fade, Degradê & Barboterapia',
    role: 'profissional',
    comissaoServicos: 50,
    comissaoProdutos: 10,
    telefone: '(65) 99999-0003',
  },
  {
    username: 'natani',
    nome: 'Natani Minanis Dobler',
    apelido: 'Natani',
    email: 'natani@barbeariadino.com.br',
    emailAlternativo: '',
    senhaPadrao: 'Natani@2026!',
    especialidade: 'Hair Stylist & Especialista em Visagismo e Química Capilar',
    role: 'profissional',
    comissaoServicos: 50,
    comissaoProdutos: 10,
    telefone: '(65) 99999-0004',
  },
  {
    username: 'ester',
    nome: 'Steffany Marielly de Oliveira',
    apelido: 'Ester',
    email: 'ester@barbeariadino.com.br',
    emailAlternativo: '',
    senhaPadrao: 'Ester@2026!',
    especialidade: 'Barbeira / Especialista em Sobrancelha, Barba & Estética',
    role: 'profissional',
    comissaoServicos: 50,
    comissaoProdutos: 10,
    telefone: '(65) 99999-0005',
  },
  {
    username: 'joao',
    nome: 'João Victor Domingos Ruedel',
    apelido: 'João',
    email: 'joao@barbeariadino.com.br',
    emailAlternativo: '',
    senhaPadrao: 'Joao@2026!',
    especialidade: 'Barbeiro / Cortes Modernos, Texturização & Barba',
    role: 'profissional',
    comissaoServicos: 50,
    comissaoProdutos: 10,
    telefone: '(65) 99999-0006',
  },
  {
    username: 'jhenyffer',
    nome: 'Jhenyffer Andrade',
    apelido: 'Jhenyffer',
    email: 'jhenyffer@barbeariadino.com.br',
    emailAlternativo: 'jhenyfferkellyn@gmail.com',
    senhaPadrao: 'Jhenyffer@2026!',
    especialidade: 'Gestão de Atendimento, Recepção & Comandas',
    role: 'staff',
    comissaoServicos: 0,
    comissaoProdutos: 5,
    telefone: '(65) 99999-0007',
  },
  {
    username: 'amanda',
    nome: 'Amanda Gabrielly Santos da Silva',
    apelido: 'Amanda',
    email: 'amanda@barbeariadino.com.br',
    emailAlternativo: '',
    senhaPadrao: 'Amanda@2026!',
    especialidade: 'Barbeira / Atendimento, Estética Capilar & Barboterapia',
    role: 'profissional',
    comissaoServicos: 50,
    comissaoProdutos: 10,
    telefone: '(65) 99999-0008',
  },
];

/**
 * Garante que todos os profissionais da equipe Dino estejam provisionados no ERP
 * e tenham credenciais ativas de login para o App do Profissional.
 */
export function provisionarEquipeDino({ commerceDb = null } = {}) {
  const d = db();
  d.usuarios ||= [];

  const empresasAlvo = [DINO_EMPRESA_CANONICA, 'emp-kytto-001', 'dino'];

  // 1. Provisiona no barbeariaErpKytto para cada empresa equivalente
  for (const empId of empresasAlvo) {
    try {
      const profissionaisAtuais = barbeariaErpKytto.listarProfissionais(empId, { incluirInativos: true });

      for (const membro of PROFISSIONAIS_DINO_OFICIAIS) {
        let prof = profissionaisAtuais.find(
          (p) =>
            (p.email && p.email.toLowerCase() === membro.email.toLowerCase()) ||
            (membro.emailAlternativo && p.email && p.email.toLowerCase() === membro.emailAlternativo.toLowerCase()) ||
            (p.nome && p.nome.trim().toLowerCase() === membro.nome.trim().toLowerCase()) ||
            (p.apelido && p.apelido.trim().toLowerCase() === membro.apelido.trim().toLowerCase())
        );

        const dadosProf = {
          nome: membro.nome,
          apelido: membro.apelido,
          email: membro.email,
          telefone: membro.telefone,
          especialidade: membro.especialidade,
          tipo: 'parceiro',
          percentualComissao: membro.comissaoServicos,
          percentualComissaoProduto: membro.comissaoProdutos,
          horarioInicio: '08:00',
          horarioFim: '20:00',
          diasTrabalho: [1, 2, 3, 4, 5, 6], // Seg a Sáb
          ativo: true,
          lojaId: DINO_LOJA_CANONICA,
        };

        if (prof) {
          // Atualiza dados e garante e-mail e comissões corretas
          barbeariaErpKytto.atualizarProfissional(empId, prof.id, dadosProf);
        } else {
          // Cria novo profissional no ERP
          barbeariaErpKytto.criarProfissional(empId, dadosProf);
        }
      }
    } catch (e) {
      console.warn(`[dino-equipe-seed] Aviso ao provisionar ERP para ${empId}:`, e.message);
    }
  }

  // 2. Provisiona as contas de usuário em db().usuarios
  let novosUsuarios = 0;
  for (const membro of PROFISSIONAIS_DINO_OFICIAIS) {
    const emailNorm = membro.email.toLowerCase().trim();
    const usernameNorm = membro.username.toLowerCase().trim();

    let u = d.usuarios.find(
      (user) =>
        (user.email && user.email.toLowerCase().trim() === emailNorm) ||
        (membro.emailAlternativo && user.email && user.email.toLowerCase().trim() === membro.emailAlternativo.toLowerCase().trim()) ||
        (user.username && user.username.toLowerCase().trim() === usernameNorm)
    );

    if (!u) {
      const id = `usr-dino-${usernameNorm}`;
      const senhaHash = bcrypt.hashSync(membro.senhaPadrao, 10);
      const novoUsuario = {
        id,
        nome: membro.nome,
        username: usernameNorm,
        email: emailNorm,
        senhaHash,
        role: membro.role,
        perfil: membro.role,
        telefone: membro.telefone,
        empresaId: DINO_EMPRESA_CANONICA,
        lojaId: DINO_LOJA_CANONICA,
        ativo: true,
        criadoEm: new Date().toISOString(),
      };
      d.usuarios.push(novoUsuario);
      novosUsuarios++;
    } else {
      // Garante atributos ativos
      u.username ||= usernameNorm;
      u.role ||= membro.role;
      u.perfil ||= membro.role;
      u.empresaId ||= DINO_EMPRESA_CANONICA;
      u.lojaId ||= DINO_LOJA_CANONICA;
      u.ativo = true;
    }
  }

  // 2.5 Semeia os planos VIP e tabela de preços por profissional para a Barbearia Dino
  for (const empId of empresasAlvo) {
    try {
      barbeariaErpKytto.semearPlanosVipDino(empId);
    } catch (e) {
      console.warn(`[dino-equipe-seed] Aviso ao semear planos VIP para ${empId}:`, e.message);
    }
  }

  save();

  // 3. Opcionalmente sincroniza no PostgreSQL (se database fornecido)
  if (commerceDb && typeof commerceDb.query === 'function') {
    sincronizarEquipePostgres(commerceDb).catch((err) => {
      console.warn('[dino-equipe-seed] Aviso ao sincronizar Postgres:', err.message);
    });
  }

  return {
    ok: true,
    totalMembros: PROFISSIONAIS_DINO_OFICIAIS.length,
    novosUsuarios,
  };
}

/**
 * Insere ou atualiza os usuários na tabela usuarios e commerce_memberships do PostgreSQL
 */
async function sincronizarEquipePostgres(commerceDb) {
  for (const membro of PROFISSIONAIS_DINO_OFICIAIS) {
    try {
      const email = membro.email.toLowerCase().trim();
      const senhaHash = bcrypt.hashSync(membro.senhaPadrao, 10);
      const pgRole = membro.username === 'dino' || membro.username === 'jhenyffer' ? 'gerente' : 'barbeiro';

      // Verifica se usuário já existe no Postgres
      const r = await commerceDb.query(
        `SELECT id FROM usuarios WHERE lower(btrim(email)) = $1 OR lower(btrim(email)) = $2 LIMIT 1`,
        [email, membro.emailAlternativo ? membro.emailAlternativo.toLowerCase().trim() : email]
      );

      let userId;
      if (r.rows && r.rows.length > 0) {
        userId = r.rows[0].id;
        await commerceDb.query(
          `UPDATE usuarios SET ativo = true, nome_completo = $1, role = $2, senha_hash = COALESCE(NULLIF(senha_hash, ''), $3) WHERE id = $4`,
          [membro.nome, pgRole, senhaHash, userId]
        );
      } else {
        const ins = await commerceDb.query(
          `INSERT INTO usuarios (id, email, senha_hash, nome_completo, role, empresa_id, ativo, data_criacao, data_atualizacao)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true, NOW(), NOW())
           RETURNING id`,
          [email, senhaHash, membro.nome, pgRole, DINO_EMPRESA_CANONICA]
        );
        userId = ins.rows[0].id;
      }

      // Garante membership na loja e empresa da Dino
      if (userId) {
        await commerceDb.query(
          `INSERT INTO commerce_memberships (id, empresa_id, usuario_id, loja_id, role_id, ativo, criado_em, atualizado_em)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
           ON CONFLICT DO NOTHING`,
          [DINO_EMPRESA_CANONICA, userId, DINO_LOJA_CANONICA, DINO_ROLE_PROFISSIONAL_UUID]
        ).catch(() => null);
      }
    } catch (e) {
      console.warn(`[dino-equipe-seed] Aviso ao salvar membro ${membro.username} no PG:`, e.message);
    }
  }
}
