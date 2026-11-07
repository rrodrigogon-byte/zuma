// ============================================================================
// TEMPLATES E PROVISIONAMENTO ÁGIL DE NOVAS EMPRESAS — ERP KYTTO
// Permite escalar e criar novas empresas completas em 1 clique com catálogo,
// unidade matriz, loja virtual, parâmetros fiscais e administrador isolado.
// ============================================================================
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { db as getDb, save as saveDb } from '../../db.js';
import { estadoEmpresa, criarServico, criarProdutoRevenda } from '../../barbearia-erp-kytto.js';

export const TEMPLATES_NEGOCIO = {
  barbearia: {
    id: 'barbearia',
    icon: '💈',
    label: 'Barbearia & Salão',
    tagline: 'Barbearia, perfumaria, estética e cuidados masculinos e femininos.',
    servicos: [
      { nome: 'Corte de Cabelo Tradicional', preco: 40, duracaoMinutos: 30, categoria: 'Cabelo', grupoServico: 'convencionais' },
      { nome: 'Barba Tradicional com Toalha Quente', preco: 35, duracaoMinutos: 30, categoria: 'Barba', grupoServico: 'convencionais' },
      { nome: 'Combo Cabelo & Barba Completo', preco: 70, duracaoMinutos: 50, categoria: 'Combos', grupoServico: 'convencionais' },
      { nome: 'Corte Infantil Especial', preco: 35, duracaoMinutos: 30, categoria: 'Cabelo', grupoServico: 'convencionais' },
      { nome: 'Hidratação & Tratamento Capilar', preco: 45, duracaoMinutos: 25, categoria: 'Tratamentos', grupoServico: 'extras' },
      { nome: 'Alinhamento & Design de Sobrancelha', preco: 15, duracaoMinutos: 15, categoria: 'Acabamentos', grupoServico: 'extras' },
    ],
    produtos: [
      { nome: 'Pomada Modeladora Efeito Matte 100g', precoVenda: 55, custoUnitario: 22, categoria: 'Finalizadores', estoqueAtual: 12, estoqueMinimo: 4 },
      { nome: 'Óleo Hidratante de Barba 30ml', precoVenda: 48, custoUnitario: 18, categoria: 'Cuidados Barba', estoqueAtual: 10, estoqueMinimo: 3 },
      { nome: 'Shampoo Mentolado Refrescante 250ml', precoVenda: 38, custoUnitario: 15, categoria: 'Shampoos', estoqueAtual: 8, estoqueMinimo: 2 },
      { nome: 'Água Mineral sem Gás 500ml', precoVenda: 5, custoUnitario: 1.5, categoria: 'Bebidas Balcão', estoqueAtual: 24, estoqueMinimo: 6 },
      { nome: 'Cerveja Long Neck Artesanal', precoVenda: 12, custoUnitario: 5.5, categoria: 'Bebidas Balcão', estoqueAtual: 24, estoqueMinimo: 6 },
    ],
    comissoes: { baseServicos: 40, baseProdutos: 10 },
    moduloPrincipal: 'barbearia'
  },

  loja: {
    id: 'loja',
    icon: '💊',
    label: 'Suplementos, Varejo & Moda',
    tagline: 'Suplementação esportiva, alimentação saudável, vestuário e comércio varejista.',
    servicos: [
      { nome: 'Avaliação de Bioimpedância & Orientação', preco: 60, duracaoMinutos: 30, categoria: 'Avaliações' }
    ],
    produtos: [
      { nome: '100% Whey Protein Concentrado 900g', precoVenda: 139.9, custoUnitario: 85, categoria: 'Proteínas & Whey', estoqueAtual: 20, estoqueMinimo: 5 },
      { nome: 'Creatina Monohidratada 100% Pura 300g', precoVenda: 89.9, custoUnitario: 45, categoria: 'Aminoácidos', estoqueAtual: 25, estoqueMinimo: 6 },
      { nome: 'Pré-Treino Ultra Concentrado 300g', precoVenda: 119.9, custoUnitario: 65, categoria: 'Pré-Treinos', estoqueAtual: 15, estoqueMinimo: 4 },
      { nome: 'Complexo Multivitamínico Daily Health 60 caps', precoVenda: 49.9, custoUnitario: 24, categoria: 'Vitaminas', estoqueAtual: 30, estoqueMinimo: 8 },
      { nome: 'Coqueteleira Blender 700ml c/ Mola', precoVenda: 35, custoUnitario: 14, categoria: 'Acessórios & Coqueteleiras', estoqueAtual: 18, estoqueMinimo: 5 },
    ],
    comissoes: { baseServicos: 10, baseProdutos: 10 },
    moduloPrincipal: 'loja'
  },

  bar: {
    id: 'bar',
    icon: '🍔',
    label: 'Bar, Choperia & Gastronomia',
    tagline: 'Choperias, bares, petiscarias, pubs e lanchonetes com comandas e balcão.',
    servicos: [],
    produtos: [
      { nome: 'Chopp Pilsen Artesanal 500ml', precoVenda: 14, custoUnitario: 4.5, categoria: 'Chopps & Cervejas', estoqueAtual: 100, estoqueMinimo: 20 },
      { nome: 'Chopp IPA Artesanal 500ml', precoVenda: 18, custoUnitario: 6.5, categoria: 'Chopps & Cervejas', estoqueAtual: 80, estoqueMinimo: 15 },
      { nome: 'Porção Batata Rústica com Cheddar e Bacon 500g', precoVenda: 42, custoUnitario: 14, categoria: 'Petiscos & Porções', estoqueAtual: 40, estoqueMinimo: 10 },
      { nome: 'Burger Artesanal Smash Duplo com Queijo Prato', precoVenda: 36, custoUnitario: 13, categoria: 'Lanches Artesanais', estoqueAtual: 50, estoqueMinimo: 12 },
      { nome: 'Caipirinha Tradicional de Limão', precoVenda: 22, custoUnitario: 5, categoria: 'Drinks Especiais', estoqueAtual: 60, estoqueMinimo: 15 },
      { nome: 'Refrigerante Lata 350ml', precoVenda: 7, custoUnitario: 2.8, categoria: 'Bebidas Não Alcoólicas', estoqueAtual: 60, estoqueMinimo: 20 },
    ],
    comissoes: { baseServicos: 10, baseProdutos: 10 },
    moduloPrincipal: 'bar'
  },

  esporte: {
    id: 'esporte',
    icon: '🎾',
    label: 'Arena Esportiva & Beach Tennis',
    tagline: 'Complexos esportivos, quadras de areia, beach tennis, futevôlei e clubes.',
    servicos: [
      { nome: 'Locação Quadra Beach Tennis 1 Hora', preco: 90, duracaoMinutos: 60, categoria: 'Locação Quadras' },
      { nome: 'Locação Quadra Futevôlei 1 Hora', preco: 80, duracaoMinutos: 60, categoria: 'Locação Quadras' },
      { nome: 'Day Use Individual Livre', preco: 35, duracaoMinutos: 180, categoria: 'Day Use' },
      { nome: 'Aula / Clínica com Instrutor Especializado', preco: 130, duracaoMinutos: 60, categoria: 'Treinamento' },
    ],
    produtos: [
      { nome: 'Água de Coco Natural 300ml', precoVenda: 8, custoUnitario: 3, categoria: 'Hidratação', estoqueAtual: 40, estoqueMinimo: 10 },
      { nome: 'Isotônico 500ml', precoVenda: 10, custoUnitario: 4.5, categoria: 'Hidratação', estoqueAtual: 30, estoqueMinimo: 8 },
      { nome: 'Tubo de Bolinhas Oficiais Beach Tennis (3un)', precoVenda: 65, custoUnitario: 38, categoria: 'Artigos Esportivos', estoqueAtual: 15, estoqueMinimo: 4 },
      { nome: 'Overgrip Antiderrapante para Raquete', precoVenda: 25, custoUnitario: 9, categoria: 'Acessórios', estoqueAtual: 20, estoqueMinimo: 5 },
    ],
    comissoes: { baseServicos: 20, baseProdutos: 10 },
    moduloPrincipal: 'esporte'
  },

  supermercado: {
    id: 'supermercado',
    icon: '🛒',
    label: 'Supermercado & Empório',
    tagline: 'Minimercados, mercearias, empórios e conveniências com PDV veloz.',
    servicos: [],
    produtos: [
      { nome: 'Café Especial Torrado e Moído 500g', precoVenda: 24.9, custoUnitario: 16, categoria: 'Mercearia', estoqueAtual: 35, estoqueMinimo: 10 },
      { nome: 'Queijo Meia Cura Artesanal 500g', precoVenda: 32, custoUnitario: 19, categoria: 'Frios & Laticínios', estoqueAtual: 15, estoqueMinimo: 4 },
      { nome: 'Cerveja Puro Malte 600ml', precoVenda: 11.9, custoUnitario: 6.8, categoria: 'Bebidas', estoqueAtual: 48, estoqueMinimo: 12 },
      { nome: 'Azeite de Oliva Extra Virgem 500ml', precoVenda: 42.9, custoUnitario: 28, categoria: 'Mercearia', estoqueAtual: 20, estoqueMinimo: 5 },
    ],
    comissoes: { baseServicos: 5, baseProdutos: 5 },
    moduloPrincipal: 'supermercado'
  },

  outro: {
    id: 'outro',
    icon: '🏢',
    label: 'Serviços & Negócios em Geral',
    tagline: 'Prestação de serviços, consultorias, clínicas e negócios gerais.',
    servicos: [
      { nome: 'Atendimento / Consultoria Especializada', preco: 150, duracaoMinutos: 60, categoria: 'Serviços' },
      { nome: 'Pacote Mensal de Serviços', preco: 450, duracaoMinutos: 120, categoria: 'Planos' }
    ],
    produtos: [],
    comissoes: { baseServicos: 30, baseProdutos: 10 },
    moduloPrincipal: 'outro'
  }
};

/**
 * Cria slug URL-friendly a partir do nome
 */
export function gerarSlug(nome = '') {
  return String(nome)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'empresa';
}

/**
 * Provisiona automaticamente o catálogo, produtos, serviços e comissões
 * correspondentes ao segmento/template escolhido.
 */
export function provisionarCatalogoSegmento(empresaId, tipoNegocio = 'barbearia', lojaId = null) {
  const template = TEMPLATES_NEGOCIO[tipoNegocio] || TEMPLATES_NEGOCIO.outro;
  const resultados = {
    tipoNegocio,
    servicosCriados: 0,
    produtosCriados: 0,
    comissoesConfiguradas: false
  };

  try {
    const estado = estadoEmpresa(empresaId);

    // 1. Criar serviços do template se for barbearia ou prestador
    if (Array.isArray(template.servicos) && template.servicos.length > 0) {
      for (const s of template.servicos) {
        try {
          criarServico(empresaId, {
            nome: s.nome,
            preco: s.preco,
            duracaoMinutos: s.duracaoMinutos,
            categoria: s.categoria || 'Geral',
            grupoServico: s.grupoServico || 'convencionais',
            lojaId: lojaId || undefined,
            ativo: true
          });
          resultados.servicosCriados++;
        } catch (e) {
          // ignora se já existir
        }
      }
    }

    // 2. Criar produtos do template
    if (Array.isArray(template.produtos) && template.produtos.length > 0) {
      for (const p of template.produtos) {
        try {
          criarProdutoRevenda(empresaId, {
            nome: p.nome,
            precoVenda: p.precoVenda,
            custoUnitario: p.custoUnitario,
            categoria: p.categoria || 'Revenda',
            estoqueAtual: p.estoqueAtual || 10,
            estoqueMinimo: p.estoqueMinimo || 2,
            lojaId: lojaId || undefined,
            ativo: true
          });
          resultados.produtosCriados++;
        } catch (e) {
          // ignora se já existir
        }
      }
    }

    // 3. Salvar configurações de metas e comissões da empresa
    if (template.comissoes) {
      estado.configuracoes ||= {};
      estado.configuracoes.comissaoBaseServicos = template.comissoes.baseServicos;
      estado.configuracoes.comissaoBaseProdutos = template.comissoes.baseProdutos;
      estado.configuracoes.templateOrigem = tipoNegocio;
      estado.configuracoes.provisionadoEm = new Date().toISOString();
      resultados.comissoesConfiguradas = true;
    }

    saveDb();
  } catch (err) {
    console.warn('[onboarding] Aviso ao provisionar catálogo do segmento:', err.message);
  }

  return resultados;
}

/**
 * Provisiona Administrador da Empresa no PostgreSQL e Datastore JSON
 */
export async function provisionarAdminCompleto(db, empresaId, dadosAdmin = {}, nomeEmpresa = '') {
  const nome = String(dadosAdmin.nome || 'Administrador').trim();
  const slugEmp = gerarSlug(nomeEmpresa);
  const email = String(dadosAdmin.email || `admin@${slugEmp}.kytto.com.br`).trim().toLowerCase();
  const senhaPura = String(dadosAdmin.senhaInicial || `Kytto@${Math.floor(1000 + Math.random() * 9000)}`).trim();
  const senhaHash = bcrypt.hashSync(senhaPura, 10);
  const userId = crypto.randomUUID();

  // 1. Inserir no PostgreSQL (usuarios e commerce_memberships)
  try {
    await db.query(
      `INSERT INTO usuarios (id, empresa_id, nome, email, senha_hash, role, ativo)
       VALUES ($1, $2, $3, $4, $5, 'admin', true)
       ON CONFLICT (empresa_id, email) DO UPDATE SET senha_hash = EXCLUDED.senha_hash, ativo = true`,
      [userId, empresaId, nome, email, senhaHash]
    );

    // Buscar role de administrador ou tenant_owner para membership
    const resRole = await db.query(
      `SELECT id FROM commerce_roles WHERE codigo IN ('store_admin', 'tenant_owner') AND empresa_id IS NULL ORDER BY codigo DESC LIMIT 1`
    ).catch(() => ({ rows: [] }));
    
    if (resRole.rows && resRole.rows.length > 0) {
      const roleId = resRole.rows[0].id;
      await db.query(
        `INSERT INTO commerce_memberships (empresa_id, usuario_id, role_id, ativo)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (empresa_id, usuario_id, role_id) DO NOTHING`,
        [empresaId, userId, roleId]
      ).catch(() => null);
    }
  } catch (err) {
    console.warn('[onboarding] Aviso ao persistir usuário no PostgreSQL:', err.message);
  }

  // 2. Inserir no Datastore JSON Kytto para login imediato
  try {
    const rootDb = getDb();
    rootDb.usuarios ||= [];
    const username = email.split('@')[0].replace(/[^a-z0-9_]/g, '') || `user_${Date.now()}`;
    
    const idx = rootDb.usuarios.findIndex(u => (u.email && u.email.toLowerCase() === email) || (u.username && u.username.toLowerCase() === username));
    const usuarioJson = {
      id: userId,
      username,
      nome,
      email,
      senhaHash,
      role: 'organizador',
      empresaId,
      criadoEm: new Date().toISOString(),
      ativo: true
    };

    if (idx >= 0) {
      rootDb.usuarios[idx] = { ...rootDb.usuarios[idx], ...usuarioJson };
    } else {
      rootDb.usuarios.push(usuarioJson);
    }
    saveDb();
  } catch (err) {
    console.warn('[onboarding] Aviso ao persistir usuário no Datastore JSON:', err.message);
  }

  return {
    id: userId,
    nome,
    email,
    senhaInicial: senhaPura,
    empresaId,
    role: 'admin'
  };
}

/**
 * Provisiona Storefront Alias e Configuração Fiscal Inicial
 */
export async function provisionarIntegracoesIniciais(db, empresaId, lojaId, dadosEmpresa = {}) {
  const nomeFantasia = dadosEmpresa.nome || dadosEmpresa.nomeFantasia || 'Empresa';
  const slug = gerarSlug(nomeFantasia);

  // 1. Storefront Alias
  try {
    const aliasId = crypto.randomUUID();
    const storefrontId = crypto.randomUUID();
    await db.query(
      `INSERT INTO commerce_storefront_aliases (
        id, empresa_id, brand_key, alias, storefront_id, public_config, ativo
      ) VALUES ($1, $2, $3, $4, $5, $6, true)
      ON CONFLICT DO NOTHING`,
      [
        aliasId,
        empresaId,
        slug,
        slug,
        storefrontId,
        JSON.stringify({
          displayName: nomeFantasia,
          tagline: `${nomeFantasia} — Atendimento de excelência pelo ERP Kytto`,
          contact: { email: dadosEmpresa.email || '', phone: dadosEmpresa.telefone || '' },
          address: {
            street: dadosEmpresa.enderecoLogradouro || '',
            number: dadosEmpresa.enderecoNumero || '',
            city: dadosEmpresa.enderecoCidade || '',
            state: dadosEmpresa.enderecoEstado || ''
          }
        })
      ]
    ).catch(() => null);
  } catch (err) {
    // ignora se tabela não existir
  }

  // 2. Fiscal Inicial (fis_emitentes e fis_numeracao)
  try {
    const cnpj = String(dadosEmpresa.cnpj || '').replace(/\D/g, '') || '00000000000000';
    const emitId = crypto.randomUUID();
    await db.query(
      `INSERT INTO fis_emitentes (
        id, empresa_id, loja_id, cnpj, razao_social, nome_fantasia, ie, im, crt, uf,
        ambiente, ativo
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '1', $9, 'homologacao', true)
      ON CONFLICT DO NOTHING`,
      [
        emitId,
        empresaId,
        lojaId,
        cnpj,
        dadosEmpresa.razaoSocial || nomeFantasia,
        nomeFantasia,
        dadosEmpresa.inscricaoEstadual || null,
        dadosEmpresa.inscricaoMunicipal || null,
        dadosEmpresa.enderecoEstado || 'MT'
      ]
    ).catch(() => null);

    // Série inicial de NFC-e
    await db.query(
      `INSERT INTO fis_numeracao (empresa_id, emitente_id, modelo, serie, ultimo_numero)
       VALUES ($1, $2, '65', 1, 0)
       ON CONFLICT DO NOTHING`,
      [empresaId, emitId]
    ).catch(() => null);
  } catch (err) {
    // ignora se fis_emitentes não existir no schema
  }
}
