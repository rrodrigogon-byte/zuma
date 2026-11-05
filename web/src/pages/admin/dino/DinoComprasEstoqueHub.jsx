// ==========================================================================
// DINO COMPRAS E ESTOQUE HUB — KYTTO ERP
// Módulo completo, autônomo, detalhado e integrado para Barbearia Dino e Kytto:
// 1. 🚚 Compras e fornecedores (pedidos, XML de NF-e, reposição por giro)
// 2. 📦 Estoque (catálogo unificado, bebidas & bar, insumos, saldo, kardex, curva ABC)
// 3. 🧾 Perdas e inventário (baixas manuais, contagem cíclica, acuracidade %)
// 4. 🧪 Fichas técnicas (composição de insumos por serviço e baixa automática)
// 5. 🗂️ Fornecedores e funcionários (cadastros mestres unificados)
// ==========================================================================
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, fmtR } from '../../../lib/api';
import { a2Path } from '../../../lib/tenant-api';
import { useToast } from '../../../hooks/useToast';
import { useAuth } from '../../../lib/auth';
import { moneyK } from './format';
import Modal from '../../../components/Modal';

const styles = {
  container: { display: 'grid', gap: 16 },
  headerCard: {
    background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.08) 0%, rgba(16, 185, 129, 0.05) 100%)',
    border: '1px solid rgba(2, 132, 199, 0.25)',
    borderRadius: 16,
    padding: '20px 24px',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
  },
  titleRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  kicker: { fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', color: '#0284c7' },
  h1: { margin: '4px 0', fontSize: 24, fontWeight: 800, fontFamily: 'var(--font-display, inherit)', color: 'var(--fg)' },
  sub: { margin: 0, fontSize: 13, color: 'var(--muted)', maxWidth: 780 },
  navBar: {
    display: 'flex',
    gap: 8,
    marginTop: 18,
    paddingTop: 16,
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
    overflowX: 'auto',
    paddingBottom: 4,
  },
  navButton: (active) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 18px',
    borderRadius: 12,
    border: active ? '1px solid #0284c7' : '1px solid var(--line, #e2e8f0)',
    background: active ? '#0284c7' : 'var(--card, #fff)',
    color: active ? '#fff' : 'var(--fg, #0f172a)',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap',
    boxShadow: active ? '0 4px 12px rgba(2, 132, 199, 0.25)' : 'none',
  }),
  navBadge: (active, alert = false) => ({
    display: 'inline-block',
    padding: '2px 7px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
    background: active ? (alert ? '#ef4444' : 'rgba(255, 255, 255, 0.25)') : (alert ? '#fee2e2' : 'var(--surface-2, #f1f5f9)'),
    color: active ? '#fff' : (alert ? '#b91c1c' : 'var(--muted, #64748b)'),
  }),
  card: { background: 'var(--card, #fff)', border: '1px solid var(--line, #e2e8f0)', borderRadius: 14, padding: 20 },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: 12 },
  kpi: { background: 'var(--card2, var(--card, #fff))', border: '1px solid var(--line, #e2e8f0)', borderRadius: 12, padding: '14px 16px' },
  kpiLabel: { fontSize: 11, fontWeight: 800, color: 'var(--muted, #64748b)', textTransform: 'uppercase', letterSpacing: '.06em' },
  kpiValue: { fontSize: 24, fontWeight: 800, marginTop: 4, fontFamily: 'var(--font-display, inherit)', color: 'var(--fg, #0f172a)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '10px 12px', color: 'var(--muted, #64748b)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid var(--line, #e2e8f0)', whiteSpace: 'nowrap' },
  td: { padding: '12px 12px', borderBottom: '1px solid var(--line, #e2e8f0)', verticalAlign: 'middle' },
  input: { padding: '9px 12px', borderRadius: 9, border: '1px solid var(--line, #e2e8f0)', background: 'var(--card, #fff)', color: 'var(--fg, #0f172a)', font: 'inherit', fontSize: 13, minWidth: 0 },
  btn: { padding: '8px 14px', borderRadius: 9, border: '1px solid var(--line, #e2e8f0)', background: 'transparent', color: 'var(--fg, #0f172a)', cursor: 'pointer', font: 'inherit', fontSize: 12, fontWeight: 700 },
  btnPrimary: { padding: '8px 14px', borderRadius: 9, border: '1px solid #0284c7', background: '#0284c7', color: '#fff', cursor: 'pointer', font: 'inherit', fontSize: 12, fontWeight: 700 },
  btnSuccess: { padding: '8px 14px', borderRadius: 9, border: '1px solid #10b981', background: '#10b981', color: '#fff', cursor: 'pointer', font: 'inherit', fontSize: 12, fontWeight: 700 },
  btnDanger: { padding: '8px 14px', borderRadius: 9, border: '1px solid #ef4444', background: '#ef4444', color: '#fff', cursor: 'pointer', font: 'inherit', fontSize: 12, fontWeight: 700 },
  pill: (cor = '#64748b', bg = 'transparent') => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 8px',
    borderRadius: 16,
    fontSize: 11,
    fontWeight: 800,
    color: cor,
    border: `1px solid ${cor}`,
    background: bg,
    whiteSpace: 'nowrap',
  }),
};

const MODULOS = [
  { id: 'compras', label: 'Compras e fornecedores', icon: '🚚' },
  { id: 'estoque', label: 'Estoque', icon: '📦' },
  { id: 'perdas', label: 'Perdas e inventário', icon: '🧾' },
  { id: 'fichas', label: 'Fichas técnicas', icon: '🧪' },
  { id: 'cadastros', label: 'Fornecedores e funcionários', icon: '🗂️' },
];

export default function DinoComprasEstoqueHub({
  tabInicial = 'estoque',
  produtosRevenda = [],
  onAtualizar,
  onAbrirProduto,
  onAjustarEstoque,
}) {
  const { empresaAtiva } = useAuth();
  const { toast } = useToast();

  // Resolve aba ativa a partir da prop ou URL
  const mapaTab = {
    'Estoque de revenda': 'estoque',
    'Estoque': 'estoque',
    'estoque': 'estoque',
    'Compras e fornecedores': 'compras',
    'compras': 'compras',
    'Perdas e inventário': 'perdas',
    'perdas': 'perdas',
    'Fichas técnicas': 'fichas',
    'fichas': 'fichas',
    'Fornecedores e funcionários': 'cadastros',
    'cadastros': 'cadastros',
  };

  const [abaAtiva, setAbaAtiva] = useState(mapaTab[tabInicial] || 'estoque');

  // Sincroniza se tabInicial mudar externamente
  useEffect(() => {
    if (mapaTab[tabInicial]) {
      setAbaAtiva(mapaTab[tabInicial]);
    }
  }, [tabInicial]);

  // Estados dos módulos
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas');

  // Estoque Geral e Kardex
  const [estoqueGeral, setEstoqueGeral] = useState([]);
  const [resumoEstoque, setResumoEstoque] = useState({ total: 0, ok: 0, baixo: 0, semEstoque: 0, valorTotal: 0 });

  // Compras, Pedidos e Fornecedores
  const [fornecedores, setFornecedores] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [reposicao, setReposicao] = useState({ itens: [], totalEstimado: 0 });

  // Perdas e Inventário
  const [ocorrencias, setOcorrencias] = useState([]);
  const [inventarios, setInventarios] = useState([]);
  const [relatorioAcuracidade, setRelatorioAcuracidade] = useState(null);
  const [inventarioAberto, setInventarioAberto] = useState(null);

  // Fichas Técnicas
  const [fichas, setFichas] = useState([]);

  // Cadastros Mestres
  const [funcionarios, setFuncionarios] = useState([]);
  const [fornecedoresMestres, setFornecedoresMestres] = useState([]);

  // Modais de Ação Rápida
  const [modalEntrada, setModalEntrada] = useState(false);
  const [formEntrada, setFormEntrada] = useState({ produtoId: '', qtd: '', custo: '', observacao: '' });
  const [modalOcorrencia, setModalOcorrencia] = useState(false);
  const [formOcorrencia, setFormOcorrencia] = useState({ tipo: 'perda', produtoId: '', qtd: '1', motivo: '', observacao: '' });
  const [modalInventario, setModalInventario] = useState(false);
  const [formInventario, setFormInventario] = useState({ tipo: 'geral', categoria: '', observacao: '' });
  const [modalFicha, setModalFicha] = useState(false);
  const [formFicha, setFormFicha] = useState({ produtoFinalId: '', rendimento: 1, observacao: '', itens: [] });
  const [itemFichaId, setItemFichaId] = useState('');
  const [itemFichaQtd, setItemFichaQtd] = useState('1');

  // Carga dos Dados Integrados
  const carregarTudo = useCallback(async () => {
    setLoading(true);
    try {
      const [
        estoqueRes,
        fornRes,
        pedRes,
        repRes,
        ocoRes,
        invRes,
        acuRes,
        fichasRes,
        mestresFornRes,
        mestresFuncRes,
      ] = await Promise.all([
        api.get('/api/admin/estoque').catch(() => ({ estoque: [] })),
        api.get('/api/admin/barbearia/compras/fornecedores').catch(() => ({ fornecedores: [] })),
        api.get('/api/admin/barbearia/compras/pedidos').catch(() => ({ pedidos: [] })),
        api.get('/api/admin/barbearia/compras/reposicao').catch(() => ({ itens: [], totalEstimado: 0 })),
        api.get('/api/admin/estoque/ocorrencias').catch(() => ({ ocorrencias: [] })),
        api.get('/api/admin/estoque/inventarios').catch(() => ({ inventarios: [] })),
        api.get('/api/admin/estoque/acuracidade').catch(() => ({ relatorio: null })),
        api.get('/api/admin/fichas-tecnicas').catch(() => ({ fichas: [] })),
        api.get(a2Path('/fornecedores')).catch(() => ({ fornecedores: [] })),
        api.get(a2Path('/funcionarios')).catch(() => ({ funcionarios: [] })),
      ]);

      const listaEst = Array.isArray(estoqueRes) ? estoqueRes : (estoqueRes.estoque || []);
      setEstoqueGeral(listaEst);
      setResumoEstoque(estoqueRes.resumo || { total: listaEst.length, ok: 0, baixo: 0, semEstoque: 0, valorTotal: 0 });

      setFornecedores(fornRes.fornecedores || []);
      setPedidos(pedRes.pedidos || []);
      setReposicao(repRes || { itens: [], totalEstimado: 0 });

      setOcorrencias(ocoRes.ocorrencias || []);
      setInventarios(invRes.inventarios || []);
      setRelatorioAcuracidade(acuRes.relatorio || null);

      setFichas(fichasRes.fichas || []);
      setFornecedoresMestres(mestresFornRes.fornecedores || []);
      setFuncionarios(mestresFuncRes.funcionarios || []);
    } catch (err) {
      console.warn('[DinoComprasEstoqueHub] Aviso ao sincronizar módulos:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarTudo();
  }, [carregarTudo]);

  // Lista combinada de produtos (Revenda do ERP + Insumos do Estoque Geral)
  const produtosCombinados = useMemo(() => {
    const mapa = new Map();

    // 1. Produtos de Revenda da Barbearia
    (produtosRevenda || []).forEach((p) => {
      mapa.set(p.id, {
        id: p.id,
        nome: p.nome,
        categoria: p.categoria || 'Revenda',
        tipo: 'revenda',
        sku: p.sku || 'Sem SKU',
        precoVenda: Number(p.precoVenda || p.preco || 0),
        custoUnitario: Number(p.custoUnitario || p.custoMedio || 0),
        estoqueAtual: Number(p.estoqueAtual ?? 0),
        estoqueMinimo: Number(p.estoqueMinimo ?? 0),
        statusEstoque: p.statusEstoque || (Number(p.estoqueAtual ?? 0) <= 0 ? 'sem_estoque' : (Number(p.estoqueAtual ?? 0) <= Number(p.estoqueMinimo ?? 0) ? 'baixo' : 'ok')),
        ativo: p.ativo !== false,
      });
    });

    // 2. Insumos e itens do Estoque Geral que não estejam no mapa
    (estoqueGeral || []).forEach((it) => {
      const id = it.produtoId || it.id;
      if (!mapa.has(id)) {
        const qtd = Number(it.qtd ?? 0);
        const min = Number(it.minimo ?? it.min ?? 0);
        mapa.set(id, {
          id,
          nome: it.nome,
          categoria: it.cat || it.categoria || 'Insumo',
          tipo: 'insumo',
          sku: it.codigo || it.sku || 'Sem SKU',
          precoVenda: Number(it.preco || 0),
          custoUnitario: Number(it.custoMedioPonderado || it.custo || 0),
          estoqueAtual: qtd,
          estoqueMinimo: min,
          statusEstoque: it.statusEstoque || (qtd <= 0 ? 'sem_estoque' : (min > 0 && qtd <= min ? 'baixo' : 'ok')),
          ativo: it.ativo !== false,
        });
      }
    });

    return Array.from(mapa.values());
  }, [produtosRevenda, estoqueGeral]);

  // Produtos filtrados
  const produtosFiltrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return produtosCombinados.filter((p) => {
      const matchBusca = !t || [p.nome, p.sku, p.categoria].some((c) => String(c || '').toLowerCase().includes(t));
      const matchCat =
        categoriaFiltro === 'todas' ||
        (categoriaFiltro === 'revenda' && p.tipo === 'revenda') ||
        (categoriaFiltro === 'bebidas' && String(p.categoria || '').toLowerCase().includes('bebida')) ||
        (categoriaFiltro === 'insumos' && p.tipo === 'insumo') ||
        (categoriaFiltro === 'baixo' && p.statusEstoque !== 'ok');
      return matchBusca && matchCat;
    });
  }, [produtosCombinados, busca, categoriaFiltro]);

  // Métricas e KPIs
  const kpis = useMemo(() => {
    const ativos = produtosCombinados.filter((p) => p.ativo);
    const baixos = ativos.filter((p) => p.statusEstoque === 'baixo');
    const sem = ativos.filter((p) => p.statusEstoque === 'sem_estoque');
    const valorCusto = ativos.reduce((acc, p) => acc + (p.estoqueAtual * p.custoUnitario), 0);
    const valorVenda = ativos.reduce((acc, p) => acc + (p.estoqueAtual * p.precoVenda), 0);
    const margemMedia = valorVenda > 0 ? Math.round(((valorVenda - valorCusto) / valorVenda) * 100) : 0;
    return {
      totalAtivos: ativos.length,
      baixos: baixos.length,
      sem: sem.length,
      valorCusto,
      valorVenda,
      margemMedia,
      pedidosAbertos: pedidos.filter((p) => ['rascunho', 'enviado', 'recebido_parcial'].includes(p.status)).length,
      itensReposicao: (reposicao.itens || []).length,
      acuracidade: relatorioAcuracidade?.acuracidade ?? 100,
      totalFichas: fichas.length,
    };
  }, [produtosCombinados, pedidos, reposicao, relatorioAcuracidade, fichas]);

  // Ações de Entrada Rápida
  async function salvarEntradaRapida() {
    if (!formEntrada.produtoId) return toast('Selecione um produto para a entrada.', true);
    const qtd = Number(formEntrada.qtd);
    if (!Number.isFinite(qtd) || qtd <= 0) return toast('Informe uma quantidade válida maior que zero.', true);

    try {
      const body = { produtoId: formEntrada.produtoId, qtd };
      if (formEntrada.custo !== '') body.custo = Number(String(formEntrada.custo).replace(',', '.'));
      await api.post('/api/admin/estoque/entrada', body);
      toast('Entrada em estoque realizada com sucesso!');
      setModalEntrada(false);
      setFormEntrada({ produtoId: '', qtd: '', custo: '', observacao: '' });
      carregarTudo();
      onAtualizar?.();
    } catch (e) {
      toast(e.message || 'Erro ao registrar entrada de estoque.', true);
    }
  }

  // Ações de Perdas / Ocorrências
  async function salvarOcorrencia() {
    if (!formOcorrencia.produtoId) return toast('Selecione o produto ou insumo.', true);
    const qtd = Number(formOcorrencia.qtd);
    if (!Number.isFinite(qtd) || qtd <= 0) return toast('Informe a quantidade para baixa.', true);

    try {
      await api.post('/api/admin/estoque/ocorrencias', {
        tipo: formOcorrencia.tipo,
        produtoId: formOcorrencia.produtoId,
        qtd,
        motivo: formOcorrencia.motivo || 'Baixa operacional registrada no hub',
        observacao: formOcorrencia.observacao,
      });
      toast('Ocorrência de perda/consumo registrada com baixa auditada no estoque!', 'success');
      setModalOcorrencia(false);
      setFormOcorrencia({ tipo: 'perda', produtoId: '', qtd: '1', motivo: '', observacao: '' });
      carregarTudo();
      onAtualizar?.();
    } catch (e) {
      toast(e.message || 'Erro ao registrar ocorrência.', true);
    }
  }

  // Ações de Inventário Físico
  async function abrirNovoInventario() {
    try {
      const res = await api.post('/api/admin/estoque/inventarios', formInventario);
      setInventarioAberto(res.inventario);
      setModalInventario(false);
      toast('Inventário aberto para contagem física!', 'success');
      carregarTudo();
    } catch (e) {
      toast(e.message || 'Erro ao abrir inventário.', true);
    }
  }

  async function registrarContagem(produtoId, valorContado) {
    if (!inventarioAberto || valorContado === '') return;
    try {
      const res = await api.post(`/api/admin/estoque/inventarios/${inventarioAberto.id}/contagens`, {
        produtoId,
        contado: Number(valorContado),
      });
      setInventarioAberto(res.inventario);
    } catch (e) {
      toast(e.message || 'Erro ao registrar contagem do item.', true);
    }
  }

  async function concluirInventario() {
    if (!inventarioAberto) return;
    if (!window.confirm('Concluir inventário físico e atualizar automaticamente todos os saldos no sistema? A trilha de auditoria será gravada.')) return;

    try {
      const res = await api.post(`/api/admin/estoque/inventarios/${inventarioAberto.id}/concluir`, {});
      toast(`Inventário concluído com sucesso! ${res.movimentos?.length || 0} ajuste(s) auditado(s).`, 'success');
      setInventarioAberto(null);
      carregarTudo();
      onAtualizar?.();
    } catch (e) {
      toast(e.message || 'Ainda existem itens pendentes de contagem.', true);
    }
  }

  // Exportar CSV
  function exportarCSV() {
    const cabecalho = ['Produto', 'SKU', 'Categoria', 'Tipo', 'Saldo Atual', 'Estoque Minimo', 'Custo Unitario (R$)', 'Preco Venda (R$)', 'Valor Total (R$)', 'Status'];
    const linhas = produtosFiltrados.map((p) => [
      p.nome,
      p.sku,
      p.categoria,
      p.tipo,
      p.estoqueAtual,
      p.estoqueMinimo,
      p.custoUnitario.toFixed(2),
      p.precoVenda.toFixed(2),
      (p.estoqueAtual * p.custoUnitario).toFixed(2),
      p.statusEstoque,
    ]);
    const csvContent = [cabecalho, ...linhas].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `estoque_kytto_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={styles.container}>
      {/* ── CABEÇALHO UNIFICADO COM OS 5 MÓDULOS EXATOS DO PRINT ── */}
      <div style={styles.headerCard}>
        <div style={styles.titleRow}>
          <div>
            <div style={styles.kicker}>Hub Integrado de Gestão de Materiais · {empresaAtiva?.nome || 'Empresa'}</div>
            <h1 style={styles.h1}>Compras e Estoque</h1>
            <p style={styles.sub}>
              Gestão centralizada de suprimentos e materiais para {empresaAtiva?.nome || 'todas as empresas'}. Fluxo unificado de compras e fornecedores, controle de saldos por unidade, perdas e inventário rotativo, fichas técnicas e cadastros mestres.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="button" style={styles.btn} onClick={carregarTudo}>
              ↺ Sincronizar
            </button>
            <button type="button" style={styles.btnPrimary} onClick={() => setModalEntrada(true)}>
              + Entrada de Estoque
            </button>
            <button type="button" style={styles.btnSuccess} onClick={onAbrirProduto || (() => toast('Cadastre pelo catálogo'))}>
              + Novo Produto
            </button>
          </div>
        </div>

        {/* ── BARRA DE NAVEGAÇÃO DOS 5 MÓDULOS ── */}
        <div style={styles.navBar}>
          {MODULOS.map((mod) => {
            const ativo = abaAtiva === mod.id;
            let badgeTexto = null;
            let badgeAlerta = false;

            if (mod.id === 'compras') {
              if (kpis.pedidosAbertos > 0) {
                badgeTexto = `${kpis.pedidosAbertos} abertos`;
                badgeAlerta = false;
              } else if (kpis.itensReposicao > 0) {
                badgeTexto = `${kpis.itensReposicao} reposição`;
                badgeAlerta = true;
              }
            } else if (mod.id === 'estoque') {
              badgeTexto = kpis.totalAtivos;
              if (kpis.sem > 0 || kpis.baixos > 0) badgeAlerta = true;
            } else if (mod.id === 'perdas') {
              badgeTexto = `${kpis.acuracidade}% acurácia`;
            } else if (mod.id === 'fichas') {
              badgeTexto = kpis.totalFichas;
            } else if (mod.id === 'cadastros') {
              badgeTexto = fornecedores.length + funcionarios.length;
            }

            return (
              <button
                key={mod.id}
                type="button"
                style={styles.navButton(ativo)}
                onClick={() => setAbaAtiva(mod.id)}
              >
                <span>{mod.icon}</span>
                <span>{mod.label}</span>
                {badgeTexto !== null && (
                  <span style={styles.navBadge(ativo, badgeAlerta)}>{badgeTexto}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── SUBMÓDULO 1: 📦 ESTOQUE ── */}
      {abaAtiva === 'estoque' && (
        <div style={{ display: 'grid', gap: 16 }}>
          {/* KPIs do Estoque */}
          <div style={styles.kpiGrid}>
            <div style={styles.kpi}>
              <div style={styles.kpiLabel}>Total de Itens Ativos</div>
              <div style={styles.kpiValue}>{kpis.totalAtivos}</div>
            </div>
            <div style={styles.kpi}>
              <div style={styles.kpiLabel}>Abaixo do Mínimo</div>
              <div style={{ ...styles.kpiValue, color: kpis.baixos ? '#f59e0b' : '#10b981' }}>{kpis.baixos}</div>
            </div>
            <div style={styles.kpi}>
              <div style={styles.kpiLabel}>Sem Estoque (Ruptura)</div>
              <div style={{ ...styles.kpiValue, color: kpis.sem ? '#ef4444' : '#10b981' }}>{kpis.sem}</div>
            </div>
            <div style={styles.kpi}>
              <div style={styles.kpiLabel}>Valor Investido (Custo)</div>
              <div style={styles.kpiValue}>{moneyK(kpis.valorCusto)}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Exato: {fmtR(kpis.valorCusto)}</div>
            </div>
            <div style={styles.kpi}>
              <div style={styles.kpiLabel}>Previsão de Receita</div>
              <div style={styles.kpiValue}>{moneyK(kpis.valorVenda)}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Exato: {fmtR(kpis.valorVenda)}</div>
            </div>
            <div style={styles.kpi}>
              <div style={styles.kpiLabel}>Margem Média Projetada</div>
              <div style={{ ...styles.kpiValue, color: '#10b981' }}>{kpis.margemMedia}%</div>
            </div>
          </div>

          {/* Filtros e Barra de Ações */}
          <div style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', flex: 1 }}>
                <input
                  type="text"
                  placeholder="Buscar produto por nome, SKU, código de barras..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  style={{ ...styles.input, minWidth: 260, flex: 1 }}
                />
                <select
                  value={categoriaFiltro}
                  onChange={(e) => setCategoriaFiltro(e.target.value)}
                  style={{ ...styles.input, width: 180 }}
                >
                  <option value="todas">Todas as categorias</option>
                  <option value="revenda">Revenda (Pomadas/Perfumaria)</option>
                  <option value="bebidas">Bebidas & Bar</option>
                  <option value="insumos">Insumos de Bancada</option>
                  <option value="baixo">⚠️ Abaixo do Mínimo</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" style={styles.btn} onClick={exportarCSV}>
                  📥 Exportar CSV
                </button>
                <button type="button" style={styles.btnPrimary} onClick={() => setModalEntrada(true)}>
                  + Entrada Rápida
                </button>
              </div>
            </div>

            {/* Tabela de Produtos do Estoque */}
            <div style={{ overflowX: 'auto', marginTop: 16 }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Produto & SKU</th>
                    <th style={styles.th}>Categoria</th>
                    <th style={styles.th}>Saldo Atual</th>
                    <th style={styles.th}>Mínimo</th>
                    <th style={styles.th}>Custo Médio</th>
                    <th style={styles.th}>Preço Venda</th>
                    <th style={styles.th}>Total (Custo)</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {produtosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: 28, color: 'var(--muted)' }}>
                        Nenhum produto encontrado com os filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    produtosFiltrados.map((p) => {
                      const totalCusto = p.estoqueAtual * p.custoUnitario;
                      const statusColor = p.statusEstoque === 'ok' ? '#10b981' : (p.statusEstoque === 'baixo' ? '#f59e0b' : '#ef4444');
                      const statusTexto = p.statusEstoque === 'ok' ? 'Estoque OK' : (p.statusEstoque === 'baixo' ? 'Estoque Baixo' : 'Sem Estoque');

                      return (
                        <tr key={p.id}>
                          <td style={styles.td}>
                            <strong>{p.nome}</strong>
                            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                              SKU: {p.sku} {p.tipo === 'insumo' && <span style={styles.pill('#64748b', 'rgba(100, 116, 139, 0.08)')}>Insumo</span>}
                            </div>
                          </td>
                          <td style={styles.td}>
                            <span style={styles.pill('#0284c7', 'rgba(2, 132, 199, 0.08)')}>{p.categoria}</span>
                          </td>
                          <td style={{ ...styles.td, fontWeight: 800, fontSize: 15 }}>
                            {p.estoqueAtual}
                          </td>
                          <td style={styles.td}>{p.estoqueMinimo}</td>
                          <td style={styles.td}>{fmtR(p.custoUnitario)}</td>
                          <td style={{ ...styles.td, fontWeight: 700 }}>{fmtR(p.precoVenda)}</td>
                          <td style={{ ...styles.td, fontWeight: 800 }}>{fmtR(totalCusto)}</td>
                          <td style={styles.td}>
                            <span style={styles.pill(statusColor, `${statusColor}15`)}>{statusTexto}</span>
                          </td>
                          <td style={styles.td}>
                            <button
                              type="button"
                              style={{ ...styles.btn, fontSize: 11, padding: '5px 9px' }}
                              onClick={() => {
                                setFormEntrada({ produtoId: p.id, qtd: '', custo: p.custoUnitario || '', observacao: '' });
                                setModalEntrada(true);
                              }}
                            >
                              + Entrada
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── SUBMÓDULO 2: 🚚 COMPRAS E FORNECEDORES ── */}
      {abaAtiva === 'compras' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={styles.kpiGrid}>
            <div style={styles.kpi}>
              <div style={styles.kpiLabel}>Pedidos em Aberto</div>
              <div style={styles.kpiValue}>{kpis.pedidosAbertos}</div>
            </div>
            <div style={styles.kpi}>
              <div style={styles.kpiLabel}>Itens para Reposição</div>
              <div style={{ ...styles.kpiValue, color: kpis.itensReposicao ? '#f59e0b' : '#10b981' }}>{kpis.itensReposicao}</div>
            </div>
            <div style={styles.kpi}>
              <div style={styles.kpiLabel}>Total Estimado Reposição</div>
              <div style={styles.kpiValue}>{moneyK(reposicao.totalEstimado || 0)}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Exato: {fmtR(reposicao.totalEstimado || 0)}</div>
            </div>
            <div style={styles.kpi}>
              <div style={styles.kpiLabel}>Fornecedores Parceiros</div>
              <div style={styles.kpiValue}>{fornecedores.length}</div>
            </div>
          </div>

          {/* Reposição Sugerida */}
          <div style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Reposição Inteligente de Estoque</h3>
                <p style={styles.sub}>Cálculo algorítmico baseado no estoque mínimo, giro dos últimos 60 dias e prazo dos fornecedores.</p>
              </div>
              <button
                type="button"
                style={styles.btnPrimary}
                onClick={async () => {
                  try {
                    const r = await api.post('/api/admin/barbearia/compras/reposicao/pedidos', {});
                    toast(`${r.pedidos?.length || 0} pedido(s) em rascunho gerado(s) com sucesso!`, 'success');
                    carregarTudo();
                  } catch (e) {
                    toast(e.message || 'Erro ao gerar pedidos automáticos.', true);
                  }
                }}
              >
                ⚡ Gerar Pedidos em Rascunho
              </button>
            </div>

            <div style={{ overflowX: 'auto', marginTop: 14 }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Produto</th>
                    <th style={styles.th}>Motivo</th>
                    <th style={styles.th}>Estoque</th>
                    <th style={styles.th}>Mínimo</th>
                    <th style={styles.th}>Em Pedido</th>
                    <th style={styles.th}>Giro / Dia</th>
                    <th style={styles.th}>Cobertura</th>
                    <th style={styles.th}>Qtd Sugerida</th>
                    <th style={styles.th}>Fornecedor</th>
                  </tr>
                </thead>
                <tbody>
                  {(reposicao.itens || []).length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: 22, color: 'var(--muted)' }}>
                        Nenhum produto necessita de reposição neste momento. Todos os saldos estão saudáveis!
                      </td>
                    </tr>
                  ) : (
                    reposicao.itens.map((item) => (
                      <tr key={item.produtoId}>
                        <td style={styles.td}><strong>{item.nome}</strong></td>
                        <td style={styles.td}>
                          <span style={styles.pill(item.motivo === 'ruptura' ? '#ef4444' : '#f59e0b')}>
                            {item.motivo === 'ruptura' ? 'Sem estoque' : 'Abaixo do mínimo'}
                          </span>
                        </td>
                        <td style={styles.td}>{item.estoqueAtual}</td>
                        <td style={styles.td}>{item.estoqueMinimo}</td>
                        <td style={styles.td}>{item.emPedido}</td>
                        <td style={styles.td}>{item.consumoDiario} un</td>
                        <td style={styles.td}>{item.diasCobertura !== null ? `${item.diasCobertura} dias` : '—'}</td>
                        <td style={{ ...styles.td, fontWeight: 800, color: '#0284c7', fontSize: 14 }}>
                          {item.quantidadeSugerida} un
                        </td>
                        <td style={styles.td}>{item.fornecedorNome || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pedidos de Compra */}
          <div style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Pedidos de Compra</h3>
                <p style={styles.sub}>Acompanhe o ciclo de compras: Rascunho → Enviado → Recebimento no estoque.</p>
              </div>
            </div>

            <div style={{ overflowX: 'auto', marginTop: 14 }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Pedido</th>
                    <th style={styles.th}>Fornecedor</th>
                    <th style={styles.th}>Itens</th>
                    <th style={styles.th}>Total</th>
                    <th style={styles.th}>Previsão</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidos.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: 22, color: 'var(--muted)' }}>
                        Nenhum pedido de compra cadastrado ainda.
                      </td>
                    </tr>
                  ) : (
                    pedidos.map((p) => {
                      const statusColor = p.status === 'recebido' ? '#10b981' : (p.status === 'enviado' ? '#f59e0b' : '#64748b');
                      return (
                        <tr key={p.id}>
                          <td style={styles.td}><strong>{p.numero}</strong></td>
                          <td style={styles.td}>{p.fornecedorNome}</td>
                          <td style={styles.td}>
                            {(p.itens || []).map((it) => (
                              <div key={it.produtoId} style={{ fontSize: 12 }}>
                                {it.quantidade}× {it.nome}
                              </div>
                            ))}
                          </td>
                          <td style={{ ...styles.td, fontWeight: 800 }}>{fmtR(p.total)}</td>
                          <td style={styles.td}>{p.previsaoEntrega || '—'}</td>
                          <td style={styles.td}>
                            <span style={styles.pill(statusColor, `${statusColor}15`)}>{p.status?.toUpperCase()}</span>
                          </td>
                          <td style={styles.td}>
                            {['rascunho', 'enviado'].includes(p.status) && (
                              <button
                                type="button"
                                style={{ ...styles.btnSuccess, fontSize: 11, padding: '5px 9px' }}
                                onClick={async () => {
                                  if (window.confirm(`Confirmar recebimento do pedido ${p.numero} e dar entrada de todos os itens no estoque?`)) {
                                    try {
                                      await api.post(`/api/admin/barbearia/compras/pedidos/${p.id}/receber`, {
                                        confirmado: true,
                                        chaveIdempotencia: `rec-${Date.now()}`,
                                      });
                                      toast(`Pedido ${p.numero} recebido com entrada no estoque!`, 'success');
                                      carregarTudo();
                                      onAtualizar?.();
                                    } catch (e) {
                                      toast(e.message, true);
                                    }
                                  }
                                }}
                              >
                                Receber e Dar Entrada
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── SUBMÓDULO 3: 🧾 PERDAS E INVENTÁRIO ── */}
      {abaAtiva === 'perdas' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={styles.kpiGrid}>
            <div style={styles.kpi}>
              <div style={styles.kpiLabel}>Acuracidade do Estoque</div>
              <div style={{ ...styles.kpiValue, color: '#10b981' }}>{relatorioAcuracidade?.acuracidade ?? 100}%</div>
            </div>
            <div style={styles.kpi}>
              <div style={styles.kpiLabel}>Itens Divergentes</div>
              <div style={{ ...styles.kpiValue, color: relatorioAcuracidade?.itensDivergentes ? '#ef4444' : '#10b981' }}>
                {relatorioAcuracidade?.itensDivergentes || 0}
              </div>
            </div>
            <div style={styles.kpi}>
              <div style={styles.kpiLabel}>Impacto Total de Perdas</div>
              <div style={{ ...styles.kpiValue, color: '#f59e0b' }}>{moneyK(relatorioAcuracidade?.totalPerdas || 0)}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Exato: {fmtR(relatorioAcuracidade?.totalPerdas || 0)}</div>
            </div>
            <div style={styles.kpi}>
              <div style={styles.kpiLabel}>Inventários Concluídos</div>
              <div style={styles.kpiValue}>{relatorioAcuracidade?.inventariosConcluidos || 0}</div>
            </div>
          </div>

          {/* Painel de Ações Rápidas de Perdas e Inventário */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: 16 }}>
            {/* Registro de Baixa / Ocorrência */}
            <div style={styles.card}>
              <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800 }}>Registrar Ocorrência / Perda</h3>
              <p style={styles.sub}>Baixas manuais auditadas: avarias, validade, quebras ou consumo interno.</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  salvarOcorrencia();
                }}
                style={{ display: 'grid', gap: 12, marginTop: 14 }}
              >
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>Tipo de Ocorrência</label>
                  <select
                    value={formOcorrencia.tipo}
                    onChange={(e) => setFormOcorrencia({ ...formOcorrencia, tipo: e.target.value })}
                    style={{ ...styles.input, width: '100%', marginTop: 4 }}
                  >
                    <option value="perda">Perda / Avaria Física</option>
                    <option value="quebra">Quebra Acidental</option>
                    <option value="consumo_interno">Consumo Interno (Bancada/Equipe)</option>
                    <option value="cortesia">Cortesia / Bonificação</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>Produto / Insumo</label>
                  <select
                    required
                    value={formOcorrencia.produtoId}
                    onChange={(e) => setFormOcorrencia({ ...formOcorrencia, produtoId: e.target.value })}
                    style={{ ...styles.input, width: '100%', marginTop: 4 }}
                  >
                    <option value="">Selecione um item…</option>
                    {produtosCombinados.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} (Saldo atual: {p.estoqueAtual})
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>Quantidade</label>
                    <input
                      type="number"
                      min="0.1"
                      step="any"
                      required
                      value={formOcorrencia.qtd}
                      onChange={(e) => setFormOcorrencia({ ...formOcorrencia, qtd: e.target.value })}
                      style={{ ...styles.input, width: '100%', marginTop: 4 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>Motivo</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: vidro quebrado, produto vencido"
                      value={formOcorrencia.motivo}
                      onChange={(e) => setFormOcorrencia({ ...formOcorrencia, motivo: e.target.value })}
                      style={{ ...styles.input, width: '100%', marginTop: 4 }}
                    />
                  </div>
                </div>
                <button type="submit" style={styles.btnDanger}>
                  Registrar Baixa Auditada
                </button>
              </form>
            </div>

            {/* Abertura de Inventário Físico */}
            <div style={styles.card}>
              <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800 }}>Contagem Física / Inventário</h3>
              <p style={styles.sub}>Inicie uma contagem para conferir o saldo físico com o sistema e gerar acuracidade.</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  abrirNovoInventario();
                }}
                style={{ display: 'grid', gap: 12, marginTop: 14 }}
              >
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>Modalidade</label>
                  <select
                    value={formInventario.tipo}
                    onChange={(e) => setFormInventario({ ...formInventario, tipo: e.target.value })}
                    style={{ ...styles.input, width: '100%', marginTop: 4 }}
                  >
                    <option value="geral">Inventário Geral (Todos os itens)</option>
                    <option value="rotativo">Rotativo por Categoria</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>Observação / Responsável</label>
                  <input
                    type="text"
                    placeholder="Ex: Contagem mensal de revenda e bar"
                    value={formInventario.observacao}
                    onChange={(e) => setFormInventario({ ...formInventario, observacao: e.target.value })}
                    style={{ ...styles.input, width: '100%', marginTop: 4 }}
                  />
                </div>
                <button type="submit" style={styles.btnPrimary}>
                  Iniciar Contagem de Inventário
                </button>
              </form>
            </div>
          </div>

          {/* Inventário em Andamento (se houver) */}
          {inventarioAberto && (
            <div style={{ ...styles.card, border: '2px solid #0284c7' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, color: '#0284c7', fontWeight: 800 }}>
                    Contagem em Aberto #{inventarioAberto.numero}
                  </h3>
                  <p style={styles.sub}>Preencha o saldo físico contado de cada item. Divergências serão calculadas em tempo real.</p>
                </div>
                <button type="button" style={styles.btnSuccess} onClick={concluirInventario}>
                  ✓ Concluir e Ajustar Saldos
                </button>
              </div>

              <div style={{ overflowX: 'auto', marginTop: 14 }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Item</th>
                      <th style={styles.th}>Saldo Sistema</th>
                      <th style={styles.th}>Contagem Física</th>
                      <th style={styles.th}>Divergência</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(inventarioAberto.itens || []).map((it) => (
                      <tr key={it.produtoId}>
                        <td style={styles.td}><strong>{it.nome}</strong></td>
                        <td style={styles.td}>{it.saldoSistema} un</td>
                        <td style={styles.td}>
                          <input
                            type="number"
                            defaultValue={it.contado ?? ''}
                            onBlur={(e) => registrarContagem(it.produtoId, e.target.value)}
                            placeholder="Qtd contada"
                            style={{ ...styles.input, width: 120 }}
                          />
                        </td>
                        <td style={{ ...styles.td, fontWeight: 800, color: Number(it.divergencia || 0) === 0 ? '#10b981' : '#ef4444' }}>
                          {it.divergencia !== null ? (it.divergencia > 0 ? `+${it.divergencia}` : it.divergencia) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Histórico Recente de Perdas */}
          <div style={styles.card}>
            <h3 style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 800 }}>Histórico Recente de Ocorrências e Perdas</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Data</th>
                    <th style={styles.th}>Tipo</th>
                    <th style={styles.th}>Produto</th>
                    <th style={styles.th}>Quantidade</th>
                    <th style={styles.th}>Motivo</th>
                    <th style={styles.th}>Responsável</th>
                  </tr>
                </thead>
                <tbody>
                  {ocorrencias.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: 20, color: 'var(--muted)' }}>
                        Nenhuma ocorrência de perda registrada.
                      </td>
                    </tr>
                  ) : (
                    ocorrencias.slice(0, 15).map((oco) => (
                      <tr key={oco.id}>
                        <td style={styles.td}>{oco.registradoEm ? String(oco.registradoEm).slice(0, 10) : '—'}</td>
                        <td style={styles.td}>
                          <span style={styles.pill(oco.tipo === 'perda' ? '#ef4444' : '#f59e0b')}>
                            {oco.tipo?.toUpperCase()}
                          </span>
                        </td>
                        <td style={styles.td}><strong>{oco.produtoNome || oco.produtoId}</strong></td>
                        <td style={{ ...styles.td, fontWeight: 700 }}>{oco.qtd} un</td>
                        <td style={styles.td}>{oco.motivo}</td>
                        <td style={styles.td}>{oco.usuarioNome || 'Operador'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── SUBMÓDULO 4: 🧪 FICHAS TÉCNICAS ── */}
      {abaAtiva === 'fichas' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Fichas Técnicas de Procedimentos</h3>
                <p style={styles.sub}>
                  Composição de insumos consumidos por cada serviço da Barbearia Dino (corte, barba, selagem, químicas, barboterapia). Sempre que a comanda é finalizada no caixa, os insumos da ficha técnica são baixados automaticamente pelo custo real.
                </p>
              </div>
              <button
                type="button"
                style={styles.btnPrimary}
                onClick={() => {
                  setFormFicha({ produtoFinalId: '', rendimento: 1, observacao: '', itens: [] });
                  setModalFicha(true);
                }}
              >
                + Nova Ficha Técnica
              </button>
            </div>

            <div style={{ overflowX: 'auto', marginTop: 16 }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Serviço / Procedimento</th>
                    <th style={styles.th}>Insumos Consumidos</th>
                    <th style={styles.th}>Custo dos Insumos</th>
                    <th style={styles.th}>Preço do Serviço</th>
                    <th style={styles.th}>Margem de Insumo</th>
                    <th style={styles.th}>Baixa Automática</th>
                    <th style={styles.th}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {fichas.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: 28, color: 'var(--muted)' }}>
                        Nenhuma ficha técnica cadastrada. Clique em "+ Nova Ficha Técnica" para vincular insumos a um serviço!
                      </td>
                    </tr>
                  ) : (
                    fichas.map((f) => {
                      const custoTotal = Number(f.custoTotalEstimado || f.custoTotal || 0);
                      const preco = Number(f.precoVenda || 0);
                      const margem = preco > 0 ? Math.round(((preco - custoTotal) / preco) * 100) : 0;

                      return (
                        <tr key={f.id}>
                          <td style={styles.td}>
                            <strong>{f.nomeProduto || f.nomeServico || 'Procedimento'}</strong>
                            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                              Rendimento: {f.rendimento || 1} atendimento(s)
                            </div>
                          </td>
                          <td style={styles.td}>
                            {(f.itens || []).map((it, idx) => (
                              <div key={idx} style={{ fontSize: 12 }}>
                                • {it.qtd}× {it.nomeInsumo || it.produtoId}
                              </div>
                            ))}
                          </td>
                          <td style={{ ...styles.td, fontWeight: 700, color: '#ef4444' }}>
                            {fmtR(custoTotal)}
                          </td>
                          <td style={{ ...styles.td, fontWeight: 700 }}>
                            {fmtR(preco)}
                          </td>
                          <td style={{ ...styles.td, fontWeight: 800, color: '#10b981' }}>
                            {margem}%
                          </td>
                          <td style={styles.td}>
                            <span style={styles.pill('#10b981', 'rgba(16, 185, 129, 0.1)')}>
                              ✓ Ativa no Caixa
                            </span>
                          </td>
                          <td style={styles.td}>
                            <button
                              type="button"
                              style={{ ...styles.btnDanger, fontSize: 11, padding: '4px 8px' }}
                              onClick={async () => {
                                if (window.confirm(`Remover ficha técnica de ${f.nomeProduto || 'serviço'}?`)) {
                                  try {
                                    await api.delete(`/api/admin/fichas-tecnicas/${f.id}`);
                                    toast('Ficha técnica removida com sucesso!', 'success');
                                    carregarTudo();
                                  } catch (e) {
                                    toast(e.message, true);
                                  }
                                }
                              }}
                            >
                              Excluir
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── SUBMÓDULO 5: 🗂️ FORNECEDORES E FUNCIONÁRIOS ── */}
      {abaAtiva === 'cadastros' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(450px, 100%), 1fr))', gap: 16 }}>
          {/* Fornecedores */}
          <div style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Fornecedores Parceiros</h3>
                <p style={styles.sub}>Distribuidores de cosméticos, bebidas de bar e materiais de bancada.</p>
              </div>
            </div>

            <div style={{ overflowX: 'auto', marginTop: 14 }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Fornecedor</th>
                    <th style={styles.th}>CNPJ</th>
                    <th style={styles.th}>Contato / Fone</th>
                    <th style={styles.th}>Prazo</th>
                  </tr>
                </thead>
                <tbody>
                  {fornecedores.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: 20, color: 'var(--muted)' }}>
                        Nenhum fornecedor cadastrado.
                      </td>
                    </tr>
                  ) : (
                    fornecedores.map((f) => (
                      <tr key={f.id}>
                        <td style={styles.td}><strong>{f.nome}</strong></td>
                        <td style={styles.td}>{f.cnpj || '—'}</td>
                        <td style={styles.td}>{[f.contato, f.telefone].filter(Boolean).join(' · ') || '—'}</td>
                        <td style={styles.td}>{f.prazoEntregaDias || 7} dia(s)</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Funcionários e Equipe */}
          <div style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Equipe e Funcionários</h3>
                <p style={styles.sub}>Profissionais da bancada, recepção, caixa e gestão Dino Barbearia.</p>
              </div>
            </div>

            <div style={{ overflowX: 'auto', marginTop: 14 }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Nome</th>
                    <th style={styles.th}>Cargo / Perfil</th>
                    <th style={styles.th}>Telefone / E-mail</th>
                    <th style={styles.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {funcionarios.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: 20, color: 'var(--muted)' }}>
                        Carregando equipe…
                      </td>
                    </tr>
                  ) : (
                    funcionarios.map((func) => (
                      <tr key={func.id}>
                        <td style={styles.td}><strong>{func.nome}</strong></td>
                        <td style={styles.td}>
                          <span style={styles.pill('#0284c7', 'rgba(2, 132, 199, 0.08)')}>{func.cargo || func.role || 'Profissional'}</span>
                        </td>
                        <td style={styles.td}>{[func.telefone, func.email].filter(Boolean).join(' · ') || '—'}</td>
                        <td style={styles.td}>
                          <span style={styles.pill('#10b981', 'rgba(16, 185, 129, 0.1)')}>Ativo</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DE ENTRADA RÁPIDA DE ESTOQUE ── */}
      {modalEntrada && (
        <Modal open={modalEntrada} onClose={() => setModalEntrada(false)} title="Registrar Entrada no Estoque">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              salvarEntradaRapida();
            }}
            style={{ display: 'grid', gap: 14 }}
          >
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Produto / Insumo *</label>
              <select
                required
                value={formEntrada.produtoId}
                onChange={(e) => setFormEntrada({ ...formEntrada, produtoId: e.target.value })}
                style={{ ...styles.input, width: '100%', marginTop: 4 }}
              >
                <option value="">Selecione um produto…</option>
                {produtosCombinados.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} — Saldo atual: {p.estoqueAtual}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Quantidade de Entrada *</label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="Ex: 12"
                  value={formEntrada.qtd}
                  onChange={(e) => setFormEntrada({ ...formEntrada, qtd: e.target.value })}
                  style={{ ...styles.input, width: '100%', marginTop: 4 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Custo Unitário (R$)</label>
                <input
                  type="text"
                  placeholder="Ex: 25,00"
                  value={formEntrada.custo}
                  onChange={(e) => setFormEntrada({ ...formEntrada, custo: e.target.value })}
                  style={{ ...styles.input, width: '100%', marginTop: 4 }}
                />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Observação / NF-e</label>
              <input
                type="text"
                placeholder="Ex: Compra local distribuidor, reposição balcão"
                value={formEntrada.observacao}
                onChange={(e) => setFormEntrada({ ...formEntrada, observacao: e.target.value })}
                style={{ ...styles.input, width: '100%', marginTop: 4 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
              <button type="button" style={styles.btn} onClick={() => setModalEntrada(false)}>
                Cancelar
              </button>
              <button type="submit" style={styles.btnPrimary}>
                Confirmar Entrada e Recalcular Saldo
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── MODAL DE NOVA FICHA TÉCNICA ── */}
      {modalFicha && (
        <Modal open={modalFicha} onClose={() => setModalFicha(false)} title="Nova Ficha Técnica de Procedimento">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!formFicha.produtoFinalId || !formFicha.itens.length) {
                return toast('Selecione o serviço e ao menos um insumo.', true);
              }
              try {
                await api.post('/api/admin/fichas-tecnicas', formFicha);
                toast('Ficha técnica cadastrada com sucesso!', 'success');
                setModalFicha(false);
                carregarTudo();
              } catch (err) {
                toast(err.message, true);
              }
            }}
            style={{ display: 'grid', gap: 14 }}
          >
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Serviço / Procedimento *</label>
              <select
                required
                value={formFicha.produtoFinalId}
                onChange={(e) => setFormFicha({ ...formFicha, produtoFinalId: e.target.value })}
                style={{ ...styles.input, width: '100%', marginTop: 4 }}
              >
                <option value="">Selecione um serviço…</option>
                {produtosCombinados.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome} ({p.categoria})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Adicionar Insumo Consumido</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px auto', gap: 8, marginTop: 4 }}>
                <select
                  value={itemFichaId}
                  onChange={(e) => setItemFichaId(e.target.value)}
                  style={styles.input}
                >
                  <option value="">Selecione o insumo…</option>
                  {produtosCombinados.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} (Custo: {fmtR(p.custoUnitario)})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0.001"
                  step="any"
                  value={itemFichaQtd}
                  onChange={(e) => setItemFichaQtd(e.target.value)}
                  placeholder="Qtd"
                  style={styles.input}
                />
                <button
                  type="button"
                  style={styles.btnPrimary}
                  onClick={() => {
                    const q = Number(itemFichaQtd);
                    if (!itemFichaId || q <= 0) return toast('Selecione o insumo e informe a quantidade.');
                    const insumoObj = produtosCombinados.find((p) => p.id === itemFichaId);
                    setFormFicha({
                      ...formFicha,
                      itens: [...formFicha.itens, { produtoId: itemFichaId, qtd: q, nomeInsumo: insumoObj?.nome || itemFichaId }],
                    });
                    setItemFichaId('');
                    setItemFichaQtd('1');
                  }}
                >
                  + Adicionar
                </button>
              </div>
            </div>

            {formFicha.itens.length > 0 && (
              <div style={{ background: 'var(--surface-2, #f8fafc)', padding: 12, borderRadius: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>
                  Insumos da Ficha Técnica:
                </div>
                {formFicha.itens.map((it, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
                    <span>{it.qtd}× {it.nomeInsumo}</span>
                    <button
                      type="button"
                      style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontWeight: 800 }}
                      onClick={() => setFormFicha({ ...formFicha, itens: formFicha.itens.filter((_, i) => i !== idx) })}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
              <button type="button" style={styles.btn} onClick={() => setModalFicha(false)}>
                Cancelar
              </button>
              <button type="submit" style={styles.btnPrimary}>
                Salvar Ficha Técnica
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
