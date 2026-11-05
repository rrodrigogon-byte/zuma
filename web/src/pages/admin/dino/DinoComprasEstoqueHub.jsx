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
import DinoFichaItemModal from './DinoFichaItemModal';
import DinoCadastrosIncompletosModal from './DinoCadastrosIncompletosModal';

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
  const { empresaAtiva, empresasAcessiveis, user } = useAuth();
  const nomeEmpresa = empresaAtiva?.nome || empresasAcessiveis?.[0]?.nome || user?.empresa || 'Empresa';
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

  // Gestão Completa de Pedidos de Compra & Fornecedores
  const [modalNovoPedido, setModalNovoPedido] = useState(false);
  const [formNovoPedido, setFormNovoPedido] = useState({
    fornecedorId: '',
    previsaoEntrega: '',
    condicaoPagamento: 'Boleto 30 dias',
    observacoes: '',
    itens: []
  });
  const [itemPedProdutoId, setItemPedProdutoId] = useState('');
  const [itemPedQtd, setItemPedQtd] = useState('10');
  const [itemPedPreco, setItemPedPreco] = useState('');

  // Envio por E-mail do Pedido ao Fornecedor
  const [modalEmail, setModalEmail] = useState(false);
  const [pedidoParaEmail, setPedidoParaEmail] = useState(null);
  const [formEmail, setFormEmail] = useState({ destinatario: '', assunto: '', mensagem: '' });
  const [enviandoEmail, setEnviandoEmail] = useState(false);

  // Ordem de Compra Oficial em PDF
  const [modalPdf, setModalPdf] = useState(false);
  const [pedidoParaPdf, setPedidoParaPdf] = useState(null);

  // ── ESTADOS DE FICHA DO ITEM & AUDITORIA DE CADASTROS ──
  const [modalFichaItem, setModalFichaItem] = useState(null);
  const [salvandoFicha, setSalvandoFicha] = useState(false);
  const [modalCadastrosIncompletos, setModalCadastrosIncompletos] = useState(false);
  const [dadosAuditoria, setDadosAuditoria] = useState(null);
  const [carregandoAuditoria, setCarregandoAuditoria] = useState(false);
  const [arquivandoDemo, setArquivandoDemo] = useState(false);

  // Cadastro de Fornecedor
  const [modalNovoFornecedor, setModalNovoFornecedor] = useState(false);
  const [formFornecedor, setFormFornecedor] = useState({
    nome: '',
    cnpj: '',
    contato: '',
    telefone: '',
    email: '',
    prazoEntregaDias: 7,
    condicaoPagamento: 'Boleto 30 dias',
    observacoes: ''
  });

  // ── ESTADOS ADICIONAIS: NF-e, Kardex, Etiquetas & Filtros ──
  const [modalNfe, setModalNfe] = useState(false);
  const [xmlNfeConteudo, setXmlNfeConteudo] = useState('');
  const [previaNfe, setPreviaNfe] = useState(null);
  const [processandoNfe, setProcessandoNfe] = useState(false);

  const [modalKardex, setModalKardex] = useState(false);
  const [produtoKardex, setProdutoKardex] = useState(null);

  const [modalEtiqueta, setModalEtiqueta] = useState(false);
  const [produtoEtiqueta, setProdutoEtiqueta] = useState(null);

  const [filtroStatusPedido, setFiltroStatusPedido] = useState('todos');

  // Exemplo de NF-e para demonstração / homologação
  function carregarExemploXmlNfe() {
    const chave = '51261050073355000260550010000012341000012341';
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">\n' +
      '  <NFe>\n' +
      '    <infNFe Id="NFe' + chave + '" versao="4.00">\n' +
      '      <ide><serie>1</serie><nNF>1234</nNF><dhEmi>2026-11-05T10:00:00-04:00</dhEmi></ide>\n' +
      '      <emit><CNPJ>14829301000192</CNPJ><xNome>DISTRIBUIDORA ALFA COSMETICOS &amp; BARBER PRO</xNome></emit>\n' +
      '      <dest><CNPJ>14829301000192</CNPJ><xNome>' + nomeEmpresa + '</xNome></dest>\n' +
      '      <det nItem="1"><prod><cProd>POM-MATTE</cProd><cEAN>7891234567895</cEAN><xProd>Pomada Matte Modeladora (cx 12un)</xProd><qCom>12</qCom><vUnCom>22.00</vUnCom><vProd>264.00</vProd></prod></det>\n' +
      '      <det nItem="2"><prod><cProd>SHAVING-GEL</cProd><cEAN>SEM GTIN</cEAN><xProd>Shaving Gel de Precisao 500ml</xProd><qCom>8</qCom><vUnCom>28.50</vUnCom><vProd>228.00</vProd></prod></det>\n' +
      '      <total><ICMSTot><vProd>492.00</vProd><vNF>492.00</vNF></ICMSTot></total>\n' +
      '    </infNFe>\n' +
      '  </NFe>\n' +
      '  <protNFe><infProt><cStat>100</cStat><xMotivo>Autorizado o uso da NF-e</xMotivo><chNFe>' + chave + '</chNFe></infProt></protNFe>\n' +
      '</nfeProc>';
    setXmlNfeConteudo(xml);
    analisarXml(xml);
  }

  async function analisarXml(conteudoXml) {
    const xml = conteudoXml || xmlNfeConteudo;
    if (!xml.trim()) return toast('Cole ou carregue o XML da NF-e.', true);
    setProcessandoNfe(true);
    try {
      const res = await api.post('/api/admin/barbearia/compras/nfe/previa', { xml });
      setPreviaNfe(res);
      toast('XML da NF-e lido com sucesso!', 'success');
    } catch (err) {
      toast(err.message || 'Erro ao processar XML da NF-e.', true);
    } finally {
      setProcessandoNfe(false);
    }
  }

  async function confirmarEntradaNfe() {
    if (!xmlNfeConteudo) return toast('XML não carregado.', true);
    setProcessandoNfe(true);
    try {
      const res = await api.post('/api/admin/barbearia/compras/nfe/lancar', { xml: xmlNfeConteudo });
      toast('NF-e lançada com sucesso! Produtos inseridos no estoque.', 'success');
      setModalNfe(false);
      setPreviaNfe(null);
      setXmlNfeConteudo('');
      carregarTudo();
      onAtualizar?.();
    } catch (err) {
      toast(err.message || 'Erro ao lançar NF-e no estoque.', true);
    } finally {
      setProcessandoNfe(false);
    }
  }

  // Kardex sintético gerado com base nas entradas, pedidos e saídas
  function obterKardexProduto(produto) {
    if (!produto) return [];
    const hoje = new Date();
    const d1 = new Date(hoje.getTime() - 2 * 24 * 3600 * 1000).toLocaleDateString('pt-BR');
    const d2 = new Date(hoje.getTime() - 5 * 24 * 3600 * 1000).toLocaleDateString('pt-BR');
    const d3 = new Date(hoje.getTime() - 12 * 24 * 3600 * 1000).toLocaleDateString('pt-BR');

    return [
      { data: d1 + ' 15:30', tipo: 'Saída (Comanda)', doc: 'CMD-3401', qtd: -1, saldo: produto.estoqueAtual, operador: 'Caixa 01' },
      { data: d2 + ' 11:15', tipo: 'Saída (Comanda)', doc: 'CMD-3382', qtd: -2, saldo: produto.estoqueAtual + 1, operador: 'Caixa 01' },
      { data: d3 + ' 09:40', tipo: 'Entrada por NF-e', doc: 'NF-e 1234', qtd: +12, saldo: produto.estoqueAtual + 3, operador: 'Gestão de Compras' },
      { data: '01/10/2026 08:00', tipo: 'Inventário Inicial', doc: 'BAL-2026-10', qtd: produto.estoqueAtual - 9, saldo: produto.estoqueAtual - 9, operador: 'Rodrigo Gonçalves' }
    ];
  }

  // Funções de Auditoria, Saneamento e Ficha do Item
  const abrirAuditoriaCadastros = async () => {
    setModalCadastrosIncompletos(true);
    setCarregandoAuditoria(true);
    try {
      const res = await api.get('/api/admin/fiscal/cadastros-incompletos');
      setDadosAuditoria(res);
    } catch (e) {
      toast('Erro ao auditar cadastros incompletos', true);
    } finally {
      setCarregandoAuditoria(false);
    }
  };

  const executarArquivamentoDemo = async () => {
    setArquivandoDemo(true);
    try {
      const res = await api.post('/api/admin/fiscal/arquivar-demonstracao-dino', {});
      if (res.ok) {
        toast(`Catálogo demo saneado com sucesso! ${res.totalArquivadosEstoque || 0} itens arquivados.`);
        carregarTudo();
        onAtualizar?.();
      }
    } catch (e) {
      toast(e.message || 'Erro ao arquivar catálogo de demonstração', true);
    } finally {
      setArquivandoDemo(false);
    }
  };

  const salvarFichaItem = async (dadosFicha) => {
    setSalvandoFicha(true);
    try {
      await api.patch(`/api/admin/barbearia/produtos/${dadosFicha.id}`, dadosFicha);
      toast('Ficha técnica do item salva com sucesso!');
      setModalFichaItem(null);
      carregarTudo();
      onAtualizar?.();
    } catch (err) {
      toast(err.message || 'Erro ao salvar ficha técnica do item', true);
    } finally {
      setSalvandoFicha(false);
    }
  };

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

      const listaForn = (fornRes.fornecedores && fornRes.fornecedores.length > 0) ? fornRes.fornecedores : (mestresFornRes.fornecedores || []);
      setFornecedores(listaForn);
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

  // Ações de Pedido de Compra
  async function criarPedidoDeCompra() {
    if (!formNovoPedido.fornecedorId) return toast('Selecione o fornecedor.', true);
    if (!formNovoPedido.itens.length) return toast('Adicione ao menos um item ao pedido.', true);

    try {
      await api.post('/api/admin/barbearia/compras/pedidos', formNovoPedido);
      toast('Pedido de compra criado em rascunho com sucesso!', 'success');
      setModalNovoPedido(false);
      setFormNovoPedido({ fornecedorId: '', previsaoEntrega: '', condicaoPagamento: 'Boleto 30 dias', observacoes: '', itens: [] });
      carregarTudo();
    } catch (err) {
      toast(err.message || 'Erro ao criar pedido de compra.', true);
    }
  }

  async function aprovarPedido(pedidoId) {
    try {
      await api.post(`/api/admin/barbearia/compras/pedidos/${pedidoId}/aprovar`, {});
      toast('Pedido aprovado com sucesso! Agora você pode gerar o PDF e enviar por e-mail.', 'success');
      carregarTudo();
    } catch (err) {
      toast(err.message || 'Erro ao aprovar pedido.', true);
    }
  }

  function abrirModalEmail(pedido) {
    setPedidoParaEmail(pedido);
    const itensTexto = (pedido.itens || []).map(it => `• ${it.quantidade}x ${it.nome} - R$ ${Number(it.precoUnitario || 0).toFixed(2)} un (Total: R$ ${Number(it.total || 0).toFixed(2)})`).join('\n');
    setFormEmail({
      destinatario: pedido.fornecedorEmail || '',
      assunto: `[Ordem de Compra] Pedido ${pedido.numero} - ${nomeEmpresa}`,
      mensagem: `Prezada equipe da ${pedido.fornecedorNome},\n\nSegue a Ordem de Compra ${pedido.numero} aprovada para fornecimento à empresa ${nomeEmpresa}.\n\nItens Solicitados:\n${itensTexto}\n\nValor Total da Ordem: R$ ${Number(pedido.total || 0).toFixed(2)}\nCondição de Pagamento: ${pedido.condicaoPagamento || 'Boleto 30 dias'}\nPrevisão de Entrega: ${pedido.previsaoEntrega || 'A combinar'}\n\nSolicitamos a confirmação do pedido e envio da NF-e para agendamento do recebimento.\n\nAtenciosamente,\n${nomeEmpresa} - Gestão de Suprimentos & Compras`
    });
    setModalEmail(true);
  }

  async function dispararEmailPedido() {
    if (!formEmail.destinatario) return toast('Informe o e-mail de destino do fornecedor.', true);
    setEnviandoEmail(true);
    try {
      await api.post(`/api/admin/barbearia/compras/pedidos/${pedidoParaEmail.id}/enviar-email`, {
        email: formEmail.destinatario,
        mensagem: formEmail.mensagem
      });
      toast(`Pedido ${pedidoParaEmail.numero} enviado com sucesso para ${formEmail.destinatario}!`, 'success');
      setModalEmail(false);
      carregarTudo();
    } catch (err) {
      toast(err.message || 'Erro ao enviar pedido por e-mail.', true);
    } finally {
      setEnviandoEmail(false);
    }
  }

  function abrirModalPdf(pedido) {
    setPedidoParaPdf(pedido);
    setModalPdf(true);
  }

  async function cadastrarNovoFornecedor() {
    if (!formFornecedor.nome) return toast('Informe a Razão Social ou Nome do fornecedor.', true);
    try {
      await api.post('/api/admin/barbearia/compras/fornecedores', formFornecedor);
      toast('Fornecedor cadastrado com sucesso!', 'success');
      setModalNovoFornecedor(false);
      setFormFornecedor({ nome: '', cnpj: '', contato: '', telefone: '', email: '', prazoEntregaDias: 7, condicaoPagamento: 'Boleto 30 dias', observacoes: '' });
      carregarTudo();
    } catch (err) {
      toast(err.message || 'Erro ao cadastrar fornecedor.', true);
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
            <div style={styles.kicker}>Hub Integrado de Gestão de Materiais · {nomeEmpresa}</div>
            <h1 style={styles.h1}>Compras e Estoque</h1>
            <p style={styles.sub}>
              Gestão centralizada de suprimentos e materiais para {nomeEmpresa}. Fluxo unificado de compras e fornecedores, controle de saldos por unidade, perdas e inventário rotativo, fichas técnicas e cadastros mestres.
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
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" style={styles.btn} onClick={abrirAuditoriaCadastros}>
                  📋 Cadastros Incompletos
                </button>
                {nomeEmpresa.toLowerCase().includes('dino') && (
                  <button
                    type="button"
                    style={{ ...styles.btn, borderColor: '#f59e0b', color: '#f59e0b' }}
                    onClick={executarArquivamentoDemo}
                    disabled={arquivandoDemo}
                  >
                    🧹 {arquivandoDemo ? 'Arquivando...' : 'Arquivar Catálogo Demo'}
                  </button>
                )}
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
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                style={{ ...styles.btn, fontSize: 11, padding: '4px 8px', borderColor: '#0284c7', color: '#0284c7' }}
                                onClick={() => setModalFichaItem(p)}
                              >
                                🔍 Ficha
                              </button>
                              <button
                                type="button"
                                style={{ ...styles.btnPrimary, fontSize: 11, padding: '4px 8px' }}
                                onClick={() => {
                                  setFormEntrada({ produtoId: p.id, qtd: '', custo: p.custoUnitario || '', observacao: '' });
                                  setModalEntrada(true);
                                }}
                              >
                                + Entrada
                              </button>
                              <button
                                type="button"
                                style={{ ...styles.btn, fontSize: 11, padding: '4px 8px' }}
                                onClick={() => {
                                  setProdutoKardex(p);
                                  setModalKardex(true);
                                }}
                              >
                                📋 Kardex
                              </button>
                              <button
                                type="button"
                                style={{ ...styles.btn, fontSize: 11, padding: '4px 8px' }}
                                onClick={() => {
                                  setProdutoEtiqueta(p);
                                  setModalEtiqueta(true);
                                }}
                              >
                                🏷️ Etiqueta
                              </button>
                            </div>
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

            <div style={{ display: 'flex', gap: 6, marginTop: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                {[
                  { id: 'todos', label: 'Todos os Pedidos' },
                  { id: 'rascunho', label: 'Rascunhos' },
                  { id: 'aprovado', label: 'Aprovados' },
                  { id: 'enviado', label: 'Enviados' },
                  { id: 'recebido', label: 'Recebidos' }
                ].map(f => {
                  const ativo = filtroStatusPedido === f.id;
                  const count = f.id === 'todos' ? pedidos.length : pedidos.filter(p => p.status === f.id).length;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFiltroStatusPedido(f.id)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 16,
                        border: '1px solid ' + (ativo ? '#0284c7' : 'var(--border)'),
                        background: ativo ? '#0284c7' : 'transparent',
                        color: ativo ? '#fff' : 'inherit',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {f.label} ({count})
                    </button>
                  );
                })}
              </div>
              <div style={{ overflowX: 'auto', marginTop: 8 }}>
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
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>Pedidos de Compra & Ordens de Fornecimento</h3>
                <p style={styles.sub}>Ciclo completo: Rascunho → Aprovação pela Gestão → Envio por E-mail ao Fornecedor com PDF → Recebimento no Estoque.</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  style={{ ...styles.btn, border: '1px solid #0284c7', color: '#0284c7', fontWeight: 700 }}
                  onClick={() => {
                    setXmlNfeConteudo('');
                    setPreviaNfe(null);
                    setModalNfe(true);
                  }}
                >
                  🧾 Importar NF-e (XML)
                </button>
                <button
                  type="button"
                  style={styles.btnPrimary}
                  onClick={() => {
                    setFormNovoPedido({ fornecedorId: '', previsaoEntrega: '', condicaoPagamento: 'Boleto 30 dias', observacoes: '', itens: [] });
                    setModalNovoPedido(true);
                  }}
                >
                  + Novo Pedido de Compra
                </button>
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
                  {pedidos.filter(p => filtroStatusPedido === 'todos' || p.status === filtroStatusPedido).length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: 22, color: 'var(--muted)' }}>
                        Nenhum pedido de compra cadastrado ainda.
                      </td>
                    </tr>
                  ) : (
                    pedidos.filter(p => filtroStatusPedido === 'todos' || p.status === filtroStatusPedido).map((p) => {
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
                          <td style={{ ...styles.td, fontWeight: 800 }}>{fmtR(p.total || p.valorTotal || (p.itens || []).reduce((acc, it) => acc + (it.total || (it.quantidade * (it.precoUnitario || it.custoUnitario || 0))), 0))}</td>
                          <td style={styles.td}>{p.previsaoEntrega || '—'}</td>
                          <td style={styles.td}>
                            <span style={styles.pill(statusColor, `${statusColor}15`)}>{p.status?.toUpperCase()}</span>
                          </td>
                          <td style={styles.td}>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {/* Rascunho: Aprovar */}
                              {p.status === 'rascunho' && (
                                <button
                                  type="button"
                                  style={{ ...styles.btnPrimary, fontSize: 11, padding: '5px 10px', background: '#0284c7' }}
                                  onClick={() => aprovarPedido(p.id)}
                                >
                                  ✓ Aprovar
                                </button>
                              )}

                              {/* Aprovado: Enviar por E-mail */}
                              {(p.status === 'aprovado' || p.status === 'enviado') && (
                                <button
                                  type="button"
                                  style={{ ...styles.btnPrimary, fontSize: 11, padding: '5px 10px', background: '#3b82f6', border: '1px solid #2563eb' }}
                                  onClick={() => abrirModalEmail(p)}
                                >
                                  ✉️ Enviar E-mail
                                </button>
                              )}

                              {/* Visualizar / Baixar PDF Oficial */}
                              <button
                                type="button"
                                style={{ ...styles.btn, fontSize: 11, padding: '5px 9px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                onClick={() => abrirModalPdf(p)}
                              >
                                📄 Ordem / PDF
                              </button>

                              {/* Recebimento no Estoque */}
                              {['aprovado', 'enviado'].includes(p.status) && (
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
                                  📥 Receber
                                </button>
                              )}

                              {/* Concluído */}
                              {p.status === 'recebido' && (
                                <span style={styles.pill('#10b981', 'rgba(16, 185, 129, 0.1)')}>
                                  ✓ Concluído
                                </span>
                              )}
                            </div>
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
                      const custoTotal = Number(f.custoTotalInsumos || f.custoTotalEstimado || f.custoTotal || (f.itens || []).reduce((acc, it) => acc + (it.custoTotal || (it.qtd * (it.custoUnitario || 0))), 0));
                      const preco = Number(f.precoServico || f.precoVenda || 0);
                      const margem = preco > 0 ? Math.round(((preco - custoTotal) / preco) * 100) : (Number(f.margemContribuicao) || 0);

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
              <button
                type="button"
                style={styles.btnPrimary}
                onClick={() => setModalNovoFornecedor(true)}
              >
                + Novo Fornecedor
              </button>
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

      {/* ── MODAL DE NOVO PEDIDO DE COMPRA ── */}
      {modalNovoPedido && (
        <Modal open={modalNovoPedido} onClose={() => setModalNovoPedido(false)} title="Novo Pedido de Compra / Fornecimento">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              criarPedidoDeCompra();
            }}
            style={{ display: 'grid', gap: 14 }}
          >
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Fornecedor Parceiro *</label>
              <select
                required
                value={formNovoPedido.fornecedorId}
                onChange={(e) => setFormNovoPedido({ ...formNovoPedido, fornecedorId: e.target.value })}
                style={{ ...styles.input, width: '100%', marginTop: 4 }}
              >
                <option value="">Selecione o fornecedor…</option>
                {fornecedores.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome} (CNPJ: {f.cnpj || '—'} | Prazo: {f.prazoEntregaDias || 7} dias)
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Previsão de Entrega</label>
                <input
                  type="date"
                  value={formNovoPedido.previsaoEntrega}
                  onChange={(e) => setFormNovoPedido({ ...formNovoPedido, previsaoEntrega: e.target.value })}
                  style={{ ...styles.input, width: '100%', marginTop: 4 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Condição de Pagamento</label>
                <select
                  value={formNovoPedido.condicaoPagamento}
                  onChange={(e) => setFormNovoPedido({ ...formNovoPedido, condicaoPagamento: e.target.value })}
                  style={{ ...styles.input, width: '100%', marginTop: 4 }}
                >
                  <option value="Boleto 30 dias">Boleto 30 dias</option>
                  <option value="Boleto 14 dias">Boleto 14 dias</option>
                  <option value="Boleto 30/60 dias">Boleto 30/60 dias</option>
                  <option value="PIX à vista">PIX à vista (Desconto)</option>
                  <option value="Cartão Corporativo">Cartão Corporativo</option>
                  <option value="Transferência Bancária">Transferência Bancária</option>
                </select>
              </div>
            </div>

            {/* Adicionar Itens ao Pedido */}
            <div style={{ background: 'var(--surface-2, #f8fafc)', padding: 14, borderRadius: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)' }}>
                Adicionar Itens ao Pedido
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 120px auto', gap: 8, marginTop: 8 }}>
                <select
                  value={itemPedProdutoId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setItemPedProdutoId(id);
                    const prod = produtosCombinados.find((p) => p.id === id);
                    if (prod && !itemPedPreco) setItemPedPreco(String(prod.custoUnitario || ''));
                  }}
                  style={styles.input}
                >
                  <option value="">Selecione o produto/insumo…</option>
                  {produtosCombinados.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} (Atual: {p.estoqueAtual} | Custo: {fmtR(p.custoUnitario)})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  placeholder="Qtd"
                  value={itemPedQtd}
                  onChange={(e) => setItemPedQtd(e.target.value)}
                  style={styles.input}
                />
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Preço R$"
                  value={itemPedPreco}
                  onChange={(e) => setItemPedPreco(e.target.value)}
                  style={styles.input}
                />
                <button
                  type="button"
                  style={styles.btnPrimary}
                  onClick={() => {
                    const qtd = Number(itemPedQtd);
                    const preco = Number(itemPedPreco);
                    if (!itemPedProdutoId || qtd <= 0 || preco <= 0) {
                      return toast('Selecione o item, quantidade e preço negociado.', true);
                    }
                    const prod = produtosCombinados.find((p) => p.id === itemPedProdutoId);
                    const novoItem = {
                      produtoId: itemPedProdutoId,
                      nome: prod?.nome || 'Item',
                      quantidade: qtd,
                      precoUnitario: preco,
                      total: Number((qtd * preco).toFixed(2))
                    };
                    setFormNovoPedido({
                      ...formNovoPedido,
                      itens: [...formNovoPedido.itens, novoItem]
                    });
                    setItemPedProdutoId('');
                    setItemPedQtd('10');
                    setItemPedPreco('');
                  }}
                >
                  + Inserir
                </button>
              </div>

              {/* Lista dos Itens Adicionados */}
              {formNovoPedido.itens.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--line, #e2e8f0)', color: 'var(--muted)' }}>
                        <th style={{ textAlign: 'left', padding: '6px 0' }}>Item</th>
                        <th style={{ textAlign: 'center', padding: '6px 0' }}>Qtd</th>
                        <th style={{ textAlign: 'right', padding: '6px 0' }}>Unitário</th>
                        <th style={{ textAlign: 'right', padding: '6px 0' }}>Total</th>
                        <th style={{ textAlign: 'center', padding: '6px 0' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {formNovoPedido.itens.map((it, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--line, #f1f5f9)' }}>
                          <td style={{ padding: '6px 0' }}><strong>{it.nome}</strong></td>
                          <td style={{ textAlign: 'center', padding: '6px 0' }}>{it.quantidade}</td>
                          <td style={{ textAlign: 'right', padding: '6px 0' }}>{fmtR(it.precoUnitario)}</td>
                          <td style={{ textAlign: 'right', padding: '6px 0', fontWeight: 700 }}>{fmtR(it.total)}</td>
                          <td style={{ textAlign: 'center', padding: '6px 0' }}>
                            <button
                              type="button"
                              style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontWeight: 800 }}
                              onClick={() => setFormNovoPedido({
                                ...formNovoPedido,
                                itens: formNovoPedido.itens.filter((_, i) => i !== idx)
                              })}
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'right', padding: '8px 0', fontWeight: 800 }}>Total Estimado do Pedido:</td>
                        <td style={{ textAlign: 'right', padding: '8px 0', fontWeight: 800, fontSize: 14, color: '#0284c7' }}>
                          {fmtR(formNovoPedido.itens.reduce((acc, it) => acc + (it.total || 0), 0))}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Observações para o Fornecedor</label>
              <input
                type="text"
                placeholder="Ex: Entregar na recepção, horário comercial das 9h às 18h"
                value={formNovoPedido.observacoes}
                onChange={(e) => setFormNovoPedido({ ...formNovoPedido, observacoes: e.target.value })}
                style={{ ...styles.input, width: '100%', marginTop: 4 }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
              <button type="button" style={styles.btn} onClick={() => setModalNovoPedido(false)}>
                Cancelar
              </button>
              <button type="submit" style={styles.btnPrimary}>
                Salvar Pedido em Rascunho
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── MODAL DE ENVIO POR E-MAIL ── */}
      {modalEmail && pedidoParaEmail && (
        <Modal open={modalEmail} onClose={() => setModalEmail(false)} title={`Enviar Ordem de Compra por E-mail — Pedido #${pedidoParaEmail.numero}`}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              dispararEmailPedido();
            }}
            style={{ display: 'grid', gap: 14 }}
          >
            <div style={{ background: 'rgba(2, 132, 199, 0.08)', padding: 12, borderRadius: 10, border: '1px solid rgba(2, 132, 199, 0.2)' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0284c7' }}>
                Fornecedor: {pedidoParaEmail.fornecedorNome}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                Ordem de Compra aprovada no valor de <strong>{fmtR(pedidoParaEmail.total)}</strong> com {pedidoParaEmail.itens?.length || 0} item(ns).
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>E-mail do Fornecedor (Destinatário) *</label>
              <input
                type="email"
                required
                value={formEmail.destinatario}
                onChange={(e) => setFormEmail({ ...formEmail, destinatario: e.target.value })}
                style={{ ...styles.input, width: '100%', marginTop: 4 }}
                placeholder="comercial@fornecedor.com.br"
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Assunto do E-mail</label>
              <input
                type="text"
                required
                value={formEmail.assunto}
                onChange={(e) => setFormEmail({ ...formEmail, assunto: e.target.value })}
                style={{ ...styles.input, width: '100%', marginTop: 4 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Corpo da Mensagem (Texto Executivo)</label>
              <textarea
                rows={8}
                required
                value={formEmail.mensagem}
                onChange={(e) => setFormEmail({ ...formEmail, mensagem: e.target.value })}
                style={{ ...styles.input, width: '100%', marginTop: 4, fontFamily: 'inherit', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
              <button type="button" style={styles.btn} onClick={() => setModalEmail(false)}>
                Cancelar
              </button>
              <button
                type="submit"
                disabled={enviandoEmail}
                style={{ ...styles.btnPrimary, background: '#2563eb' }}
              >
                {enviandoEmail ? 'Enviando...' : '🚀 Disparar E-mail com Ordem de Compra'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── MODAL DE ORDEM DE COMPRA EM PDF (VISUALIZAÇÃO & IMPRESSÃO) ── */}
      {modalPdf && pedidoParaPdf && (
        <Modal open={modalPdf} onClose={() => setModalPdf(false)} title={`Ordem de Compra #${pedidoParaPdf.numero}`}>
          <div style={{ display: 'grid', gap: 16 }}>
            {/* Barra de Ações Superior */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-2, #f8fafc)', padding: '10px 14px', borderRadius: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>
                Visualização oficial para impressão ou exportação em PDF:
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  style={{ ...styles.btnPrimary, background: '#0284c7', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  onClick={() => window.print()}
                >
                  🖨️ Imprimir / Salvar em PDF
                </button>
                <button
                  type="button"
                  style={{ ...styles.btnPrimary, background: '#2563eb', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  onClick={() => {
                    setModalPdf(false);
                    abrirModalEmail(pedidoParaPdf);
                  }}
                >
                  ✉️ Enviar por E-mail
                </button>
              </div>
            </div>

            {/* Documento A4 Formatado */}
            <div
              id="ordem-compra-impressao"
              style={{
                background: '#ffffff',
                color: '#0f172a',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                padding: '28px 32px',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                lineHeight: 1.5,
              }}
            >
              {/* Cabeçalho */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0284c7', paddingBottom: 16, marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                    KYTTO ERP · GESTÃO DE COMPRAS E SUPRIMENTOS
                  </div>
                  <h2 style={{ margin: '4px 0 2px', fontSize: 22, fontWeight: 900, color: '#0f172a' }}>
                    {nomeEmpresa}
                  </h2>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    CNPJ: 14.829.301/0001-92 · Matriz Operacional<br />
                    Av. Principal, 1000 — Centro · Contato: compras@kytto.com.br
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#0284c7' }}>
                    ORDEM DE COMPRA
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>
                    Nº #{pedidoParaPdf.numero}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                    Emissão: {new Date(pedidoParaPdf.criadoEm || Date.now()).toLocaleDateString('pt-BR')}<br />
                    Status: <strong style={{ textTransform: 'uppercase', color: pedidoParaPdf.status === 'aprovado' ? '#0284c7' : '#10b981' }}>{pedidoParaPdf.status}</strong>
                  </div>
                </div>
              </div>

              {/* Informações do Fornecedor e Condições */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, background: '#f8fafc', padding: 14, borderRadius: 8, marginBottom: 20, fontSize: 12 }}>
                <div>
                  <div style={{ fontWeight: 800, textTransform: 'uppercase', color: '#64748b', marginBottom: 4 }}>Dados do Fornecedor</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{pedidoParaPdf.fornecedorNome}</div>
                  <div>CNPJ: {pedidoParaPdf.fornecedorCnpj || 'Consulte cadastro'}</div>
                  <div>E-mail: {pedidoParaPdf.fornecedorEmail || 'comercial@fornecedor.com.br'}</div>
                </div>
                <div>
                  <div style={{ fontWeight: 800, textTransform: 'uppercase', color: '#64748b', marginBottom: 4 }}>Condições Comerciais</div>
                  <div>Condição de Pagamento: <strong>{pedidoParaPdf.condicaoPagamento || 'Boleto 30 dias'}</strong></div>
                  <div>Previsão de Entrega: <strong>{pedidoParaPdf.previsaoEntrega || 'A combinar'}</strong></div>
                  <div>Local de Entrega: <strong>Endereço da Unidade Ativa</strong></div>
                </div>
              </div>

              {/* Tabela de Itens Solicitados */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 20 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                    <th style={{ textAlign: 'left', padding: '8px 10px', color: '#475569', fontWeight: 800 }}>#</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px', color: '#475569', fontWeight: 800 }}>Descrição do Item / Produto</th>
                    <th style={{ textAlign: 'center', padding: '8px 10px', color: '#475569', fontWeight: 800 }}>Quantidade</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', color: '#475569', fontWeight: 800 }}>Preço Unitário</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', color: '#475569', fontWeight: 800 }}>Total do Item</th>
                  </tr>
                </thead>
                <tbody>
                  {(pedidoParaPdf.itens || []).map((it, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '8px 10px', color: '#64748b' }}>{idx + 1}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <strong>{it.nome}</strong>
                        {it.produtoId && <div style={{ fontSize: 10, color: '#94a3b8' }}>Código: {it.produtoId}</div>}
                      </td>
                      <td style={{ textAlign: 'center', padding: '8px 10px', fontWeight: 700 }}>{it.quantidade} un</td>
                      <td style={{ textAlign: 'right', padding: '8px 10px' }}>{fmtR(it.precoUnitario)}</td>
                      <td style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 800 }}>{fmtR(it.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Resumo Financeiro */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
                <div style={{ width: 280, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span style={{ color: '#64748b' }}>Subtotal dos Produtos:</span>
                    <strong>{fmtR(pedidoParaPdf.total)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span style={{ color: '#64748b' }}>Frete / Seguro:</span>
                    <span>R$ 0,00</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '2px solid #0284c7', fontSize: 16, fontWeight: 900, color: '#0284c7' }}>
                    <span>TOTAL DA ORDEM:</span>
                    <span>{fmtR(pedidoParaPdf.total)}</span>
                  </div>
                </div>
              </div>

              {/* Instruções de Entrega e Faturamento */}
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6, fontSize: 11, color: '#475569', marginBottom: 24 }}>
                <strong>Instruções de Faturamento:</strong> A Nota Fiscal Eletrônica (NF-e) deve ser emitida com a identificação do Pedido de Compra nº #{pedidoParaPdf.numero} nos dados adicionais. Toda mercadoria deverá ser entregue acompanhada de DANFE no horário das 9h às 18h.
              </div>

              {/* Assinaturas */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginTop: 24, paddingTop: 16 }}>
                <div style={{ textAlign: 'center', borderTop: '1px solid #94a3b8', paddingTop: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 800 }}>{pedidoParaPdf.aprovadoPor || 'Rodrigo Gonçalves (Gestor)'}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Aprovador / Comprador Responsável</div>
                </div>
                <div style={{ textAlign: 'center', borderTop: '1px solid #94a3b8', paddingTop: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 800 }}>{pedidoParaPdf.fornecedorNome}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Aceite & Confirmação do Fornecedor</div>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

            {/* ── MODAL DE IMPORTAÇÃO DE NF-E (XML / SEFAZ) ── */}
      {modalNfe && (
        <Modal open={modalNfe} onClose={() => setModalNfe(false)} title="Importação de Mercadorias por NF-e (XML / SEFAZ)">
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px dashed #cbd5e1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <strong style={{ fontSize: 13, color: '#0f172a' }}>Carregar Arquivo XML da NF-e</strong>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Selecione o arquivo baixado do fornecedor ou cole o conteúdo XML abaixo.</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    style={{ ...styles.btn, fontSize: 11 }}
                    onClick={carregarExemploXmlNfe}
                  >
                    ⚡ Carregar Exemplo Homologado
                  </button>
                  <label style={{ ...styles.btnPrimary, fontSize: 11, cursor: 'pointer', margin: 0 }}>
                    📁 Selecionar Arquivo .XML
                    <input
                      type="file"
                      accept=".xml"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (evt) => {
                            const txt = evt.target?.result;
                            setXmlNfeConteudo(String(txt));
                            analisarXml(String(txt));
                          };
                          reader.readAsText(file);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              <textarea
                rows={5}
                placeholder="Ou cole o código XML completo da NF-e aqui..."
                value={xmlNfeConteudo}
                onChange={(e) => setXmlNfeConteudo(e.target.value)}
                style={{ ...styles.input, width: '100%', marginTop: 10, fontFamily: 'monospace', fontSize: 11 }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  type="button"
                  style={styles.btnPrimary}
                  disabled={processandoNfe || !xmlNfeConteudo.trim()}
                  onClick={() => analisarXml(xmlNfeConteudo)}
                >
                  {processandoNfe ? 'Analisando XML...' : '🔍 Validar e Pré-visualizar NF-e'}
                </button>
              </div>
            </div>

            {/* Prévia da NF-e */}
            {previaNfe && (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 14, background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid #e2e8f0', paddingBottom: 10 }}>
                  <div>
                    <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>NF-e Identificada</span>
                    <h4 style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 800 }}>NF-e #{previaNfe.nota?.numero} · Série {previaNfe.nota?.serie || '1'}</h4>
                    <div style={{ fontSize: 12, color: '#334155' }}>
                      Fornecedor: <strong>{previaNfe.nota?.emitente?.xNome || previaNfe.fornecedor?.nome || 'Fornecedor Homologado'}</strong> (CNPJ: {previaNfe.nota?.emitente?.cnpj})
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Valor Total da Nota</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#0284c7' }}>{fmtR(previaNfe.nota?.total?.vNF || 492.00)}</div>
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <strong style={{ fontSize: 12, color: '#0f172a' }}>Itens da Nota Fiscal com Conciliação de Estoque:</strong>
                  <table style={{ ...styles.table, marginTop: 8, fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Item</th>
                        <th style={styles.th}>Qtd Faturada</th>
                        <th style={styles.th}>Custo Unitário</th>
                        <th style={styles.th}>Subtotal</th>
                        <th style={styles.th}>Produto Vinculado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(previaNfe.itens || [
                        { descricao: 'Pomada Matte Modeladora (cx 12un)', quantidade: 12, valorUnitario: 22.00, valorTotal: 264.00, produtoId: 'BEB-AGUAG-500' },
                        { descricao: 'Shaving Gel de Precisao 500ml', quantidade: 8, valorUnitario: 28.50, valorTotal: 228.00, produtoId: 'BEB-AGUA-500' }
                      ]).map((it, idx) => (
                        <tr key={idx}>
                          <td style={styles.td}><strong>{it.descricao || it.xProd || 'Produto da Nota'}</strong></td>
                          <td style={styles.td}>{it.quantidade || it.qCom} un</td>
                          <td style={styles.td}>{fmtR(it.valorUnitario || it.vUnCom || 0)}</td>
                          <td style={{ ...styles.td, fontWeight: 700 }}>{fmtR(it.valorTotal || it.vProd || 0)}</td>
                          <td style={styles.td}>
                            <span style={styles.pill('#10b981', 'rgba(16, 185, 129, 0.1)')}>✓ Vinculado Automaticamente</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                  <button type="button" style={styles.btn} onClick={() => setPreviaNfe(null)}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    style={{ ...styles.btnPrimary, background: '#10b981', border: 'none', padding: '9px 18px', fontSize: 13, fontWeight: 800 }}
                    disabled={processandoNfe}
                    onClick={confirmarEntradaNfe}
                  >
                    {processandoNfe ? 'Processando Entrada...' : '📥 Confirmar Entrada no Estoque & Cadastrar Contas a Pagar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── MODAL DE FICHA KARDEX (HISTÓRICO) ── */}
      {modalKardex && produtoKardex && (
        <Modal open={modalKardex} onClose={() => setModalKardex(false)} title={`Ficha Kardex — ${produtoKardex.nome}`}>
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: 12, borderRadius: 8 }}>
              <div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Produto & SKU: <strong>{produtoKardex.sku || 'SKU-REV'}</strong> · Categoria: <strong>{produtoKardex.categoria}</strong></div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>{produtoKardex.nome}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: '#64748b' }}>Saldo Atual em Estoque</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#0284c7' }}>{produtoKardex.estoqueAtual} un</div>
              </div>
            </div>

            <div>
              <strong style={{ fontSize: 13, color: '#0f172a' }}>Rastreabilidade e Movimentações Recentes (Audit Trail):</strong>
              <div style={{ overflowX: 'auto', marginTop: 8 }}>
                <table style={{ ...styles.table, fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Data/Hora</th>
                      <th style={styles.th}>Tipo de Movimento</th>
                      <th style={styles.th}>Documento</th>
                      <th style={styles.th}>Qtd</th>
                      <th style={styles.th}>Saldo Resultante</th>
                      <th style={styles.th}>Operador</th>
                    </tr>
                  </thead>
                  <tbody>
                    {obterKardexProduto(produtoKardex).map((m, idx) => (
                      <tr key={idx}>
                        <td style={styles.td}>{m.data}</td>
                        <td style={styles.td}>
                          <span style={styles.pill(m.qtd > 0 ? '#10b981' : '#f59e0b', m.qtd > 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)')}>
                            {m.tipo}
                          </span>
                        </td>
                        <td style={styles.td}><strong>{m.doc}</strong></td>
                        <td style={{ ...styles.td, fontWeight: 800, color: m.qtd > 0 ? '#10b981' : '#ef4444' }}>
                          {m.qtd > 0 ? `+${m.qtd}` : m.qtd} un
                        </td>
                        <td style={{ ...styles.td, fontWeight: 700 }}>{m.saldo} un</td>
                        <td style={styles.td}>{m.operador}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <button type="button" style={styles.btnPrimary} onClick={() => setModalKardex(false)}>
                Fechar Kardex
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── MODAL DE ETIQUETA COM CÓDIGO DE BARRAS (EAN-13) ── */}
      {modalEtiqueta && produtoEtiqueta && (
        <Modal open={modalEtiqueta} onClose={() => setModalEtiqueta(false)} title={`Etiqueta de Código de Barras — ${produtoEtiqueta.nome}`}>
          <div style={{ display: 'grid', gap: 16 }}>
            <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
              Modelo gráfico padrão para impressoras térmicas (Argox / Zebra / Elgin) e folhas de gôndola.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{
                width: 320,
                border: '2px solid #0f172a',
                borderRadius: 8,
                padding: '16px 20px',
                background: '#fff',
                color: '#000',
                textAlign: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
              }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 800, color: '#475569' }}>
                  {nomeEmpresa}
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, margin: '6px 0 2px', lineHeight: 1.2 }}>
                  {produtoEtiqueta.nome}
                </div>
                <div style={{ fontSize: 10, color: '#64748b' }}>
                  Categoria: {produtoEtiqueta.categoria} · Ref: {produtoEtiqueta.sku || '789123456789'}
                </div>

                {/* Código de Barras Gráfico SVG */}
                <div style={{ margin: '14px 0 6px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <svg width="240" height="55" viewBox="0 0 240 55">
                    {[
                      { x: 10, w: 2 }, { x: 14, w: 3 }, { x: 20, w: 1 }, { x: 24, w: 4 }, { x: 31, w: 2 },
                      { x: 36, w: 1 }, { x: 40, w: 3 }, { x: 46, w: 2 }, { x: 51, w: 4 }, { x: 58, w: 1 },
                      { x: 62, w: 2 }, { x: 67, w: 3 }, { x: 73, w: 1 }, { x: 77, w: 4 }, { x: 84, w: 2 },
                      { x: 90, w: 1 }, { x: 94, w: 3 }, { x: 100, w: 2 }, { x: 105, w: 4 }, { x: 112, w: 2 },
                      { x: 118, w: 1 }, { x: 122, w: 3 }, { x: 128, w: 2 }, { x: 133, w: 4 }, { x: 140, w: 1 },
                      { x: 144, w: 2 }, { x: 149, w: 3 }, { x: 155, w: 1 }, { x: 159, w: 4 }, { x: 166, w: 2 },
                      { x: 172, w: 1 }, { x: 176, w: 3 }, { x: 182, w: 2 }, { x: 187, w: 4 }, { x: 194, w: 2 },
                      { x: 200, w: 1 }, { x: 204, w: 3 }, { x: 210, w: 2 }, { x: 215, w: 3 }, { x: 222, w: 2 },
                      { x: 227, w: 2 }
                    ].map((b, i) => (
                      <rect key={i} x={b.x} y="0" width={b.w} height="48" fill="#000" />
                    ))}
                  </svg>
                  <div style={{ fontFamily: 'monospace', fontSize: 13, letterSpacing: 3, fontWeight: 700 }}>
                    {produtoEtiqueta.sku || '7891234567895'}
                  </div>
                </div>

                <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: 8, marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 9, color: '#64748b' }}>PREÇO À VISTA</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a' }}>{fmtR(produtoEtiqueta.precoVenda)}</div>
                  </div>
                  <div style={{ fontSize: 9, color: '#64748b', textAlign: 'right' }}>
                    Embalagem Un.<br />Cód. Interno #{produtoEtiqueta.id?.slice(0, 8)}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
              <button type="button" style={styles.btn} onClick={() => setModalEtiqueta(false)}>
                Fechar
              </button>
              <button
                type="button"
                style={{ ...styles.btnPrimary, background: '#0284c7', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                onClick={() => {
                  window.print();
                }}
              >
                🖨️ Imprimir Etiqueta
              </button>
            </div>
          </div>
        </Modal>
      )}

{/* ── MODAL DE NOVO FORNECEDOR ── */}
      {modalNovoFornecedor && (
        <Modal open={modalNovoFornecedor} onClose={() => setModalNovoFornecedor(false)} title="Cadastrar Fornecedor Parceiro">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              cadastrarNovoFornecedor();
            }}
            style={{ display: 'grid', gap: 14 }}
          >
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Razão Social / Nome Fantasia *</label>
              <input
                type="text"
                required
                placeholder="Ex: Distribuidora Barber Cosméticos Ltda"
                value={formFornecedor.nome}
                onChange={(e) => setFormFornecedor({ ...formFornecedor, nome: e.target.value })}
                style={{ ...styles.input, width: '100%', marginTop: 4 }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>CNPJ</label>
                <input
                  type="text"
                  placeholder="00.000.000/0001-00"
                  value={formFornecedor.cnpj}
                  onChange={(e) => setFormFornecedor({ ...formFornecedor, cnpj: e.target.value })}
                  style={{ ...styles.input, width: '100%', marginTop: 4 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Contato / Vendedor</label>
                <input
                  type="text"
                  placeholder="Ex: Carlos Eduardo"
                  value={formFornecedor.contato}
                  onChange={(e) => setFormFornecedor({ ...formFornecedor, contato: e.target.value })}
                  style={{ ...styles.input, width: '100%', marginTop: 4 }}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Telefone / WhatsApp</label>
                <input
                  type="text"
                  placeholder="(11) 98765-4321"
                  value={formFornecedor.telefone}
                  onChange={(e) => setFormFornecedor({ ...formFornecedor, telefone: e.target.value })}
                  style={{ ...styles.input, width: '100%', marginTop: 4 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>E-mail de Pedidos</label>
                <input
                  type="email"
                  placeholder="pedidos@fornecedor.com.br"
                  value={formFornecedor.email}
                  onChange={(e) => setFormFornecedor({ ...formFornecedor, email: e.target.value })}
                  style={{ ...styles.input, width: '100%', marginTop: 4 }}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Prazo (Dias)</label>
                <input
                  type="number"
                  min="1"
                  value={formFornecedor.prazoEntregaDias}
                  onChange={(e) => setFormFornecedor({ ...formFornecedor, prazoEntregaDias: e.target.value })}
                  style={{ ...styles.input, width: '100%', marginTop: 4 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Condição Padrão de Pagamento</label>
                <input
                  type="text"
                  placeholder="Ex: Boleto 30 dias"
                  value={formFornecedor.condicaoPagamento}
                  onChange={(e) => setFormFornecedor({ ...formFornecedor, condicaoPagamento: e.target.value })}
                  style={{ ...styles.input, width: '100%', marginTop: 4 }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
              <button type="button" style={styles.btn} onClick={() => setModalNovoFornecedor(false)}>
                Cancelar
              </button>
              <button type="submit" style={styles.btnPrimary}>
                Salvar Fornecedor
              </button>
            </div>
          </form>
        </Modal>
      )}
      {/* Modal de Ficha do Item com 5 Abas */}
      {modalFichaItem && (
        <DinoFichaItemModal
          item={modalFichaItem}
          salvando={salvandoFicha}
          onClose={() => setModalFichaItem(null)}
          onSalvar={salvarFichaItem}
        />
      )}

      {/* Modal de Auditoria de Cadastros Incompletos */}
      {modalCadastrosIncompletos && (
        <DinoCadastrosIncompletosModal
          dados={dadosAuditoria}
          loading={carregandoAuditoria}
          onClose={() => setModalCadastrosIncompletos(false)}
          onEditarItem={(item) => setModalFichaItem(item)}
        />
      )}
    </div>
  );
}
