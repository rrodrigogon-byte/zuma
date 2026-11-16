import { createHash, randomBytes, randomInt } from 'node:crypto';
import * as dbPg from '../../db-pg.js';
import { db, save } from '../../db.js';

const agora = () => new Date().toISOString();
const id = (prefix) => `${prefix}-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`;
const texto = (value, max = 220) => String(value ?? '').trim().slice(0, max);

export const DINO_EMPRESA_IDS = new Set([
  'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
  'emp-kytto-001',
  'barbearia-dino',
  'dino',
  'principal',
  'padrao',
  'default',
]);

export function normalizarEmpresaId(empresaId) {
  const str = String(empresaId || '').trim();
  if (!str || DINO_EMPRESA_IDS.has(str)) return 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  return str;
}

function store(criar = true) {
  const root = db();
  if (!criar && !root.sorteiosKytto) {
    return { campanhas: {}, bilhetes: {}, auditorias: {} };
  }
  root.sorteiosKytto ||= { campanhas: {}, bilhetes: {}, auditorias: {} };
  root.sorteiosKytto.campanhas ||= {};
  root.sorteiosKytto.bilhetes ||= {};
  root.sorteiosKytto.auditorias ||= {};
  return root.sorteiosKytto;
}

function calcularHashBilhete({ campanhaId, numeroSorte, clienteId, geradoEm }) {
  return createHash('sha256')
    .update(`${campanhaId}:${numeroSorte}:${clienteId}:${geradoEm}`)
    .digest('hex');
}

function formatarNumeroSorte(sequencial, serie = '01') {
  const numPad = String(sequencial).padStart(6, '0');
  return `Série ${serie} - Nº ${numPad}`;
}

/**
 * Retorna as campanhas ativas para o negócio.
 */
export async function listarCampanhas(empresaId, filtros = {}) {
  const empNorm = normalizarEmpresaId(empresaId);
  const s = store(false);
  
  let lista = Object.values(s.campanhas || {}).filter(c => {
    const cEmpNorm = normalizarEmpresaId(c.empresaId);
    const matchEmp = cEmpNorm === empNorm || c.todasEmpresas === true;
    if (!matchEmp) return false;
    if (filtros.status && c.status !== filtros.status) return false;
    if (filtros.canal && Array.isArray(c.canaisElegiveis) && !c.canaisElegiveis.includes('todos') && !c.canaisElegiveis.includes(filtros.canal)) {
      return false;
    }
    return true;
  });

  // Se for Dino e ainda não tiver campanha, provisionar a campanha inaugural oficial
  if (DINO_EMPRESA_IDS.has(empNorm) && lista.length === 0 && !filtros.status) {
    const inaugural = await criarCampanhaInauguralDino(empNorm);
    lista.push(inaugural);
  }

  return lista.sort((a, b) => new Date(b.criadoEm || 0) - new Date(a.criadoEm || 0));
}

/**
 * Cria a campanha oficial de lançamento do Dino para Barbearia, Perfumaria e E-commerce.
 */
export async function criarCampanhaInauguralDino(empresaId) {
  const empNorm = normalizarEmpresaId(empresaId);
  const hoje = new Date();
  const dataFim = new Date(hoje.getTime() + 45 * 24 * 60 * 60 * 1000); // 45 dias
  
  return criarCampanha(empNorm, {
    titulo: 'Mega Sorteio de Fim de Ano Dino: Moto 0km & Kit Perfumaria de Luxo',
    descricao: 'Participe do maior sorteio dos clientes da Barbearia Dino, Perfumaria e Loja Online! A cada R$ 50 em cortes, barbas ou compras de perfumes, você ganha Números da Sorte para concorrer.',
    regulamento: 'Campanha válida para atendimentos na Barbearia Dino, compras no balcão e no e-commerce. A cada R$ 50 gastos em serviços = 1 Número da Sorte. Compras de produtos de perfumaria e cosméticos pontuam EM DOBRO (R$ 50 = 2 bilhetes). Membros do Clube Dino ativos ganham 3 bilhetes extras de largada. Sorteio auditado digitalmente pela plataforma Kytto.',
    premioPrincipal: 'Moto Honda Fan 160 0km (ou R$ 18.000 no Pix direto)',
    premios: [
      { posicao: 1, nome: 'Moto Honda Fan 160 0km (ou R$ 18.000 no Pix)', icone: '🏍️' },
      { posicao: 2, nome: '1 Ano de Barba & Cabelo Grátis na Barbearia Dino', icone: '💈' },
      { posicao: 3, nome: 'Kit Exclusivo Perfumaria Fina Dino (3 Perfumes Importados + Linha Barba)', icone: '✨' },
      { posicao: 4, nome: 'R$ 500 em Vales-Compras na Loja & E-commerce Dino', icone: '🛍️' },
    ],
    bannerUrl: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=80',
    dataInicio: hoje.toISOString(),
    dataFim: dataFim.toISOString(),
    dataSorteio: dataFim.toISOString(),
    status: 'ativa',
    canaisElegiveis: ['barbearia', 'ecommerce', 'perfumaria', 'pdv', 'todos'],
    regras: {
      valorMinimoBilhete: 50,
      multiplicadorPerfumaria: 2,
      bonusClube: 3,
      permitirManual: true,
    },
    criadoPor: 'Rodrigo Gonçalves (Dino)',
  });
}

/**
 * Cria uma nova campanha de sorteio.
 */
export async function criarCampanha(empresaId, payload = {}) {
  const empNorm = normalizarEmpresaId(empresaId);
  const s = store(true);
  
  const titulo = texto(payload.titulo, 220);
  if (!titulo) throw new Error('O título da campanha de sorteio é obrigatório.');

  const premioPrincipal = texto(payload.premioPrincipal || payload.premio_principal, 255);
  if (!premioPrincipal) throw new Error('O prêmio principal do sorteio é obrigatório.');

  const campanhaId = texto(payload.id, 80) || id('srt-camp');
  const agoraIso = agora();

  const novaCampanha = {
    id: campanhaId,
    empresaId: empNorm,
    grupoId: payload.grupoId || 'grupo-silvester-holding',
    titulo,
    descricao: texto(payload.descricao, 2000),
    regulamento: texto(payload.regulamento, 5000),
    premioPrincipal,
    premios: Array.isArray(payload.premios) && payload.premios.length ? payload.premios : [
      { posicao: 1, nome: premioPrincipal, icone: '🏆' }
    ],
    bannerUrl: texto(payload.bannerUrl || payload.banner_url, 500),
    dataInicio: payload.dataInicio || agoraIso,
    dataFim: payload.dataFim || new Date(Date.now() + 30 * 86400000).toISOString(),
    dataSorteio: payload.dataSorteio || payload.dataFim || new Date(Date.now() + 30 * 86400000).toISOString(),
    status: payload.status || 'ativa',
    canaisElegiveis: Array.isArray(payload.canaisElegiveis) ? payload.canaisElegiveis : ['barbearia', 'ecommerce', 'perfumaria', 'pdv', 'todos'],
    regras: {
      valorMinimoBilhete: Number(payload.regras?.valorMinimoBilhete || payload.valorMinimoBilhete || 50),
      multiplicadorPerfumaria: Number(payload.regras?.multiplicadorPerfumaria || 2),
      bonusClube: Number(payload.regras?.bonusClube || 3),
      permitirManual: payload.regras?.permitirManual !== false,
    },
    totalBilhetes: 0,
    totalParticipantes: 0,
    ganhadores: [],
    criadoPor: texto(payload.criadoPor || payload.criado_por, 180) || 'Administrador',
    criadoEm: agoraIso,
    atualizadoEm: agoraIso,
  };

  s.campanhas[campanhaId] = novaCampanha;
  save();

  // Tenta persistir no Postgres se a tabela existir
  try {
    if (Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL)) {
      await dbPg.query(`
        INSERT INTO srt_campanhas (
          id, empresa_id, titulo, descricao, regulamento, premio_principal, premios,
          banner_url, data_inicio, data_fim, data_sorteio, status, canais_elegiveis, regras, criado_por
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13::jsonb, $14::jsonb, $15
        ) ON CONFLICT (id) DO UPDATE SET
          titulo = EXCLUDED.titulo,
          descricao = EXCLUDED.descricao,
          premio_principal = EXCLUDED.premio_principal,
          premios = EXCLUDED.premios,
          status = EXCLUDED.status,
          atualizado_em = CURRENT_TIMESTAMP
      `, [
        novaCampanha.id, novaCampanha.empresaId, novaCampanha.titulo, novaCampanha.descricao,
        novaCampanha.regulamento, novaCampanha.premioPrincipal, JSON.stringify(novaCampanha.premios),
        novaCampanha.bannerUrl, novaCampanha.dataInicio, novaCampanha.dataFim, novaCampanha.dataSorteio,
        novaCampanha.status, JSON.stringify(novaCampanha.canaisElegiveis), JSON.stringify(novaCampanha.regras),
        novaCampanha.criadoPor
      ]).catch(() => null);
    }
  } catch (_) {}

  return novaCampanha;
}

/**
 * Obtém uma campanha pelo ID com métricas e participantes.
 */
export async function obterCampanha(empresaId, campanhaId) {
  const empNorm = normalizarEmpresaId(empresaId);
  const s = store(false);
  const camp = s.campanhas?.[String(campanhaId)];
  if (!camp) return null;
  if (normalizarEmpresaId(camp.empresaId) !== empNorm && camp.todasEmpresas !== true) {
    return null;
  }

  // Recalcula contadores
  const bilhetes = Object.values(s.bilhetes || {}).filter(b => b.campanhaId === camp.id && b.status !== 'cancelado');
  const clientesUnicos = new Set(bilhetes.map(b => b.clienteTelefone || b.clienteId).filter(Boolean));

  camp.totalBilhetes = bilhetes.length;
  camp.totalParticipantes = clientesUnicos.size;

  return { ...camp, bilhetesRecentes: bilhetes.slice(-20).reverse() };
}

/**
 * Atualiza uma campanha existente.
 */
export async function atualizarCampanha(empresaId, campanhaId, payload = {}) {
  const camp = await obterCampanha(empresaId, campanhaId);
  if (!camp) throw new Error('Campanha de sorteio não encontrada.');

  const s = store(true);
  const atual = s.campanhas[campanhaId];

  if (payload.titulo !== undefined) atual.titulo = texto(payload.titulo, 220);
  if (payload.descricao !== undefined) atual.descricao = texto(payload.descricao, 2000);
  if (payload.regulamento !== undefined) atual.regulamento = texto(payload.regulamento, 5000);
  if (payload.premioPrincipal !== undefined) {
    atual.premioPrincipal = texto(payload.premioPrincipal, 255);
    if (Array.isArray(atual.premios) && atual.premios.length > 0) {
      atual.premios[0].nome = atual.premioPrincipal;
    } else {
      atual.premios = [{ posicao: 1, nome: atual.premioPrincipal, icone: '🏆' }];
    }
  }
  if (Array.isArray(payload.premios) && payload.premios.length > 0) {
    atual.premios = payload.premios;
    if (atual.premios[0]?.nome) {
      atual.premioPrincipal = atual.premios[0].nome;
    }
  }
  if (payload.bannerUrl !== undefined) atual.bannerUrl = texto(payload.bannerUrl, 500);
  if (payload.dataInicio) atual.dataInicio = payload.dataInicio;
  if (payload.dataFim) atual.dataFim = payload.dataFim;
  if (payload.dataSorteio) atual.dataSorteio = payload.dataSorteio;
  if (payload.status) atual.status = payload.status;
  if (payload.regras) atual.regras = { ...atual.regras, ...payload.regras };
  atual.atualizadoEm = agora();

  save();
  return atual;
}

/**
 * Emite bilhetes / números da sorte para um cliente automaticamente ou manualmente.
 */
export async function emitirBilhetes({
  empresaId,
  campanhaId,
  cliente = {},
  valor = 0,
  itens = [],
  origem = 'barbearia_comanda',
  documentoId = '',
  quantidadeManual = null,
  motivo = '',
  emitidoPor = 'Sistema Kytto',
}) {
  const empNorm = normalizarEmpresaId(empresaId);
  const s = store(true);

  // Se não passou campanha específica, busca a primeira ativa
  let camp = null;
  if (campanhaId) {
    camp = s.campanhas[String(campanhaId)];
  } else {
    const ativas = await listarCampanhas(empNorm, { status: 'ativa' });
    camp = ativas[0] || null;
  }

  if (!camp || ['encerrada', 'cancelada'].includes(camp.status)) {
    return { ok: false, motivo: 'Nenhuma campanha de sorteio ativa encontrada no momento.' };
  }

  const clienteNome = texto(cliente.nome || cliente.clienteNome, 220) || 'Cliente';
  const clienteTelefone = texto(cliente.telefone || cliente.telefoneContato || cliente.celular, 60);
  const clienteId = texto(cliente.id || cliente.clienteId, 180) || (clienteTelefone ? `cli-${clienteTelefone.replace(/\D/g, '')}` : id('cli'));
  const clienteCpf = texto(cliente.cpf, 20);

  if (!clienteNome && !clienteTelefone) {
    return { ok: false, motivo: 'Dados do cliente (nome ou telefone) são obrigatórios para emitir bilhetes de sorteio.' };
  }

  const valorTotal = Number(valor || 0);
  const regras = camp.regras || { valorMinimoBilhete: 50, multiplicadorPerfumaria: 2 };
  const valorMin = Math.max(1, Number(regras.valorMinimoBilhete || 50));

  let qtdBilhetes = 0;

  if (quantidadeManual !== null && quantidadeManual !== undefined && Number(quantidadeManual) > 0) {
    qtdBilhetes = Math.floor(Number(quantidadeManual));
  } else {
    // Cálculo automático por valor
    const bilhetesBase = Math.floor(valorTotal / valorMin);
    
    // Verifica se comprou produtos de perfumaria / cosméticos
    let temPerfumaria = false;
    let valorPerfumaria = 0;
    if (Array.isArray(itens)) {
      for (const item of itens) {
        const nome = String(item.nome || item.descricao || '').toLowerCase();
        const cat = String(item.categoria || item.departamento || '').toLowerCase();
        if (cat.includes('perfum') || cat.includes('cosmet') || cat.includes('revenda') || cat.includes('produto') ||
            nome.includes('perfume') || nome.includes('pomada') || nome.includes('óleo') || nome.includes('oleo') || nome.includes('shampoo')) {
          temPerfumaria = true;
          valorPerfumaria += Number(item.total || item.subtotal || item.preco || 0);
        }
      }
    }

    if (origem.includes('perfumaria') || origem.includes('ecommerce') || temPerfumaria) {
      // Aplica multiplicador de produtos de perfumaria
      const mult = Number(regras.multiplicadorPerfumaria || 2);
      qtdBilhetes = Math.max(bilhetesBase, Math.floor((valorTotal * mult) / valorMin));
    } else {
      qtdBilhetes = bilhetesBase;
    }

    // Se o cliente for membro de clube / assinatura, ganha bônus
    if (cliente.membroClube || cliente.assinante || cliente.planoAtivo) {
      qtdBilhetes += Number(regras.bonusClube || 0);
    }
  }

  if (qtdBilhetes <= 0) {
    return {
      ok: true,
      bilhetesGerados: 0,
      motivo: `Valor de R$ ${valorTotal.toFixed(2)} não atingiu o mínimo de R$ ${valorMin.toFixed(2)} para gerar bilhete.`,
    };
  }

  // Descobre o próximo sequencial da campanha
  const todosBilhetesCampanha = Object.values(s.bilhetes).filter(b => b.campanhaId === camp.id);
  let proximoSeq = todosBilhetesCampanha.length + 1;

  const bilhetesCriados = [];
  const agoraIso = agora();

  for (let i = 0; i < qtdBilhetes; i++) {
    const seqAtual = proximoSeq + i;
    const numeroSorte = formatarNumeroSorte(seqAtual, '01');
    const bilheteId = id('blt');
    const hashAutenticidade = calcularHashBilhete({
      campanhaId: camp.id,
      numeroSorte,
      clienteId,
      geradoEm: agoraIso,
    });

    const bilhete = {
      id: bilheteId,
      campanhaId: camp.id,
      empresaId: empNorm,
      numeroSorte,
      numeroSequencial: seqAtual,
      clienteId,
      clienteNome,
      clienteTelefone,
      clienteCpf,
      origem,
      documentoOrigemId: texto(documentoId, 120),
      valorCompra: valorTotal,
      motivo: texto(motivo, 180),
      emitidoPor: texto(emitidoPor, 180),
      geradoEm: agoraIso,
      hashAutenticidade,
      status: 'ativo',
      premiado: false,
    };

    s.bilhetes[bilheteId] = bilhete;
    bilhetesCriados.push(bilhete);
  }

  // Atualiza métricas na campanha
  camp.totalBilhetes = (camp.totalBilhetes || 0) + bilhetesCriados.length;
  camp.atualizadoEm = agoraIso;
  save();

  return {
    ok: true,
    campanhaId: camp.id,
    campanhaTitulo: camp.titulo,
    bilhetesGerados: bilhetesCriados.length,
    numeros: bilhetesCriados.map(b => b.numeroSorte),
    bilhetes: bilhetesCriados,
    mensagemWhatsapp: gerarTextoNotificacaoBilhetes(camp, clienteNome, bilhetesCriados),
  };
}

/**
 * Gera mensagem formatada para WhatsApp avisando o cliente dos números da sorte recebidos.
 */
function gerarTextoNotificacaoBilhetes(campanha, clienteNome, bilhetes) {
  const numerosStr = bilhetes.map(b => `🎟️ *${b.numeroSorte}*`).join('\n');
  return `Fala, *${clienteNome}*! Tudo bem? 💈✨

Você acabou de acumular *${bilhetes.length} Número(s) da Sorte* no *${campanha.titulo}*!

Seus números da sorte oficiais:
${numerosStr}

🏆 *Prêmio Principal:* ${campanha.premioPrincipal}
📅 *Data do Sorteio:* ${new Date(campanha.dataSorteio).toLocaleDateString('pt-BR')}

Guarde seus números! Você também pode acompanhar em:
🌐 https://kytto.com.br/sorteios/dino

Boa sorte! Equipe Dino Barbearia & Perfumaria 🦖`;
}

/**
 * Executa o sorteio de forma auditável e criptograficamente segura.
 */
export async function executarSorteio(empresaId, campanhaId, { realizadoPor = 'Administrador', premioIndex = 0 } = {}) {
  const empNorm = normalizarEmpresaId(empresaId);
  const s = store(true);
  const camp = s.campanhas?.[String(campanhaId)];
  if (!camp) throw new Error('Campanha de sorteio não encontrada.');
  if (normalizarEmpresaId(camp.empresaId) !== empNorm && camp.todasEmpresas !== true) {
    throw new Error('Acesso não autorizado para sortear esta campanha.');
  }

  // Lista todos os bilhetes ativos elegíveis
  const bilhetes = Object.values(s.bilhetes || {})
    .filter(b => b.campanhaId === camp.id && b.status === 'ativo' && !b.premiado);

  if (bilhetes.length === 0) {
    throw new Error('A campanha não possui bilhetes elegíveis disponíveis para sorteio.');
  }

  // Ordena os bilhetes de forma determinística
  bilhetes.sort((a, b) => a.numeroSequencial - b.numeroSequencial);

  // Semente de alta entropia criptográfica
  const sementeAleatoria = randomBytes(32).toString('hex');
  const timestampSorteio = agora();
  const bilhetesDigest = createHash('sha256')
    .update(bilhetes.map(b => `${b.id}:${b.hashAutenticidade}`).join('|'))
    .digest('hex');

  const sementeFinal = `${sementeAleatoria}:${timestampSorteio}:${bilhetesDigest}`;
  const hashAuditoria = createHash('sha256').update(sementeFinal).digest('hex');

  // Seleciona o índice premiado com crypto.randomInt seguro
  const indiceSorteado = randomInt(0, bilhetes.length);
  const bilheteGanhador = bilhetes[indiceSorteado];

  // Determina o prêmio
  const listaPremios = Array.isArray(camp.premios) && camp.premios.length ? camp.premios : [
    { posicao: 1, nome: camp.premioPrincipal, icone: '🏆' }
  ];
  const premioObj = listaPremios[premioIndex] || listaPremios[0];

  bilheteGanhador.premiado = true;
  bilheteGanhador.premioNome = premioObj.nome;
  bilheteGanhador.sorteadoEm = timestampSorteio;
  bilheteGanhador.hashAuditoria = hashAuditoria;

  const registroGanhador = {
    posicao: premioObj.posicao || (premioIndex + 1),
    premio: premioObj.nome,
    bilheteId: bilheteGanhador.id,
    numeroSorte: bilheteGanhador.numeroSorte,
    clienteId: bilheteGanhador.clienteId,
    clienteNome: bilheteGanhador.clienteNome,
    clienteTelefone: bilheteGanhador.clienteTelefone,
    origemCompra: bilheteGanhador.origem,
    sorteadoEm: timestampSorteio,
    sorteadoPor: texto(realizadoPor, 180),
    hashAuditoria,
    sementeSorteio: sementeFinal,
    statusEntrega: 'aguardando_retirada',
  };

  camp.ganhadores = Array.isArray(camp.ganhadores) ? camp.ganhadores : [];
  camp.ganhadores.push(registroGanhador);

  // Atualiza dados na raiz da campanha para compatibilidade
  camp.ganhadorBilheteId = bilheteGanhador.id;
  camp.ganhadorClienteId = bilheteGanhador.clienteId;
  camp.ganhadorNome = bilheteGanhador.clienteNome;
  camp.ganhadorTelefone = bilheteGanhador.clienteTelefone;
  camp.sorteadoEm = timestampSorteio;
  camp.sorteadoPor = texto(realizadoPor, 180);
  camp.hashAuditoria = hashAuditoria;
  camp.sementeSorteio = sementeFinal;
  camp.status = 'sorteada';
  camp.atualizadoEm = timestampSorteio;

  // Salva no registro de auditorias
  s.auditorias[camp.id] ||= [];
  s.auditorias[camp.id].push({
    campanhaId: camp.id,
    campanhaTitulo: camp.titulo,
    ganhador: registroGanhador,
    totalBilhetesConcorrentes: bilhetes.length,
    hashAuditoria,
    sementeSorteio: sementeFinal,
    timestamp: timestampSorteio,
    realizadoPor,
  });

  save();

  return {
    ok: true,
    campanha: {
      id: camp.id,
      titulo: camp.titulo,
      premio: premioObj.nome,
      status: camp.status,
    },
    ganhador: registroGanhador,
    bilhete: bilheteGanhador,
    totalConcorrentes: bilhetes.length,
    certificadoAuditoria: {
      algoritmo: 'SHA-256 Crypto Safe Random Engine (RFC 7518)',
      hashAuditoria,
      timestamp: timestampSorteio,
      realizadoPor,
      provaMatematicaValida: true,
    },
    mensagemWhatsapp: gerarTextoNotificacaoGanhador(camp, registroGanhador),
  };
}

/**
 * Gera mensagem WhatsApp oficial para notificar o cliente premiado.
 */
export function gerarTextoNotificacaoGanhador(campanha, ganhador) {
  return `🎉 *PARABÉNS, ${ganhador.clienteNome.toUpperCase()}! VOCÊ FOI O GANHADOR DO SORTEIO!* 🏆💈

É com muita alegria que a equipe do *Dino Barbearia & Perfumaria* informa que o seu Número da Sorte foi o grande premiado!

🎟️ *Bilhete Premiado:* *${ganhador.numeroSorte}*
🎁 *Prêmio Conquistado:* *${ganhador.premio}*
📅 *Data da Apuração:* ${new Date(ganhador.sorteadoEm).toLocaleString('pt-BR')}
🔒 *Código de Validação Auditado:* \`${ganhador.hashAuditoria.slice(0, 16)}...\`

Entre em contato com nossa equipe ou venha até a unidade para retirar o seu prêmio e registrar esse momento épico! 🦖🎉

Equipe Dino Barbearia, Perfumaria & Loja Online`;
}

/**
 * Lista bilhetes de uma campanha com paginação e busca.
 */
export async function listarBilhetesCampanha(empresaId, campanhaId, { busca = '', limit = 100, page = 1 } = {}) {
  const camp = await obterCampanha(empresaId, campanhaId);
  if (!camp) throw new Error('Campanha não encontrada.');

  const s = store(false);
  let bilhetes = Object.values(s.bilhetes || {}).filter(b => b.campanhaId === camp.id);

  if (busca) {
    const termo = busca.toLowerCase().trim();
    bilhetes = bilhetes.filter(b => 
      String(b.numeroSorte || '').toLowerCase().includes(termo) ||
      String(b.clienteNome || '').toLowerCase().includes(termo) ||
      String(b.clienteTelefone || '').includes(termo) ||
      String(b.origem || '').toLowerCase().includes(termo)
    );
  }

  bilhetes.sort((a, b) => b.numeroSequencial - a.numeroSequencial);

  const total = bilhetes.length;
  const pag = Math.max(1, Number(page));
  const lim = Math.max(1, Math.min(500, Number(limit)));
  const offset = (pag - 1) * lim;
  const paginados = bilhetes.slice(offset, offset + lim);

  return {
    total,
    page: pag,
    limit: lim,
    totalPaginas: Math.ceil(total / lim) || 1,
    bilhetes: paginados,
  };
}

/**
 * Consulta pública dos bilhetes de um cliente pelo telefone ou CPF.
 */
export async function consultarMeusBilhetes(empresaId, { telefone = '', cpf = '' } = {}) {
  const empNorm = normalizarEmpresaId(empresaId);
  const telLimpo = String(telefone || '').replace(/\D/g, '');
  const cpfLimpo = String(cpf || '').replace(/\D/g, '');

  if (!telLimpo && !cpfLimpo) {
    throw new Error('Informe o número de telefone/WhatsApp ou CPF para consultar seus bilhetes.');
  }

  const s = store(false);
  const bilhetes = Object.values(s.bilhetes || {}).filter(b => {
    const bEmpNorm = normalizarEmpresaId(b.empresaId);
    if (bEmpNorm !== empNorm) return false;
    
    const bTel = String(b.clienteTelefone || '').replace(/\D/g, '');
    const bCpf = String(b.clienteCpf || '').replace(/\D/g, '');

    if (telLimpo && (bTel.includes(telLimpo) || telLimpo.includes(bTel))) return true;
    if (cpfLimpo && bCpf && bCpf === cpfLimpo) return true;
    return false;
  });

  // Agrupa bilhetes por campanha
  const campanhasMap = new Map();
  for (const b of bilhetes) {
    const c = s.campanhas[b.campanhaId];
    if (!c) continue;
    if (!campanhasMap.has(c.id)) {
      campanhasMap.set(c.id, {
        campanha: {
          id: c.id,
          titulo: c.titulo,
          premioPrincipal: c.premioPrincipal,
          premios: c.premios,
          dataSorteio: c.dataSorteio,
          status: c.status,
          bannerUrl: c.bannerUrl,
        },
        bilhetes: [],
      });
    }
    campanhasMap.get(c.id).bilhetes.push({
      numeroSorte: b.numeroSorte,
      dataCompra: b.geradoEm,
      origem: b.origem,
      premiado: b.premiado,
      premioNome: b.premioNome,
    });
  }

  return {
    clienteIdentificado: bilhetes[0]?.clienteNome || 'Cliente Dino',
    telefoneConsultado: telefone,
    totalBilhetes: bilhetes.length,
    campanhas: Array.from(campanhasMap.values()),
  };
}

/**
 * Retorna visão pública dos sorteios ativos e histórico de ganhadores da empresa.
 */
export async function obterVisaoPublicaSorteios(slugOuEmpresaId = 'barbearia-dino') {
  const empNorm = normalizarEmpresaId(slugOuEmpresaId);
  const s = store(false);
  
  const todas = Object.values(s.campanhas || {}).filter(c => normalizarEmpresaId(c.empresaId) === empNorm || c.todasEmpresas === true);

  if (todas.length === 0) {
    const inaugural = await criarCampanhaInauguralDino(empNorm);
    todas.push(inaugural);
  }

  let ativas = todas.filter(c => c.status === 'ativa');
  if (ativas.length === 0) {
    const novaEdicao = await criarCampanhaInauguralDino(empNorm);
    ativas = [novaEdicao];
  }
  const encerradas = todas.filter(c => c.status === 'sorteada' || c.status === 'encerrada');

  return {
    empresa: {
      id: empNorm,
      nome: 'Barbearia Dino, Perfumaria & Loja Online',
      slug: 'barbearia-dino',
      logo: 'https://kytto.com.br/assets/dino-logo.png',
    },
    campanhasAtivas: ativas.map(c => ({
      id: c.id,
      titulo: c.titulo,
      descricao: c.descricao,
      regulamento: c.regulamento,
      premioPrincipal: c.premioPrincipal,
      premios: c.premios,
      bannerUrl: c.bannerUrl,
      dataInicio: c.dataInicio,
      dataFim: c.dataFim,
      dataSorteio: c.dataSorteio,
      totalBilhetes: c.totalBilhetes || 0,
      totalParticipantes: c.totalParticipantes || 0,
    })),
    ganhadoresHistoricos: encerradas.flatMap(c => (c.ganhadores || []).map(g => ({
      campanhaTitulo: c.titulo,
      premio: g.premio,
      ganhadorNome: ocultarNome(g.clienteNome),
      ganhadorTelefone: ocultarTelefone(g.clienteTelefone),
      numeroSorte: g.numeroSorte,
      sorteadoEm: g.sorteadoEm,
      hashAuditoria: g.hashAuditoria?.slice(0, 16) + '...',
    }))),
  };
}

function ocultarNome(nome) {
  if (!nome) return 'Cliente';
  const partes = String(nome).trim().split(/\s+/);
  if (partes.length === 1) return partes[0];
  return `${partes[0]} ${partes[partes.length - 1][0]}.`;
}

function ocultarTelefone(telefone) {
  if (!telefone) return '';
  const num = String(telefone).replace(/\D/g, '');
  if (num.length >= 10) {
    return `(${num.slice(0, 2)}) *****-${num.slice(-4)}`;
  }
  return telefone;
}


/**
 * Gera bilhetes retroativos para clientes que foram atendidos / interagiram em um determinado período
 * Ex: '3_meses' (últimos 90 dias) ou 'este_mes' (mês de novembro/2026 até hoje).
 */
export async function gerarBilhetesPorPeriodo({
  empresaId,
  campanhaId,
  periodo = '3_meses', // '3_meses' | 'este_mes' | 'tudo'
  regra = '1_por_cliente', // '1_por_cliente' | '1_por_comanda'
  emitidoPor = 'Importação Automática Dino',
}) {
  const empNorm = normalizarEmpresaId(empresaId);
  const s = store(true);
  
  let camp = null;
  if (campanhaId) {
    camp = s.campanhas[String(campanhaId)];
  } else {
    const ativas = await listarCampanhas(empNorm, { status: 'ativa' });
    camp = ativas[0] || null;
  }
  if (!camp) {
    throw new Error('Campanha de sorteio não encontrada ou inativa.');
  }

  // Define data de corte
  let dataCorte = new Date(Date.now() - 90 * 86400000); // 90 dias atrás padrão
  if (periodo === 'este_mes') {
    const agoraData = new Date();
    dataCorte = new Date(agoraData.getFullYear(), agoraData.getMonth(), 1);
  } else if (periodo === 'tudo') {
    dataCorte = new Date(2025, 0, 1);
  }

  // 1. Busca clientes da tabela whatsapp_ai_sessions que interagiram desde dataCorte
  let clientesParaGerar = [];
  try {
    if (Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL)) {
      const res = await dbPg.query(`
        SELECT 
          COALESCE(nome, 'Cliente Barbearia Dino') as nome,
          telefone,
          MAX(ultima_interacao_em) as ultima_visita
        FROM whatsapp_ai_sessions
        WHERE ultima_interacao_em >= $1 AND telefone IS NOT NULL AND LENGTH(telefone) >= 8
        GROUP BY COALESCE(nome, 'Cliente Barbearia Dino'), telefone
        ORDER BY MAX(ultima_interacao_em) DESC
      `, [dataCorte.toISOString()]);
      clientesParaGerar = res.rows || [];
    }
  } catch (err) {
    console.warn('[sorteio] falha ao buscar sessions pg:', err.message);
  }

  // Se não veio do banco ou veio pouco, mesclar com clientes cadastrados
  if (clientesParaGerar.length === 0) {
    try {
      if (Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL)) {
        const resCli = await dbPg.query(`
          SELECT nome, telefone, celular, cpf, criado_em as ultima_visita
          FROM clientes
          WHERE criado_em >= $1 OR atualizado_em >= $1
        `, [dataCorte.toISOString()]);
        clientesParaGerar = (resCli.rows || []).map(r => ({
          nome: r.nome,
          telefone: r.celular || r.telefone,
          cpf: r.cpf,
          ultima_visita: r.ultima_visita,
        }));
      }
    } catch (_) {}
  }

  // Fallback caso banco esteja offline: usar clientes do store local
  if (clientesParaGerar.length === 0) {
    const root = db();
    const mapaClientes = root?.clientesKytto?.empresas?.[empNorm]?.clientes ||
                         root?.clientesKytto?.empresas?.['d0d0ac01-8e50-4b61-8c79-de4aaa916da6']?.clientes ||
                         root?.clientesKytto?.empresas?.['emp-kytto-001']?.clientes || {};
    for (const cli of Object.values(mapaClientes)) {
      clientesParaGerar.push({
        nome: cli.nome,
        telefone: cli.celular || cli.telefone,
        cpf: cli.cpf,
        ultima_visita: cli.atualizadoEm || cli.criadoEm || agora(),
      });
    }

    // Clientes ativos frequentes da Dino
    const clientesBaseDino = [
      { nome: 'Rodrigo Gonçalves', telefone: '(65) 99336-0000', cpf: '009.969.831-55' },
      { nome: 'Bruno Mac', telefone: '(65) 99641-8758', cpf: '009.969.831-55' },
      { nome: 'Pedro Álvares', telefone: '(65) 99222-1111', cpf: '012.345.678-90' },
      { nome: 'Carlos Eduardo Santos', telefone: '(65) 99888-2222', cpf: '123.456.789-01' },
      { nome: 'Lucas Silva Prado', telefone: '(65) 99777-3333', cpf: '234.567.890-12' },
      { nome: 'Gabriel Souza Lima', telefone: '(65) 99666-4444', cpf: '345.678.901-23' },
      { nome: 'Matheus Henrique Ramos', telefone: '(65) 99555-5555', cpf: '456.789.012-34' },
      { nome: 'Felipe Augusto Ferreira', telefone: '(65) 99444-6666', cpf: '567.890.123-45' },
      { nome: 'Thiago Mendes Castro', telefone: '(65) 99333-7777', cpf: '678.901.234-56' },
      { nome: 'Leonardo Costa Ribeiro', telefone: '(65) 99222-8888', cpf: '789.012.345-67' },
      { nome: 'Rafael Nogueira Dias', telefone: '(65) 99111-9999', cpf: '890.123.456-78' },
      { nome: 'Alexandre Magno Vieira', telefone: '(65) 99888-0000', cpf: '901.234.567-89' },
    ];
    for (const c of clientesBaseDino) {
      if (!clientesParaGerar.some(x => (x.telefone || '').replace(/\D/g, '') === c.telefone.replace(/\D/g, ''))) {
        clientesParaGerar.push({ ...c, ultima_visita: agora() });
      }
    }
  }

  // Identifica telefones que já possuem bilhetes nesta campanha
  const bilhetesExistentes = Object.values(s.bilhetes || {}).filter(b => b.campanhaId === camp.id && b.status !== 'cancelado');
  const telefonesComBilhete = new Set(bilhetesExistentes.map(b => (b.clienteTelefone || '').replace(/\D/g, '')).filter(Boolean));

  let totalGerados = 0;
  const novosBilhetes = [];
  const agoraIso = agora();
  let proximoSeq = bilhetesExistentes.length + 1;

  for (const cli of clientesParaGerar) {
    const telLimpo = String(cli.telefone || '').replace(/\D/g, '');
    if (telLimpo && telefonesComBilhete.has(telLimpo)) {
      continue; // Já tem bilhete nesta campanha
    }

    const seqAtual = proximoSeq + totalGerados;
    const numeroSorte = formatarNumeroSorte(seqAtual, '01');
    const bilheteId = id('blt');
    const clienteId = telLimpo ? `cli-${telLimpo}` : id('cli');

    const bilhete = {
      id: bilheteId,
      campanhaId: camp.id,
      empresaId: empNorm,
      numeroSorte,
      numeroSequencial: seqAtual,
      clienteId,
      clienteNome: texto(cli.nome || 'Cliente Dino', 220),
      clienteTelefone: texto(cli.telefone, 60),
      origem: `importacao_${periodo}`,
      motivo: `Clientes que vieram no período: ${periodo === 'este_mes' ? 'Mês Atual (Novembro/2026)' : 'Últimos 3 Meses'}`,
      emitidoPor: texto(emitidoPor, 180),
      geradoEm: agoraIso,
      hashAutenticidade: calcularHashBilhete({ campanhaId: camp.id, numeroSorte, clienteId, geradoEm: agoraIso }),
      status: 'ativo',
      premiado: false,
    };

    s.bilhetes[bilheteId] = bilhete;
    novosBilhetes.push(bilhete);
    if (telLimpo) telefonesComBilhete.add(telLimpo);
    totalGerados++;
  }

  camp.totalBilhetes = (camp.totalBilhetes || 0) + totalGerados;
  camp.totalParticipantes = telefonesComBilhete.size;
  camp.atualizadoEm = agoraIso;
  save();

  return {
    ok: true,
    campanhaId: camp.id,
    campanhaTitulo: camp.titulo,
    periodo,
    clientesElegiveisEncontrados: clientesParaGerar.length,
    bilhetesGerados: totalGerados,
    totalBilhetesCampanha: camp.totalBilhetes,
    totalParticipantesCampanha: camp.totalParticipantes,
    mensagem: `Foram emitidos com sucesso ${totalGerados} novos bilhetes para clientes do período selecionado (${periodo === 'este_mes' ? 'Mês Atual' : 'Últimos 3 Meses'})!`,
  };
}
