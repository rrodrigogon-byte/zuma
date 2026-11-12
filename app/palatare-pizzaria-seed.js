// ============================================================================
// PROVISIONAMENTO OFICIAL — PALATARE PIZZARIA & RESTAURANTE
// Empresa gastronômica de pizzas artesanais, restaurante e salão no Kytto ERP
// ============================================================================
import bcrypt from 'bcryptjs';
import { db, save } from './db.js';

export const PALATARE_EMPRESA_ID = 'c1c1ac01-8e50-4b61-8c79-de4aaa916da9';
export const PALATARE_LOJA_ID = 'loj-palatare-matriz-01';
export const PALATARE_CNPJ = '52.184.920/0001-00';
export const PALATARE_CNPJ_NUM = '52184920000100';

export const PALATARE_DADOS_EMPRESA = {
  id: PALATARE_EMPRESA_ID,
  nome: 'Palatare Pizzaria & Restaurante',
  nomeFantasia: 'Palatare Pizzaria',
  razaoSocial: 'PALATARE PIZZARIA E RESTAURANTE LTDA',
  cnpj: PALATARE_CNPJ,
  cnpjNormalizado: PALATARE_CNPJ_NUM,
  inscricaoEstadual: '13.789.456-1',
  inscricaoMunicipal: '45890',
  tipoNegocio: 'restaurante',
  segmento: 'gastronomia',
  telefone: '(65) 3326-8000',
  whatsapp: '(65) 99988-7766',
  email: 'contato@palatarepizzaria.com.br',
  website: 'https://palatare.kytto.com.br',
  logoUrl: '/palatare-logo.png',
  enderecoLogradouro: 'Av. Brasil',
  enderecoNumero: '850',
  enderecoComplemento: 'Centro',
  enderecoBairro: 'Centro',
  enderecoCidade: 'Tangará da Serra',
  enderecoEstado: 'MT',
  enderecoCep: '78300000',
  endereco: 'Av. Brasil, nº 850, Centro, Tangará da Serra/MT, CEP 78300-000',
  ativa: true,
  permitirEstoqueNegativo: true,
  totalLojas: 1,
  cores: {
    accent: '#E53935',
    accentStrong: '#B71C1C',
    background: '#111111',
    surface: '#1A1A1A',
    text: '#F8FAFC'
  }
};

export const PALATARE_CARDAPIO_INICIAL = [
  // Pizzas Tradicionais
  { nome: 'Pizza Calabresa Artesanal (8 Fatias)', categoria: 'Pizzas Tradicionais', setor: 'cozinha', preco: 68.00, unidade: 'un', estoque: 50, minimo: 10, ordem: 10, descricao: 'Molho de tomate italiano, muçarela especial, calabresa artesanal fatiada, cebola roxa e orégano fresco.' },
  { nome: 'Pizza Margherita Especial (8 Fatias)', categoria: 'Pizzas Tradicionais', setor: 'cozinha', preco: 72.00, unidade: 'un', estoque: 40, minimo: 10, ordem: 20, descricao: 'Molho pelati, muçarela de búfala, rodelas de tomate maduro, folhas frescas de manjericão e azeite extravirgem.' },
  { nome: 'Pizza Quatro Queijos Nobres (8 Fatias)', categoria: 'Pizzas Tradicionais', setor: 'cozinha', preco: 78.00, unidade: 'un', estoque: 45, minimo: 10, ordem: 30, descricao: 'Muçarela especial, queijo gorgonzola, provolone defumado e catupiry original.' },
  { nome: 'Pizza Portuguesa Tradicional (8 Fatias)', categoria: 'Pizzas Tradicionais', setor: 'cozinha', preco: 74.00, unidade: 'un', estoque: 35, minimo: 10, ordem: 40, descricao: 'Presunto magro em cubos, muçarela, ovos cozidos, cebola fresca, ervilha e azeitonas pretas chilenas.' },
  { nome: 'Pizza Frango com Catupiry Original (8 Fatias)', categoria: 'Pizzas Tradicionais', setor: 'cozinha', preco: 75.00, unidade: 'un', estoque: 40, minimo: 10, ordem: 50, descricao: 'Peito de frango desfiado temperado com ervas finas e generosa camada de Catupiry original.' },
  { nome: 'Pizza Pepperoni Crocante (8 Fatias)', categoria: 'Pizzas Tradicionais', setor: 'cozinha', preco: 79.00, unidade: 'un', estoque: 30, minimo: 8, ordem: 60, descricao: 'Muçarela especial, fatias crocantes de pepperoni premium e toque leve de páprica.' },

  // Pizzas Especiais / Premium Palatare
  { nome: 'Pizza Palatare Especial (Costela & Barbecue)', categoria: 'Pizzas Especiais', setor: 'cozinha', preco: 89.00, unidade: 'un', estoque: 30, minimo: 8, ordem: 70, descricao: 'Costela bovina desfiada marinada por 12 horas, muçarela, cebola caramelizada e molho barbecue artesanal.' },
  { nome: 'Pizza Parma & Rúcula Selvagem', categoria: 'Pizzas Especiais', setor: 'cozinha', preco: 94.00, unidade: 'un', estoque: 25, minimo: 6, ordem: 80, descricao: 'Muçarela de búfala, lâminas de presunto de Parma curado, rúcula selvagem fresca e lascas de parmesão regadas no azeite.' },
  { nome: 'Pizza Queijo Brie com Geleia de Pimenta', categoria: 'Pizzas Especiais', setor: 'cozinha', preco: 88.00, unidade: 'un', estoque: 25, minimo: 6, ordem: 90, descricao: 'Base de muçarela especial, fatias generosas de queijo Brie francês e geleia agridoce de pimenta dedo-de-moça.' },

  // Pizzas Doces
  { nome: 'Pizza Doce Nutella com Morangos Frescos', categoria: 'Pizzas Doces', setor: 'cozinha', preco: 65.00, unidade: 'un', estoque: 25, minimo: 5, ordem: 100, descricao: 'Base de chocolate suave, Nutella pura espalhada e morangos frescos fatiados.' },
  { nome: 'Pizza Doce Romeu e Julieta Artesanal', categoria: 'Pizzas Doces', setor: 'cozinha', preco: 58.00, unidade: 'un', estoque: 20, minimo: 5, ordem: 110, descricao: 'Goiabada cascão cremosa derretida coberta com queijo minas padrão artesanal.' },

  // Pratos & Massas
  { nome: 'Lasanha à Bolonhesa Gratinada 600g', categoria: 'Pratos & Massas', setor: 'cozinha', preco: 58.00, unidade: 'un', estoque: 20, minimo: 5, ordem: 120, descricao: 'Massa fresca caseira, ragù de carne bovina cozido lentamente, molho bechamel e parmesão gratinado.' },
  { nome: 'Fettuccine ao Molho Alfredo com Tiras de Filé', categoria: 'Pratos & Massas', setor: 'cozinha', preco: 62.00, unidade: 'un', estoque: 20, minimo: 5, ordem: 130, descricao: 'Fettuccine artesanal envolto em molho Alfredo amanteigado com lascas de filé mignon grelhado.' },
  { nome: 'Filé Mignon à Parmegiana com Arroz e Fritas', categoria: 'Pratos & Massas', setor: 'cozinha', preco: 79.00, unidade: 'un', estoque: 15, minimo: 4, ordem: 140, descricao: 'Filé mignon empanado crocante, coberto com molho de tomate caseiro e muçarela gratinada. Acompanha arroz e batatas rústicas.' },

  // Entradas & Antepastos
  { nome: 'Bruschetta Pomodoro Tradicional (4 un)', categoria: 'Entradas & Antepastos', setor: 'cozinha', preco: 32.00, unidade: 'un', estoque: 30, minimo: 8, ordem: 150, descricao: 'Pão italiano tostado no azeite, cubos de tomate fresco temperados com alho, manjericão e redução balsâmica.' },
  { nome: 'Focaccia de Alecrim com Parmesão e Azeite', categoria: 'Entradas & Antepastos', setor: 'cozinha', preco: 28.00, unidade: 'un', estoque: 30, minimo: 8, ordem: 160, descricao: 'Massa de fermentação natural com flor de sal, alecrim fresco, queijo parmesão e azeite extravirgem.' },
  { nome: 'Batata Rústica Trufada com Parmesão', categoria: 'Entradas & Antepastos', setor: 'cozinha', preco: 38.00, unidade: 'un', estoque: 35, minimo: 10, ordem: 170, descricao: 'Batatas rústicas douradas com alecrim, finalizadas com azeite trufado e parmesão ralado.' },

  // Vinhos & Adega
  { nome: 'Vinho Tinto Cabernet Sauvignon Reserva 750ml', categoria: 'Vinhos & Adega', setor: 'bar', preco: 98.00, unidade: 'garrafa', estoque: 24, minimo: 6, ordem: 180, descricao: 'Vinho tinto seco encorpado com notas de frutas vermelhas maduras, carvalho e baunilha.' },

  // Bebidas & Chopps
  { nome: 'Chopp Pilsen Artesanal 500ml', categoria: 'Bebidas & Chopps', setor: 'bar', preco: 15.00, unidade: 'copo', estoque: 100, minimo: 20, ordem: 190, descricao: 'Chopp pilsen artesanal gelado, cremoso e refrescante tirado na torneira.' },
  { nome: 'Cerveja Long Neck Stella Artois 330ml', categoria: 'Bebidas & Chopps', setor: 'bar', preco: 12.00, unidade: 'garrafa', estoque: 60, minimo: 15, ordem: 200, descricao: 'Cerveja premium puro malte clássica gelada.' },
  { nome: 'Refrigerante Lata 350ml (Coca / Guaraná)', categoria: 'Bebidas & Chopps', setor: 'bar', preco: 7.50, unidade: 'lata', estoque: 80, minimo: 20, ordem: 210, descricao: 'Refrigerante lata gelado (Coca-Cola Original, Zero ou Guaraná Antarctica).' },
  { nome: 'Água Mineral com Gás 500ml', categoria: 'Bebidas & Chopps', setor: 'bar', preco: 5.00, unidade: 'garrafa', estoque: 60, minimo: 15, ordem: 220, descricao: 'Água mineral natural gaseificada gelada.' },
  { nome: 'Suco Natural de Laranja 500ml', categoria: 'Bebidas & Chopps', setor: 'bar', preco: 12.00, unidade: 'copo', estoque: 40, minimo: 10, ordem: 230, descricao: 'Suco 100% natural espremido na hora.' },

  // Sobremesas
  { nome: 'Petit Gâteau com Sorvete de Creme', categoria: 'Sobremesas', setor: 'cozinha', preco: 32.00, unidade: 'un', estoque: 20, minimo: 5, ordem: 240, descricao: 'Bolo de chocolate com recheio cremoso quente, acompanhado de sorvete de creme artesanal.' },
  { nome: 'Tiramisù Italiano Clássico', categoria: 'Sobremesas', setor: 'cozinha', preco: 28.00, unidade: 'un', estoque: 15, minimo: 4, ordem: 250, descricao: 'Sobremesa clássica italiana com biscoitos savoiardi embebidos em café, creme de queijo mascarpone e cacau em pó.' }
];

export const PALATARE_MESAS_INICIAIS = [
  // Mesas físicas Salão Principal (1 a 15)
  ...Array.from({ length: 15 }, (_, i) => ({ numero: i + 1, nome: `Mesa ${i + 1} · Salão`, tipo: 'fisica' })),
  // Mesas físicas Varanda / Área Externa (16 a 20)
  ...Array.from({ length: 5 }, (_, i) => ({ numero: i + 16, nome: `Mesa ${i + 16} · Varanda`, tipo: 'fisica' })),
  // Mesas virtuais para Balcão e Delivery
  { numero: 101, nome: 'Balcão / Retirada', tipo: 'virtual' },
  { numero: 102, nome: 'Delivery / WhatsApp', tipo: 'virtual' }
];

/**
 * Provisiona a Palatare Pizzaria & Restaurante no Datastore JSON e PostgreSQL
 */
export async function provisionarPalatarePizzaria({ commerceDb } = {}) {
  const rootDb = db();
  const resultados = {
    empresaProvisionada: false,
    produtosCriados: 0,
    mesasCriadas: 0,
    usuariosProvisionados: 0
  };

  // 1. Sincronizar no Datastore JSON Kytto
  try {
    rootDb.cadastrosMestresKytto ||= {};
    rootDb.cadastrosMestresKytto.empresas ||= {};
    rootDb.cadastrosMestresKytto.empresas[PALATARE_EMPRESA_ID] = {
      ...PALATARE_DADOS_EMPRESA,
      criadaEm: rootDb.cadastrosMestresKytto.empresas[PALATARE_EMPRESA_ID]?.criadaEm || new Date().toISOString(),
      atualizadaEm: new Date().toISOString(),
    };

    // Usuário administrador da Palatare no JSON
    rootDb.usuarios ||= [];
    const usuariosSeed = [
      { id: 'usr-palatare-gerente-01', username: 'palatare', email: 'contato@palatarepizzaria.com.br', emailAlt: 'admin@palatarepizzaria.com.br', nome: 'Gerente Palatare', role: 'organizador' },
      { id: 'usr-palatare-pizzaiolo-01', username: 'pizzaiolo', email: 'cozinha@palatarepizzaria.com.br', nome: 'Chef Pizzaiolo Palatare', role: 'operador' },
      { id: 'usr-palatare-atendente-01', username: 'atendente_palatare', email: 'atendimento@palatarepizzaria.com.br', nome: 'Atendente Salão & Delivery', role: 'operador' },
    ];

    const senhaHashPadrao = bcrypt.hashSync('123456', 10);
    for (const u of usuariosSeed) {
      const idx = rootDb.usuarios.findIndex(item => 
        (item.username && item.username.toLowerCase() === u.username.toLowerCase()) ||
        (item.email && item.email.toLowerCase() === u.email.toLowerCase())
      );
      const userPayload = {
        id: u.id,
        username: u.username,
        nome: u.nome,
        email: u.email,
        emailAlternativo: u.emailAlt || '',
        senhaHash: senhaHashPadrao,
        role: u.role,
        empresaId: PALATARE_EMPRESA_ID,
        lojaId: PALATARE_LOJA_ID,
        ativo: true,
        criadoEm: new Date().toISOString()
      };
      if (idx >= 0) {
        rootDb.usuarios[idx] = { ...rootDb.usuarios[idx], ...userPayload, id: rootDb.usuarios[idx].id || u.id };
      } else {
        rootDb.usuarios.push(userPayload);
      }
      resultados.usuariosProvisionados++;
    }

    save();
    resultados.empresaProvisionada = true;
  } catch (err) {
    console.warn('[palatare-seed] Aviso ao salvar Palatare no Datastore JSON:', err.message);
  }

  // 2. Sincronizar no PostgreSQL (empresas, lojas, negocios, bar_produtos, bar_mesas, usuarios, commerce_memberships)
  if (commerceDb && typeof commerceDb.query === 'function') {
    try {
      // 2.1 Tabela empresas
      await commerceDb.query(`
        INSERT INTO empresas (
          id, nome, razao_social, cnpj, inscricao_estadual, inscricao_municipal, tipo_negocio,
          telefone, email, website, endereco_logradouro, endereco_numero, endereco_complemento,
          endereco_bairro, endereco_cidade, endereco_estado, endereco_cep, ativa
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, true
        ) ON CONFLICT (id) DO UPDATE SET
          nome = EXCLUDED.nome,
          razao_social = EXCLUDED.razao_social,
          cnpj = EXCLUDED.cnpj,
          inscricao_estadual = EXCLUDED.inscricao_estadual,
          tipo_negocio = EXCLUDED.tipo_negocio,
          telefone = EXCLUDED.telefone,
          email = EXCLUDED.email,
          website = EXCLUDED.website,
          endereco_cidade = EXCLUDED.endereco_cidade,
          endereco_estado = EXCLUDED.endereco_estado,
          ativa = true
      `, [
        PALATARE_EMPRESA_ID,
        PALATARE_DADOS_EMPRESA.nome,
        PALATARE_DADOS_EMPRESA.razaoSocial,
        PALATARE_CNPJ_NUM,
        PALATARE_DADOS_EMPRESA.inscricaoEstadual,
        PALATARE_DADOS_EMPRESA.inscricaoMunicipal,
        'restaurante',
        PALATARE_DADOS_EMPRESA.telefone,
        PALATARE_DADOS_EMPRESA.email,
        PALATARE_DADOS_EMPRESA.website,
        PALATARE_DADOS_EMPRESA.enderecoLogradouro,
        PALATARE_DADOS_EMPRESA.enderecoNumero,
        PALATARE_DADOS_EMPRESA.enderecoComplemento,
        PALATARE_DADOS_EMPRESA.enderecoBairro,
        PALATARE_DADOS_EMPRESA.enderecoCidade,
        PALATARE_DADOS_EMPRESA.enderecoEstado,
        PALATARE_DADOS_EMPRESA.enderecoCep
      ]);

      // 2.2 Tabela lojas
      await commerceDb.query(`
        INSERT INTO lojas (
          id, empresa_id, codigo, nome, cnpj, telefone, email,
          endereco_logradouro, endereco_numero, endereco_bairro,
          endereco_cidade, endereco_estado, endereco_cep, ativa
        ) VALUES (
          $1, $2, 'PALATARE-MATRIZ', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true
        ) ON CONFLICT (id) DO UPDATE SET
          nome = EXCLUDED.nome,
          telefone = EXCLUDED.telefone,
          email = EXCLUDED.email,
          ativa = true
      `, [
        PALATARE_LOJA_ID,
        PALATARE_EMPRESA_ID,
        'Palatare Pizzaria · Matriz & Salão',
        PALATARE_CNPJ_NUM,
        PALATARE_DADOS_EMPRESA.telefone,
        PALATARE_DADOS_EMPRESA.email,
        PALATARE_DADOS_EMPRESA.enderecoLogradouro,
        PALATARE_DADOS_EMPRESA.enderecoNumero,
        PALATARE_DADOS_EMPRESA.enderecoBairro,
        PALATARE_DADOS_EMPRESA.enderecoCidade,
        PALATARE_DADOS_EMPRESA.enderecoEstado,
        PALATARE_DADOS_EMPRESA.enderecoCep
      ]);

      // 2.3 Tabela negocios
      await commerceDb.query(`
        INSERT INTO negocios (
          id, empresa_id, tipo, nome, situacao, modulos_ligados
        ) VALUES (
          gen_random_uuid(), $1, 'restaurante', 'Gastronomia, Pizzaria & Bar', 'ativo',
          $2::text[]
        ) ON CONFLICT DO NOTHING
      `, [
        PALATARE_EMPRESA_ID,
        ['erp_comum', 'bar', 'restaurante', 'cardapio', 'mesas', 'cozinha', 'kds', 'caixa', 'comanda', 'delivery', 'estoque', 'financeiro', 'fiscal', 'whatsapp']
      ]).catch(() => null);

      // 2.4 Storefront alias
      await commerceDb.query(`
        INSERT INTO commerce_storefront_aliases (
          id, empresa_id, loja_id, brand_key, host, ativo
        ) VALUES (
          gen_random_uuid(), $1, $2, 'palatare', 'palatare.kytto.com.br', true
        ) ON CONFLICT DO NOTHING
      `, [PALATARE_EMPRESA_ID, PALATARE_LOJA_ID]).catch(() => null);

      // 2.5 Produtos do Cardápio (bar_produtos)
      for (const p of PALATARE_CARDAPIO_INICIAL) {
        try {
          await commerceDb.query(`
            INSERT INTO bar_produtos (
              empresa_id, nome, categoria, setor, preco, unidade, fator_estoque, estoque_atual, estoque_minimo, ordem, ativo
            ) VALUES (
              $1, $2, $3, $4, $5, $6, 1, $7, $8, $9, true
            ) ON CONFLICT (empresa_id, nome) DO UPDATE SET
              preco = EXCLUDED.preco,
              categoria = EXCLUDED.categoria,
              setor = EXCLUDED.setor,
              unidade = EXCLUDED.unidade,
              estoque_atual = EXCLUDED.estoque_atual,
              estoque_minimo = EXCLUDED.estoque_minimo,
              ordem = EXCLUDED.ordem,
              ativo = true
          `, [
            PALATARE_EMPRESA_ID,
            p.nome,
            p.categoria,
            p.setor,
            p.preco,
            p.unidade,
            p.estoque,
            p.minimo,
            p.ordem
          ]);
          resultados.produtosCriados++;
        } catch (prodErr) {
          console.warn(`[palatare-seed] Aviso ao inserir produto ${p.nome}:`, prodErr.message);
        }
      }

      // 2.6 Mesas (bar_mesas)
      for (const m of PALATARE_MESAS_INICIAIS) {
        try {
          await commerceDb.query(`
            INSERT INTO bar_mesas (
              empresa_id, numero, nome, tipo, ativa
            ) VALUES (
              $1, $2, $3, $4, true
            ) ON CONFLICT (empresa_id, numero) DO UPDATE SET
              nome = EXCLUDED.nome,
              tipo = EXCLUDED.tipo,
              ativa = true
          `, [
            PALATARE_EMPRESA_ID,
            m.numero,
            m.nome,
            m.tipo
          ]);
          resultados.mesasCriadas++;
        } catch (mesaErr) {
          console.warn(`[palatare-seed] Aviso ao inserir mesa ${m.numero}:`, mesaErr.message);
        }
      }

      // 2.7 Usuários e Memberships no PostgreSQL
      const senhaHash = bcrypt.hashSync('123456', 10);
      const resRoleOwner = await commerceDb.query(`
        SELECT id FROM commerce_roles WHERE codigo IN ('store_admin', 'tenant_owner') AND empresa_id IS NULL ORDER BY codigo DESC LIMIT 1
      `).catch(() => ({ rows: [] }));
      const roleIdOwner = resRoleOwner.rows?.[0]?.id || 'b125e523-957d-4d12-a881-56b958ecec45';

      const usuariosPg = [
        { email: 'contato@palatarepizzaria.com.br', nome: 'Gerente Palatare', role: 'gerente', isOwner: true },
        { email: 'cozinha@palatarepizzaria.com.br', nome: 'Chef Pizzaiolo Palatare', role: 'operador', isOwner: false },
        { email: 'atendimento@palatarepizzaria.com.br', nome: 'Atendente Salão & Delivery', role: 'operador', isOwner: false },
      ];

      for (const u of usuariosPg) {
        try {
          const updateRes = await commerceDb.query(`
            UPDATE usuarios 
               SET nome_completo = $1, role = $2, empresa_id = $3, ativo = true, data_atualizacao = NOW()
             WHERE lower(btrim(email)) = $4
             RETURNING id
          `, [u.nome, u.role, PALATARE_EMPRESA_ID, u.email.toLowerCase()]);

          let uid = updateRes.rows?.[0]?.id;
          if (!uid) {
            const insertRes = await commerceDb.query(`
              INSERT INTO usuarios (id, email, senha_hash, nome_completo, role, empresa_id, ativo, data_criacao, data_atualizacao)
              VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true, NOW(), NOW())
              RETURNING id
            `, [u.email.toLowerCase(), senhaHash, u.nome, u.role, PALATARE_EMPRESA_ID]);
            uid = insertRes.rows?.[0]?.id;
          }

          if (uid) {
            await commerceDb.query(`
              INSERT INTO commerce_memberships (id, usuario_id, empresa_id, loja_id, role_id, ativo, criado_em, atualizado_em)
              VALUES (gen_random_uuid(), $1, $2, $3, $4, true, NOW(), NOW())
              ON CONFLICT (empresa_id, usuario_id, role_id) DO UPDATE SET ativo = true, atualizado_em = NOW()
            `, [uid, PALATARE_EMPRESA_ID, u.isOwner ? null : PALATARE_LOJA_ID, roleIdOwner]).catch(() => null);
          }
        } catch (uErr) {
          console.warn(`[palatare-seed] Aviso ao criar usuário ${u.email} no PG:`, uErr.message);
        }
      }

    } catch (pgErr) {
      console.warn('[palatare-seed] Aviso ao sincronizar Palatare no PostgreSQL:', pgErr.message);
    }
  }

  return resultados;
}
