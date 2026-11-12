import { db, save } from './db.js';

export const PALATARE_EMPRESA_ID = 'c1c1ac01-8e50-4b61-8c79-de4aaa916da9';
export const PALATARE_LOJA_ID = 'c1c1ac01-8e50-4b61-8c79-de4aaa916da0';
export const PALATARE_CNPJ = '31.002.650/0001-08';
export const PALATARE_CNPJ_NUM = '31002650000108';

export const PALATARE_DADOS_EMPRESA = {
  id: PALATARE_EMPRESA_ID,
  nome: 'Palatare Pizzaria & Restaurante',
  nomeFantasia: 'Palatare Pizzaria',
  razaoSocial: 'Palatare Restaurante e Pizzaria LTDA',
  cnpj: PALATARE_CNPJ,
  inscricaoEstadual: '13.789.456-1',
  inscricaoMunicipal: '99201',
  tipoNegocio: 'restaurante',
  segmento: 'alimentacao',
  telefone: '(65) 99999-0090',
  whatsapp: '(65) 99999-0090',
  instagram: '@palataretga',
  instagramUrl: 'https://www.instagram.com/palataretga/',
  email: 'contato@palatarepizzaria.com.br',
  website: 'https://palatare.kytto.com.br',
  enderecoLogradouro: 'Rua João do Prado Arantes (Rua 14)',
  enderecoNumero: '307 W',
  enderecoComplemento: 'Setor W',
  enderecoBairro: 'Centro',
  enderecoCidade: 'Tangará da Serra',
  enderecoEstado: 'MT',
  enderecoCep: '78300076',
  horarioFuncionamento: 'Terça a Domingo das 18:00 às 23:00 (Segunda-feira fechado)',
  rodizioDias: 'Terças, Quartas e Sextas-feiras',
  avaliacaoNota: '4.7 ★',
  avaliacaoFonte: 'Google & Restaurant Guru (Top #2 Pizzaria de Tangará da Serra)',
  logoUrl: '/palatare-logo.png',
  bannerUrl: '/palatare-banner.png',
  ativa: true,
  permitirEstoqueNegativo: false,
  totalLojas: 1,
};

export const PALATARE_CARDAPIO_INICIAL = [
  // Destaques da Casa & Rodízio Oficial
  { nome: 'Rodízio de Pizzas Tradicional Palatare (Ter, Qua e Sex)', categoria: 'Rodízio & Experiências', setor: 'cozinha', preco: 59.90, unidade: 'pessoa', estoque: 100, minimo: 10, ordem: 5, descricao: 'Mais de 30 sabores doces e salgados assados no ponto perfeito, massas artesanais e calzones servidos à vontade à mesa.' },

  // Pizzas Mais Pedidas & Especiais de Tangará da Serra
  { nome: 'Pizza de Picanha Especial da Palatare (Grande 8 Fatias)', categoria: 'Pizzas Especiais', setor: 'cozinha', preco: 89.00, unidade: 'un', estoque: 40, minimo: 10, ordem: 10, descricao: 'Eleita favorita pelos clientes de Tangará: lâminas de picanha grelhada ao ponto, muçarela especial, alho tostado crocante, vinagrete da casa e orégano fresco.' },
  { nome: 'Pizza Filé Mignon ao Gorgonzola (Grande 8 Fatias)', categoria: 'Pizzas Especiais', setor: 'cozinha', preco: 92.00, unidade: 'un', estoque: 35, minimo: 10, ordem: 20, descricao: 'Carro-chefe da casa: tiras suculentas de filé mignon grelhado, muçarela, molho pelati italiano, creme de gorgonzola dolce e cebola caramelizada.' },
  { nome: 'Pizza Carne Seca com Catupiry Original (Grande 8 Fatias)', categoria: 'Pizzas Especiais', setor: 'cozinha', preco: 78.00, unidade: 'un', estoque: 35, minimo: 10, ordem: 30, descricao: 'Carne seca artesanal desfiada na manteiga de garrafa, cebola roxa fininha, muçarela e generosa cobertura de Catupiry original.' },
  { nome: 'Pizza Palatare da Casa (Parma, Figos & Rúcula)', categoria: 'Pizzas Especiais', setor: 'cozinha', preco: 89.00, unidade: 'un', estoque: 30, minimo: 5, ordem: 40, descricao: 'Molho de tomate San Marzano, presunto de Parma italiano, figos caramelizados no balsâmico, rúcula fresca e lascas de Grana Padano.' },
  { nome: 'Pizza Camarão ao Catupiry Trufado (Grande)', categoria: 'Pizzas Especiais', setor: 'cozinha', preco: 98.00, unidade: 'un', estoque: 25, minimo: 5, ordem: 50, descricao: 'Camarões rosa salteados no azeite extravirgem e alho confit, muçarela, Catupiry original e finalização com azeite trufado.' },
  { nome: 'Pizza Shimeji & Cogumelos Frescos no Alho Poró', categoria: 'Pizzas Especiais', setor: 'cozinha', preco: 82.00, unidade: 'un', estoque: 25, minimo: 5, ordem: 60, descricao: 'Mix selecionado de cogumelos shimeji frescos salteados na manteiga e shoyu, rodelas de alho-poró e queijo muçarela artesanal.' },
  { nome: 'Pizza Pepperoni Importado & Mel Picante (Grande)', categoria: 'Pizzas Especiais', setor: 'cozinha', preco: 79.00, unidade: 'un', estoque: 30, minimo: 8, ordem: 70, descricao: 'Fatias generosas de pepperoni premium crocante, muçarela, fios de mel de flor de laranjeira infusionado com pimenta dedo-de-moça.' },

  // Pizzas Tradicionais
  { nome: 'Pizza Calabresa Artesanal Especial (Grande 8 Fatias)', categoria: 'Pizzas Tradicionais', setor: 'cozinha', preco: 68.00, unidade: 'un', estoque: 50, minimo: 10, ordem: 80, descricao: 'Molho pelati italiano, muçarela artesanal, calabresa defumada fatiada, cebola roxa e orégano fresco.' },
  { nome: 'Pizza Margherita Di Bufala & Manjericão (Grande)', categoria: 'Pizzas Tradicionais', setor: 'cozinha', preco: 72.00, unidade: 'un', estoque: 40, minimo: 10, ordem: 90, descricao: 'Molho pelati, muçarela de búfala fresca, rodelas de tomate caqui, queijo parmesão ralado na hora e folhas de manjericão fresco.' },
  { nome: 'Pizza Quatro Queijos Nobres (Grande 8 Fatias)', categoria: 'Pizzas Tradicionais', setor: 'cozinha', preco: 76.00, unidade: 'un', estoque: 40, minimo: 10, ordem: 100, descricao: 'Muçarela fatiada, provolone defumado, gorgonzola italiano cremoso e catupiry original forneados.' },
  { nome: 'Pizza Frango com Catupiry Original (Grande 8 Fatias)', categoria: 'Pizzas Tradicionais', setor: 'cozinha', preco: 70.00, unidade: 'un', estoque: 45, minimo: 10, ordem: 110, descricao: 'Peito de frango desfiado temperado com ervas finas, milho verde selecionado e Catupiry original cremoso.' },
  { nome: 'Pizza Portuguesa Tradicional (Grande 8 Fatias)', categoria: 'Pizzas Tradicionais', setor: 'cozinha', preco: 74.00, unidade: 'un', estoque: 35, minimo: 8, ordem: 120, descricao: 'Presunto cozido nobre, muçarela, ovos cozidos, cebola em rodelas, ervilhas frescas e azeitonas pretas chilenas.' },

  // Calzones Tradicionais
  { nome: 'Calzone Tradicional Palatare Especial', categoria: 'Calzones & Massas Fechadas', setor: 'cozinha', preco: 68.00, unidade: 'un', estoque: 20, minimo: 5, ordem: 130, descricao: 'Massa artesanal assada em formato meia-lua, recheada com muçarela, presunto parma, tomate concassé, manjericão e catupiry, polvilhada com parmesão.' },
  { nome: 'Calzone Quatro Queijos & Alho Poró', categoria: 'Calzones & Massas Fechadas', setor: 'cozinha', preco: 64.00, unidade: 'un', estoque: 20, minimo: 5, ordem: 140, descricao: 'Massa crocante por fora e cremosa por dentro, recheio de muçarela, provolone, gorgonzola, catupiry e tiras de alho-poró.' },

  // Bordas Recheadas
  { nome: 'Borda Recheada de Catupiry Original', categoria: 'Bordas Recheadas', setor: 'cozinha', preco: 14.00, unidade: 'un', estoque: 100, minimo: 20, ordem: 150, descricao: 'Borda artesanal enrolada e recheada com legítimo Catupiry cremoso.' },
  { nome: 'Borda Recheada de Cheddar Cremoso', categoria: 'Bordas Recheadas', setor: 'cozinha', preco: 14.00, unidade: 'un', estoque: 100, minimo: 20, ordem: 160, descricao: 'Borda recheada com queijo cheddar cremoso especial para pizza.' },
  { nome: 'Borda Recheada de Chocolate ao Leite Derretido', categoria: 'Bordas Recheadas', setor: 'cozinha', preco: 16.00, unidade: 'un', estoque: 100, minimo: 20, ordem: 170, descricao: 'Borda recheada com generoso chocolate ao leite nobre forneado e derretido.' },

  // Pizzas Doces
  { nome: 'Pizza Doce Nutella com Morangos Frescos', categoria: 'Pizzas Doces', setor: 'cozinha', preco: 62.00, unidade: 'un', estoque: 30, minimo: 6, ordem: 180, descricao: 'Generosa camada de Nutella original, fatias de morangos frescos selecionados e raspas de chocolate belga ao leite.' },
  { nome: 'Pizza Doce Banana Nevada com Canela e Mel', categoria: 'Pizzas Doces', setor: 'cozinha', preco: 54.00, unidade: 'un', estoque: 30, minimo: 6, ordem: 190, descricao: 'Fatias de banana caramelizadas, creme de queijo suave, canela em pó, leite condensado e gotas de chocolate branco forneadas.' },

  // Pratos & Massas
  { nome: 'Lasanha à Bolonhesa Clássica Palatare', categoria: 'Pratos & Massas', setor: 'cozinha', preco: 52.00, unidade: 'prato', estoque: 20, minimo: 5, ordem: 200, descricao: 'Massa artesanal fresca feita na casa, ragu de carnes selecionadas lentamente cozido por 6 horas, molho bechamel cremoso e gratinada com queijo parmesão.' },
  { nome: 'Fettuccine ao Molho Alfredo com Tiras de Filé', categoria: 'Pratos & Massas', setor: 'cozinha', preco: 58.00, unidade: 'prato', estoque: 25, minimo: 5, ordem: 210, descricao: 'Massa artesanal fettuccine fresca envolta em molho alfredo clássico de manteiga da terra, creme de leite fresco e queijo parmesão, com medalhão de filé mignon.' },
  { nome: 'Gnocchi de Batata ao Pomodoro & Burrata', categoria: 'Pratos & Massas', setor: 'cozinha', preco: 56.00, unidade: 'prato', estoque: 20, minimo: 5, ordem: 220, descricao: 'Nhoque artesanal leve de batata asterix, molho pomodoro de tomates rasteiros com manjericão e coração de burrata fresca inteira.' },

  // Entradas & Petiscos
  { nome: 'Bruschetta Tradicional Pomodoro & Basílico (4 un)', categoria: 'Entradas & Petiscos', setor: 'cozinha', preco: 28.00, unidade: 'porcao', estoque: 40, minimo: 10, ordem: 230, descricao: 'Pão italiano ciabatta tostado com azeite de alho, tomates concassé marinados no azeite extravirgem, manjericão fresco e lascas de parmesão.' },
  { nome: 'Carpaccio de Filé Mignon com Alcaparras', categoria: 'Entradas & Petiscos', setor: 'cozinha', preco: 44.00, unidade: 'porcao', estoque: 20, minimo: 5, ordem: 240, descricao: 'Finas lâminas de filé mignon cru temperado, molho clássico de alcaparras, mostarda dijon e azeite, rúcula selvagem e lascas de grana padano.' },

  // Vinhos & Adega
  { nome: 'Vinho Tinto Cabernet Sauvignon Reserva 750ml', categoria: 'Vinhos & Adega', setor: 'bar', preco: 98.00, unidade: 'garrafa', estoque: 24, minimo: 6, ordem: 250, descricao: 'Vinho tinto seco encorpado com notas de frutas vermelhas maduras, baunilha e taninos sedosos. Harmonização perfeita com carnes e massas.' },

  // Bebidas & Chopps
  { nome: 'Chopp Pilsen Artesanal 500ml', categoria: 'Bebidas & Chopps', setor: 'bar', preco: 15.00, unidade: 'copo', estoque: 100, minimo: 20, ordem: 260, descricao: 'Chopp pilsen artesanal gelado, cremoso e refrescante tirado na torneira.' },
  { nome: 'Cerveja Long Neck Stella Artois 330ml', categoria: 'Bebidas & Chopps', setor: 'bar', preco: 12.00, unidade: 'garrafa', estoque: 60, minimo: 15, ordem: 270, descricao: 'Cerveja premium puro malte clássica gelada.' },
  { nome: 'Refrigerante Lata 350ml (Coca / Guaraná)', categoria: 'Bebidas & Chopps', setor: 'bar', preco: 7.50, unidade: 'lata', estoque: 80, minimo: 20, ordem: 280, descricao: 'Refrigerante lata gelado (Coca-Cola Original, Zero ou Guaraná Antarctica).' },
  { nome: 'Água Mineral com Gás 500ml', categoria: 'Bebidas & Chopps', setor: 'bar', preco: 5.00, unidade: 'garrafa', estoque: 60, minimo: 15, ordem: 290, descricao: 'Água mineral natural gaseificada gelada.' },
  { nome: 'Suco Natural de Laranja 500ml', categoria: 'Bebidas & Chopps', setor: 'bar', preco: 12.00, unidade: 'copo', estoque: 40, minimo: 10, ordem: 300, descricao: 'Suco 100% natural espremido na hora da fruta selecionada.' },

  // Sobremesas
  { nome: 'Petit Gâteau com Sorvete de Creme', categoria: 'Sobremesas', setor: 'cozinha', preco: 32.00, unidade: 'un', estoque: 20, minimo: 5, ordem: 310, descricao: 'Bolo de chocolate com recheio cremoso quente, acompanhado de sorvete de creme artesanal.' },
  { nome: 'Tiramisù Italiano Clássico', categoria: 'Sobremesas', setor: 'cozinha', preco: 28.00, unidade: 'un', estoque: 15, minimo: 4, ordem: 320, descricao: 'Sobremesa clássica italiana com biscoitos savoiardi embebidos em café, creme de queijo mascarpone e cacau em pó.' }
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

const SENHA_PADRAO_HASH = '$2a$10$GhTXS1zakV8wRo77OFp2JOvCJj9ezTUPg75ZbBupWek/RBR/.SHcq';

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

  // 1. Cadastros Mestres no JSON (para persistência e fallback offline)
  try {
    rootDb.cadastrosMestresKytto ||= {};
    rootDb.cadastrosMestresKytto.empresas ||= {};
    rootDb.cadastrosMestresKytto.empresas[PALATARE_EMPRESA_ID] = {
      ...PALATARE_DADOS_EMPRESA,
      criadaEm: rootDb.cadastrosMestresKytto.empresas[PALATARE_EMPRESA_ID]?.criadaEm || new Date().toISOString(),
      atualizadaEm: new Date().toISOString(),
    };

    // Usuários da Palatare no JSON
    rootDb.usuarios ||= [];
    const usuariosSeed = [
      { id: 'usr-palatare-gerente-01', username: 'palatare', email: 'contato@palatarepizzaria.com.br', emailAlt: 'admin@palatarepizzaria.com.br', nome: 'Gerente Palatare', role: 'organizador' },
      { id: 'usr-palatare-pizzaiolo-01', username: 'pizzaiolo', email: 'cozinha@palatarepizzaria.com.br', nome: 'Chef Pizzaiolo Palatare', role: 'operador' },
      { id: 'usr-palatare-atendente-01', username: 'atendente_palatare', email: 'atendimento@palatarepizzaria.com.br', nome: 'Atendente Salão & Delivery', role: 'operador' },
    ];

    for (const u of usuariosSeed) {
      const idx = rootDb.usuarios.findIndex(item => 
        (item.id && item.id === u.id) ||
        (item.username && item.username.toLowerCase() === u.username.toLowerCase()) ||
        (item.email && item.email.toLowerCase() === u.email.toLowerCase())
      );
      const userPayload = {
        id: u.id,
        username: u.username,
        nome: u.nome,
        email: u.email,
        emailAlternativo: u.emailAlt || '',
        senhaHash: SENHA_PADRAO_HASH,
        role: u.role,
        empresaId: PALATARE_EMPRESA_ID,
        lojaId: PALATARE_LOJA_ID,
        ativo: true,
        criadoEm: new Date().toISOString()
      };
      if (idx >= 0) {
        rootDb.usuarios[idx] = { 
          ...rootDb.usuarios[idx], 
          ...userPayload, 
          senhaHash: rootDb.usuarios[idx].senhaHash || SENHA_PADRAO_HASH,
          id: u.id 
        };
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

  // 2. Sincronizar no PostgreSQL (empresas, lojas, bar_produtos, bar_mesas)
  if (commerceDb && typeof commerceDb.query === 'function') {
    try {
      // 2.1 Tabela empresas
      await commerceDb.query(`
        INSERT INTO empresas (
          id, nome, cnpj, razao_social, tipo_negocio
        ) VALUES (
          $1, $2, $3, $4, $5
        ) ON CONFLICT (id) DO UPDATE SET
          nome = EXCLUDED.nome,
          razao_social = EXCLUDED.razao_social,
          cnpj = EXCLUDED.cnpj,
          tipo_negocio = EXCLUDED.tipo_negocio
      `, [
        PALATARE_EMPRESA_ID,
        PALATARE_DADOS_EMPRESA.nome,
        PALATARE_CNPJ_NUM,
        PALATARE_DADOS_EMPRESA.razaoSocial,
        'restaurante'
      ]);

      // 2.2 Tabela lojas
      await commerceDb.query(`
        INSERT INTO lojas (
          id, empresa_id, codigo, nome
        ) VALUES (
          $1, $2, 'PALATARE-MATRIZ', $3
        ) ON CONFLICT (id) DO UPDATE SET
          nome = EXCLUDED.nome
      `, [
        PALATARE_LOJA_ID,
        PALATARE_EMPRESA_ID,
        'Palatare Pizzaria · Matriz & Salão'
      ]);

      // 2.3 Produtos do Cardápio (bar_produtos)
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

      // 2.4 Mesas (bar_mesas)
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
    } catch (sqlErr) {
      console.warn('[palatare-seed] Aviso no PostgreSQL:', sqlErr.message);
    }
  }

  return resultados;
}
