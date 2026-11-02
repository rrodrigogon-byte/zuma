import express from 'express';
import crypto from 'node:crypto';
import { db as defaultDb, save as defaultSave } from '../db.js';
import { responderErro } from './acesso/banco.js';

const uid = (prefix = 'id') => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
const num = (v, d = 0) => {
  if (v === undefined || v === null || String(v).trim() === '') return d;
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : d;
};

function garantirEstadoVerticais(store, empresaId) {
  const chave = String(empresaId || 'global');
  if (!store.verticaisPorEmpresa || typeof store.verticaisPorEmpresa !== 'object') {
    store.verticaisPorEmpresa = {};
  }
  if (!store.verticaisPorEmpresa[chave]) {
    store.verticaisPorEmpresa[chave] = {
      oficina: {
        seqOs: 1,
        ordens: [],
      },
      varejo: {
        seqOrcamento: 1,
        seqPedido: 1,
        orcamentos: [],
        pedidos: [],
        estoques: [
          { id: 'est-central', nome: 'Depósito Central', tipo: 'CD / Atacado', responsavel: 'Logística', padrao: true },
          { id: 'est-loja', nome: 'Loja Principal (Frente de Caixa)', tipo: 'Varejo', responsavel: 'Gerência', padrao: false },
        ],
        entregas: [],
      },
      lojaModa: {
        produtos: [],
        crediarios: [],
        condicionais: [],
        vales: [],
        comissoes: [],
      },
      agropecuaria: {
        seqReceita: 1,
        pets: [],
        vacinas: [],
        prontuarios: [],
        receituarios: [],
      },
    };
  }
  return store.verticaisPorEmpresa[chave];
}

export function createVerticaisRouter({ escopoDaRequisicao, getDb = () => defaultDb, saveDb = defaultSave } = {}) {
  const router = express.Router();
  router.use(express.json({ limit: '2mb' }));
  router.use((req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });

  const comEscopo = (permissao, fn, status = 200) => async (req, res) => {
    try {
      let empresaId = 'global';
      if (typeof escopoDaRequisicao === 'function') {
        try {
          const esc = await escopoDaRequisicao(req, permissao);
          if (esc?.empresaId) empresaId = esc.empresaId;
        } catch {
          empresaId = String(req.headers['x-empresa-id'] || req.user?.empresaId || 'global');
        }
      }
      const estado = garantirEstadoVerticais(getDb(), empresaId);
      const resultado = await fn({ req, estado, empresaId, salvar: saveDb });
      return res.status(status).json(resultado);
    } catch (error) {
      return responderErro(res, error);
    }
  };

  // ── 1. OFICINA MECÂNICA (/api/v1/oficina) ──────────────────────────────────
  router.get('/oficina/ordens', comEscopo('orders.read', ({ req, estado }) => {
    const status = String(req.query.status || '').trim();
    const q = String(req.query.q || '').trim().toLowerCase();
    let ordens = [...(estado.oficina.ordens || [])];
    if (status) ordens = ordens.filter((o) => o.status === status);
    if (q) {
      ordens = ordens.filter((o) =>
        `${o.placa || ''} ${o.cliente_nome || ''} ${o.numero_os || ''} ${o.modelo || ''}`.toLowerCase().includes(q),
      );
    }
    return { ordens };
  }));

  router.post('/oficina/ordens', comEscopo('orders.write', ({ req, estado, salvar }) => {
    const b = req.body || {};
    const seq = Number(estado.oficina.seqOs || 1);
    estado.oficina.seqOs = seq + 1;
    const valorPecas = num(b.valor_pecas, 0);
    const valorMaoObra = num(b.valor_mao_obra, 0);
    const os = {
      id: uid('os'),
      numero_os: String(seq).padStart(4, '0'),
      placa: String(b.placa || '').toUpperCase().trim(),
      marca: String(b.marca || '').trim(),
      modelo: String(b.modelo || '').trim(),
      ano_fabricacao: b.ano_fabricacao ? Number(b.ano_fabricacao) : null,
      km_entrada: b.km_entrada ? Number(b.km_entrada) : null,
      cliente_nome: String(b.cliente_nome || '').trim(),
      cliente_telefone: String(b.cliente_telefone || '').trim(),
      descricao_problema: String(b.descricao_problema || '').trim(),
      mecanico_responsavel: String(b.mecanico_responsavel || '').trim(),
      valor_pecas: valorPecas,
      valor_mao_obra: valorMaoObra,
      valor_total: num(b.valor_total, valorPecas + valorMaoObra),
      status: b.status || 'aberta',
      created_at: new Date().toISOString(),
    };
    estado.oficina.ordens.unshift(os);
    salvar();
    return os;
  }, 201));

  router.patch('/oficina/ordens/:id', comEscopo('orders.write', ({ req, estado, salvar }) => {
    const os = estado.oficina.ordens.find((o) => o.id === req.params.id);
    if (!os) return { error: 'OS não encontrada' };
    const b = req.body || {};
    if (b.placa !== undefined) os.placa = String(b.placa).toUpperCase().trim();
    if (b.marca !== undefined) os.marca = String(b.marca).trim();
    if (b.modelo !== undefined) os.modelo = String(b.modelo).trim();
    if (b.cliente_nome !== undefined) os.cliente_nome = String(b.cliente_nome).trim();
    if (b.cliente_telefone !== undefined) os.cliente_telefone = String(b.cliente_telefone).trim();
    if (b.descricao_problema !== undefined) os.descricao_problema = String(b.descricao_problema).trim();
    if (b.mecanico_responsavel !== undefined) os.mecanico_responsavel = String(b.mecanico_responsavel).trim();
    if (b.valor_pecas !== undefined) os.valor_pecas = num(b.valor_pecas, os.valor_pecas);
    if (b.valor_mao_obra !== undefined) os.valor_mao_obra = num(b.valor_mao_obra, os.valor_mao_obra);
    os.valor_total = num(b.valor_total, (os.valor_pecas || 0) + (os.valor_mao_obra || 0));
    if (b.status) os.status = String(b.status);
    salvar();
    return os;
  }));

  router.patch('/oficina/ordens/:id/status', comEscopo('orders.write', ({ req, estado, salvar }) => {
    const os = estado.oficina.ordens.find((o) => o.id === req.params.id);
    if (!os) return { error: 'OS não encontrada' };
    if (req.body?.status) os.status = String(req.body.status);
    salvar();
    return os;
  }));

  router.post('/oficina/ordens/:id/enviar-orcamento', comEscopo('orders.write', ({ req, estado, salvar }) => {
    const os = estado.oficina.ordens.find((o) => o.id === req.params.id);
    if (!os) return { error: 'OS não encontrada' };
    os.status = 'orcamento_enviado';
    const fone = String(os.cliente_telefone || '').replace(/\D/g, '');
    const msg = encodeURIComponent(
      `Olá ${os.cliente_nome}! Segue o orçamento da OS #${os.numero_os} (${os.placa} - ${os.marca} ${os.modelo}): Total R$ ${Number(os.valor_total || 0).toFixed(2)}.`,
    );
    salvar();
    return {
      ok: true,
      os,
      link_whatsapp: fone ? `https://wa.me/55${fone}?text=${msg}` : null,
    };
  }));

  router.delete('/oficina/ordens/:id', comEscopo('orders.write', ({ req, estado, salvar }) => {
    estado.oficina.ordens = estado.oficina.ordens.filter((o) => o.id !== req.params.id);
    salvar();
    return { ok: true };
  }));

  // ── 2. VAREJO GERAL (/api/v1/varejo) ───────────────────────────────────────
  router.get('/varejo/orcamentos', comEscopo('orders.read', ({ estado }) => ({
    orcamentos: estado.varejo.orcamentos || [],
  })));

  router.post('/varejo/orcamentos', comEscopo('orders.write', ({ req, estado, salvar }) => {
    const b = req.body || {};
    const seq = Number(estado.varejo.seqOrcamento || 1);
    estado.varejo.seqOrcamento = seq + 1;
    const itens = Array.isArray(b.itens) ? b.itens.map((i) => ({
      descricao: String(i.descricao || 'Item').trim(),
      quantidade: num(i.quantidade, 1),
      unidade: String(i.unidade || 'UN').trim(),
      valor_unitario: num(i.valor_unitario, 0),
    })) : [];
    const valorTotal = itens.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0);
    const dias = Number(b.validade_dias || 7);
    const validade = new Date(Date.now() + dias * 86400000).toISOString();
    const orc = {
      id: uid('orc'),
      numero_orcamento: `ORC-${String(seq).padStart(4, '0')}`,
      cliente_nome: String(b.cliente_nome || 'Cliente Consumidor').trim(),
      validade_dias: dias,
      data_validade: validade,
      observacoes: String(b.observacoes || '').trim(),
      itens,
      valor_total: Math.round(valorTotal * 100) / 100,
      status: 'aberto',
      created_at: new Date().toISOString(),
    };
    estado.varejo.orcamentos.unshift(orc);
    salvar();
    return orc;
  }, 201));

  router.post('/varejo/orcamentos/:id/converter', comEscopo('orders.write', ({ req, estado, salvar }) => {
    const orc = estado.varejo.orcamentos.find((o) => o.id === req.params.id);
    if (!orc) return { error: 'Orçamento não encontrado' };
    orc.status = 'convertido';
    const seqPed = Number(estado.varejo.seqPedido || 1);
    estado.varejo.seqPedido = seqPed + 1;
    const pedido = {
      id: uid('ped'),
      numero_pedido: `PED-${String(seqPed).padStart(4, '0')}`,
      orcamento_id: orc.id,
      numero_orcamento: orc.numero_orcamento,
      cliente_nome: orc.cliente_nome,
      itens: orc.itens,
      valor_total: orc.valor_total,
      status: 'aprovado',
      created_at: new Date().toISOString(),
    };
    estado.varejo.pedidos = estado.varejo.pedidos || [];
    estado.varejo.pedidos.unshift(pedido);
    salvar();
    return { ok: true, orcamento: orc, pedido };
  }));

  router.get('/varejo/pedidos', comEscopo('orders.read', ({ estado }) => ({
    pedidos: estado.varejo.pedidos || [],
  })));

  router.get('/varejo/estoques', comEscopo('inventory.read', ({ estado }) => ({
    estoques: estado.varejo.estoques || [],
  })));

  router.post('/varejo/estoques', comEscopo('inventory.write', ({ req, estado, salvar }) => {
    const b = req.body || {};
    const est = {
      id: uid('est'),
      nome: String(b.nome || 'Novo Depósito').trim(),
      tipo: String(b.tipo || 'Varejo').trim(),
      responsavel: String(b.responsavel || '').trim(),
    };
    estado.varejo.estoques.push(est);
    salvar();
    return est;
  }, 201));

  router.get('/varejo/entregas', comEscopo('orders.read', ({ estado }) => ({
    entregas: estado.varejo.entregas || [],
  })));

  router.post('/varejo/entregas', comEscopo('orders.write', ({ req, estado, salvar }) => {
    const b = req.body || {};
    const ent = {
      id: uid('ent'),
      cliente_nome: String(b.cliente_nome || '').trim(),
      motorista_nome: String(b.motorista_nome || '').trim(),
      endereco: String(b.endereco || '').trim(),
      data_entrega_prevista: b.data_entrega_prevista || new Date().toISOString().slice(0, 10),
      valor_frete: num(b.valor_frete, 0),
      status: b.status || 'pendente',
      created_at: new Date().toISOString(),
    };
    estado.varejo.entregas.unshift(ent);
    salvar();
    return ent;
  }, 201));

  router.patch('/varejo/entregas/:id/status', comEscopo('orders.write', ({ req, estado, salvar }) => {
    const ent = (estado.varejo.entregas || []).find((e) => e.id === req.params.id);
    if (!ent) return { error: 'Entrega não encontrada' };
    if (req.body?.status) ent.status = String(req.body.status);
    salvar();
    return ent;
  }));

  // ── 3. LOJA DE MODA E CALÇADOS (/api/v1/loja-moda) ─────────────────────────
  router.get('/loja-moda/produtos', comEscopo('catalog.read', ({ estado }) => ({
    produtos: estado.lojaModa.produtos || [],
  })));

  router.post('/loja-moda/grade', comEscopo('catalog.write', ({ req, estado, salvar }) => {
    const b = req.body || {};
    const cores = Array.isArray(b.cores) ? b.cores : [];
    const tamanhos = Array.isArray(b.tamanhos) ? b.tamanhos : [];
    const qtdPorVariante = Math.max(1, Number(b.estoque_por_variante || 1));
    const variantes = [];
    for (const cor of cores) {
      for (const tam of tamanhos) {
        variantes.push({
          sku: `${String(b.referencia || 'MODA').toUpperCase()}-${cor.slice(0, 3).toUpperCase()}-${tam}`,
          cor,
          tamanho: tam,
          estoque: qtdPorVariante,
          preco_venda: num(b.preco_venda, 0),
        });
      }
    }
    const prod = {
      id: uid('moda'),
      nome: String(b.produto_nome || b.nome || 'Produto de Moda').trim(),
      referencia: String(b.referencia || `REF-${String((estado.lojaModa.produtos?.length || 0) + 1).padStart(3, '0')}`).trim(),
      categoria: String(b.categoria || 'adulto'),
      preco_custo: num(b.preco_custo, 0),
      preco_venda: num(b.preco_venda, 0),
      cores,
      tamanhos,
      variantes,
      estoque_total: variantes.length * qtdPorVariante,
      created_at: new Date().toISOString(),
    };
    estado.lojaModa.produtos.unshift(prod);
    salvar();
    return prod;
  }, 201));

  router.get('/loja-moda/crediario', comEscopo('payments.read', ({ estado }) => ({
    clientes: estado.lojaModa.crediarios || [],
  })));

  router.post('/loja-moda/crediario', comEscopo('payments.write', ({ req, estado, salvar }) => {
    const b = req.body || {};
    const valorTotal = num(b.valor_total, 0);
    const entrada = num(b.entrada, 0);
    const numParcelas = Math.max(1, parseInt(b.num_parcelas || 1, 10));
    const diaVenc = Math.min(28, Math.max(1, parseInt(b.dia_vencimento || 10, 10)));
    const prox = new Date();
    prox.setMonth(prox.getMonth() + 1);
    prox.setDate(diaVenc);
    const cred = {
      id: uid('cred'),
      cliente_nome: String(b.cliente_nome || '').trim(),
      cliente_cpf: String(b.cliente_cpf || '').trim(),
      cliente_telefone: String(b.cliente_telefone || '').trim(),
      valor_total: valorTotal,
      entrada,
      valor_pago: entrada,
      num_parcelas: numParcelas,
      dia_vencimento: diaVenc,
      proximo_vencimento: prox.toISOString().slice(0, 10),
      dias_atraso: 0,
      status: 'em_dia',
      created_at: new Date().toISOString(),
    };
    estado.lojaModa.crediarios.unshift(cred);
    salvar();
    return cred;
  }, 201));

  router.post('/loja-moda/crediario/:id/pagar', comEscopo('payments.write', ({ req, estado, salvar }) => {
    const cred = (estado.lojaModa.crediarios || []).find((c) => c.id === req.params.id);
    if (!cred) return { error: 'Crediário não encontrado' };
    const valorParcela = num(req.body?.valor, (cred.valor_total - cred.entrada) / Math.max(1, cred.num_parcelas));
    cred.valor_pago = Math.min(cred.valor_total, num(cred.valor_pago + valorParcela));
    cred.dias_atraso = 0;
    if (cred.valor_pago >= cred.valor_total) cred.status = 'quitado';
    salvar();
    return cred;
  }));

  router.get('/loja-moda/condicionais', comEscopo('orders.read', ({ estado }) => {
    const agora = Date.now();
    const condicionais = (estado.lojaModa.condicionais || []).map((c) => {
      const prazoMs = new Date(c.data_devolucao_prevista || Date.now()).getTime();
      const diasRestantes = Math.ceil((prazoMs - agora) / 86400000);
      return { ...c, dias_restantes: diasRestantes };
    });
    return { condicionais };
  }));

  router.post('/loja-moda/condicionais', comEscopo('orders.write', ({ req, estado, salvar }) => {
    const b = req.body || {};
    const dias = Math.max(1, parseInt(b.prazo_devolucao_dias || 3, 10));
    const saida = new Date();
    const devolucao = new Date(saida.getTime() + dias * 86400000);
    const cond = {
      id: uid('cond'),
      cliente_nome: String(b.cliente_nome || '').trim(),
      cliente_telefone: String(b.cliente_telefone || '').trim(),
      vendedor_nome: String(b.vendedor_nome || 'Equipe Loja').trim(),
      prazo_devolucao_dias: dias,
      data_saida: saida.toISOString(),
      data_devolucao_prevista: devolucao.toISOString(),
      valor_total: num(b.valor_total, 0),
      status: 'em_aberto',
      created_at: saida.toISOString(),
    };
    estado.lojaModa.condicionais.unshift(cond);
    salvar();
    return cond;
  }, 201));

  router.post('/loja-moda/condicionais/:id/finalizar', comEscopo('orders.write', ({ req, estado, salvar }) => {
    const cond = (estado.lojaModa.condicionais || []).find((c) => c.id === req.params.id);
    if (!cond) return { error: 'Condicional não encontrada' };
    const acao = req.body?.acao || 'converter_venda';
    cond.status = acao === 'devolver' ? 'devolvido' : 'convertido_venda';
    if (cond.status === 'convertido_venda' && cond.valor_total > 0) {
      const perc = 5;
      estado.lojaModa.comissoes.unshift({
        id: uid('com'),
        vendedor_nome: cond.vendedor_nome || 'Vendedor',
        total_vendas: cond.valor_total,
        percentual_comissao: perc,
        valor_comissao: num(cond.valor_total * perc / 100),
        periodo: new Date().toISOString().slice(0, 7),
        pago: false,
      });
    }
    salvar();
    return cond;
  }));

  router.get('/loja-moda/vales', comEscopo('payments.read', ({ estado }) => ({
    vales: estado.lojaModa.vales || [],
  })));

  router.post('/loja-moda/vales', comEscopo('payments.write', ({ req, estado, salvar }) => {
    const b = req.body || {};
    const vale = {
      id: uid('vale'),
      codigo: `VALE-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      valor: num(b.valor, 100),
      cliente_nome: String(b.cliente_nome || '').trim(),
      status: 'ativo',
      created_at: new Date().toISOString(),
    };
    estado.lojaModa.vales.unshift(vale);
    salvar();
    return vale;
  }, 201));

  router.post('/loja-moda/vales/:id/utilizar', comEscopo('payments.write', ({ req, estado, salvar }) => {
    const vale = (estado.lojaModa.vales || []).find((v) => v.id === req.params.id);
    if (!vale) return { error: 'Vale não encontrado' };
    vale.status = 'utilizado';
    salvar();
    return vale;
  }));

  router.get('/loja-moda/comissoes', comEscopo('payments.read', ({ estado }) => ({
    comissoes: estado.lojaModa.comissoes || [],
  })));

  // ── 4. AGROPECUÁRIA E PETSHOP (/api/v1/agropecuaria) ───────────────────────
  router.get('/agropecuaria/pets', comEscopo('customers.read', ({ estado }) => ({
    pets: estado.agropecuaria.pets || [],
  })));

  router.post('/agropecuaria/pets', comEscopo('customers.write', ({ req, estado, salvar }) => {
    const b = req.body || {};
    const pet = {
      id: uid('pet'),
      nome: String(b.nome || '').trim(),
      especie: String(b.especie || 'cão').trim(),
      raca: String(b.raca || '').trim(),
      sexo: String(b.sexo || 'macho'),
      peso_kg: b.peso_kg ? num(b.peso_kg) : null,
      data_nascimento: b.data_nascimento || null,
      castrado: Boolean(b.castrado),
      cliente_nome: String(b.cliente_nome || '').trim(),
      cliente_telefone: String(b.cliente_telefone || '').trim(),
      microchip: String(b.microchip || '').trim(),
      created_at: new Date().toISOString(),
    };
    estado.agropecuaria.pets.unshift(pet);
    salvar();
    return pet;
  }, 201));

  router.get('/agropecuaria/vacinas', comEscopo('customers.read', ({ estado }) => ({
    vacinas: estado.agropecuaria.vacinas || [],
  })));

  router.post('/agropecuaria/vacinas', comEscopo('customers.write', ({ req, estado, salvar }) => {
    const b = req.body || {};
    const vac = {
      id: uid('vac'),
      pet_id: b.pet_id || null,
      pet_nome: String(b.pet_nome || '').trim(),
      nome_vacina: String(b.nome_vacina || '').trim(),
      veterinario: String(b.veterinario || '').trim(),
      lote: String(b.lote || '').trim(),
      data_aplicacao: b.data_aplicacao || new Date().toISOString().slice(0, 10),
      proxima_dose: b.proxima_dose || null,
      created_at: new Date().toISOString(),
    };
    estado.agropecuaria.vacinas = estado.agropecuaria.vacinas || [];
    estado.agropecuaria.vacinas.unshift(vac);
    salvar();
    return vac;
  }, 201));

  router.get('/agropecuaria/prontuarios', comEscopo('customers.read', ({ estado }) => ({
    prontuarios: estado.agropecuaria.prontuarios || [],
  })));

  router.post('/agropecuaria/prontuarios', comEscopo('customers.write', ({ req, estado, salvar }) => {
    const b = req.body || {};
    const pront = {
      id: uid('pront'),
      pet_id: b.pet_id || null,
      pet_nome: String(b.pet_nome || '').trim(),
      veterinario: String(b.veterinario || '').trim(),
      queixa: String(b.queixa || '').trim(),
      diagnostico: String(b.diagnostico || '').trim(),
      prescricao: String(b.prescricao || '').trim(),
      data_atendimento: b.data_atendimento || new Date().toISOString().slice(0, 10),
      created_at: new Date().toISOString(),
    };
    estado.agropecuaria.prontuarios = estado.agropecuaria.prontuarios || [];
    estado.agropecuaria.prontuarios.unshift(pront);
    salvar();
    return pront;
  }, 201));

  router.get('/agropecuaria/receituarios', comEscopo('customers.read', ({ estado }) => ({
    receituarios: estado.agropecuaria.receituarios || [],
  })));

  router.post('/agropecuaria/receituarios', comEscopo('customers.write', ({ req, estado, salvar }) => {
    const b = req.body || {};
    const seq = Number(estado.agropecuaria.seqReceita || 1);
    estado.agropecuaria.seqReceita = seq + 1;
    const rec = {
      id: uid('rec'),
      numero_receita: `REC-${String(seq).padStart(4, '0')}`,
      tipo: b.tipo === 'veterinario' ? 'veterinario' : 'agronomico',
      profissional_nome: String(b.profissional_nome || '').trim(),
      profissional_registro: String(b.profissional_registro || '').trim(),
      cliente_nome: String(b.cliente_nome || '').trim(),
      propriedade: String(b.propriedade || '').trim(),
      cultura_especie: String(b.cultura_especie || '').trim(),
      diagnostico_praga: String(b.diagnostico_praga || '').trim(),
      produto_prescrito: String(b.produto_prescrito || '').trim(),
      dosagem: String(b.dosagem || '').trim(),
      validade_dias: Number(b.validade_dias || 30),
      data_emissao: new Date().toISOString(),
      status: 'emitido',
    };
    estado.agropecuaria.receituarios.unshift(rec);
    salvar();
    return rec;
  }, 201));

  return router;
}
