import crypto from 'crypto';
import {
  calcularTabela,
  podeFinalizar,
  registrarResultado,
  sortearLiga,
  sortearProximaRodada,
} from './liga.js';
import { applyElo } from './rating.js';

const PLANOS = [
  { id: 'basico', nome: 'Básico', valor: 120 },
  { id: 'prata', nome: 'Prata', valor: 150 },
  { id: 'ouro', nome: 'Ouro', valor: 180 },
  { id: 'diamante', nome: 'Diamante', valor: 240 },
  { id: 'individual', nome: 'Sócio Individual', valor: 120 },
  { id: 'familia', nome: 'Sócio Família', valor: 200 },
  { id: 'atleta', nome: 'Sócio Atleta+', valor: 160 },
];
const STATUS_LIGA = new Set(['inscricoes', 'em_andamento', 'encerrada']);

function id(prefixo) {
  return `${prefixo}-${crypto.randomUUID()}`;
}

function clone(value) {
  return structuredClone(value);
}

function normalizarEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function planoPorValor(value) {
  const recebido = String(value || '').trim().toLowerCase();
  return PLANOS.find((plano) => plano.id === recebido || plano.nome.toLowerCase() === recebido) || PLANOS[0];
}

function publicEmpresaId(cadastrosMestres) {
  // Rotas públicas ficam restritas à empresa pública padrão; o cabeçalho de
  // loja só é aceito pelos middlewares autenticados nas rotas administrativas.
  return cadastrosMestres.EMPRESA_PADRAO_ID;
}

export function registerEsportivoPontosLigas({ app, db, save, cadastrosMestres, requerEditorCatalogo, requerAutenticacao }) {
  const empresaPadraoId = cadastrosMestres.EMPRESA_PADRAO_ID;

  function ensureBuckets() {
    const estado = db();
    let mudou = false;
    if (!estado.sociosPorEmpresa || typeof estado.sociosPorEmpresa !== 'object' || Array.isArray(estado.sociosPorEmpresa)) {
      estado.sociosPorEmpresa = {};
      mudou = true;
    }
    if (!Object.prototype.hasOwnProperty.call(estado.sociosPorEmpresa, empresaPadraoId) && Array.isArray(estado.socios) && estado.socios.length) {
      estado.sociosPorEmpresa[empresaPadraoId] = estado.socios.map((socio) => ({ ...clone(socio), empresaId: empresaPadraoId }));
      mudou = true;
    }
    if (!estado.pontosPorEmpresa || typeof estado.pontosPorEmpresa !== 'object' || Array.isArray(estado.pontosPorEmpresa)) {
      estado.pontosPorEmpresa = {};
      mudou = true;
    }
    if (!Object.prototype.hasOwnProperty.call(estado.pontosPorEmpresa, empresaPadraoId) && Array.isArray(estado.pontos) && estado.pontos.length) {
      estado.pontosPorEmpresa[empresaPadraoId] = estado.pontos.map((ponto) => ({ ...clone(ponto), empresaId: empresaPadraoId }));
      mudou = true;
    }
    if (!estado.ligasPorEmpresa || typeof estado.ligasPorEmpresa !== 'object' || Array.isArray(estado.ligasPorEmpresa)) {
      estado.ligasPorEmpresa = {};
      mudou = true;
    }
    if (!Object.prototype.hasOwnProperty.call(estado.ligasPorEmpresa, empresaPadraoId) && estado.ligas && typeof estado.ligas === 'object' && !Array.isArray(estado.ligas)) {
      estado.ligasPorEmpresa[empresaPadraoId] = Object.fromEntries(
        Object.entries(estado.ligas).map(([chave, liga]) => [chave, { ...clone(liga), empresaId: empresaPadraoId }])
      );
      mudou = true;
    }
    if (!estado.rankingPorEmpresa || typeof estado.rankingPorEmpresa !== 'object' || Array.isArray(estado.rankingPorEmpresa)) {
      estado.rankingPorEmpresa = {};
      mudou = true;
    }
    if (!Object.prototype.hasOwnProperty.call(estado.rankingPorEmpresa, empresaPadraoId) && estado.ranking && typeof estado.ranking === 'object') {
      estado.rankingPorEmpresa[empresaPadraoId] = clone(estado.ranking);
      mudou = true;
    }
    if (!estado.eloPorEmpresa || typeof estado.eloPorEmpresa !== 'object' || Array.isArray(estado.eloPorEmpresa)) {
      estado.eloPorEmpresa = {};
      mudou = true;
    }
    if (!Object.prototype.hasOwnProperty.call(estado.eloPorEmpresa, empresaPadraoId) && estado.elo && typeof estado.elo === 'object') {
      estado.eloPorEmpresa[empresaPadraoId] = clone(estado.elo);
      mudou = true;
    }
    if (mudou) save();
    return estado;
  }

  function socios(empresaId) {
    const estado = ensureBuckets();
    estado.sociosPorEmpresa[empresaId] ||= [];
    return estado.sociosPorEmpresa[empresaId];
  }

  function pontos(empresaId) {
    const estado = ensureBuckets();
    estado.pontosPorEmpresa[empresaId] ||= [];
    return estado.pontosPorEmpresa[empresaId];
  }

  function ligas(empresaId) {
    const estado = ensureBuckets();
    estado.ligasPorEmpresa[empresaId] ||= {};
    return estado.ligasPorEmpresa[empresaId];
  }

  function ranking(empresaId) {
    const estado = ensureBuckets();
    estado.rankingPorEmpresa[empresaId] ||= { players: {}, arquivados: {} };
    return estado.rankingPorEmpresa[empresaId];
  }

  function elo(empresaId) {
    const estado = ensureBuckets();
    estado.eloPorEmpresa[empresaId] ||= { players: {} };
    return estado.eloPorEmpresa[empresaId];
  }

  function saldoPontos(empresaId, socioId) {
    return pontos(empresaId)
      .filter((ponto) => String(ponto.socioId) === String(socioId))
      .reduce((total, ponto) => total + Number(ponto.pontos || 0), 0);
  }

  function socioPorId(empresaId, socioId) {
    return socios(empresaId).find((socio) => String(socio.id) === String(socioId));
  }

  function publicarSocio(socio, empresaId) {
    const faturas = Array.isArray(socio.faturas) ? socio.faturas : [];
    const hoje = new Date().toISOString().slice(0, 10);
    const vencida = faturas.some((fatura) => fatura.status !== 'paga' && fatura.venc && fatura.venc < hoje);
    const saldo = faturas
      .filter((fatura) => fatura.status !== 'paga')
      .reduce((total, fatura) => total + Number(fatura.valor || 0), 0);
    socio.status = vencida ? 'late' : 'ok';
    socio.faturas = faturas;
    return {
      ...clone(socio),
      empresaId,
      saldo,
      limite: Number(socio.limite || 0),
      status: socio.status,
      faturas: faturas.slice().sort((a, b) => String(b.ref || b.venc || '').localeCompare(String(a.ref || a.venc || ''))),
    };
  }

  function ligaResumo(liga) {
    const ativos = (liga.inscricoes || []).filter((inscricao) => inscricao.status === 'ativo');
    return {
      id: liga.id,
      nome: liga.nome,
      temporada: liga.temporada,
      categoria: liga.categoria,
      formato: liga.formato,
      status: liga.status,
      rodadaAtual: liga.rodadaAtual || 0,
      totalRodadas: (liga.rodadas || []).length,
      descricao: liga.descricao || '',
      config: liga.config || {},
      criadoEm: liga.criadoEm || liga.criadaEm || null,
      inscricoes: ativos.length,
      inscritosAtivos: ativos.length,
    };
  }

  function ligaDetalhe(liga, incluirContato = true) {
    const inscritos = (liga.inscricoes || []).filter((inscricao) => inscricao.status === 'ativo');
    return {
      ...clone(liga),
      inscricoes: incluirContato
        ? inscritos
        : inscritos.map(({ id, nome, inscritoEm }) => ({ id, nome, inscritoEm })),
      rodadas: clone(liga.rodadas || []),
      tabela: calcularTabela(liga),
    };
  }

  function obterLiga(empresaId, ligaId) {
    return ligas(empresaId)[String(ligaId)] || null;
  }

  function configLiga(config = {}) {
    return {
      pontosVitoria: Number.isFinite(Number(config.pontosVitoria)) ? Number(config.pontosVitoria) : 3,
      pontosDerrota: Number.isFinite(Number(config.pontosDerrota)) ? Number(config.pontosDerrota) : 1,
      pontosWO: Number.isFinite(Number(config.pontosWO)) ? Number(config.pontosWO) : 0,
      pontosBye: Number.isFinite(Number(config.pontosBye)) ? Number(config.pontosBye) : 2,
      maxRodadas: config.maxRodadas === null || config.maxRodadas === undefined || config.maxRodadas === '' ? 7 : Math.max(1, Number(config.maxRodadas)),
    };
  }

  // ── Sócios ────────────────────────────────────────────────────────────────
  app.get('/api/socio-planos', (_req, res) => res.json(PLANOS));

  app.get('/api/admin/socios', requerEditorCatalogo, (req, res) => {
    res.json(socios(req.empresaId).map((socio) => publicarSocio(socio, req.empresaId)));
  });

  app.post('/api/admin/socios', requerEditorCatalogo, (req, res) => {
    const body = req.body || {};
    const nome = String(body.nome || '').trim();
    const email = normalizarEmail(body.email);
    if (!nome || !email) return res.status(400).json({ error: 'informe nome e e-mail do sócio' });
    if (socios(req.empresaId).some((socio) => normalizarEmail(socio.email) === email)) return res.status(409).json({ error: 'este cliente já é sócio' });
    const plano = planoPorValor(body.plano);
    const agora = new Date();
    const vencimento = new Date(agora);
    vencimento.setDate(10);
    if (vencimento <= agora) vencimento.setMonth(vencimento.getMonth() + 1);
    const socio = {
      id: id('socio'), empresaId: req.empresaId, usuarioId: body.usuarioId || null,
      nome, email, telefone: String(body.telefone || body.tel || '').trim(),
      plano: plano.id, planoNome: plano.nome, valor: plano.valor,
      limite: Math.max(0, Number(body.limite || 0)), cardCode: `SOC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      desde: agora.toISOString(), status: 'ok',
      faturas: [{ id: id('fat'), ref: `${vencimento.getFullYear()}-${String(vencimento.getMonth() + 1).padStart(2, '0')}`, valor: plano.valor, venc: vencimento.toISOString().slice(0, 10), status: 'aberta', criadoEm: agora.toISOString() }],
    };
    socios(req.empresaId).push(socio);
    save();
    res.status(201).json(publicarSocio(socio, req.empresaId));
  });

  app.patch('/api/admin/socios/:id', requerEditorCatalogo, (req, res) => {
    const socio = socioPorId(req.empresaId, req.params.id);
    if (!socio) return res.status(404).json({ error: 'sócio não encontrado' });
    const body = req.body || {};
    if (body.nome !== undefined) socio.nome = String(body.nome).trim();
    if (body.email !== undefined) socio.email = normalizarEmail(body.email);
    if (body.limite !== undefined) socio.limite = Math.max(0, Number(body.limite || 0));
    if (body.status !== undefined) socio.status = String(body.status);
    if (body.plano !== undefined) {
      const plano = planoPorValor(body.plano);
      socio.plano = plano.id; socio.planoNome = plano.nome; socio.valor = plano.valor;
    }
    if (body.vencimento && socio.faturas?.length) socio.faturas[socio.faturas.length - 1].venc = String(body.vencimento).slice(0, 10);
    save();
    res.json(publicarSocio(socio, req.empresaId));
  });

  app.delete('/api/admin/socios/:id', requerEditorCatalogo, (req, res) => {
    const lista = socios(req.empresaId);
    const indice = lista.findIndex((socio) => String(socio.id) === String(req.params.id));
    if (indice < 0) return res.status(404).json({ error: 'sócio não encontrado' });
    lista.splice(indice, 1); save(); res.json({ ok: true });
  });

  app.post('/api/admin/socios/:id/fatura', requerEditorCatalogo, (req, res) => {
    const socio = socioPorId(req.empresaId, req.params.id);
    if (!socio) return res.status(404).json({ error: 'sócio não encontrado' });
    const data = new Date(); data.setMonth(data.getMonth() + 1);
    const ref = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
    if ((socio.faturas || []).some((fatura) => fatura.ref === ref)) return res.status(409).json({ error: 'fatura deste mês já existe' });
    socio.faturas ||= [];
    socio.faturas.push({ id: id('fat'), ref, valor: Number(req.body?.valor || socio.valor || 0), descricao: String(req.body?.descricao || 'Mensalidade'), venc: new Date(data.getFullYear(), data.getMonth(), 10).toISOString().slice(0, 10), status: 'aberta', criadoEm: new Date().toISOString() });
    save(); res.json(publicarSocio(socio, req.empresaId));
  });

  app.post('/api/admin/socios/:id/pagar', requerEditorCatalogo, (req, res) => {
    const socio = socioPorId(req.empresaId, req.params.id);
    if (!socio) return res.status(404).json({ error: 'sócio não encontrado' });
    const fatura = (socio.faturas || []).find((item) => String(item.id) === String(req.body?.faturaId));
    if (!fatura) return res.status(404).json({ error: 'fatura não encontrada' });
    fatura.status = 'paga'; fatura.pagaEm = new Date().toISOString(); save(); res.json(publicarSocio(socio, req.empresaId));
  });

  // ── Programa de Pontos ────────────────────────────────────────────────────
  app.get('/api/admin/pontos', requerEditorCatalogo, (req, res) => {
    let lista = pontos(req.empresaId);
    if (req.query?.socioId) lista = lista.filter((ponto) => String(ponto.socioId) === String(req.query.socioId));
    res.json(lista.slice().sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm))));
  });

  app.get('/api/admin/pontos/saldos', requerEditorCatalogo, (req, res) => {
    res.json(socios(req.empresaId).map((socio) => ({ id: socio.id, nome: socio.nome, email: socio.email, saldo: saldoPontos(req.empresaId, socio.id) })).sort((a, b) => b.saldo - a.saldo));
  });

  app.post('/api/admin/pontos', requerEditorCatalogo, (req, res) => {
    const socioId = req.body?.socioId;
    const valor = Number(req.body?.pontos);
    const descricao = String(req.body?.descricao || '').trim();
    const socio = socioPorId(req.empresaId, socioId);
    if (!socio) return res.status(404).json({ error: 'sócio não encontrado na empresa ativa' });
    if (!Number.isInteger(valor) || valor <= 0 || !descricao) return res.status(400).json({ error: 'socioId, pontos inteiros positivos e descrição são obrigatórios' });
    const lancamento = { id: id('ponto'), empresaId: req.empresaId, socioId: socio.id, socioNome: socio.nome, pontos: valor, tipo: String(req.body?.tipo || 'manual'), descricao, criadoEm: new Date().toISOString(), criadoPor: req.usuario?.email || null };
    pontos(req.empresaId).push(lancamento); save();
    res.status(201).json({ ...lancamento, saldo: saldoPontos(req.empresaId, socio.id) });
  });

  app.delete('/api/admin/pontos/:id', requerEditorCatalogo, (req, res) => {
    const lista = pontos(req.empresaId);
    const indice = lista.findIndex((ponto) => String(ponto.id) === String(req.params.id));
    if (indice < 0) return res.status(404).json({ error: 'lançamento não encontrado' });
    lista.splice(indice, 1); save(); res.json({ ok: true });
  });

  app.post('/api/admin/pontos/resgatar', requerEditorCatalogo, (req, res) => {
    const socio = socioPorId(req.empresaId, req.body?.socioId);
    const valor = Number(req.body?.pontos);
    if (!socio) return res.status(404).json({ error: 'sócio não encontrado na empresa ativa' });
    if (!Number.isInteger(valor) || valor <= 0) return res.status(400).json({ error: 'socioId e pontos inteiros positivos são obrigatórios' });
    const saldo = saldoPontos(req.empresaId, socio.id);
    if (saldo < valor) return res.status(400).json({ error: `Saldo insuficiente (${saldo} pontos disponíveis)` });
    const lancamento = { id: id('ponto'), empresaId: req.empresaId, socioId: socio.id, socioNome: socio.nome, pontos: -valor, tipo: 'resgate', descricao: String(req.body?.descricao || 'Resgate de pontos').trim(), criadoEm: new Date().toISOString(), criadoPor: req.usuario?.email || null };
    pontos(req.empresaId).push(lancamento); save(); res.json({ ...lancamento, saldo: saldo - valor });
  });

  app.get('/api/pontos/meus', requerAutenticacao, (req, res) => {
    const socio = socios(req.empresaId).find((item) => String(item.usuarioId) === String(req.usuario?.id) || normalizarEmail(item.email) === normalizarEmail(req.usuario?.email));
    const lista = socio ? pontos(req.empresaId).filter((ponto) => String(ponto.socioId) === String(socio.id)) : [];
    res.json({ saldo: lista.reduce((total, ponto) => total + Number(ponto.pontos || 0), 0), historico: lista.slice().sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm))).slice(0, 50) });
  });

  // ── Ligas ─────────────────────────────────────────────────────────────────
  app.get('/api/ligas', (req, res) => {
    const empresaId = publicEmpresaId(cadastrosMestres);
    res.json(Object.values(ligas(empresaId)).map(ligaResumo).sort((a, b) => String(b.criadoEm || '').localeCompare(String(a.criadoEm || ''))));
  });

  app.get('/api/ligas/:id', (req, res) => {
    const liga = obterLiga(publicEmpresaId(cadastrosMestres), req.params.id);
    if (!liga) return res.status(404).json({ error: 'liga não encontrada' });
    res.json(ligaDetalhe(liga, false));
  });

  app.post('/api/ligas/:id/inscrever', (req, res) => {
    const liga = obterLiga(publicEmpresaId(cadastrosMestres), req.params.id);
    if (!liga) return res.status(404).json({ error: 'liga não encontrada' });
    if (liga.status !== 'inscricoes') return res.status(400).json({ error: 'inscrições encerradas para esta liga' });
    const nome = String(req.body?.nome || '').trim(); const email = normalizarEmail(req.body?.email);
    if (!nome || !email) return res.status(400).json({ error: 'nome e e-mail obrigatórios' });
    if ((liga.inscricoes || []).some((item) => normalizarEmail(item.email) === email && item.status === 'ativo')) return res.status(409).json({ error: 'e-mail já inscrito nesta liga' });
    liga.inscricoes ||= [];
    const inscricao = { id: id('insc'), nome, email, tel: String(req.body?.tel || '').trim(), status: 'ativo', inscritoEm: new Date().toISOString() };
    liga.inscricoes.push(inscricao); save(); res.status(201).json({ ok: true, inscricao, totalInscritos: liga.inscricoes.filter((item) => item.status === 'ativo').length });
  });

  app.delete('/api/ligas/:id/inscrever', (req, res) => {
    const liga = obterLiga(publicEmpresaId(cadastrosMestres), req.params.id);
    if (!liga) return res.status(404).json({ error: 'liga não encontrada' });
    const email = normalizarEmail(req.body?.email);
    const inscricao = (liga.inscricoes || []).find((item) => normalizarEmail(item.email) === email && item.status === 'ativo');
    if (!inscricao) return res.status(404).json({ error: 'inscrição não encontrada' });
    if (liga.status !== 'inscricoes') return res.status(400).json({ error: 'não é possível cancelar após início' });
    inscricao.status = 'desistiu'; save(); res.json({ ok: true });
  });

  app.get('/api/admin/ligas', requerEditorCatalogo, (req, res) => {
    res.json(Object.values(ligas(req.empresaId)).map(ligaResumo).sort((a, b) => String(b.criadoEm || '').localeCompare(String(a.criadoEm || ''))));
  });

  app.post('/api/admin/ligas', requerEditorCatalogo, (req, res) => {
    const nome = String(req.body?.nome || '').trim();
    if (!nome) return res.status(400).json({ error: 'nome obrigatório' });
    const liga = {
      id: id('liga'), empresaId: req.empresaId, nome,
      temporada: String(req.body?.temporada || new Date().getFullYear()), categoria: String(req.body?.categoria || 'Geral').trim(), formato: String(req.body?.formato || 'simples'), descricao: String(req.body?.descricao || '').trim(), status: 'inscricoes', rodadaAtual: 0, inscricoes: [], rodadas: [], config: configLiga(req.body?.config), criadoEm: new Date().toISOString(),
    };
    ligas(req.empresaId)[String(liga.id)] = liga; save(); res.status(201).json(ligaDetalhe(liga));
  });

  app.patch('/api/admin/ligas/:id', requerEditorCatalogo, (req, res) => {
    const liga = obterLiga(req.empresaId, req.params.id);
    if (!liga) return res.status(404).json({ error: 'liga não encontrada' });
    for (const campo of ['nome', 'temporada', 'categoria', 'formato', 'descricao']) if (req.body?.[campo] !== undefined) liga[campo] = String(req.body[campo]).trim();
    if (req.body?.config) liga.config = { ...liga.config, ...configLiga({ ...liga.config, ...req.body.config }) };
    save(); res.json(ligaDetalhe(liga));
  });

  app.delete('/api/admin/ligas/:id', requerEditorCatalogo, (req, res) => {
    const mapa = ligas(req.empresaId); if (!mapa[String(req.params.id)]) return res.status(404).json({ error: 'liga não encontrada' });
    delete mapa[String(req.params.id)]; save(); res.json({ ok: true });
  });

  app.post('/api/admin/ligas/:id/status', requerEditorCatalogo, (req, res) => {
    const liga = obterLiga(req.empresaId, req.params.id);
    if (!liga) return res.status(404).json({ error: 'liga não encontrada' });
    if (!STATUS_LIGA.has(req.body?.status)) return res.status(400).json({ error: 'status inválido' });
    liga.status = req.body.status; save(); res.json({ ok: true, status: liga.status });
  });

  app.post('/api/admin/ligas/:id/participantes', requerEditorCatalogo, (req, res) => {
    const liga = obterLiga(req.empresaId, req.params.id);
    if (!liga) return res.status(404).json({ error: 'liga não encontrada' });
    const nome = String(req.body?.nome || '').trim(); if (!nome) return res.status(400).json({ error: 'nome obrigatório' });
    liga.inscricoes ||= [];
    const email = normalizarEmail(req.body?.email);
    if (email && liga.inscricoes.some((item) => normalizarEmail(item.email) === email && item.status === 'ativo')) return res.status(409).json({ error: 'e-mail já inscrito' });
    const inscricao = { id: id('insc'), nome, email, tel: String(req.body?.tel || '').trim(), status: 'ativo', inscritoEm: new Date().toISOString() };
    liga.inscricoes.push(inscricao); save(); res.status(201).json({ ok: true, inscricao });
  });

  app.delete('/api/admin/ligas/:id/participantes/:inscId', requerEditorCatalogo, (req, res) => {
    const liga = obterLiga(req.empresaId, req.params.id); const inscricao = liga?.inscricoes?.find((item) => String(item.id) === String(req.params.inscId));
    if (!inscricao) return res.status(404).json({ error: 'participante não encontrado' });
    inscricao.status = 'desistiu'; save(); res.json({ ok: true });
  });

  app.post('/api/admin/ligas/:id/sortear', requerEditorCatalogo, (req, res) => {
    const liga = obterLiga(req.empresaId, req.params.id);
    if (!liga) return res.status(404).json({ error: 'liga não encontrada' });
    if ((liga.rodadas || []).length) return res.status(409).json({ error: 'rodadas já geradas. Exclua todas para regenerar.' });
    if ((liga.inscricoes || []).filter((item) => item.status === 'ativo').length < 2) return res.status(400).json({ error: 'mínimo 2 participantes ativos' });
    try {
      liga.rodadas = sortearLiga(liga.inscricoes, liga.config); liga.rodadaAtual = 1; liga.status = 'em_andamento'; liga.rodadas[0].status = 'em_andamento'; liga.rodadas[0].geradaEm = new Date().toISOString(); save();
      res.json({ ok: true, totalRodadas: liga.rodadas.length, liga: ligaDetalhe(liga) });
    } catch (error) { res.status(400).json({ error: error.message }); }
  });

  app.post('/api/admin/ligas/:id/proxima-rodada', requerEditorCatalogo, (req, res) => {
    const liga = obterLiga(req.empresaId, req.params.id); if (!liga) return res.status(404).json({ error: 'liga não encontrada' });
    const ultima = liga.rodadas?.[liga.rodadas.length - 1];
    if (ultima && ultima.status !== 'encerrada') return res.status(400).json({ error: 'encerre a rodada atual antes de gerar a próxima' });
    try { const rodada = sortearProximaRodada(liga); rodada.status = 'em_andamento'; liga.rodadas ||= []; liga.rodadas.push(rodada); liga.rodadaAtual = rodada.numero; save(); res.json({ ok: true, rodada }); }
    catch (error) { res.status(400).json({ error: error.message }); }
  });

  app.delete('/api/admin/ligas/:id/rodadas', requerEditorCatalogo, (req, res) => {
    const liga = obterLiga(req.empresaId, req.params.id); if (!liga) return res.status(404).json({ error: 'liga não encontrada' });
    liga.rodadas = []; liga.rodadaAtual = 0; liga.status = 'inscricoes'; save(); res.json({ ok: true });
  });

  app.post('/api/admin/ligas/:id/resultado', requerEditorCatalogo, (req, res) => {
    const liga = obterLiga(req.empresaId, req.params.id); if (!liga) return res.status(404).json({ error: 'liga não encontrada' });
    const rodadaIdx = req.body?.rodada ?? req.body?.rodadaIdx; const jogoId = req.body?.jogoId;
    if (rodadaIdx === undefined || jogoId === undefined) return res.status(400).json({ error: 'rodada e jogoId obrigatórios' });
    try {
      registrarResultado(liga, Number(rodadaIdx), jogoId, { sets: req.body?.sets, vencedor: req.body?.vencedor, tipo: req.body?.tipo || 'normal' });
      const jogo = liga.rodadas[Number(rodadaIdx)].jogos.find((item) => String(item.id) === String(jogoId));
      if (req.body?.placar && jogo) jogo.placar = String(req.body.placar).trim().slice(0, 60);
      const rodada = liga.rodadas[Number(rodadaIdx)];
      if (rodada.status === 'encerrada' && liga.rodadas[Number(rodadaIdx) + 1]) { liga.rodadas[Number(rodadaIdx) + 1].status = 'em_andamento'; liga.rodadaAtual = Number(rodadaIdx) + 2; }
      if (jogo?.vencedor && jogo?.b) { const perdedor = jogo.vencedor === jogo.a ? jogo.b : jogo.a; applyElo(elo(req.empresaId), jogo.vencedor, perdedor); }
      save(); res.json({ ok: true, jogo, tabela: calcularTabela(liga), rodadaStatus: rodada.status });
    } catch (error) { res.status(400).json({ error: error.message }); }
  });

  app.post('/api/admin/ligas/:id/resultado-wo', requerEditorCatalogo, (req, res) => {
    const liga = obterLiga(req.empresaId, req.params.id); if (!liga) return res.status(404).json({ error: 'liga não encontrada' });
    try { registrarResultado(liga, Number(req.body?.rodada ?? req.body?.rodadaIdx), req.body?.jogoId, { vencedor: req.body?.vencedor, tipo: req.body?.tipo || 'wo' }); save(); res.json({ ok: true, tabela: calcularTabela(liga) }); }
    catch (error) { res.status(400).json({ error: error.message }); }
  });

  app.post('/api/admin/ligas/:id/finalizar', requerEditorCatalogo, (req, res) => {
    const liga = obterLiga(req.empresaId, req.params.id); if (!liga) return res.status(404).json({ error: 'liga não encontrada' });
    if (liga.status === 'encerrada') return res.status(409).json({ error: 'liga já encerrada' });
    if (!podeFinalizar(liga)) return res.status(400).json({ error: 'encerre a última rodada antes de finalizar a liga' });
    const tabela = calcularTabela(liga); const rankingEmpresa = ranking(req.empresaId);
    rankingEmpresa.players ||= {};
    for (const entry of tabela) {
      const chave = `${liga.categoria}|${entry.nome}`.toLowerCase();
      const jogador = rankingEmpresa.players[chave] ||= { nome: entry.nome, categoria: liga.categoria, pontos: 0, vitorias: 0, derrotas: 0, torneios: 0, partidas_avulsas: 0, historico: [] };
      jogador.pontos += entry.pts; jogador.vitorias += entry.v; jogador.derrotas += entry.d; jogador.torneios += 1; jogador.historico.push({ tipo: 'liga', pontos: entry.pts, descricao: liga.nome, data: new Date().toISOString(), temporada: liga.temporada });
    }
    liga.status = 'encerrada'; liga.encerradaEm = new Date().toISOString(); liga.tabelaFinal = tabela; save(); res.json({ ok: true, tabela, campeao: tabela[0] || null });
  });

  app.get('/api/admin/ligas/:id', requerEditorCatalogo, (req, res) => {
    const liga = obterLiga(req.empresaId, req.params.id); if (!liga) return res.status(404).json({ error: 'liga não encontrada' });
    res.json(ligaDetalhe(liga, true));
  });
}
