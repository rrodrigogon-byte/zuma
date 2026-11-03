// ==========================================================================
// SEED E SINCRONIZAÇÃO AUTOMÁTICA DA EQUIPE DE PROFISSIONAIS — BARBEARIA DINO
// Provisiona os 8 profissionais oficiais da Dino com login, senha e perfil no ERP.
// Idempotente: atualiza sem duplicar e preserva senhas já alteradas.
// ==========================================================================
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db, save } from './db.js';
import * as barbeariaErpKytto from './barbearia-erp-kytto.js';
import { CATALOGO_OFICIAL_SUPERMERCADO } from './modules/varejo/servico.js';

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
    senhaPadrao: '123456',
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
    senhaPadrao: '123456',
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
    senhaPadrao: '123456',
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
    emailAlternativo: 'nati@barbeariadino.com.br',
    senhaPadrao: '123456',
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
    senhaPadrao: '123456',
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
    senhaPadrao: '123456',
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
    senhaPadrao: '123456',
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
    senhaPadrao: '123456',
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
      const ativosAtuais = profissionaisAtuais.filter((p) => p.ativo !== false && !p.removidoEm);
      const poucosAtivos = ativosAtuais.length < 2;

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
        let prof = ativosAtuais.find(casaMembro) || profissionaisAtuais.find(casaMembro);

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
          barbeariaErpKytto.atualizarProfissional(empId, prof.id, {
            ...dadosProf,
            nome: prof.nome || dadosProf.nome,
            ativo: true,
            removidoEm: null,
          });
        } else {
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
    const senhaHashPadrao = bcrypt.hashSync('123456', 10);

    let u = d.usuarios.find(
      (user) =>
        (user.email && user.email.toLowerCase().trim() === emailNorm) ||
        (membro.emailAlternativo && user.email && user.email.toLowerCase().trim() === membro.emailAlternativo.toLowerCase().trim()) ||
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
        senhaHash: senhaHashPadrao,
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
      // Garante atributos ativos e atualiza a senha de login para 123456
      if (!u.passwordChangedAt) {
        u.senhaHash = senhaHashPadrao;
      }
      u.username ||= usernameNorm;
      u.apelido ||= membro.apelido || usernameNorm;
      if (membro.emailAlternativo) u.emailAlternativo = membro.emailAlternativo.toLowerCase().trim();
      u.role ||= membro.role;
      u.perfil ||= membro.role;
      u.empresaId = DINO_EMPRESA_CANONICA;
      u.lojaId = DINO_LOJA_CANONICA;
      u.ativo = true;
    }

    // Garante também conta para nati se natani existir
    if (membro.username === 'natani') {
      let uNati = d.usuarios.find(user => user.username === 'nati' || (user.email && user.email.toLowerCase().trim() === 'nati@barbeariadino.com.br'));
      if (!uNati) {
        d.usuarios.push({
          id: 'usr-dino-nati',
          nome: membro.nome,
          username: 'nati',
          email: 'nati@barbeariadino.com.br',
          senhaHash: senhaHashPadrao,
          role: membro.role,
          perfil: membro.role,
          telefone: membro.telefone,
          empresaId: DINO_EMPRESA_CANONICA,
          lojaId: DINO_LOJA_CANONICA,
          ativo: true,
          criadoEm: new Date().toISOString(),
        });
      } else {
        if (!uNati.passwordChangedAt) uNati.senhaHash = senhaHashPadrao;
        uNati.ativo = true;
        uNati.empresaId = DINO_EMPRESA_CANONICA;
        uNati.lojaId = DINO_LOJA_CANONICA;
      }
    }
  }

  // 2.2 Sincroniza qualquer outro profissional cadastrado no ERP da Barbearia Dino com senha 123456
  const senhaHashPadrao = bcrypt.hashSync('123456', 10);
  for (const empId of empresasAlvo) {
    try {
      const todosProfs = barbeariaErpKytto.listarProfissionais(empId, { incluirInativos: false });
      for (const p of todosProfs) {
        if (!p || !p.nome || p.removidoEm) continue;
        const primeiroNome = String(p.apelido || p.nome).trim().split(/\s+/)[0].toLowerCase();
        const usernameSlug = primeiroNome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
        if (!usernameSlug) continue;
        const emailDino = p.email || `${usernameSlug}@barbeariadino.com.br`;
        if (!p.email) {
          barbeariaErpKytto.atualizarProfissional(empId, p.id, { email: emailDino });
        }
        let u = d.usuarios.find(
          (user) =>
            (user.email && user.email.toLowerCase().trim() === emailDino.toLowerCase().trim()) ||
            (user.username && user.username.toLowerCase().trim() === usernameSlug)
        );
        if (!u) {
          const id = `usr-dino-${usernameSlug}-${p.id.slice(-4)}`;
          d.usuarios.push({
            id,
            nome: p.nome,
            username: usernameSlug,
            email: emailDino,
            senhaHash: senhaHashPadrao,
            role: 'profissional',
            perfil: 'profissional',
            empresaId: DINO_EMPRESA_CANONICA,
            lojaId: DINO_LOJA_CANONICA,
            ativo: true,
            criadoEm: new Date().toISOString(),
          });
        } else {
          u.senhaHash = senhaHashPadrao;
          u.ativo = true;
        }
      }
    } catch (_) {}
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
    provisionarVarejoDino(commerceDb).catch((err) => {
      console.warn('[dino-equipe-seed] Aviso ao provisionar Varejo:', err.message);
    });
    provisionarPDVOfflineDino(commerceDb).catch((err) => {
      console.warn('[dino-equipe-seed] Aviso ao provisionar PDV Offline:', err.message);
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

      const altEmail = membro.emailAlternativo ? membro.emailAlternativo.toLowerCase().trim() : '';

      // 1. Atualiza todos os registros existentes com email corporativo ou pessoal
      await commerceDb.query(
        `UPDATE usuarios 
            SET nome_completo = $1, role = $2, senha_hash = $3, ativo = true, data_atualizacao = NOW() 
          WHERE lower(btrim(email)) = $4 OR (length($5) > 0 AND lower(btrim(email)) = $5)`,
        [membro.nome, pgRole, senhaHash, email, altEmail]
      );

      // 2. Busca IDs para vincular memberships
      const r = await commerceDb.query(
        `SELECT id FROM usuarios WHERE lower(btrim(email)) = $1 OR lower(btrim(email)) = $2 LIMIT 1`,
        [email, altEmail || email]
      );

      let userId;
      if (!r.rows || r.rows.length === 0) {
        const ins = await commerceDb.query(
          `INSERT INTO usuarios (id, email, senha_hash, nome_completo, role, empresa_id, ativo, data_criacao, data_atualizacao)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true, NOW(), NOW())
           RETURNING id`,
          [email, senhaHash, membro.nome, pgRole, DINO_EMPRESA_CANONICA]
        );
        userId = ins.rows[0].id;
      } else {
        userId = r.rows[0].id;
      }

      // Garante membership na loja e empresa da Dino
      if (userId) {
        const isDinoOwner = membro.username === 'dino';
        const roleId = isDinoOwner ? 'b125e523-957d-4d12-a881-56b958ecec45' : DINO_ROLE_PROFISSIONAL_UUID;
        const lojaId = isDinoOwner ? null : DINO_LOJA_CANONICA;
        await commerceDb.query(
          `INSERT INTO commerce_memberships (id, empresa_id, usuario_id, loja_id, role_id, ativo, criado_em, atualizado_em)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
           ON CONFLICT DO NOTHING`,
          [DINO_EMPRESA_CANONICA, userId, lojaId, roleId]
        ).catch(() => null);
      }
    } catch (e) {
      console.warn(`[dino-equipe-seed] Aviso ao salvar membro ${membro.username} no PG:`, e.message);
    }
  }
}

export async function provisionarVarejoDino(commerceDb) {
  try {
    const produtos = [
      { nome: 'Pomada Modeladora Efeito Matte 120g', sku: 'POM-001', ean: '7891234560012', plu: '1001', preco: 65.00, custo: 25.00, depto: 'Finalizadores', estoque: 48, pesavel: false, lote: false },
      { nome: 'Óleo para Barba Premium Hidratante 30ml', sku: 'OLE-002', ean: '7891234560029', plu: '1002', preco: 55.00, custo: 20.00, depto: 'Barba', estoque: 32, pesavel: false, lote: false },
      { nome: 'Balm Alinhador e Modelador de Barba 100g', sku: 'BLM-003', ean: '7891234560036', plu: '1003', preco: 50.00, custo: 18.00, depto: 'Barba', estoque: 40, pesavel: false, lote: false },
      { nome: 'Shampoo Antiqueda & Fortalecedor Capilar 250ml', sku: 'SHP-004', ean: '7891234560043', plu: '1004', preco: 45.00, custo: 16.00, depto: 'Cabelo', estoque: 60, pesavel: false, lote: false },
      { nome: 'Minoxidil 5% Loção Antiqueda e Crescimento 60ml', sku: 'MNX-005', ean: '7891234560050', plu: '1005', preco: 90.00, custo: 35.00, depto: 'Tratamento', estoque: 25, pesavel: false, lote: true },
      { nome: 'Cera Modeladora Efeito Teia Alto Brilho 100g', sku: 'CER-006', ean: '7891234560067', plu: '1006', preco: 60.00, custo: 22.00, depto: 'Finalizadores', estoque: 30, pesavel: false, lote: false },
      { nome: 'Loção Pós-Barba Refrescante Mentolada 150ml', sku: 'POS-007', ean: '7891234560074', plu: '1007', preco: 48.00, custo: 17.50, depto: 'Barba', estoque: 35, pesavel: false, lote: false },
      { nome: 'Perfume Masculino Dino Signature Amadeirado 100ml', sku: 'PRF-008', ean: '7891234560081', plu: '1008', preco: 180.00, custo: 70.00, depto: 'Perfumaria', estoque: 18, pesavel: false, lote: true },
      { nome: 'Café Espresso Gourmet Moído na Hora (Dose)', sku: 'CAF-009', ean: '7891234560098', plu: '1009', preco: 8.00, custo: 2.50, depto: 'Conveniência', estoque: 120, pesavel: false, lote: false },
      { nome: 'Mix de Castanhas Nobres e Frutas Secas 100g', sku: 'SNC-010', ean: '7891234560104', plu: '1010', preco: 15.00, custo: 6.50, depto: 'Conveniência', estoque: 80, pesavel: true, lote: true }
      ,
      ...CATALOGO_OFICIAL_SUPERMERCADO.map(c => ({
        nome: c.nome, sku: c.sku, ean: c.ean, plu: c.plu, preco: c.precoVenda, custo: c.custoMedio,
        depto: c.departamento, estoque: c.saldoInicial || 50, pesavel: Boolean(c.pesavel), lote: false, unidade: c.unidade || 'UN'
      }))
    ];

    for (const p of produtos) {
      const existe = await commerceDb.query(
        `SELECT id FROM est_itens WHERE empresa_id = $1 AND (sku = $2 OR (ean IS NOT NULL AND ean = $3)) LIMIT 1`,
        [DINO_EMPRESA_CANONICA, p.sku, p.ean]
      );
      let itemId = existe.rows?.[0]?.id;
      if (!itemId) {
        const ins = await commerceDb.query(
          `INSERT INTO est_itens (empresa_id, nome, sku, ean, plu, unidade, preco_venda, custo_medio, departamento, categoria, pesavel, controla_lote, ativo, criado_em, atualizado_em)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, $10, $11, true, NOW(), NOW())
           RETURNING id`,
          [DINO_EMPRESA_CANONICA, p.nome, p.sku, p.ean, p.plu, p.unidade || 'UN', p.preco, p.custo, p.depto, p.pesavel, p.lote]
        );
        itemId = ins.rows?.[0]?.id;
      }
      if (itemId) {
        await commerceDb.query(
          `INSERT INTO est_saldos (empresa_id, loja_id, item_id, quantidade, atualizado_em)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT DO NOTHING`,
          [DINO_EMPRESA_CANONICA, DINO_LOJA_CANONICA, itemId, p.estoque]
        ).catch(() => null);

        await commerceDb.query(
          `INSERT INTO var_precos_unidade (empresa_id, loja_id, item_id, preco_venda, atualizado_em)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT DO NOTHING`,
          [DINO_EMPRESA_CANONICA, DINO_LOJA_CANONICA, itemId, p.preco]
        ).catch(() => null);
      }
    }
    console.log('[dino-equipe-seed] Estoque e catálogo de supermercado/varejo da Barbearia Dino provisionado com sucesso.');
  } catch (err) {
    console.warn('[dino-equipe-seed] Aviso ao provisionar varejo Dino:', err.message);
  }
}

export async function provisionarPDVOfflineDino(commerceDb) {
  try {
    const r = await commerceDb.query(
      `SELECT count(*) FROM pdv_terminais WHERE empresa_id = $1`,
      [DINO_EMPRESA_CANONICA]
    );
    const total = Number(r.rows?.[0]?.count || 0);
    if (total > 0) return;

    const token = crypto.randomBytes(24).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const insTerm = await commerceDb.query(
      `INSERT INTO pdv_terminais (id, empresa_id, loja_id, codigo, nome, identificador_dispositivo, token_hash, modo_offline_habilitado, ativo, criado_em, atualizado_em)
       VALUES (gen_random_uuid(), $1, $2, 'CAIXA-01', 'Caixa Principal 01 - Recepção', 'terminal-pos-dino-01', $3, true, true, NOW(), NOW())
       RETURNING id`,
      [DINO_EMPRESA_CANONICA, DINO_LOJA_CANONICA, tokenHash]
    );
    const terminalId = insTerm.rows?.[0]?.id;

    if (terminalId) {
      await commerceDb.query(
        `INSERT INTO pdv_dispositivos (id, empresa_id, loja_id, terminal_id, tipo, nome, fabricante, modelo, endereco_conexao, configuracoes, ativo, criado_em, atualizado_em)
         VALUES (gen_random_uuid(), $1, $2, $3, 'impressora_termica', 'Impressora Cupom Não Fiscal 80mm', 'Epson', 'TM-T20X', 'USB/TCP 192.168.1.200:9100', '{"modo":"rede","host":"192.168.1.200","porta":9100}'::jsonb, true, NOW(), NOW())`,
        [DINO_EMPRESA_CANONICA, DINO_LOJA_CANONICA, terminalId]
      ).catch(() => null);
    }
    console.log('[dino-equipe-seed] PDV Offline e periféricos da Barbearia Dino provisionados com sucesso.');
  } catch (err) {
    console.warn('[dino-equipe-seed] Aviso ao provisionar PDV Offline Dino:', err.message);
  }
}
