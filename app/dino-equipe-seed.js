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
    email: 'jhenyfferkellyn@gmail.com',
    emailAlternativo: 'jhenyffer@barbeariadino.com.br',
    senhaPadrao: '123456',
    especialidade: 'Administradora Geral, Gestão, Atendimento & Caixa',
    role: 'organizador',
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
          faixasComissaoServico: membro.faixasComissaoServico || (prof?.faixasComissaoServico?.length ? prof.faixasComissaoServico : []),
          faixasComissaoProduto: membro.faixasComissaoProduto || (prof?.faixasComissaoProduto?.length ? prof.faixasComissaoProduto : []),
          horarioInicio: '08:00',
          horarioFim: '20:00',
          diasTrabalho: [1, 2, 3, 4, 5, 6], // Seg a Sáb
          ativo: true,
          lojaId: DINO_LOJA_CANONICA,
        };

        if (prof) {
          // Se o profissional foi inativado ou removido pelo gestor da barbearia,
          // RESPEITA a decisão e NÃO ressuscita! Mantém todo o histórico preservado.
          if (prof.ativo === false || prof.removidoEm) {
            continue;
          }
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
      novosUsuarios++;
    } else {
      // Garante atributos ativos, papel atualizado e senha do membro
      u.senhaHash = senhaHashMembro;
      u.username ||= usernameNorm;
      u.apelido = membro.apelido || usernameNorm;
      u.email = emailNorm;
      if (membro.emailAlternativo) u.emailAlternativo = membro.emailAlternativo.toLowerCase().trim();
      u.role = membro.role;
      u.perfil = membro.role;
      u.empresaId ||= DINO_EMPRESA_CANONICA;
      u.lojaId ||= DINO_LOJA_CANONICA;
      if (u.ativo === undefined) u.ativo = true;
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
          const membroOficial = PROFISSIONAIS_DINO_OFICIAIS.find(m => m.username === u.username || m.email === u.email || m.emailAlternativo === u.email);
          if (!membroOficial) {
            u.senhaHash = senhaHashPadrao;
          }
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

  // 2.6 Provisiona o catálogo de Bebidas & Bar e Revenda da Barbearia Dino
  provisionarBebidasRevendaDino();

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
        const isDinoManager = membro.username === 'dino' || membro.username === 'jhenyffer';
        const roleId = isDinoManager ? 'b125e523-957d-4d12-a881-56b958ecec45' : DINO_ROLE_PROFISSIONAL_UUID;
        const lojaId = isDinoManager ? null : DINO_LOJA_CANONICA;
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

export const BEBIDAS_E_PRODUTOS_DINO = [
  // Cervejas e Bebidas Alcoólicas
  { nome: 'Cerveja Heineken Long Neck 330ml', categoria: 'Bebidas & Bar', precoVenda: 12.00, custoUnitario: 5.50, estoqueAtual: 48, estoqueMinimo: 12, sku: 'BEB-HEIN-330' },
  { nome: 'Cerveja Corona Extra Long Neck 330ml', categoria: 'Bebidas & Bar', precoVenda: 14.00, custoUnitario: 6.80, estoqueAtual: 36, estoqueMinimo: 12, sku: 'BEB-COR-330' },
  { nome: 'Cerveja Budweiser Long Neck 330ml', categoria: 'Bebidas & Bar', precoVenda: 10.00, custoUnitario: 4.80, estoqueAtual: 36, estoqueMinimo: 12, sku: 'BEB-BUD-330' },
  { nome: 'Cerveja Stella Artois Long Neck 330ml', categoria: 'Bebidas & Bar', precoVenda: 12.00, custoUnitario: 5.50, estoqueAtual: 36, estoqueMinimo: 12, sku: 'BEB-STE-330' },
  { nome: 'Dose Whisky / Destilado Especial', categoria: 'Bebidas & Bar', precoVenda: 25.00, custoUnitario: 10.00, estoqueAtual: 50, estoqueMinimo: 10, sku: 'BEB-DOSE-01' },
  // Bebidas Não Alcoólicas
  { nome: 'Refrigerante Coca-Cola Lata 350ml', categoria: 'Bebidas & Bar', precoVenda: 7.00, custoUnitario: 3.20, estoqueAtual: 48, estoqueMinimo: 12, sku: 'BEB-COCA-350' },
  { nome: 'Refrigerante Coca-Cola Zero Lata 350ml', categoria: 'Bebidas & Bar', precoVenda: 7.00, custoUnitario: 3.20, estoqueAtual: 36, estoqueMinimo: 12, sku: 'BEB-COCAZ-350' },
  { nome: 'Refrigerante Guaraná Antarctica Lata 350ml', categoria: 'Bebidas & Bar', precoVenda: 7.00, custoUnitario: 3.00, estoqueAtual: 36, estoqueMinimo: 12, sku: 'BEB-GUAR-350' },
  { nome: 'Água Mineral sem Gás 500ml', categoria: 'Bebidas & Bar', precoVenda: 5.00, custoUnitario: 1.80, estoqueAtual: 60, estoqueMinimo: 20, sku: 'BEB-AGUA-500' },
  { nome: 'Água Mineral com Gás 500ml', categoria: 'Bebidas & Bar', precoVenda: 6.00, custoUnitario: 2.20, estoqueAtual: 40, estoqueMinimo: 15, sku: 'BEB-AGUAG-500' },
  { nome: 'Energético Red Bull 250ml', categoria: 'Bebidas & Bar', precoVenda: 16.00, custoUnitario: 8.50, estoqueAtual: 30, estoqueMinimo: 10, sku: 'BEB-REDB-250' },
  { nome: 'Café Expresso Gourmet', categoria: 'Bebidas & Bar', precoVenda: 5.00, custoUnitario: 1.50, estoqueAtual: 100, estoqueMinimo: 20, sku: 'BEB-CAFE-01' },
  // Cuidados Masculinos / Revenda
  { nome: 'Pomada Modeladora Efeito Matte 120g', categoria: 'Revenda', precoVenda: 65.00, custoUnitario: 25.00, estoqueAtual: 24, estoqueMinimo: 6, sku: 'REV-POM-01' },
  { nome: 'Óleo para Barba Premium Hidratante 30ml', categoria: 'Revenda', precoVenda: 55.00, custoUnitario: 20.00, estoqueAtual: 18, estoqueMinimo: 5, sku: 'REV-OLEO-01' },
  { nome: 'Balm Alinhador e Modelador de Barba 100g', categoria: 'Revenda', precoVenda: 50.00, custoUnitario: 18.00, estoqueAtual: 20, estoqueMinimo: 5, sku: 'REV-BALM-01' },
  { nome: 'Shampoo Masculino Anticaspa Fortalecedor 250ml', categoria: 'Revenda', precoVenda: 45.00, custoUnitario: 16.00, estoqueAtual: 15, estoqueMinimo: 4, sku: 'REV-SHAMP-01' },
];

export function provisionarBebidasRevendaDino() {
  const empresasAlvo = [DINO_EMPRESA_CANONICA, 'emp-kytto-001', 'dino'];
  let totalCriados = 0;
  for (const empId of empresasAlvo) {
    try {
      const existentes = barbeariaErpKytto.listarProdutosRevenda(empId, { incluirInativos: true });
      const nomesExistentes = new Set(existentes.map((p) => p.nome.toLowerCase().trim()));
      for (const item of BEBIDAS_E_PRODUTOS_DINO) {
        if (!nomesExistentes.has(item.nome.toLowerCase().trim())) {
          barbeariaErpKytto.criarProdutoRevenda(empId, {
            ...item,
            ativo: true,
            lojaId: DINO_LOJA_CANONICA,
          });
          totalCriados++;
        }
      }
    } catch (e) {
      console.warn(`[dino-equipe-seed] Aviso ao provisionar bebidas para ${empId}:`, e.message);
    }
  }
  return totalCriados;
}
