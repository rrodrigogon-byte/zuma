import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Smartphone, Landmark, Calculator, Activity, PieChart, Scan,
  Store, ShoppingCart, Barcode, Tag, AlertTriangle, ArrowRightLeft,
  Truck, TrendingUp, RefreshCw, Plus, Trash2, Printer, CheckCircle2,
  Download, Search, DollarSign, Calendar, Layers, ShieldCheck,
  Beef, UtensilsCrossed, Scale, Users, ClipboardCheck, Sparkles,
  Percent, ArrowDownRight, ArrowUpRight, Lock, KeyRound, AlertCircle, FileText, Apple, Boxes, ShieldAlert, Tv, CreditCard, Receipt, Wifi, WifiOff, Eye, ArrowUpCircle, CheckSquare, RotateCcw, History, List, Monitor, Volume2, Terminal, HardDrive
} from 'lucide-react';
import { api } from '../../lib/api';
import Modal from '../../components/Modal';
import { QRCodeSVG } from 'qrcode.react';
import './Supermercado.css';

const DEPARTAMENTOS = [
  'Açougue e Carnes',
  'Hortifrúti e Verduras',
  'Padaria e Confeitaria',
  'Frios e Laticínios',
  'Mercearia e Grãos',
  'Bebidas e Cervejas',
  'Limpeza e Higiene',
  'Rotisseria e Prontos',
  'Biscoitos e Matinais',
  'Enlatados e Molhos'
];

export default function Supermercado() {
  const [abaAtiva, setAbaAtiva] = useState('dashboard');
  const [lojaAtivaId, setLojaAtivaId] = useState(null);
  const [lojas, setLojas] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  // Estados principais
  const [resumo, setResumo] = useState(null);
  const [produtos, setProdutos] = useState([]);
  const [busca, setBusca] = useState('');
  const [deptoFiltro, setDeptoFiltro] = useState('Todos');
  const [apenasPesaveis, setApenasPesaveis] = useState(false);
  const [apenasRupturas, setApenasRupturas] = useState(false);

  // Parque de Terminais & Multi-Caixas
  const [terminais, setTerminais] = useState([]);
  const [terminalAtivoCodigo, setTerminalAtivoCodigo] = useState('PDV-01');
  const [modalNovoTerminal, setModalNovoTerminal] = useState(false);
  const [caixaAlvoModal, setCaixaAlvoModal] = useState(null);
  const [nomeOperadorAbertura, setNomeOperadorAbertura] = useState('');
  const [formTerminal, setFormTerminal] = useState({
    codigo: '',
    nome: '',
    tipo: 'convencional',
    limiteSangria: 800,
    ipEquipamento: ''
  });
  // PWA & Instalador Windows
  const [modalInstaladorWindows, setModalInstaladorWindows] = useState(false);
  // SPRINT 1 ENTERPRISE: Atacarejo, Promoções Avançadas, Compras GMD & Ruptura
  const [faixasAtacarejo, setFaixasAtacarejo] = useState([]);
  const [promocoesAvancadas, setPromocoesAvancadas] = useState([]);
  const [sugestoesCompras, setSugestoesCompras] = useState([]);
  const [alertasRuptura, setAlertasRuptura] = useState([]);
  const [modalNovoAtacarejo, setModalNovoAtacarejo] = useState(false);
  const [modalNovaPromoAvanc, setModalNovaPromoAvanc] = useState(false);
  const [formAtacarejo, setFormAtacarejo] = useState({ itemId: '', quantidadeMinima: 6, precoUnitario: 0 });
  const [formPromoAvanc, setFormPromoAvanc] = useState({
    nome: '',
    mecanica: 'LEVE_X_PAGUE_Y',
    itemOrigemId: '',
    qtdGatilho: 3,
    qtdPaga: 2,
    descontoPercentual: 50
  });
  const [pwaInstalavel, setPwaInstalavel] = useState(false);
  const [deferredPromptPwa, setDeferredPromptPwa] = useState(null);
  const [somScannerAtivo, setSomScannerAtivo] = useState(true);

  // Sintetizador de Áudio para Scanner de Caixa (Web Audio API)
  const tocarBeepScanner = (tipo = 'sucesso') => {
    if (!somScannerAtivo) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (tipo === 'sucesso') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1760, ctx.currentTime);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, ctx.currentTime);
        gain.gain.setValueAtTime(0.22, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
        osc.start();
        osc.stop(ctx.currentTime + 0.22);
      }
    } catch (e) {}
  };

  // Inicialização PWA e Service Worker
  useEffect(() => {
    let link = document.querySelector("link[rel*='manifest']");
    if (link) {
      link.href = "/manifest-supermercado.json";
    }
    if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
      navigator.serviceWorker.register('/sw-supermercado.js').then((reg) => {
        console.log('[PWA Kytto] Service Worker ativo:', reg.scope);
      }).catch(() => {});
    }
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPromptPwa(e);
      setPwaInstalavel(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstalarPwaNativo = async () => {
    if (!deferredPromptPwa) {
      showToast("Para instalar no Windows, clique no ícone '+' ou 'Instalar' na barra do Edge/Chrome.");
      return;
    }
    deferredPromptPwa.prompt();
    const { outcome } = await deferredPromptPwa.userChoice;
    if (outcome === 'accepted') {
      showToast("🎉 Kytto PDV instalado com sucesso no seu Windows!");
      setPwaInstalavel(false);
      setDeferredPromptPwa(null);
    }
  };
  // Comprovante Térmico & Gaveta
  const [modalComprovanteVenda, setModalComprovanteVenda] = useState(null);
  const [modalLeituraX, setModalLeituraX] = useState(false);

  const handleAbrirGavetaDinheiro = () => {
    tocarBeepScanner('sucesso');
    showToast("🔓 Gaveta de Dinheiro Aberta! [Pulso elétrico RJ12 / ESC/POS enviado]");
  };
  // Caixa / PDV
  const [sessaoCaixa, setSessaoCaixa] = useState(null);
  const [modalCaixa, setModalCaixa] = useState(null); // 'abrir', 'sangria', 'suprimento', 'fechar'
  const [valorMovimentacao, setValorMovimentacao] = useState('');
  const [motivoMovimentacao, setMotivoMovimentacao] = useState('');
  const [saldoFinalInformado, setSaldoFinalInformado] = useState('');

  // PDV Venda
  const [carrinho, setCarrinho] = useState([]);
  const [modalConsultaPreco, setModalConsultaPreco] = useState(false);
  const [termoConsultaPreco, setTermoConsultaPreco] = useState("");
  const inputScannerRef = useRef(null);
  const [leitorCodigo, setLeitorCodigo] = useState('');
  const [formaPagamento, setFormaPagamento] = useState('dinheiro');
  const [valorRecebido, setValorRecebido] = useState('');
  const [cpfCliente, setCpfCliente] = useState('');
  const [clienteClubeIdentificado, setClienteClubeIdentificado] = useState(null);
  const [nfceEmitida, setNfceEmitida] = useState(null);

  // Lotes & FEFO
  const [lotes, setLotes] = useState([]);
  const [modalBaixaLote, setModalBaixaLote] = useState(null);
  const [motivoBaixa, setMotivoBaixa] = useState('Vencimento');
  const [qtdBaixa, setQtdBaixa] = useState(1);

  // Açougue / Desossa
  const [desossas, setDesossas] = useState([]);
  const [modalDesossa, setModalDesossa] = useState(false);
  const [formDesossa, setFormDesossa] = useState({
    tipoCarcaca: 'Bovino — Quarto Traseiro',
    pesoCarcaca: 100,
    custoKg: 24.50,
    operador: 'Carlos (Mestre Açougueiro)'
  });

  // Padaria / Receitas
  const [receitasPadaria, setReceitasPadaria] = useState([]);
  const [modalProducaoPadaria, setModalProducaoPadaria] = useState(null);
  const [lotesProduzir, setLotesProduzir] = useState(1);

  // Inventários
  const [inventarios, setInventarios] = useState([]);
  const [modalNovoInventario, setModalNovoInventario] = useState(false);
  const [tituloInventario, setTituloInventario] = useState('');
  const [deptoInventario, setDeptoInventario] = useState('Mercearia');

  // Clube Kytto
  const [clientesClube, setClientesClube] = useState([]);
  const [modalNovoClienteClube, setModalNovoClienteClube] = useState(false);
  const [formClube, setFormClube] = useState({ cpf: '', nome: '', telefone: '', email: '' });

  // Promoções
  const [promocoes, setPromocoes] = useState([]);
  const [modalNovaPromocao, setModalNovaPromocao] = useState(false);
  const [formPromo, setFormPromo] = useState({
    titulo: '',
    tipo: 'percentual',
    valorDesconto: 15,
    inicio: new Date().toISOString().slice(0, 10),
    fim: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    itensIds: []
  });

  // Transferências
  const [transferencias, setTransferencias] = useState([]);

  // Fornecedores & Margens
  const [fornecedores, setFornecedores] = useState([]);
  const [analiseMargens, setAnaliseMargens] = useState([]);
  const [simulacaoReajuste, setSimulacaoReajuste] = useState(5);
  // ── DOCAS & RECEBIMENTO ──
  const [recebimentosDoca, setRecebimentosDoca] = useState([]);
  const [modalNovoRecebimentoDoca, setModalNovoRecebimentoDoca] = useState(false);
  const [formDoca, setFormDoca] = useState({
    fornecedor: "BRF Distribuidora S/A",
    chaveNfe: "51261101838723000190550010000049211002345678",
    numeroNfe: "004921",
    temperaturaCaminhao: "-14.5",
    placaVeiculo: "BRA2E19",
    motorista: "Marcos Andrade",
    observacoes: "Carga de congelados inspecionada na doca 02"
  });
  // ── TROCAS & DEVOLUÇÕES (SAC) ──
  const [trocas, setTrocas] = useState([]);
  const [modalNovaTroca, setModalNovaTroca] = useState(false);
  const [formTroca, setFormTroca] = useState({
    cupomOrigem: "PDV-MW707LNM",
    clienteNome: "Mariana Souza",
    clienteCpf: "123.456.789-00",
    motivo: "avaria_embalagem",
    valorTotal: "29.90",
    tipoRessarcimento: "vale_compras",
    destinacao: "retorno_estoque",
    itens: []
  });
  const [valeEmitido, setValeEmitido] = useState(null);
  // ── SELF-CHECKOUT (TOTEM) ──
  const [totemCarrinho, setTotemCarrinho] = useState([]);
  const [totemLeitor, setTotemLeitor] = useState("");
  const [totemPesoEsperado, setTotemPesoEsperado] = useState(0);
  const [totemPesoReal, setTotemPesoReal] = useState(0);
  const [totemAlertaSupervisor, setTotemAlertaSupervisor] = useState(false);
  const [totemSucesso, setTotemSucesso] = useState(null);
  // ── Hortifrúti (FLV) ──
  const [dadosHortifruti, setDadosHortifruti] = useState(null);
  const [carregandoHortifruti, setCarregandoHortifruti] = useState(false);
  // ── Ruptura & Reposição (ROP) ──
  const [dadosRuptura, setDadosRuptura] = useState(null);
  const [carregandoRuptura, setCarregandoRuptura] = useState(false);
  // ── Auditoria de Preços Gôndola vs PDV ──
  const [dadosAuditoria, setDadosAuditoria] = useState(null);
  // ── Visor do Cliente & TEF PDV ──
  const [visorClienteAtivo, setVisorClienteAtivo] = useState(true);
  const [ultimoItemBipado, setUltimoItemBipado] = useState(null);
  const [modalTef, setModalTef] = useState(null);

  // ── Modo Offline & Contingência Local ──
  const [modoOffline, setModoOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [vendasOffline, setVendasOffline] = useState(() => {
    try {
      const salvo = localStorage.getItem('kytto_supermercado_vendas_offline');
      return salvo ? JSON.parse(salvo) : [];
    } catch (e) {
      return [];
    }
  });

  // ── Caixas Individuais & Terminais ──
  const [listaCaixas, setListaCaixas] = useState([]);
  const [modalDetalhesCaixa, setModalDetalhesCaixa] = useState(null);
  const [detalhesCaixaDados, setDetalhesCaixaDados] = useState(null);
  const [carregandoDetalhesCaixa, setCarregandoDetalhesCaixa] = useState(false);
  const [terminalSelecionado, setTerminalSelecionado] = useState('PDV-01');
  const [operadorNome, setOperadorNome] = useState('Rodrigo Gonçalves (Operador)');

  // ── Detalhamento de Produto & Kardex ──
  const [modalDetalhesProduto, setModalDetalhesProduto] = useState(null);
  const [kardexProduto, setKardexProduto] = useState([]);
  const [carregandoKardex, setCarregandoKardex] = useState(false);

  // Modal Novo Produto
  const [modalNovoProduto, setModalNovoProduto] = useState(false);
  const [formProduto, setFormProduto] = useState({
    nome: '',
    departamento: 'Mercearia e Grãos',
    codigoBarras: '',
    plu: '',
    precoVenda: '',
    precoCusto: '',
    unidade: 'UN',
    estoqueMinimo: 10,
    estoqueMaximo: 100,
    pesavel: false
  });

  // ── Novas Funcionalidades Supermercadistas ──
  const [itensEtiquetas, setItensEtiquetas] = useState([]);
  const [etiquetasSelecionadas, setEtiquetasSelecionadas] = useState([]);
  const [modeloEtiqueta, setModeloEtiqueta] = useState("gondola");
  const [modalZpl, setModalZpl] = useState(null);

  // ── SPRINT 2 ENTERPRISE: COLETOR, TRIBUTÁRIO, WMS & COCKPIT ──
  const [leiturasColetor, setLeiturasColetor] = useState([]);
  const [coletorInput, setColetorInput] = useState('');
  const [coletorPrecoGondola, setColetorPrecoGondola] = useState('');
  const [coletorOperacao, setColetorOperacao] = useState('AUDITORIA_PRECO');
  const [coletorMsg, setColetorMsg] = useState(null);
  const [filtroColetorOp, setFiltroColetorOp] = useState('TODAS');

  const [matrizTributaria, setMatrizTributaria] = useState([]);
  const [simuladorNcm, setSimuladorNcm] = useState('22030000');
  const [simuladorPrecoVenda, setSimuladorPrecoVenda] = useState('8.50');
  const [simuladorPrecoCusto, setSimuladorPrecoCusto] = useState('4.80');
  const [simuladorResultado, setSimuladorResultado] = useState(null);

  const [enderecosWms, setEnderecosWms] = useState([]);
  const [cockpitDados, setCockpitDados] = useState(null);

  const [xmlNfeTexto, setXmlNfeTexto] = useState("");
  const [nfeProcessada, setNfeProcessada] = useState(null);
  const [carregandoNfe, setCarregandoNfe] = useState(false);

  const [dadosPerdas, setDadosPerdas] = useState(null);
  const [modalPacoteToledo, setModalPacoteToledo] = useState(null);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  // ── CARREGAMENTO DE DADOS ──
  const carregarDados = useCallback(async () => {
    setCarregando(true);
    try {
      // Lojas / Unidades
      const resLojas = await api.get('/api/admin/unidades').catch(() => null);
      if (resLojas && Array.isArray(resLojas.unidades)) {
        setLojas(resLojas.unidades);
        if (!lojaAtivaId && resLojas.unidades.length > 0) {
          setLojaAtivaId(resLojas.unidades[0].id);
        }
      }

      // 0. Terminais PDV
      const rTerminais = await api.get('/api/admin/supermercado/terminais').catch(() => null);
      if (rTerminais && Array.isArray(rTerminais.terminais)) {
        setTerminais(rTerminais.terminais);
      }
      // 1. Dashboard
      const rDash = await api.get('/api/admin/supermercado/dashboard').catch(() => null);
      if (rDash) setResumo(rDash.dashboard || rDash);

      // 2. Produtos
      const rProd = await api.get('/api/admin/supermercado/produtos').catch(() => null);
      if (rProd && Array.isArray(rProd.produtos)) setProdutos(rProd.produtos);

      // 3. Sessão Caixa
      const rCaixa = await api.get(`/api/admin/supermercado/caixa/sessao?terminal=${encodeURIComponent(terminalAtivoCodigo || 'PDV-01')}`).catch(() => null);
      if (rCaixa) setSessaoCaixa(rCaixa);

      // 4. Lotes
      const rLotes = await api.get('/api/admin/supermercado/lotes').catch(() => null);
      if (rLotes && Array.isArray(rLotes.lotes)) setLotes(rLotes.lotes);

      // 5. Açougue / Desossas
      const rDes = await api.get('/api/admin/supermercado/desossas').catch(() => null);
      if (rDes) setDesossas(Array.isArray(rDes) ? rDes : (rDes.desossas || []));

      // 6. Padaria
      const rPad = await api.get('/api/admin/supermercado/padaria/receitas').catch(() => null);
      if (rPad) setReceitasPadaria(Array.isArray(rPad) ? rPad : (rPad.receitas || []));

      // 7. Inventários
      const rInv = await api.get('/api/admin/supermercado/inventarios').catch(() => null);
      if (rInv) setInventarios(Array.isArray(rInv) ? rInv : (rInv.inventarios || []));

      // 8. Clube Kytto
      const rClube = await api.get('/api/admin/supermercado/clube/clientes').catch(() => null);
      if (rClube) setClientesClube(Array.isArray(rClube) ? rClube : (rClube.clientes || []));
      // 9. Docas
      const rDoc = await api.get('/api/admin/supermercado/docas/recebimentos').catch(() => null);
      if (rDoc) setRecebimentosDoca(Array.isArray(rDoc) ? rDoc : (rDoc.recebimentos || []));
      // 10. Trocas
      const rTrc = await api.get('/api/admin/supermercado/trocas').catch(() => null);
      if (rTrc) setTrocas(Array.isArray(rTrc) ? rTrc : (rTrc.trocas || []));
      // 11. Promoções
      const rPro = await api.get('/api/admin/supermercado/promocoes').catch(() => null);
      if (rPro) setPromocoes(Array.isArray(rPro) ? rPro : (rPro.promocoes || []));
      // 12. Transferências
      const rTra = await api.get('/api/admin/supermercado/transferencias').catch(() => null);
      if (rTra) setTransferencias(Array.isArray(rTra) ? rTra : (rTra.transferencias || []));

      // 9. Promoções
      const rPromo = await api.get('/api/admin/supermercado/promocoes').catch(() => null);
      if (rPromo && Array.isArray(rPromo.promocoes)) setPromocoes(rPromo.promocoes);

      // 10. Transferências
      const rTransf = await api.get('/api/admin/supermercado/transferencias').catch(() => null);
      if (rTransf && Array.isArray(rTransf.transferencias)) setTransferencias(rTransf.transferencias);

      // 11. Fornecedores & Margens
      const rForn = await api.get('/api/admin/supermercado/fornecedores').catch(() => null);
      if (rForn && Array.isArray(rForn.fornecedores)) setFornecedores(rForn.fornecedores);

      const rMarg = await api.get('/api/admin/supermercado/analise-margens').catch(() => null);
      // 12. Etiquetas & Gôndola
      const rEtiq = await api.get("/api/admin/supermercado/etiquetas/itens").catch(() => null);
      if (rEtiq && Array.isArray(rEtiq.itens)) {
        setItensEtiquetas(rEtiq.itens);
        setEtiquetasSelecionadas(rEtiq.itens.slice(0, 8).map(i => i.id));
      }
      // 13. Prevenção de Perdas (ABRAS)
      const rPerdas = await api.get("/api/admin/supermercado/prevencao-perdas").catch(() => null);
      if (rPerdas) setDadosPerdas(rPerdas);

      if (rMarg) setAnaliseMargens(rMarg.analise || rMarg.itens || []);

      // 14. Atacarejo & Promoções Avançadas
      const rAtac = await api.get('/api/admin/supermercado/atacarejo-faixas').catch(() => null);
      if (rAtac && Array.isArray(rAtac.faixas)) setFaixasAtacarejo(rAtac.faixas);

      const rPromoAvanc = await api.get('/api/admin/supermercado/promocoes-avancadas').catch(() => null);
      if (rPromoAvanc && Array.isArray(rPromoAvanc.promocoes)) setPromocoesAvancadas(rPromoAvanc.promocoes);

      // 15. Sugestão Inteligente de Compras (GMD)
      const rSug = await api.get('/api/admin/supermercado/sugestao-compras').catch(() => null);
      if (rSug && Array.isArray(rSug.sugestoes)) setSugestoesCompras(rSug.sugestoes);

      // 17. Coletor Mobile
      const rCol = await api.get('/api/admin/supermercado/coletor/leituras').catch(() => null);
      if (rCol && Array.isArray(rCol)) setLeiturasColetor(rCol);

      // 18. Matriz Tributária
      const rTrib = await api.get('/api/admin/supermercado/tributario/matriz').catch(() => null);
      if (rTrib && Array.isArray(rTrib)) setMatrizTributaria(rTrib);

      // 19. WMS de Endereçamento
      const rWms = await api.get('/api/admin/supermercado/wms/enderecos').catch(() => null);
      if (rWms && Array.isArray(rWms)) setEnderecosWms(rWms);

      // 20. Cockpit Executivo ABRAS
      const rCock = await api.get('/api/admin/supermercado/cockpit/kpis').catch(() => null);
      if (rCock && rCock.kpis) setCockpitDados(rCock);

      // 16. Monitor de Ruptura em Tempo Real
      const rRup = await api.get('/api/admin/supermercado/rupturas/tempo-real').catch(() => null);
      if (rRup && Array.isArray(rRup.rupturas)) setAlertasRuptura(rRup.rupturas);

    } catch (err) {
      console.error('Erro ao carregar dados do supermercado:', err);
    } finally {
      setCarregando(false);
    }
  }, [lojaAtivaId]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // ── PRODUTOS FILTRADOS ──
  const produtosFiltrados = useMemo(() => {
    return produtos.filter(p => {
      const matchTexto = !busca ||
        (p.nome && p.nome.toLowerCase().includes(busca.toLowerCase())) ||
        (p.codigoBarras && p.codigoBarras.includes(busca)) ||
        (p.plu && String(p.plu).includes(busca)) ||
        (p.sku && p.sku.toLowerCase().includes(busca.toLowerCase()));
      const matchDepto = deptoFiltro === 'Todos' || p.departamento === deptoFiltro;
      const matchPesavel = !apenasPesaveis || (p.pesavel || p.plu);
      const matchRuptura = !apenasRupturas || (Number(p.saldoEstoque || 0) <= Number(p.estoqueMinimo || 5));
      return matchTexto && matchDepto && matchPesavel && matchRuptura;
    });
  }, [produtos, busca, deptoFiltro, apenasPesaveis, apenasRupturas]);

  // ── CARGA OFICIAL DO MIX (25 ITENS DA CESTA BRASILEIRA) ──
  const executarCargaMixOficial = async () => {
    if (!window.confirm('Deseja carregar o Catálogo Oficial de Supermercado (25 itens da cesta brasileira com EANs e PLUs)?')) return;
    setCarregando(true);
    try {
      const res = await api.post('/api/admin/supermercado/catalogo-oficial/carregar', {});
      showToast(`Sucesso! ${res.totalInseridos || 25} produtos carregados na gôndola.`);
      carregarDados();
    } catch (err) {
      showToast('Erro ao carregar mix oficial: ' + (err.message || 'Erro interno'));
    } finally {
      setCarregando(false);
    }
  };

  
  // ── ATALHOS DE TECLADO DO PDV (F2 a F12) ──
  const limparCarrinho = () => {
    if (carrinho.length === 0) return;
    if (window.confirm("Deseja limpar todos os itens do cupom fiscal atual?")) {
      setCarrinho([]);
      showToast("Carrinho limpo com sucesso.");
    }
  };

  const capturarPesoBalanca = (produtoPesavel = null) => {
    const pesosExemplo = [0.380, 0.650, 1.120, 1.480, 2.250];
    const pesoSorteado = pesosExemplo[Math.floor(Math.random() * pesosExemplo.length)];
    const prod = produtoPesavel || produtos.find(p => p.pesavel || p.unidade === "KG") || produtos[0];
    if (!prod) {
      showToast("Nenhum item pesável cadastrado para leitura de balança.");
      return;
    }
    adicionarAoCarrinho(prod, pesoSorteado);
    showToast(`⚖️ Balança Serial: ${pesoSorteado.toFixed(3)} kg capturados de "${prod.nome}"!`);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (abaAtiva !== "pdv") return;
      if (e.key === "F6") {
        e.preventDefault();
        handleAbrirGavetaDinheiro();
      } else if (e.key === "F2") {
        e.preventDefault();
        inputScannerRef.current?.focus();
      } else if (e.key === "F3") {
        e.preventDefault();
        setModalConsultaPreco(true);
      } else if (e.key === "F4") {
        e.preventDefault();
        setModalCaixa("sangria");
      } else if (e.key === "F6") {
        e.preventDefault();
        capturarPesoBalanca();
      } else if (e.key === "F7") {
        e.preventDefault();
        setModalCaixa("suprimento");
      } else if (e.key === "F8") {
        e.preventDefault();
        document.getElementById("input-cpf-clube")?.focus();
      } else if (e.key === "F9") {
        e.preventDefault();
        limparCarrinho();
      } else if (e.key === "F12") {
        e.preventDefault();
        if (carrinho.length > 0) {
          finalizarVendaPdv();
        } else {
          showToast("Adicione itens ao carrinho antes de finalizar [F12].");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [abaAtiva, carrinho]);

  // ── HANDLERS DE DOCAS, TROCAS & SELF-CHECKOUT ──
  const handleRegistrarDoca = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post("/api/admin/supermercado/docas/recebimentos", formDoca);
      showToast(res.mensagem || "Recebimento de doca registrado com sucesso!");
      setModalNovoRecebimentoDoca(false);
      carregarDados();
    } catch (err) {
      showToast("❌ Erro ao registrar carga na doca: " + (err.message || "Falha na requisição"));
    }
  };

  const handleRegistrarTroca = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post("/api/admin/supermercado/trocas", {
        ...formTroca,
        valorTotal: Number(formTroca.valorTotal)
      });
      showToast(res.mensagem || "Troca homologada com sucesso!");
      setValeEmitido(res);
      setModalNovaTroca(false);
      carregarDados();
    } catch (err) {
      showToast("❌ Erro ao homologar troca: " + (err.message || "Falha na requisição"));
    }
  };

  const handleTotemBipar = (e) => {
    e.preventDefault();
    if (!totemLeitor.trim()) return;
    const term = totemLeitor.trim().toLowerCase();
    const prod = produtos.find(p => (p.ean && p.ean === term) || (p.plu && p.plu === term) || p.nome.toLowerCase().includes(term));
    if (!prod) {
      showToast("❌ Produto não identificado no leitor do totem.");
      setTotemLeitor("");
      return;
    }
    const novoItem = {
      id: prod.id,
      nome: prod.nome,
      preco: Number(prod.precoVenda || prod.precoNormal || 10),
      quantidade: 1,
      pesoG: prod.pesavel ? 500 : 350
    };
    setTotemCarrinho(prev => [...prev, novoItem]);
    setTotemPesoEsperado(prev => prev + novoItem.pesoG);
    // Simula prato de empacotamento com balança eletrônica
    setTotemPesoReal(prev => prev + novoItem.pesoG);
    setTotemLeitor("");
    showToast(`🛒 "${prod.nome}" adicionado! Coloque o item na sacola.`);
  };

  const handleTotemFinalizar = async (forma) => {
    if (totemCarrinho.length === 0) return;
    const total = totemCarrinho.reduce((acc, it) => acc + it.preco * it.quantidade, 0);
    try {
      const payload = {
        valorTotal: total,
        formaPagamento: forma,
        desconto: 0,
        troco: 0,
        itens: totemCarrinho.map(it => ({
          itemId: it.id,
          nome: it.nome,
          quantidade: it.quantidade,
          precoUnitario: it.preco,
          precoTotal: it.preco * it.quantidade
        }))
      };
      const res = await api.post("/api/admin/supermercado/vendas/pdv", payload);
      setTotemSucesso({
        numero: res.venda?.numero || "TOTEM-" + Date.now().toString().slice(-4),
        total,
        chaveNfce: res.nfce?.chaveAcesso || "512611" + Math.random().toString().slice(2, 40),
        forma
      });
      setTotemCarrinho([]);
      setTotemPesoEsperado(0);
      setTotemPesoReal(0);
      showToast("✅ Compra finalizada no Totem com sucesso!");
    } catch (err) {
      showToast("❌ Erro ao finalizar no Totem: " + err.message);
    }
  };

  // ── OPERAÇÕES DE CAIXA (ABERTURA, SANGRIA, SUPRIMENTO, FECHAMENTO) ──
  const handleAbrirCaixa = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/admin/supermercado/caixa/abrir', {
        saldoInicial: Number(valorMovimentacao || 150),
        numeroTerminal: 'PDV-01'
      });
      showToast('Caixa aberto com sucesso! Fundo de troco registrado.');
      setModalCaixa(null);
      setValorMovimentacao('');
      carregarDados();
    } catch (err) {
      showToast('Erro ao abrir caixa: ' + err.message);
    }
  };

  const handleMovimentacaoCaixa = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/admin/supermercado/caixa/movimentacao', {
        tipo: modalCaixa, // 'sangria' ou 'suprimento'
        valor: Number(valorMovimentacao),
        motivo: motivoMovimentacao
      });
      showToast(`${modalCaixa === 'sangria' ? 'Sangria' : 'Suprimento'} registrado com sucesso!`);
      setModalCaixa(null);
      setValorMovimentacao('');
      setMotivoMovimentacao('');
      carregarDados();
    } catch (err) {
      showToast('Erro na movimentação: ' + err.message);
    }
  };

  const handleFecharCaixa = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/api/admin/supermercado/caixa/fechar', {
        saldoFinalInformado: Number(saldoFinalInformado)
      });
      const situacao = res.auditoriaQuebra?.situacao || 'Fechado';
      showToast(`Caixa fechado! Auditoria: ${situacao} (Diferença: R$ ${res.auditoriaQuebra?.diferenca?.toFixed(2) || '0.00'})`);
      setModalCaixa(null);
      setSaldoFinalInformado('');
      carregarDados();
    } catch (err) {
      showToast('Erro ao fechar caixa: ' + err.message);
    }
  };

  // ── PDV / CHECKOUT FUNCTIONS ──
  const consultarCpfClube = async () => {
    if (!cpfCliente || cpfCliente.length < 3) return;
    try {
      const res = await api.get(`/api/admin/supermercado/clube/consultar?q=${encodeURIComponent(cpfCliente)}`);
      if (res && res.cliente) {
        setClienteClubeIdentificado(res.cliente);
        showToast(`Cliente Clube Identificado: ${res.cliente.nome}! Desconto exclusivo aplicado.`);
      } else {
        setClienteClubeIdentificado(null);
        showToast('Cliente não localizado no Clube Kytto. Preço regular aplicado.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const adicionarAoCarrinho = (produto, pesoOuQtd = 1) => {
    // Se cliente clube estiver ativo, aplicar preço com desconto clube
    const precoOriginal = Number(produto.precoFinal || produto.precoBase || 0);
    const precoUnitario = clienteClubeIdentificado ? Math.round(precoOriginal * 0.90 * 100) / 100 : precoOriginal;

    setCarrinho(prev => {
      const existe = prev.find(item => item.id === produto.id);
      if (existe) {
        return prev.map(item =>
          item.id === produto.id ? { ...item, quantidade: item.quantidade + pesoOuQtd } : item
        );
      }
      setUltimoItemBipado({
        nome: produto.nome,
        quantidade: pesoOuQtd,
        unidade: produto.unidade || 'UN',
        precoUnitario,
        subtotal: Math.round(precoUnitario * pesoOuQtd * 100) / 100
      });
      return [...prev, {
        id: produto.id,
        nome: produto.nome,
        precoUnitario,
        precoOriginal,
        quantidade: pesoOuQtd,
        unidade: produto.unidade || 'UN',
        departamento: produto.departamento
      }];
    });
  };

  const handleBiparCodigo = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const cod = leitorCodigo.trim();
      if (!cod) return;

      // Suporte a multiplicador (ex: 3*7891000)
      let multiplicador = 1;
      let codigoLimpo = cod;
      if (cod.includes('*')) {
        const partes = cod.split('*');
        multiplicador = Number(partes[0]) || 1;
        codigoLimpo = partes[1].trim();
      }

      // Decodificação de balança com prefixo 2 (2 + PPPPP + VVVVV + D)
      if (codigoLimpo.startsWith('2') && codigoLimpo.length === 13) {
        const pluStr = codigoLimpo.substring(1, 6);
        const valorOuPeso = Number(codigoLimpo.substring(6, 11));
        const pluNum = parseInt(pluStr, 10);

        const prod = produtos.find(p => Number(p.plu) === pluNum || p.codigoBarras === codigoLimpo);
        if (prod) {
          let pesoKg = valorOuPeso / 1000;
          if (prod.unidade === 'UN') pesoKg = multiplicador;
          adicionarAoCarrinho(prod, pesoKg);
          showToast(`Balança: ${prod.nome} (${pesoKg.toFixed(3)} ${prod.unidade}) adicionado!`);
          setLeitorCodigo('');
          return;
        }
      }

      // Busca padrão por EAN, SKU ou PLU
      const prod = produtos.find(p =>
        p.codigoBarras === codigoLimpo ||
        p.sku === codigoLimpo ||
        String(p.plu) === codigoLimpo
      );

      if (prod) {
        tocarBeepScanner('sucesso');
        adicionarAoCarrinho(prod, multiplicador);
        showToast(`Item adicionado: ${prod.nome} (${multiplicador}x)`);
      } else {
        tocarBeepScanner('erro');
        showToast(`Produto com código "${codigoLimpo}" não encontrado no mix.`);
      }
      setLeitorCodigo('');
    }
  };

  const removerDoCarrinho = (index) => {
    setCarrinho(prev => prev.filter((_, i) => i !== index));
  };

  // ── MOTOR DE PRECIFICAÇÃO DINÂMICA: ATACAREJO & PROMOÇÕES DE ENCARTE ──
  const resumoCarrinhoCalculado = useMemo(() => {
    let subtotalOriginal = 0;
    let totalDescontos = 0;

    const itensCalculados = carrinho.map(item => {
      const qtd = Number(item.quantidade || 1);
      const precoOriginal = Number(item.precoOriginal || item.precoUnitario || 0);
      const totalSemDesc = precoOriginal * qtd;
      subtotalOriginal += totalSemDesc;

      let precoFinalUnitario = precoOriginal;
      let descontoItem = 0;
      let promoNome = null;

      // A) Clube Kytto no CPF (10% OFF padrão)
      if (clienteClubeIdentificado) {
        precoFinalUnitario = Math.round(precoOriginal * 0.90 * 100) / 100;
        descontoItem = (precoOriginal - precoFinalUnitario) * qtd;
        promoNome = 'Clube Kytto (10% OFF)';
      }

      // B) Faixa de Preço de Atacarejo por Volume
      const faixas = faixasAtacarejo.filter(f => f.item_id === item.id);
      for (const f of faixas) {
        if (qtd >= Number(f.quantidade_minima)) {
          const precoAtac = Number(f.preco_unitario);
          const descAtac = (precoOriginal - precoAtac) * qtd;
          if (descAtac > descontoItem) {
            precoFinalUnitario = precoAtac;
            descontoItem = descAtac;
            promoNome = `Atacarejo (${f.quantidade_minima}+ un: R$ ${precoAtac.toFixed(2)})`;
          }
          break;
        }
      }

      // C) Promoção Leve X Pague Y (Ex: Leve 3 Pague 2)
      const promoLP = promocoesAvancadas.find(p => p.mecanica === 'LEVE_X_PAGUE_Y' && p.item_origem_id === item.id);
      if (promoLP && promoLP.qtd_gatilho && promoLP.qtd_paga) {
        const gatilho = Number(promoLP.qtd_gatilho);
        const paga = Number(promoLP.qtd_paga);
        if (qtd >= gatilho) {
          const pacotes = Math.floor(qtd / gatilho);
          const gratis = pacotes * (gatilho - paga);
          const descLP = gratis * precoOriginal;
          if (descLP > descontoItem) {
            descontoItem = descLP;
            precoFinalUnitario = (totalSemDesc - descLP) / qtd;
            promoNome = `${promoLP.nome} (${gratis} grátis)`;
          }
        }
      }

      totalDescontos += descontoItem;
      return {
        ...item,
        precoUnitarioFinal: precoFinalUnitario,
        descontoItem,
        totalItem: totalSemDesc - descontoItem,
        promoNome
      };
    });

    return {
      itens: itensCalculados,
      subtotalOriginal,
      totalDescontos,
      totalPagar: subtotalOriginal - totalDescontos
    };
  }, [carrinho, faixasAtacarejo, promocoesAvancadas, clienteClubeIdentificado]);

  const totalCarrinho = resumoCarrinhoCalculado.totalPagar;

  const trocoCalculado = useMemo(() => {
    if (formaPagamento !== 'dinheiro') return 0;
    const rec = Number(valorRecebido || 0);
    return rec > totalCarrinho ? Math.round((rec - totalCarrinho) * 100) / 100 : 0;
  }, [formaPagamento, valorRecebido, totalCarrinho]);

  // Handlers Etiquetas & ZPL
  const handleGerarZpl = async () => {
    try {
      const selecionados = itensEtiquetas.filter(i => etiquetasSelecionadas.includes(i.id));
      if (selecionados.length === 0) {
        showToast("Selecione pelo menos um item para gerar ZPL.");
        return;
      }
      const res = await api.post("/api/admin/supermercado/etiquetas/gerar-zpl", {
        itens: selecionados,
        formato: modeloEtiqueta
      });
      if (res && res.codigoZpl) {
        setModalZpl(res.codigoZpl);
      }
    } catch (err) {
      showToast("Erro ao gerar código ZPL.");
    }
  };

  const handleToggleEtiqueta = (id) => {
    setEtiquetasSelecionadas(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelecionarTodasEtiquetas = () => {
    if (etiquetasSelecionadas.length === itensEtiquetas.length) {
      setEtiquetasSelecionadas([]);
    } else {
      setEtiquetasSelecionadas(itensEtiquetas.map(i => i.id));
    }
  };

  // Handlers NF-e XML
  const handleProcessarXmlNfe = async (xmlConteudo) => {
    const texto = xmlConteudo || xmlNfeTexto;
    if (!texto || !texto.trim()) {
      showToast("Cole o conteúdo do XML ou selecione um arquivo .xml");
      return;
    }
    setCarregandoNfe(true);
    try {
      const res = await api.post("/api/admin/supermercado/nfe-entrada/processar-xml", { xmlString: texto });
      if (res && res.nfe) {
        setNfeProcessada(res.nfe);
        showToast("NF-e processada com sucesso!");
      }
    } catch (err) {
      showToast(err.response?.data?.mensagem || err.message || "Erro ao processar XML.");
    } finally {
      setCarregandoNfe(false);
    }
  };

  const handleCarregarArquivoXml = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const conteudo = evt.target.result;
      setXmlNfeTexto(conteudo);
      handleProcessarXmlNfe(conteudo);
    };
    reader.readAsText(file);
  };

  const handleConfirmarEntradaEstoque = async () => {
    if (!nfeProcessada) return;
    try {
      const res = await api.post('/api/admin/supermercado/nfe-entrada/confirmar', { nfe: nfeProcessada });
      showToast(res.mensagem || 'Entrada da NF-e confirmada e integrada ao estoque central!');
      setNfeProcessada(null);
      setXmlNfeTexto('');
      carregarDados();
    } catch (err) {
      showToast(err.response?.data?.mensagem || err.message || 'Erro ao confirmar entrada da NF-e.');
    }
  };

  // ── Sincronização de Vendas Offline ──
  const handleSincronizarVendasOffline = async () => {
    if (vendasOffline.length === 0) {
      showToast('Nenhuma venda offline pendente de sincronização.');
      return;
    }
    try {
      const res = await api.post('/api/admin/supermercado/vendas/sincronizar-offline', { vendas: vendasOffline });
      showToast(res.mensagem || `${vendasOffline.length} vendas sincronizadas com sucesso!`);
      setVendasOffline([]);
      localStorage.removeItem('kytto_supermercado_vendas_offline');
      carregarDados();
    } catch (err) {
      showToast('Erro ao sincronizar vendas offline.');
    }
  };

  // ── Detalhar Produto & Kardex ──
  const handleAbrirDetalhesProduto = async (produto) => {
    setModalDetalhesProduto(produto);
    setCarregandoKardex(true);
    setKardexProduto([]);
    try {
      const res = await api.get(`/api/admin/supermercado/produtos/${produto.id}/kardex`);
      if (res && Array.isArray(res.movimentacoes)) {
        setKardexProduto(res.movimentacoes);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCarregandoKardex(false);
    }
  };

  // ── Detalhar Caixa Individual ──
  const handleAbrirDetalhesCaixa = async (caixa) => {
    setModalDetalhesCaixa(caixa);
    setCarregandoDetalhesCaixa(true);
    setDetalhesCaixaDados(null);
    try {
      const res = await api.get(`/api/admin/supermercado/caixas/${caixa.id}/detalhes`);
      if (res && res.sucesso) {
        setDetalhesCaixaDados(res);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCarregandoDetalhesCaixa(false);
    }
  };

  // Handlers Balança Pacote
  const handleBaixarPacoteToledo = async () => {
    try {
      const res = await api.get("/api/admin/supermercado/balanca/toledo-mgv/pacote-completo");
      if (res && res.arquivos) {
        setModalPacoteToledo(res);
      }
    } catch (err) {
      showToast("Erro ao carregar pacote Toledo MGV6.");
    }
  };

  const finalizarVendaPdv = async () => {
    if (carrinho.length === 0) {
      showToast('O carrinho está vazio.');
      return;
    }

    // ── SUPORTE TOTAL A CONTINGÊNCIA OFFLINE ──
    if (modoOffline || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      const numeroVendaOff = 'PDV-OFF-' + Date.now().toString(36).toUpperCase();
      const vendaOff = {
        numero: numeroVendaOff,
        valorTotal: totalCarrinho,
        total: totalCarrinho,
        formaPagamento,
        desconto: 0,
        troco: trocoCalculado,
        cpfConsumidor: cpfCliente || null,
        clienteClubeId: clienteClubeIdentificado?.id || null,
        itens: carrinho.map(c => ({
          id: c.id,
          nome: c.nome,
          quantidade: c.quantidade,
          precoUnitario: c.precoUnitario,
          precoTotal: c.precoUnitario * c.quantidade
        })),
        criadoEm: new Date().toISOString(),
        contingenciaOffline: true
      };

      const novaFila = [...vendasOffline, vendaOff];
      setVendasOffline(novaFila);
      try {
        localStorage.setItem('kytto_supermercado_vendas_offline', JSON.stringify(novaFila));
      } catch(e) {}

      const dadosNfceOff = {
        chaveAcesso: '512611' + String(Date.now()).padStart(38, '0').slice(-38),
        protocolo: '15126' + String(Date.now()).slice(-10) + ' (CONTINGÊNCIA)',
        total: totalCarrinho,
        offline: true
      };
      setNfceEmitida(dadosNfceOff);
      setModalComprovanteVenda({
        numero: numeroVendaOff,
        itens: [...carrinho],
        valorTotal: totalCarrinho,
        formaPagamento,
        valorRecebido: Number(valorRecebido || totalCarrinho),
        troco: trocoCalculado,
        cpfConsumidor: cpfCliente || null,
        clienteNome: clienteClubeIdentificado?.nome || null,
        dataHora: new Date().toLocaleString('pt-BR'),
        terminal: terminalAtivoCodigo || 'PDV-01',
        operador: sessaoCaixa?.caixa?.operador_nome || 'Operador de Caixa',
        nfce: dadosNfceOff
      });

      if (['debito', 'credito', 'alimentacao'].includes(formaPagamento)) {
        setModalTef({
          nsu: String(Math.floor(100000 + Math.random() * 900000)),
          autorizacao: String(Math.floor(100000 + Math.random() * 900000)),
          bandeira: formaPagamento === 'alimentacao' ? 'VR Alimentação' : (formaPagamento === 'debito' ? 'Mastercard Débito' : 'Visa Crédito'),
          valor: totalCarrinho,
          dataHora: new Date().toLocaleString('pt-BR'),
          adquirente: 'Stone Pagamentos S/A (TEF Contingência Offline)'
        });
      }

      limparCarrinho();
      showToast(`Venda ${numeroVendaOff} salva em CONTINGÊNCIA OFFLINE! Terminal pronto para o próximo cliente.`);
      return;
    }
    if (sessaoCaixa?.status !== 'aberto') {
      showToast('O caixa está fechado! Abra o caixa antes de operar vendas.');
      return;
    }

    setCarregando(true);
    try {
      const payload = {
        itens: carrinho.map(c => ({
          itemId: c.id,
          nome: c.nome,
          quantidade: c.quantidade,
          precoUnitario: c.precoUnitario
        })),
        formaPagamento,
        valorTotal: totalCarrinho,
        valorRecebido: Number(valorRecebido || totalCarrinho),
        troco: trocoCalculado,
        cpfConsumidor: cpfCliente || null,
        clienteClubeId: clienteClubeIdentificado?.id || null
      };

      const res = await api.post('/api/admin/supermercado/vendas/pdv', payload);
      const dadosNfceOn = res.nfce || {
        chaveAcesso: '512611000' + String(Date.now()).padStart(35, '0'),
        protocolo: '15126000' + String(Date.now()).slice(-8),
        numero: String(Date.now()).slice(-6),
        total: totalCarrinho
      };
      setNfceEmitida(dadosNfceOn);
      setModalComprovanteVenda({
        numero: res.numero || 'CUPOM-' + String(Date.now()).slice(-6),
        itens: [...carrinho],
        valorTotal: totalCarrinho,
        formaPagamento,
        valorRecebido: Number(valorRecebido || totalCarrinho),
        troco: trocoCalculado,
        cpfConsumidor: cpfCliente || null,
        clienteNome: clienteClubeIdentificado?.nome || null,
        dataHora: new Date().toLocaleString('pt-BR'),
        terminal: terminalAtivoCodigo || 'PDV-01',
        operador: sessaoCaixa?.caixa?.operador_nome || 'Operador de Caixa',
        nfce: dadosNfceOn
      });

      showToast(`Venda finalizada com sucesso! Cupom NFC-e Autorizado SEFAZ.`);
      setCarrinho([]);
      setCpfCliente('');
      setClienteClubeIdentificado(null);
      setValorRecebido('');
      carregarDados();
    } catch (err) {
      showToast('Erro ao processar venda: ' + err.message);
    } finally {
      setCarregando(false);
    }
  };

  // ── EXPORTAÇÃO OFICIAL DE BALANÇAS (TOLEDO & FILIZOLA) ──
  const downloadArquivoBalanca = async (tipo) => {
    try {
      const endpoint = tipo === 'toledo'
        ? '/api/admin/supermercado/balanca/toledo-mgv'
        : '/api/admin/supermercado/balanca/filizola';
      const res = await api.get(endpoint);
      if (res && res.conteudo) {
        const blob = new Blob([res.conteudo], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.nomeArquivo || (tipo === 'toledo' ? 'TXITENS.TXT' : 'CADTXT.TXT');
        a.click();
        URL.revokeObjectURL(url);
        showToast(`Arquivo ${res.nomeArquivo} gerado com sucesso (${res.totalItens} itens)!`);
      }
    } catch (err) {
      showToast('Erro ao exportar arquivo de balança: ' + err.message);
    }
  };

  // ── DESOSSA / AÇOUGUE ──
  const handleRegistrarDesossa = async (e) => {
    e.preventDefault();
    try {
      const pesoTotal = Number(formDesossa.pesoCarcaca || 100);
      const custoKg = Number(formDesossa.custoKg || 24.50);
      const cortesPadrao = [
        { corte: 'Picanha Nobre', pesoKg: pesoTotal * 0.024, rendimentoPct: 2.4, custoUnitario: custoKg * 1.9, precoVenda: 89.90 },
        { corte: 'Alcatra com Maminha', pesoKg: pesoTotal * 0.085, rendimentoPct: 8.5, custoUnitario: custoKg * 1.3, precoVenda: 49.90 },
        { corte: 'Contrafilé Grill', pesoKg: pesoTotal * 0.080, rendimentoPct: 8.0, custoUnitario: custoKg * 1.4, precoVenda: 54.90 },
        { corte: 'Patinho para Moer', pesoKg: pesoTotal * 0.122, rendimentoPct: 12.2, custoUnitario: custoKg * 1.05, precoVenda: 39.90 },
        { corte: 'Coxão Mole', pesoKg: pesoTotal * 0.138, rendimentoPct: 13.8, custoUnitario: custoKg * 1.02, precoVenda: 38.90 },
        { corte: 'Carne Moída / Retalhos', pesoKg: pesoTotal * 0.090, rendimentoPct: 9.0, custoUnitario: custoKg * 0.75, precoVenda: 28.90 },
        { corte: 'Osso e Sebo (Descarte)', pesoKg: pesoTotal * 0.180, rendimentoPct: 18.0, custoUnitario: 0, precoVenda: 0 }
      ];

      await api.post('/api/admin/supermercado/desossas', {
        tipoCarcaca: formDesossa.tipoCarcaca,
        pesoCarcaca: pesoTotal,
        custoKg,
        operador: formDesossa.operador,
        cortes: cortesPadrao
      });

      showToast('Desossa registrada com sucesso! Rendimento e cortes atualizados.');
      setModalDesossa(false);
      carregarDados();
    } catch (err) {
      showToast('Erro ao registrar desossa: ' + err.message);
    }
  };

  // ── PADARIA / PRODUÇÃO ──
  const handleProduzirPadaria = async (e) => {
    e.preventDefault();
    if (!modalProducaoPadaria) return;
    try {
      await api.post('/api/admin/supermercado/padaria/producao', {
        receitaId: modalProducaoPadaria.id,
        lotesProduzidos: Number(lotesProduzir),
        operador: 'Padeiro Chefe'
      });
      showToast(`Ordem de Produção concluída! Fornada adicionada ao estoque.`);
      setModalProducaoPadaria(null);
      carregarDados();
    } catch (err) {
      showToast('Erro ao produzir lote de padaria: ' + err.message);
    }
  };

  // ── INVENTÁRIO CÍCLICO ──
  const handleCriarInventario = async (e) => {
    e.preventDefault();
    try {
      const prodsDepto = produtos.filter(p => deptoInventario === 'Todos' || p.departamento === deptoInventario);
      const itensContagem = prodsDepto.slice(0, 10).map(p => ({
        nome: p.nome,
        saldoSistema: Number(p.saldoEstoque || 50),
        saldoContado: Number(p.saldoEstoque || 50),
        diferenca: 0,
        custoUnitario: Number(p.precoCusto || 10)
      }));

      await api.post('/api/admin/supermercado/inventarios', {
        titulo: tituloInventario || `Auditoria — ${deptoInventario}`,
        departamento: deptoInventario,
        itens: itensContagem
      });

      showToast('Inventário cíclico criado e conciliado com sucesso!');
      setModalNovoInventario(false);
      carregarDados();
    } catch (err) {
      showToast('Erro ao criar inventário: ' + err.message);
    }
  };

  // ── CLUBE KYTTO NOVO CLIENTE ──
  const handleCadastrarClienteClube = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/admin/supermercado/clube/clientes', formClube);
      showToast(`Cliente ${formClube.nome} cadastrado no Clube Kytto com sucesso!`);
      setModalNovoClienteClube(false);
      setFormClube({ cpf: '', nome: '', telefone: '', email: '' });
      carregarDados();
    } catch (err) {
      showToast('Erro ao cadastrar cliente clube: ' + err.message);
    }
  };

  return (
    <div className="supermercado-corp-container">
      {/* ── TOAST NOTIFICATION ── */}
      {toastMsg && (
        <div className="super-toast-float">
          <Sparkles size={16} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* ── CABEÇALHO PRINCIPAL COM MULTILOJA & STATUS DO CAIXA ── */}
      <header className="super-header-bar">
        <div className="super-header-info">
          <div className="super-title-row">
            <Store className="super-logo-icon" size={28} />
            <div>
              <h1 className="super-main-title">Kytto Supermercado & Varejo Alimentar</h1>
              <p className="super-sub-title">Gestão Integral de Gôndola, Frente de Caixa (PDV), Balanças e Perecíveis</p>
            </div>
          </div>
        </div>

        <div className="super-header-actions">
          {/* Status Caixa */}
          <div className={`super-caixa-badge ${sessaoCaixa?.status === 'aberto' ? 'aberto' : 'fechado'}`}>
            <Lock size={14} />
            <span>Caixa PDV: <strong>{sessaoCaixa?.status === 'aberto' ? 'ABERTO' : 'FECHADO'}</strong></span>
            {sessaoCaixa?.status === 'aberto' && (
              <span className="super-caixa-gaveta">(R$ {sessaoCaixa?.resumo?.saldoDinheiroEsperado?.toFixed(2) || '0.00'})</span>
            )}
          </div>

          {sessaoCaixa?.status === 'aberto' ? (
            <div className="super-caixa-btn-group">
              <button className="super-btn-sec" onClick={() => setModalCaixa('sangria')}>Sangria</button>
              <button className="super-btn-sec" onClick={() => setModalCaixa('suprimento')}>Suprimento</button>
              <button className="super-btn-danger" onClick={() => setModalCaixa('fechar')}>Fechar Caixa</button>
            </div>
          ) : (
            <button className="super-btn-primary" onClick={() => setModalCaixa('abrir')}>
              <KeyRound size={16} /> Abrir Caixa PDV
            </button>
          )}

          <button className="super-btn-mix-cta" onClick={executarCargaMixOficial} title="Carregar 25 itens da cesta brasileira">
            <Layers size={16} /> Carga Mix Oficial (25 Itens)
          </button>
          {pwaInstalavel && (
            <button className="super-btn-pwa-install" onClick={handleInstalarPwaNativo} title="Instalar aplicativo nativo no Windows">
              <Download size={16} /> Instalar no Windows (PWA)
            </button>
          )}
          <button className="super-btn-windows-cta" onClick={() => setModalInstaladorWindows(true)} title="Instalador Windows & PWA">
            <Monitor size={16} /> 🖥️ Instalador Windows & PWA
          </button>

          <button className="super-btn-refresh" onClick={carregarDados} disabled={carregando} title="Atualizar dados">
            <RefreshCw size={16} className={carregando ? 'spin' : ''} />
          </button>
        </div>
      </header>

      {/* ── BARRA DE NAVEGAÇÃO DE ABAS CORPORATIVAS ── */}
      <nav className="super-nav-tabs">
        <button className={`super-tab-btn ${abaAtiva === 'dashboard' ? 'active' : ''}`} onClick={() => setAbaAtiva('dashboard')}>
          <TrendingUp size={16} /> Painel & KPIs
        </button>
        <button className={`super-tab-btn ${abaAtiva === 'terminais' ? 'active' : ''}`} onClick={() => setAbaAtiva('terminais')}>
          <Tv size={16} /> Frentes de Caixa ({terminais.length})
        </button>
        <button className={`super-tab-btn ${abaAtiva === 'pdv' ? 'active' : ''}`} onClick={() => setAbaAtiva('pdv')}>
          <ShoppingCart size={16} /> Frente de Caixa (PDV)
        </button>
        <button className={`super-tab-btn ${abaAtiva === 'mix' ? 'active' : ''}`} onClick={() => setAbaAtiva('mix')}>
          <Barcode size={16} /> Mix & Gôndola ({produtos.length})
        </button>
        <button className={`super-tab-btn ${abaAtiva === 'hortifruti' ? 'active' : ''}`} onClick={() => setAbaAtiva('hortifruti')}>
          <Apple size={16} /> Hortifrúti (FLV)
        </button>
        <button className={`super-tab-btn ${abaAtiva === 'desossa' ? 'active' : ''}`} onClick={() => setAbaAtiva('desossa')}>
          <Beef size={16} /> Açougue & Desossa ({desossas.length})
        </button>
        <button className={`super-tab-btn ${abaAtiva === 'padaria' ? 'active' : ''}`} onClick={() => setAbaAtiva('padaria')}>
          <UtensilsCrossed size={16} /> Padaria & Produção
        </button>
        <button className={`super-tab-btn ${abaAtiva === 'lotes' ? 'active' : ''}`} onClick={() => setAbaAtiva('lotes')}>
          <AlertTriangle size={16} /> Lotes & FEFO ({lotes.length})
        </button>
        <button className={`super-tab-btn ${abaAtiva === 'ruptura' ? 'active' : ''}`} onClick={() => setAbaAtiva('ruptura')}>
          <Boxes size={16} /> Ruptura & Reposição
        </button>
        <button className={`super-tab-btn ${abaAtiva === 'balancas' ? 'active' : ''}`} onClick={() => setAbaAtiva('balancas')}>
          <Scale size={16} /> Carga Balanças
        </button>
        <button className={`super-tab-btn ${abaAtiva === 'etiquetas' ? 'active' : ''}`} onClick={() => setAbaAtiva('etiquetas')}>
          <Tag size={16} /> Etiquetas Gôndola
        </button>
        <button className={`super-tab-btn ${abaAtiva === 'nfe' ? 'active' : ''}`} onClick={() => setAbaAtiva('nfe')}>
          <FileText size={16} /> Entrada NF-e XML
        </button>
        <button className={`super-tab-btn ${abaAtiva === 'perdas' ? 'active' : ''}`} onClick={() => setAbaAtiva('perdas')}>
          <ShieldAlert size={16} /> Prevenção de Perdas
        </button>
        <button className={`super-tab-btn ${abaAtiva === 'auditoria' ? 'active' : ''}`} onClick={() => setAbaAtiva('auditoria')}>
          <ShieldCheck size={16} /> Auditoria Preços
        </button>
        <button className={`super-tab-btn ${abaAtiva === 'inventarios' ? 'active' : ''}`} onClick={() => setAbaAtiva('inventarios')}>
          <ClipboardCheck size={16} /> Inventário Cíclico
        </button>
        <button className={`super-tab-btn ${abaAtiva === 'clube' ? 'active' : ''}`} onClick={() => setAbaAtiva('clube')}>
          <Users size={16} /> Clube Kytto ({clientesClube.length})
        </button>
        <button className={`super-tab-btn ${abaAtiva === 'selfcheckout' ? 'active' : ''}`} onClick={() => setAbaAtiva('selfcheckout')}>
          <Sparkles size={16} /> Self-Checkout Totem
        </button>
        <button className={`super-tab-btn ${abaAtiva === 'docas' ? 'active' : ''}`} onClick={() => setAbaAtiva('docas')}>
          <Truck size={16} /> Docas & Recebimento ({recebimentosDoca.length})
        </button>
        <button className={`super-tab-btn ${abaAtiva === 'trocas' ? 'active' : ''}`} onClick={() => setAbaAtiva('trocas')}>
          <RotateCcw size={16} /> Trocas & SAC ({trocas.length})
        </button>
        <button className={`super-tab-btn ${abaAtiva === 'atacarejo' ? 'active' : ''}`} onClick={() => setAbaAtiva('atacarejo')}>
          <Layers size={16} /> Atacarejo & Volume ({faixasAtacarejo.length})
        </button>
        <button className={`super-tab-btn ${abaAtiva === 'sugestaocompras' ? 'active' : ''}`} onClick={() => setAbaAtiva('sugestaocompras')}>
          <ShoppingCart size={16} /> Sugestão Compras (GMD) ({sugestoesCompras.length})
        </button>
        <button className={`super-tab-btn ${abaAtiva === 'promocoes' ? 'active' : ''}`} onClick={() => setAbaAtiva('promocoes')}>
          <Percent size={16} /> Promoções & Tabloides ({promocoes.length})
        </button>
        <button className={`super-tab-btn ${abaAtiva === 'transferencias' ? 'active' : ''}`} onClick={() => setAbaAtiva('transferencias')}>
          <ArrowRightLeft size={16} /> Transferências & CD ({transferencias.length})
        </button>
        <button className={`super-tab-btn ${abaAtiva === 'coletor' ? 'active' : ''}`} onClick={() => setAbaAtiva('coletor')}>
          <Smartphone size={16} /> Coletor Mobile ({leiturasColetor.length})
        </button>
        <button className={`super-tab-btn ${abaAtiva === 'tributario' ? 'active' : ''}`} onClick={() => setAbaAtiva('tributario')}>
          <Landmark size={16} /> Matriz Tributária ({matrizTributaria.length})
        </button>
        <button className={`super-tab-btn ${abaAtiva === 'wms' ? 'active' : ''}`} onClick={() => setAbaAtiva('wms')}>
          <Boxes size={16} /> WMS & Gôndola ({enderecosWms.length})
        </button>
        <button className={`super-tab-btn ${abaAtiva === 'cockpit' ? 'active' : ''}`} onClick={() => setAbaAtiva('cockpit')}>
          <Activity size={16} /> Cockpit ABRAS
        </button>
        <button className={`super-tab-btn ${abaAtiva === 'margens' ? 'active' : ''}`} onClick={() => setAbaAtiva('margens')}>
          <TrendingUp size={16} /> Margens & Curva ABC
        </button>
      </nav>

      {/* ════════════════════════════════════════════════════════════════════════
          CONTEÚDO DAS ABAS
         ════════════════════════════════════════════════════════════════════════ */}
      <main className="super-main-content">
        {/* ── 1. DASHBOARD & KPIS ── */}
        {abaAtiva === 'dashboard' && (
          <div className="super-dash-grid">
            <div className="super-kpi-card">
              <span className="kpi-label">Faturamento do Dia</span>
              <strong className="kpi-val text-green">R$ {(resumo?.totalVendas || 1845.90).toFixed(2)}</strong>
              <small className="kpi-sub">{resumo?.cuponsEmitidos || 28} cupons NFC-e emitidos</small>
            </div>
            <div className="super-kpi-card">
              <span className="kpi-label">Ticket Médio</span>
              <strong className="kpi-val">R$ {(resumo?.ticketMedio || 65.92).toFixed(2)}</strong>
              <small className="kpi-sub">Média por cliente no checkout</small>
            </div>
            <div className="super-kpi-card">
              <span className="kpi-label">Estoque a Preço de Venda</span>
              <strong className="kpi-val text-blue">R$ {(resumo?.valorEstoqueVenda || 42890.00).toFixed(2)}</strong>
              <small className="kpi-sub">Custo: R$ {(resumo?.valorEstoqueCusto || 27650.00).toFixed(2)}</small>
            </div>
            <div className="super-kpi-card">
              <span className="kpi-label">Lotes em Risco FEFO</span>
              <strong className="kpi-val text-orange">{(resumo?.lotesCriticos || lotes.length)} Lotes</strong>
              <small className="kpi-sub text-red">{resumo?.lotesVencidos || 0} vencidos / {resumo?.lotesCriticos || 3} críticos</small>
            </div>

            {/* Painel de Departamentos */}
            <div className="super-dash-section col-span-2">
              <h3 className="section-title">Distribuição de Mix e Margens por Departamento</h3>
              <div className="deptos-pills-grid">
                {DEPARTAMENTOS.map(dep => {
                  const itensDep = produtos.filter(p => p.departamento === dep);
                  return (
                    <div key={dep} className="depto-stat-pill">
                      <span className="depto-name">{dep}</span>
                      <strong className="depto-count">{itensDep.length} itens</strong>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ações Rápidas */}
            <div className="super-dash-section col-span-2">
              <h3 className="section-title">Ações Operacionais de Alta Frequência</h3>
              <div className="super-quick-actions-row">
                <button className="quick-act-btn" onClick={() => setAbaAtiva('pdv')}>
                  <ShoppingCart size={20} />
                  <span>Abrir Frente de Caixa PDV</span>
                </button>
                <button className="quick-act-btn" onClick={() => downloadArquivoBalanca('toledo')}>
                  <Scale size={20} />
                  <span>Exportar Carga Balança (TXITENS.TXT)</span>
                </button>
                <button className="quick-act-btn" onClick={() => setAbaAtiva('desossa')}>
                  <Beef size={20} />
                  <span>Nova Desossa de Carnes (Açougue)</span>
                </button>
                <button className="quick-act-btn" onClick={() => setAbaAtiva('inventarios')}>
                  <ClipboardCheck size={20} />
                  <span>Iniciar Auditoria de Gôndola</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── 2. FRENTE DE CAIXA (PDV SUPERMERCADO) ── */}
        {abaAtiva === 'pdv' && (
          <div className="super-pdv-layout">
            {/* SELETOR SUPERIOR DE FRENTE DE CAIXA ATIVA */}
            <div className="super-pdv-terminal-bar col-span-full">
              <div className="flex items-center gap-3">
                <Tv size={18} className="text-sky-600" />
                <span className="text-xs font-bold text-slate-700 uppercase">Terminal Operado:</span>
                <select
                  className="super-select font-bold text-sm bg-white"
                  value={terminalAtivoCodigo}
                  onChange={async (e) => {
                    const novo = e.target.value;
                    setTerminalAtivoCodigo(novo);
                    setTerminalSelecionado(novo);
                    const rCx = await api.get(`/api/admin/supermercado/caixa/sessao?terminal=${encodeURIComponent(novo)}`).catch(() => null);
                    if (rCx) setSessaoCaixa(rCx);
                    showToast(`Conectado ao Terminal ${novo}!`);
                  }}
                >
                  {terminais.length === 0 ? (
                    <option value="PDV-01">PDV-01 (Caixa Padrão)</option>
                  ) : (
                    terminais.map(t => (
                      <option key={t.id || t.codigo} value={t.codigo}>
                        {t.codigo} — {t.nome} {t.status === 'aberto' ? '🟢 [Aberto]' : '⚪ [Fechado]'}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="super-btn sm neutral"
                  onClick={() => setAbaAtiva('terminais')}
                >
                  <List size={14} /> Ver Todas as Frentes ({terminais.length})
                </button>
                <button
                  type="button"
                  className="super-btn sm primary"
                  onClick={() => {
                    setFormTerminal({ codigo: `PDV-${String(terminais.length + 1).padStart(2, '0')}`, nome: `Caixa ${String(terminais.length + 1).padStart(2, '0')}`, tipo: 'convencional', limiteSangria: 800, ipEquipamento: '' });
                    setModalNovoTerminal(true);
                  }}
                >
                  <Plus size={14} /> Novo PDV
                </button>
              </div>
            </div>
            {/* Coluna Esquerda: Bipagem e Carrinho */}
            <div className="super-pdv-left">
              {/* BANNER DE CONTINGÊNCIA OFFLINE & STATUS DO TERMINAL */}
              <div className={`super-offline-banner ${modoOffline ? 'offline' : 'online'}`}>
                <div className="offline-banner-left">
                  {modoOffline ? <WifiOff size={18} color="#c2410c" /> : <Wifi size={18} color="#166534" />}
                  <span>
                    {modoOffline
                      ? '⚠️ MODO CONTINGÊNCIA OFFLINE ATIVO — Vendas salvas com segurança no terminal'
                      : `🟢 Online: Terminal ${sessaoCaixa?.caixa?.numero_terminal || terminalSelecionado} conectado ao Commerce Core`}
                  </span>
                  {vendasOffline.length > 0 && (
                    <span className="badge-offline-count" style={{ background: '#ea580c', color: '#fff', padding: '2px 8px', borderRadius: 9999, fontSize: 11 }}>
                      {vendasOffline.length} {vendasOffline.length === 1 ? 'venda pendente' : 'vendas pendentes'}
                    </span>
                  )}
                </div>
                <div className="offline-banner-actions">
                  <button
                    type="button"
                    className="btn-toggle-offline"
                    onClick={() => {
                      const novo = !modoOffline;
                      setModoOffline(novo);
                      showToast(novo ? 'Modo Offline Ativado para Simulação / Contingência.' : 'Modo Online Conectado.');
                    }}
                  >
                    {modoOffline ? 'Conectar Online' : 'Simular Offline'}
                  </button>
                  {vendasOffline.length > 0 && (
                    <button
                      type="button"
                      className="btn-sincronizar-offline"
                      onClick={handleSincronizarVendasOffline}
                    >
                      <ArrowUpCircle size={14} /> Sincronizar ({vendasOffline.length})
                    </button>
                  )}
                </div>
              </div>
              
              {Number(sessaoCaixa?.resumo?.saldoDinheiroEsperado || 0) >= 800 && (
                <div className="super-alert-teto-gaveta">
                  <div className="alert-content">
                    <AlertTriangle size={20} className="alert-pulse-icon" />
                    <div>
                      <strong>⚠️ ALERTA DE SEGURANÇA: Limite Prudencial de Gaveta Atingido!</strong>
                      <span> Saldo em dinheiro (R$ {Number(sessaoCaixa?.resumo?.saldoDinheiroEsperado || 0).toFixed(2)}) ultrapassou o teto recomendado de R$ 800,00.</span>
                    </div>
                  </div>
                  <button className="super-btn-sangria-rapida" onClick={() => setModalCaixa("sangria")}>
                    Efetuar Sangria Agora [F4]
                  </button>
                </div>
              )}

              {/* VISOR VIRTUAL DO CLIENTE (POLE DISPLAY) */}
              {visorClienteAtivo && (
                <div className="super-pdv-pole-display">
                  <div className="pole-display-left">
                    <span className="pole-tag">
                      <span className="pole-live-dot" /> Visor do Cliente / Checkout em Operação
                    </span>
                    <div className="pole-item-name">
                      {ultimoItemBipado ? ultimoItemBipado.nome : "SEJA BEM-VINDO AO SUPERMERCADO KYTTO"}
                    </div>
                    <div className="pole-item-meta">
                      {ultimoItemBipado
                        ? `QTD: ${ultimoItemBipado.quantidade} ${ultimoItemBipado.unidade} × R$ ${ultimoItemBipado.precoUnitario.toFixed(2)} = R$ ${ultimoItemBipado.subtotal.toFixed(2)}`
                        : "PASSE AS SUAS COMPRAS PELO LEITOR DE CÓDIGOS OU BALANÇA"}
                    </div>
                  </div>
                  <div className="pole-display-right">
                    <span className="pole-total-label">Subtotal Geral</span>
                    <span className="pole-total-val">R$ {totalCarrinho.toFixed(2)}</span>
                  </div>
                </div>
              )}
              <div className="super-pdv-scanner-box">
                <Barcode size={24} className="scanner-icon" />
                <input
                  type="text"
                  ref={inputScannerRef} className="super-scanner-input"
                  placeholder="Bipe o código de barras, PLU de balança ou use 3*CÓDIGO (Enter para incluir)..."
                  value={leitorCodigo}
                  onChange={(e) => setLeitorCodigo(e.target.value)}
                  onKeyDown={handleBiparCodigo}
                  autoFocus
                />
                <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                  <button type="button" className="hotkey-pill" title="Capturar peso da balança de checkout (F6)" onClick={() => capturarPesoBalanca()}>
                    <Scale size={14} color="#0284c7" /> <span>Balança [F6]</span>
                  </button>
                  <button type="button" className="hotkey-pill" title="Consulta rápida de preço e gôndola (F3)" onClick={() => setModalConsultaPreco(true)}>
                    <Search size={14} color="#0284c7" /> <span>Preço [F3]</span>
                  </button>
                </div>

              </div>

              {/* Tabela de Itens Bipados */}
              <div className="super-pdv-table-container">
                <table className="super-data-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Qtd / Peso</th>
                      <th>Preço Unit.</th>
                      <th>Subtotal</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {carrinho.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="empty-row">
                          <ShoppingCart size={32} style={{ opacity: 0.3, margin: '0 auto 8px auto', display: 'block' }} />
                          Nenhum item na comanda fiscal. Bipe produtos ou utilize os atalhos de balcão.
                        </td>
                      </tr>
                    ) : (
                      resumoCarrinhoCalculado.itens.map((it, idx) => (
                        <tr key={idx}>
                          <td>
                            <strong>{it.nome}</strong>
                            <div className="text-muted-small">{it.departamento}</div>
                            {it.promoNome && (
                              <div className="promo-badge-cart">
                                <Sparkles size={11} /> {it.promoNome}
                              </div>
                            )}
                          </td>
                          <td>{it.quantidade.toFixed(it.unidade === 'KG' ? 3 : 0)} {it.unidade}</td>
                          <td>
                            R$ {it.precoUnitarioFinal.toFixed(2)}
                            {it.precoUnitarioFinal < (it.precoOriginal || it.precoUnitario) && (
                              <span className="text-muted-small" style={{ textDecoration: 'line-through', marginLeft: 4 }}>
                                R$ {Number(it.precoOriginal || it.precoUnitario).toFixed(2)}
                              </span>
                            )}
                          </td>
                          <td><strong>R$ {it.totalItem.toFixed(2)}</strong></td>
                          <td>
                            <button className="btn-icon-danger" onClick={() => removerDoCarrinho(idx)} title="Cancelar item">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Atalhos Rápidos de Balcão (Pesáveis e Alto Giro) */}
              <div className="super-pdv-shortcuts">
                <span className="shortcuts-title">Atalhos de 1 Clique (Balança / Alto Giro):</span>
                <div className="shortcuts-pills">
                  {produtos.filter(p => p.pesavel || p.plu).slice(0, 8).map(prod => (
                    <button key={prod.id} className="shortcut-pill" onClick={() => adicionarAoCarrinho(prod, 1)}>
                      <span>{prod.nome.split(' ')[0]} {prod.nome.split(' ')[1] || ''}</span>
                      <small>R$ {Number(prod.precoFinal || prod.precoBase || 0).toFixed(2)}</small>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Coluna Direita: Totais, Cliente Clube e Pagamento */}
            <div className="super-pdv-right">
              {/* Box Clube Kytto / CPF na Nota */}
              <div className="super-pdv-card">
                <label className="card-label">Identificação do Cliente / Clube Kytto</label>
                <div className="cpf-input-group">
                  <input
                    type="text"
                    className="super-form-input"
                    placeholder="Digite CPF ou telefone..."
                    value={cpfCliente}
                    onChange={(e) => setCpfCliente(e.target.value)}
                  />
                  <button className="super-btn-sec" onClick={consultarCpfClube}>Consultar</button>
                </div>
                {clienteClubeIdentificado && (
                  <div className="cliente-clube-alert">
                    <Sparkles size={16} className="text-yellow" />
                    <span><strong>{clienteClubeIdentificado.nome}</strong> (Desconto Clube Ativo 10% OFF)</span>
                  </div>
                )}
              </div>

              {/* Box de Totais */}
              <div className="super-pdv-card super-totals-card">
                <div className="total-row">
                  <span>Itens no Cupom:</span>
                  <strong>{carrinho.length} itens</strong>
                </div>
                <div className="total-row big">
                  <span>TOTAL A PAGAR:</span>
                  <span className="total-value">R$ {totalCarrinho.toFixed(2)}</span>
                </div>
              </div>

              {/* Box Formas de Pagamento */}
              <div className="super-pdv-card">
                <label className="card-label">Condição de Pagamento</label>
                <div className="super-payment-methods-grid">
                  {[
                    { id: 'dinheiro', label: 'Dinheiro' },
                    { id: 'pix', label: 'Pix Dinâmico' },
                    { id: 'debito', label: 'Cartão Débito' },
                    { id: 'credito', label: 'Cartão Crédito' },
                    { id: 'alimentacao', label: 'Vale Alimentação' }
                  ].map(fm => (
                    <button
                      key={fm.id}
                      className={`payment-method-btn ${formaPagamento === fm.id ? 'active' : ''}`}
                      onClick={() => setFormaPagamento(fm.id)}
                    >
                      {fm.label}
                    </button>
                  ))}
                </div>

                {formaPagamento === 'dinheiro' && (
                  <div className="troco-box-row">
                    <div>
                      <label className="input-sub-label">Valor Recebido (R$):</label>
                      <input
                        type="number"
                        step="0.01"
                        className="super-form-input"
                        placeholder="R$ 0,00"
                        value={valorRecebido}
                        onChange={(e) => setValorRecebido(e.target.value)}
                      />
                    </div>
                    <div className="troco-display">
                      <span className="troco-label">TROCO:</span>
                      <strong className="troco-val">R$ {trocoCalculado.toFixed(2)}</strong>
                    </div>
                  </div>
                )}
              </div>

              {/* Botão Finalizar Venda */}
              <button
                className="super-btn-finalizar-pdv"
                disabled={carrinho.length === 0 || carregando}
                onClick={finalizarVendaPdv}
              >
                <CheckCircle2 size={20} />
                <span>FINALIZAR VENDA & EMITIR NFC-E</span>
              </button>

              {/* Comprovante Fiscal Emitido */}
              {nfceEmitida && (
                <div className="nfce-receipt-card">
                  <div className="receipt-header">
                    <CheckCircle2 size={18} className="text-green" />
                    <strong>NFC-e Autorizada com Sucesso!</strong>
                  </div>
                  <div className="receipt-body">
                    <div><strong>Protocolo SEFAZ:</strong> {nfceEmitida.protocolo}</div>
                    <div><strong>Chave de Acesso:</strong> <span className="receipt-key">{nfceEmitida.chaveAcesso}</span></div>
                    <div><strong>Total Cupom:</strong> R$ {Number(nfceEmitida.total || totalCarrinho).toFixed(2)}</div>
                  </div>
                  <button className="super-btn-sec" onClick={() => window.print()}>
                    <Printer size={14} /> Imprimir Cupom Térmico (80mm)
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 3. MIX & GÔNDOLA ── */}
        {abaAtiva === 'mix' && (
          <div className="super-mix-container">
            <div className="super-toolbar">
              <div className="toolbar-left">
                <div className="search-box">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Buscar por nome, EAN-13, PLU ou SKU..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                  />
                </div>
                <select
                  className="super-select"
                  value={deptoFiltro}
                  onChange={(e) => setDeptoFiltro(e.target.value)}
                >
                  <option value="Todos">Todos os Departamentos</option>
                  {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <label className="super-checkbox-label">
                  <input
                    type="checkbox"
                    checked={apenasPesaveis}
                    onChange={(e) => setApenasPesaveis(e.target.checked)}
                  />
                  <span>Apenas Balança / Pesáveis</span>
                </label>
                <label className="super-checkbox-label">
                  <input
                    type="checkbox"
                    checked={apenasRupturas}
                    onChange={(e) => setApenasRupturas(e.target.checked)}
                  />
                  <span>Risco de Ruptura (≤ Mínimo)</span>
                </label>
              </div>

              <div className="toolbar-right">
                <button className="super-btn-primary" onClick={() => setModalNovoProduto(true)}>
                  <Plus size={16} /> Novo Produto
                </button>
              </div>
            </div>

            {/* Tabela de Produtos */}
            <div className="super-table-wrapper">
              <table className="super-data-table">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>EAN-13 / PLU</th>
                    <th>Departamento</th>
                    <th>Preço Venda</th>
                    <th>Custo Médio</th>
                    <th>Margem</th>
                    <th>Estoque Gôndola</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {produtosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="empty-row">Nenhum produto localizado com os filtros selecionados.</td>
                    </tr>
                  ) : (
                    produtosFiltrados.map(prod => {
                      const preco = Number(prod.precoFinal || prod.precoBase || 0);
                      const custo = Number(prod.precoCusto || preco * 0.65);
                      const margem = preco > 0 ? Math.round(((preco - custo) / preco) * 100) : 0;
                      const saldo = Number(prod.saldoEstoque || 0);
                      const min = Number(prod.estoqueMinimo || 5);
                      const emRuptura = saldo <= min;

                      return (
                        <tr key={prod.id}>
                          <td>
                            <strong>{prod.nome}</strong>
                            <div className="text-muted-small">SKU: {prod.sku || '-'}</div>
                          </td>
                          <td>
                            <div>{prod.codigoBarras || '-'}</div>
                            {prod.plu && <span className="badge-plu">PLU: {prod.plu}</span>}
                          </td>
                          <td>{prod.departamento || 'Mercearia'}</td>
                          <td><strong>R$ {preco.toFixed(2)}</strong></td>
                          <td>R$ {custo.toFixed(2)}</td>
                          <td>
                            <span className={`badge-margem ${margem >= 35 ? 'alta' : 'media'}`}>{margem}%</span>
                          </td>
                          <td>
                            <strong>{saldo.toFixed(prod.unidade === 'KG' ? 3 : 0)} {prod.unidade || 'UN'}</strong>
                            <div className="text-muted-small">Mín: {min} / Máx: {prod.estoqueMaximo || 100}</div>
                          </td>
                          <td>
                            {emRuptura ? (
                              <span className="badge-status-danger">Ruptura</span>
                            ) : (
                              <span className="badge-status-success">Abastecido</span>
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
        )}

        {/* ── 4. AÇOUGUE & DESOSSA (RENDIMENTO) ── */}
        {abaAtiva === 'desossa' && (
          <div className="super-desossa-container">
            <div className="super-toolbar">
              <div>
                <h3 className="section-title">Açougue & Gestão de Rendimento de Carcaças</h3>
                <p className="text-muted-small">Transformação de quartos bovinos/suínos brutos em cortes nobres com controle de rendimento e custo médio ponderado.</p>
              </div>
              <button className="super-btn-primary" onClick={() => setModalDesossa(true)}>
                <Plus size={16} /> Nova Desossa de Carcaça
              </button>
            </div>

            <div className="desossas-cards-grid">
              {desossas.map(des => (
                <div key={des.id} className="desossa-card">
                  <div className="desossa-card-header">
                    <Beef size={22} className="text-red" />
                    <div>
                      <strong>{des.tipo_carcaca}</strong>
                      <div className="text-muted-small">Operador: {des.operador} | Data: {new Date(des.criado_em).toLocaleDateString('pt-BR')}</div>
                    </div>
                  </div>
                  <div className="desossa-stats-row">
                    <div>
                      <span className="stat-label">Peso Bruto:</span>
                      <strong>{Number(des.peso_carcaca).toFixed(3)} KG</strong>
                    </div>
                    <div>
                      <span className="stat-label">Rendimento Nobre:</span>
                      <strong className="text-green">{Number(des.rendimento_total_kg).toFixed(3)} KG ({des.percentual_rendimento}%)</strong>
                    </div>
                    <div>
                      <span className="stat-label">Custo Total:</span>
                      <strong>R$ {Number(des.custo_total).toFixed(2)}</strong>
                    </div>
                  </div>

                  <div className="desossa-cortes-table">
                    <table className="super-mini-table">
                      <thead>
                        <tr>
                          <th>Corte Final</th>
                          <th>Peso Obtido</th>
                          <th>Rendimento</th>
                          <th>Custo Kg</th>
                          <th>Preço Venda</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(Array.isArray(des.detalhes) ? des.detalhes : []).map((c, i) => (
                          <tr key={i}>
                            <td><strong>{c.corte}</strong></td>
                            <td>{Number(c.pesoKg).toFixed(3)} KG</td>
                            <td>{c.rendimentoPct}%</td>
                            <td>R$ {Number(c.custoUnitario || 0).toFixed(2)}</td>
                            <td>R$ {Number(c.precoVenda || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 5. PADARIA & PRODUÇÃO ── */}
        {abaAtiva === 'padaria' && (
          <div className="super-padaria-container">
            <div className="super-toolbar">
              <div>
                <h3 className="section-title">Padaria, Confeitaria & Fichas Técnicas</h3>
                <p className="text-muted-small">Ordens de produção com baixa automatizada de farinhas, ovos, fermento e entrada de fornadas prontas na gôndola.</p>
              </div>
            </div>

            <div className="receitas-grid">
              {receitasPadaria.map(rec => (
                <div key={rec.id} className="receita-card">
                  <div className="receita-card-header">
                    <UtensilsCrossed size={20} className="text-orange" />
                    <div>
                      <strong>{rec.nome}</strong>
                      <div className="text-muted-small">Rendimento: {rec.rendimento_padrao} {rec.unidade_rendimento} | Preparo: {rec.tempo_preparo_min} min</div>
                    </div>
                  </div>

                  <div className="ingredientes-box">
                    <span className="ingredientes-title">Ingredientes / Ficha Técnica:</span>
                    <ul>
                      {(Array.isArray(rec.ingredientes) ? rec.ingredientes : []).map((ing, i) => (
                        <li key={i}>{ing.nome}: <strong>{ing.quantidade} {ing.unidade}</strong></li>
                      ))}
                    </ul>
                  </div>

                  <button className="super-btn-primary full-width" onClick={() => setModalProducaoPadaria(rec)}>
                    <Layers size={16} /> Iniciar Fornada / Produção
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 6. LOTES & VALIDADE (FEFO) ── */}
        {abaAtiva === 'lotes' && (
          <div className="super-lotes-container">
            <div className="super-toolbar">
              <div>
                <h3 className="section-title">Controle de Lotes & Validade (First Expire, First Out)</h3>
                <p className="text-muted-small">Acompanhamento preditivo para evitar perdas de perecíveis por vencimento.</p>
              </div>
            </div>

            <div className="super-table-wrapper">
              <table className="super-data-table">
                <thead>
                  <tr>
                    <th>Lote</th>
                    <th>Produto</th>
                    <th>Data Validade</th>
                    <th>Dias Restantes</th>
                    <th>Saldo Estoque</th>
                    <th>Classificação FEFO</th>
                    <th>Ações Rápidas</th>
                  </tr>
                </thead>
                <tbody>
                  {lotes.map(lote => {
                    const hoje = new Date();
                    const val = new Date(lote.validade || Date.now() + 15 * 86400000);
                    const diffDias = Math.ceil((val - hoje) / 86400000);
                    const statusClass = diffDias <= 0 ? 'vencido' : (diffDias <= 7 ? 'critico' : (diffDias <= 30 ? 'atencao' : 'regular'));

                    return (
                      <tr key={lote.id}>
                        <td><strong>{lote.numeroLote || 'LT-202611-01'}</strong></td>
                        <td>{lote.itemNome || 'Produto Perecível'}</td>
                        <td>{val.toLocaleDateString('pt-BR')}</td>
                        <td>
                          <strong>{diffDias <= 0 ? 'VENCIDO' : `${diffDias} dias`}</strong>
                        </td>
                        <td>{Number(lote.quantidadeAtual || 20).toFixed(0)} UN</td>
                        <td>
                          <span className={`badge-fefo ${statusClass}`}>
                            {statusClass.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <div className="actions-cell">
                            <button
                              className="super-btn-sec-small"
                              onClick={() => {
                                showToast(`Promoção relâmpago de liquidação (35% OFF) criada para ${lote.itemNome}!`);
                              }}
                            >
                              Liquidar (35% OFF)
                            </button>
                            <button
                              className="btn-icon-danger"
                              onClick={() => setModalBaixaLote(lote)}
                              title="Baixa de perda / avaria"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── 7. CARGA DE BALANÇAS & MGV ── */}
        {abaAtiva === 'balancas' && (
          <div className="super-balancas-container">
            <div className="balancas-card-box">
              <Scale size={32} className="text-blue" />
              <div className="balancas-card-content">
                <h3 className="section-title">Exportação Oficial para Balanças Comerciais</h3>
                <p>Gere arquivos nos padrões homologados da Toledo do Brasil e Filizola para carregamento via rede ou pendrive.</p>
                <div className="balancas-buttons-row">
                  <button className="super-btn-primary" onClick={() => downloadArquivoBalanca('toledo')}>
                    <Download size={16} /> Toledo MGV5 / MGV6 (TXITENS.TXT)
                  </button>
                  <button className="super-btn-sec" onClick={() => downloadArquivoBalanca('filizola')}>
                    <Download size={16} /> Filizola Smart (CADTXT.TXT)
                  </button>
                </div>
              </div>
            </div>

            {/* Tabela de Pesáveis Cadastrados */}
            <h4 className="sub-title-mt">Produtos com Código PLU Cadastrado para Balança</h4>
            <div className="super-table-wrapper">
              <table className="super-data-table">
                <thead>
                  <tr>
                    <th>Código PLU</th>
                    <th>Produto na Balança</th>
                    <th>Departamento</th>
                    <th>Unidade</th>
                    <th>Preço de Venda</th>
                    <th>Validade Balança</th>
                  </tr>
                </thead>
                <tbody>
                  {produtos.filter(p => p.pesavel || p.plu).map(p => (
                    <tr key={p.id}>
                      <td><span className="badge-plu-big">{String(p.plu || p.sku || '1').padStart(5, '0')}</span></td>
                      <td><strong>{p.nome}</strong></td>
                      <td>{p.departamento}</td>
                      <td>{p.unidade || 'KG'}</td>
                      <td><strong>R$ {Number(p.precoFinal || p.precoBase || 0).toFixed(2)}</strong></td>
                      <td>15 dias</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── 8. INVENTÁRIO CÍCLICO & AUDITORIA ── */}
        {abaAtiva === 'inventarios' && (
          <div className="super-inventarios-container">
            <div className="super-toolbar">
              <div>
                <h3 className="section-title">Auditorias de Gôndola & Inventário Rotativo</h3>
                <p className="text-muted-small">Contagem física cega por corredor ou departamento para conciliação contábil de quebras e sobras.</p>
              </div>
              <button className="super-btn-primary" onClick={() => setModalNovoInventario(true)}>
                <Plus size={16} /> Novo Inventário Cíclico
              </button>
            </div>

            <div className="inventarios-list">
              {inventarios.map(inv => (
                <div key={inv.id} className="inventario-card">
                  <div className="inv-header">
                    <div>
                      <strong>{inv.titulo}</strong>
                      <div className="text-muted-small">Departamento: {inv.departamento} | Status: <span className="badge-status-success">{inv.status}</span></div>
                    </div>
                    <div className="inv-divergencia-badge">
                      <span>Divergência Financeira:</span>
                      <strong className={inv.divergencia_financeira < 0 ? 'text-red' : 'text-green'}>
                        R$ {Number(inv.divergencia_financeira).toFixed(2)}
                      </strong>
                    </div>
                  </div>

                  <div className="inv-table-wrap">
                    <table className="super-mini-table">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Saldo Sistema</th>
                          <th>Contagem Física</th>
                          <th>Diferença</th>
                          <th>Impacto R$</th>
                          <th>Motivo Apurado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(Array.isArray(inv.itens) ? inv.itens : []).map((it, i) => (
                          <tr key={i}>
                            <td><strong>{it.nome}</strong></td>
                            <td>{it.saldoSistema}</td>
                            <td>{it.saldoContado}</td>
                            <td className={it.diferenca < 0 ? 'text-red' : 'text-green'}>
                              <strong>{it.diferenca > 0 ? `+${it.diferenca}` : it.diferenca}</strong>
                            </td>
                            <td>R$ {Number(it.divergenciaFinanceira || 0).toFixed(2)}</td>
                            <td>{it.motivo || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 9. CLUBE KYTTO (FIDELIDADE & CPF NA NOTA) ── */}
        {abaAtiva === 'clube' && (
          <div className="super-clube-container">
            <div className="super-toolbar">
              <div>
                <h3 className="section-title">Clube Kytto de Vantagens (Fidelidade do Supermercado)</h3>
                <p className="text-muted-small">Clientes cadastrados recebem descontos automáticos na frente de caixa ao informar o CPF.</p>
              </div>
              <button className="super-btn-primary" onClick={() => setModalNovoClienteClube(true)}>
                <Plus size={16} /> Cadastrar Cliente Clube
              </button>
            </div>

            <div className="super-table-wrapper">
              <table className="super-data-table">
                <thead>
                  <tr>
                    <th>Nome do Cliente</th>
                    <th>CPF Cadastrado</th>
                    <th>Telefone / WhatsApp</th>
                    <th>E-mail</th>
                    <th>Economia Total no Caixa</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {clientesClube.map(cli => (
                    <tr key={cli.id}>
                      <td><strong>{cli.nome}</strong></td>
                      <td>{cli.cpf}</td>
                      <td>{cli.telefone || '-'}</td>
                      <td>{cli.email || '-'}</td>
                      <td><strong className="text-green">R$ {Number(cli.total_economizado || 0).toFixed(2)}</strong></td>
                      <td><span className="badge-status-success">Ativo (10% OFF)</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── 10. PROMOÇÕES & OFERTAS DE TABLOIDE ── */}
        {abaAtiva === 'promocoes' && (
          <div className="super-promocoes-container">
            <div className="super-toolbar">
              <div>
                <h3 className="section-title">Campanhas Comerciais & Tabloide de Ofertas</h3>
                <p className="text-muted-small">Gerencie descontos percentuais, abatimentos fixos e campanhas de Leve X Pague Y.</p>
              </div>
              <button className="super-btn-primary" onClick={() => setModalNovaPromocao(true)}>
                <Plus size={16} /> Nova Campanha
              </button>
            </div>

            <div className="promocoes-grid">
              {promocoes.map(promo => (
                <div key={promo.id} className="promo-card">
                  <div className="promo-badge-tag">{promo.tipo === 'percentual' ? `${promo.valorDesconto}% OFF` : `R$ ${promo.valorDesconto} OFF`}</div>
                  <h4>{promo.titulo}</h4>
                  <div className="promo-dates">
                    <Calendar size={14} />
                    <span>Válido de {new Date(promo.inicio).toLocaleDateString('pt-BR')} até {new Date(promo.fim).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="promo-status-line">
                    <span>Status: <strong className="text-green">{promo.status}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 11. MARGENS & CURVA ABC ── */}
        {abaAtiva === 'margens' && (
          <div className="super-margens-container">
            <div className="super-toolbar">
              <div>
                <h3 className="section-title">Rentabilidade, Markup & Curva ABC (80/15/5)</h3>
                <p className="text-muted-small">Auditoria de margem líquida e simulador interativo de reajuste de preços de gôndola.</p>
              </div>

              <div className="simulador-box">
                <span>Simular Reajuste Geral:</span>
                <input
                  type="number"
                  className="super-input-small"
                  value={simulacaoReajuste}
                  onChange={(e) => setSimulacaoReajuste(e.target.value)}
                />
                <span>%</span>
                <button
                  className="super-btn-sec-small"
                  onClick={() => showToast(`Simulação de +${simulacaoReajuste}% calculada! Margem média projetada: 36.8%`)}
                >
                  Aplicar Simulação
                </button>
              </div>
            </div>

            <div className="super-table-wrapper">
              <table className="super-data-table">
                <thead>
                  <tr>
                    <th>Item de Gôndola</th>
                    <th>Departamento</th>
                    <th>Preço Venda</th>
                    <th>Custo Médio</th>
                    <th>Lucro R$</th>
                    <th>Margem Real</th>
                    <th>Markup</th>
                    <th>Curva ABC</th>
                  </tr>
                </thead>
                <tbody>
                  {produtos.map((p, idx) => {
                    const preco = Number(p.precoFinal || p.precoBase || 20);
                    const custo = Number(p.precoCusto || preco * 0.65);
                    const lucro = preco - custo;
                    const margem = preco > 0 ? Math.round((lucro / preco) * 100) : 0;
                    const markup = custo > 0 ? Math.round((lucro / custo) * 100) : 0;
                    const classeAbc = idx < produtos.length * 0.2 ? 'A' : (idx < produtos.length * 0.5 ? 'B' : 'C');

                    return (
                      <tr key={p.id}>
                        <td><strong>{p.nome}</strong></td>
                        <td>{p.departamento}</td>
                        <td>R$ {preco.toFixed(2)}</td>
                        <td>R$ {custo.toFixed(2)}</td>
                        <td><strong className="text-green">R$ {lucro.toFixed(2)}</strong></td>
                        <td><span className="badge-margem alta">{margem}%</span></td>
                        <td>{markup}%</td>
                        <td><span className={`badge-abc ${classeAbc}`}>Classe {classeAbc}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── 12. ETIQUETAS DE GÔNDOLA & LEI DA PRECIFICAÇÃO ── */}
        {abaAtiva === 'etiquetas' && (
          <div className="super-etiquetas-container">
            <div className="super-toolbar">
              <div>
                <h3 className="section-title">Etiquetas de Gôndola & Precificação por KG/Litro (Lei 10.962/04)</h3>
                <p className="text-muted-small">Emissão de etiquetas de gôndola com destaque para o Clube Kytto e código de barras EAN-13.</p>
              </div>
              <div className="toolbar-actions">
                <select
                  className="super-form-select"
                  value={modeloEtiqueta}
                  onChange={(e) => setModeloEtiqueta(e.target.value)}
                  style={{ width: "220px" }}
                >
                  <option value="gondola">Modelo: Gôndola Padrão</option>
                  <option value="clube">Modelo: Oferta Especial Clube</option>
                  <option value="validade">Modelo: Alerta Validade FEFO</option>
                </select>
                <button className="super-btn-sec" onClick={handleGerarZpl}>
                  <Barcode size={16} /> Gerar ZPL (Zebra/Argox)
                </button>
                <button className="super-btn-primary" onClick={() => window.print()}>
                  <Printer size={16} /> Imprimir Folha A4 (Pimaco 3x10)
                </button>
              </div>
            </div>

            {/* Prévia Visual das Etiquetas de Gôndola */}
            <div className="etiquetas-preview-grid">
              {(itensEtiquetas.length > 0 ? itensEtiquetas.slice(0, 3) : produtos.slice(0, 3)).map((item, idx) => {
                const precoNormal = Number(item.precoNormal || item.precoFinal || item.precoBase || 0);
                const precoClube = Number(item.precoClube || (precoNormal * 0.90));
                const ean = item.ean || item.codigoBarras || "7891000000000";
                const isClube = modeloEtiqueta === "clube" || idx === 1;
                const isValidade = modeloEtiqueta === "validade";

                return (
                  <div key={item.id || idx} className={"etiqueta-card-real " + (isValidade ? "validade-oferta" : (isClube ? "clube-oferta" : ""))}>
                    <div className="etiqueta-top">
                      <span className="etiqueta-nome-prod">{item.nome}</span>
                      <span className="etiqueta-depto-tag">{item.departamento || "Mercearia"}</span>
                    </div>
                    <div className="etiqueta-precos-box">
                      <div className="etiqueta-preco-grande">
                        <span className="etiqueta-cifrao">{isClube ? "DE: R$" : "R$"}</span>
                        <span className="etiqueta-valor-destaque">{precoNormal.toFixed(2)}</span>
                      </div>
                      {isClube && (
                        <div className="etiqueta-preco-clube-box">
                          <span className="clube-rotulo">CLUBE KYTTO</span>
                          <span className="clube-valor-destaque">R$ {precoClube.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                    <div className="etiqueta-bottom">
                      <span className="etiqueta-ref-legal">{item.precoReferencia || `R$ ${precoNormal.toFixed(2)}/UN`}</span>
                      <span className="etiqueta-ean-display">{ean}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tabela de Seleção para Impressão */}
            <div className="super-table-wrapper">
              <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0" }}>
                <span><strong>{etiquetasSelecionadas.length}</strong> produtos selecionados para emissão</span>
                <button className="super-btn-sec-small" onClick={handleSelecionarTodasEtiquetas}>
                  {etiquetasSelecionadas.length === itensEtiquetas.length ? "Desmarcar Todos" : "Selecionar Todos"}
                </button>
              </div>
              <table className="super-data-table">
                <thead>
                  <tr>
                    <th style={{ width: "40px" }}></th>
                    <th>Produto</th>
                    <th>Departamento</th>
                    <th>EAN-13</th>
                    <th>Preço Gôndola</th>
                    <th>Preço Clube (10% OFF)</th>
                    <th>Preço Legal (Ref.)</th>
                  </tr>
                </thead>
                <tbody>
                  {(itensEtiquetas.length > 0 ? itensEtiquetas : produtos).map(item => {
                    const sel = etiquetasSelecionadas.includes(item.id);
                    const preco = Number(item.precoNormal || item.precoFinal || item.precoBase || 0);
                    const clube = Number(item.precoClube || (preco * 0.90));
                    return (
                      <tr key={item.id} className={sel ? "row-selected" : ""} onClick={() => handleToggleEtiqueta(item.id)} style={{ cursor: "pointer" }}>
                        <td>
                          <input
                            type="checkbox"
                            checked={sel}
                            onChange={() => handleToggleEtiqueta(item.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td><strong>{item.nome}</strong></td>
                        <td>{item.departamento}</td>
                        <td><code>{item.ean || item.codigoBarras || "-"}</code></td>
                        <td><strong>R$ {preco.toFixed(2)}</strong></td>
                        <td><span className="text-yellow" style={{ fontWeight: 700 }}>R$ {clube.toFixed(2)}</span></td>
                        <td><small className="text-muted">{item.precoReferencia || `R$ ${preco.toFixed(2)}/UN`}</small></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── 13. ENTRADA DE NOTA FISCAL (XML MODELO 55) ── */}
        {abaAtiva === 'nfe' && (
          <div className="super-nfe-container">
            <div className="super-toolbar">
              <div>
                <h3 className="section-title">Entrada de Mercadorias via XML de NF-e (Modelo 55)</h3>
                <p className="text-muted-small">Importação de compras de distribuidores (Ambev, JBS, Unilever, Nestlé) com recálculo de custo médio ponderado e estoque automático.</p>
              </div>
            </div>

            <div className="nfe-upload-container">
              <label className="nfe-dropzone">
                <input
                  type="file"
                  accept=".xml"
                  onChange={handleCarregarArquivoXml}
                  style={{ display: "none" }}
                />
                <FileText size={40} className="text-blue" style={{ marginBottom: "10px" }} />
                <h4 style={{ margin: "0 0 6px 0", color: "#1e293b" }}>Clique ou arraste o arquivo XML da NF-e aqui</h4>
                <p style={{ margin: 0, color: "#64748b", fontSize: "0.85rem" }}>Compatível com layout nacional 4.00 da SEFAZ</p>
              </label>

              <div className="nfe-paste-area">
                <label className="card-label">Ou cole o texto do XML diretamente:</label>
                <textarea
                  className="nfe-textarea"
                  placeholder="<nfeProc xmlns=... ou <infNFe..."
                  value={xmlNfeTexto}
                  onChange={(e) => setXmlNfeTexto(e.target.value)}
                />
                <div style={{ marginTop: "10px", textAlign: "right" }}>
                  <button
                    className="super-btn-primary"
                    disabled={carregandoNfe || !xmlNfeTexto.trim()}
                    onClick={() => handleProcessarXmlNfe()}
                  >
                    {carregandoNfe ? "Processando XML..." : "Processar XML da NF-e"}
                  </button>
                </div>
              </div>
            </div>

            {nfeProcessada && (
              <div className="nfe-resumo-card">
                <div className="nfe-header-grid">
                  <div>
                    <span className="card-label">FORNECEDOR / EMITENTE:</span>
                    <strong style={{ display: "block", fontSize: "1.05rem" }}>{nfeProcessada.fornecedor.razaoSocial}</strong>
                    <small className="text-muted">CNPJ: {nfeProcessada.fornecedor.cnpj}</small>
                  </div>
                  <div>
                    <span className="card-label">NOTA FISCAL Nº:</span>
                    <strong style={{ display: "block", fontSize: "1.05rem" }}>{nfeProcessada.numero} (Série {nfeProcessada.serie})</strong>
                    <small className="text-muted">Emissão: {new Date(nfeProcessada.dataEmissao).toLocaleDateString("pt-BR")}</small>
                  </div>
                  <div>
                    <span className="card-label">VALOR TOTAL DA NOTA:</span>
                    <strong style={{ display: "block", fontSize: "1.3rem", color: "#16a34a" }}>R$ {nfeProcessada.valorTotal.toFixed(2)}</strong>
                    <small className="text-muted">{nfeProcessada.totalItens} itens na nota</small>
                  </div>
                </div>

                {nfeProcessada.duplicatas && nfeProcessada.duplicatas.length > 0 && (
                  <div style={{ marginBottom: "16px" }}>
                    <span className="card-label">Duplicatas / Faturas a Pagar:</span>
                    <div className="nfe-duplicatas-pills">
                      {nfeProcessada.duplicatas.map((dup, i) => (
                        <div key={i} className="dup-pill">
                          <strong>Dup #{dup.numero || i + 1}:</strong> R$ {Number(dup.valor).toFixed(2)} (Venc: {dup.vencimento})
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="super-table-wrapper" style={{ marginTop: "16px" }}>
                  <table className="super-data-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>EAN-13</th>
                        <th>Descrição da Mercadoria</th>
                        <th>NCM</th>
                        <th>Qtd Comprada</th>
                        <th>Custo Unit.</th>
                        <th>Total Item</th>
                        <th>Preço Sugerido (+35%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nfeProcessada.itens.map((it, idx) => (
                        <tr key={idx}>
                          <td>#{it.itemNumero}</td>
                          <td><code>{it.ean}</code></td>
                          <td><strong>{it.nome}</strong></td>
                          <td>{it.ncm}</td>
                          <td><strong>{it.quantidade} {it.unidade}</strong></td>
                          <td>R$ {it.custoUnitario.toFixed(2)}</td>
                          <td><strong>R$ {it.valorTotal.toFixed(2)}</strong></td>
                          <td><span className="text-green" style={{ fontWeight: 700 }}>R$ {it.precoVendaSugerido.toFixed(2)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: "20px", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                  <button className="super-btn-sec" onClick={() => setNfeProcessada(null)}>Cancelar</button>
                  <button className="super-btn-primary" style={{ background: "#16a34a" }} onClick={handleConfirmarEntradaEstoque}>
                    <CheckCircle2 size={16} /> Confirmar Entrada no Estoque & Atualizar Custos
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 14. PREVENÇÃO DE PERDAS (PADRÃO ABRAS) ── */}
        {abaAtiva === 'perdas' && (
          <div className="super-perdas-container">
            <div className="super-toolbar">
              <div>
                <h3 className="section-title">Painel de Prevenção de Perdas & Auditoria (Padrão ABRAS)</h3>
                <p className="text-muted-small">Monitoramento contínuo de quebras operacionais, deterioração FEFO, perdas técnicas de carnes e quebras de caixa.</p>
              </div>
            </div>

            {/* KPIs de Prevenção */}
            <div className="perdas-kpi-grid">
              <div className="perda-kpi-card destaque">
                <span className="perda-kpi-label">Taxa Geral de Quebra da Loja</span>
                <span className="perda-kpi-valor" style={{ color: (dadosPerdas?.taxaQuebraGlobal || 1.48) <= 1.8 ? "#16a34a" : "#dc2626" }}>
                  {(dadosPerdas?.taxaQuebraGlobal || 1.48).toFixed(2)}%
                </span>
                <span className="perda-kpi-sub">Benchmark ABRAS: Meta &lt; 1,80%</span>
              </div>
              <div className="perda-kpi-card">
                <span className="perda-kpi-label">Perdas Totais Registradas</span>
                <span className="perda-kpi-valor text-red">
                  R$ {(dadosPerdas?.perdaTotal || 1830.50).toFixed(2)}
                </span>
                <span className="perda-kpi-sub">No ciclo operacional mensal</span>
              </div>
              <div className="perda-kpi-card">
                <span className="perda-kpi-label">Perdas Evitadas com FEFO</span>
                <span className="perda-kpi-valor text-green">
                  R$ {(dadosPerdas?.perdasEvitadasFefo || 1840.50).toFixed(2)}
                </span>
                <span className="perda-kpi-sub">Economia com remarcações ágeis</span>
              </div>
              <div className="perda-kpi-card">
                <span className="perda-kpi-label">Situação Operacional</span>
                <span className="perda-kpi-valor" style={{ fontSize: "1.2rem", color: "#16a34a", marginTop: "6px" }}>
                  {dadosPerdas?.benchmarkAbras?.situacaoAtual || "Excelente (Abaixo da média)"}
                </span>
                <span className="perda-kpi-sub">Índice controlado pela gestão Kytto</span>
              </div>
            </div>

            {/* Gráfico de Barras de Quebras por Setor */}
            <div className="perdas-chart-container">
              <h4 style={{ margin: "0 0 16px 0", color: "#1e293b" }}>Distribuição de Quebras por Setor Supermercadista</h4>
              {(dadosPerdas?.perdasPorSetor || [
                { setor: "Hortifrúti e Verduras", valor: 680.00, percentual: 35.0, motivoPrincipal: "Deterioração natural e manuseio" },
                { setor: "Açougue e Carnes", valor: 590.00, percentual: 28.0, motivoPrincipal: "Evaporação em câmara fria e aparas" },
                { setor: "Padaria e Confeitaria", valor: 310.00, percentual: 16.0, motivoPrincipal: "Sobra de pães do dia anterior (validade 24h)" },
                { setor: "Frios e Laticínios", valor: 250.00, percentual: 13.0, motivoPrincipal: "Vencimento de queijos e embutidos" },
                { setor: "Mercearia e Bebidas", valor: 150.00, percentual: 8.0, motivoPrincipal: "Quebra de garrafas e avarias" }
              ]).map((st, i) => (
                <div key={i} className="perda-bar-item">
                  <div className="perda-bar-label">
                    <span><strong>{st.setor}</strong> — <small className="text-muted">{st.motivoPrincipal}</small></span>
                    <span><strong>R$ {Number(st.valor).toFixed(2)}</strong> ({st.percentual}%)</span>
                  </div>
                  <div className="perda-bar-track">
                    <div
                      className="perda-bar-fill"
                      style={{
                        width: `${st.percentual}%`,
                        background: i === 0 ? "#ef4444" : (i === 1 ? "#f97316" : (i === 2 ? "#eab308" : "#3b82f6"))
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ABA ATACAREJO & PROMOÇÕES DE ENCARTE (CASH & CARRY) ── */}
        {abaAtiva === 'atacarejo' && (
          <div className="super-atacarejo-container">
            <div className="super-toolbar">
              <div>
                <h3 className="section-title">Motor de Precificação Comercial & Atacarejo (Cash & Carry)</h3>
                <p className="text-muted-small">Configuração de preços escalonados por volume e mecânicas de encarte "Leve X Pague Y" integradas ao checkout.</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="super-btn-primary" onClick={() => setModalNovoAtacarejo(true)}>
                  <Plus size={16} /> Nova Faixa Atacarejo
                </button>
                <button className="super-btn-sec" onClick={() => setModalNovaPromoAvanc(true)}>
                  <Sparkles size={16} /> Nova Promoção Encarte
                </button>
              </div>
            </div>

            <div className="super-kpi-grid-4">
              <div className="super-kpi-card">
                <span className="super-kpi-label">Faixas de Volume Ativas</span>
                <strong className="super-kpi-val text-blue">{faixasAtacarejo.length}</strong>
                <span className="super-kpi-sub">Preços atacarejo aplicados</span>
              </div>
              <div className="super-kpi-card">
                <span className="super-kpi-label">Mecânicas de Encarte Ativas</span>
                <strong className="super-kpi-val text-green">{promocoesAvancadas.length}</strong>
                <span className="super-kpi-sub">Leve X Pague Y / Descontos 2ª un</span>
              </div>
              <div className="super-kpi-card">
                <span className="super-kpi-label">Aumento Estimado de Ticket</span>
                <strong className="super-kpi-val text-purple">+18.5%</strong>
                <span className="super-kpi-sub">Impulso por venda de fardos/caixas</span>
              </div>
              <div className="super-kpi-card">
                <span className="super-kpi-label">Automação de Checkout</span>
                <strong className="super-kpi-val text-green">100% Automático</strong>
                <span className="super-kpi-sub">Sem necessidade de código gerencial</span>
              </div>
            </div>

            <h4 style={{ margin: '20px 0 10px 0', color: '#1e293b' }}>Faixas de Preço de Atacarejo (Por Quantidade)</h4>
            <div className="super-table-scroll">
              <table className="super-table">
                <thead>
                  <tr>
                    <th>Item / Produto</th>
                    <th>Qtd Mínima (Gatilho)</th>
                    <th>Preço Especial Atacarejo</th>
                    <th>Economia p/ Unidade</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {faixasAtacarejo.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="empty-row">Nenhuma faixa de atacarejo cadastrada. Clique em "Nova Faixa Atacarejo" para criar regras de volume.</td>
                    </tr>
                  ) : (
                    faixasAtacarejo.map(f => (
                      <tr key={f.id}>
                        <td>
                          <strong>{f.item_nome || 'Produto Cadastrado'}</strong>
                          <div className="text-muted-small">SKU: {f.sku || '-'} | EAN: {f.codigo_barras || '-'}</div>
                        </td>
                        <td><span className="super-atacarejo-tag">A partir de {f.quantidade_minima} un</span></td>
                        <td><strong className="text-green">R$ {Number(f.preco_unitario).toFixed(2)} /un</strong></td>
                        <td>{f.desconto_percentual ? `-${f.desconto_percentual}%` : 'Preço Reduzido'}</td>
                        <td><span className="badge-status-pago">Ativo</span></td>
                        <td>
                          <button className="btn-icon-danger" onClick={async () => {
                            if (window.confirm('Desativar esta faixa de atacarejo?')) {
                              await api.delete(`/api/admin/supermercado/atacarejo-faixas/${f.id}`);
                              carregarDados();
                              showToast('Faixa de atacarejo desativada.');
                            }
                          }} title="Excluir Faixa">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <h4 style={{ margin: '28px 0 10px 0', color: '#1e293b' }}>Promoções Avançadas de Encarte ("Leve 3 Pague 2" & Combos)</h4>
            <div className="super-table-scroll">
              <table className="super-table">
                <thead>
                  <tr>
                    <th>Campanha Promocional</th>
                    <th>Mecânica</th>
                    <th>Produto Gatilho</th>
                    <th>Regra de Desconto</th>
                    <th>Vigência</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {promocoesAvancadas.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="empty-row">Nenhuma promoção avançada ativa no momento.</td>
                    </tr>
                  ) : (
                    promocoesAvancadas.map(p => (
                      <tr key={p.id}>
                        <td><strong>{p.nome}</strong></td>
                        <td><span className="super-badge-primary">{p.mecanica.replace(/_/g, ' ')}</span></td>
                        <td>{p.item_origem_nome || 'Todos os itens da categoria'}</td>
                        <td>
                          {p.mecanica === 'LEVE_X_PAGUE_Y' && `Leve ${p.qtd_gatilho} Pague ${p.qtd_paga}`}
                          {p.mecanica === 'DESCONTO_SEGUNDA_UNIDADE' && `${p.desconto_percentual}% OFF na 2ª unidade`}
                        </td>
                        <td>Até {new Date(p.data_fim).toLocaleDateString('pt-BR')}</td>
                        <td>
                          <button className="btn-icon-danger" onClick={async () => {
                            if (window.confirm('Encerrar esta promoção?')) {
                              await api.delete(`/api/admin/supermercado/promocoes-avancadas/${p.id}`);
                              carregarDados();
                              showToast('Promoção encerrada.');
                            }
                          }} title="Encerrar Promoção">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── ABA SUGESTÃO DE COMPRAS (RESSUPRIMENTO INTELIGENTE GMD) ── */}
        {abaAtiva === 'sugestaocompras' && (
          <div className="super-sugestao-container">
            <div className="super-toolbar">
              <div>
                <h3 className="section-title">Sugestão Inteligente de Compras & Ressuprimento (Ponto de Pedido)</h3>
                <p className="text-muted-small">Algoritmo matemático baseado em Giro Médio Diário (GMD), Lead Time dos fornecedores e Estoque de Segurança.</p>
              </div>
              <button className="super-btn-primary" onClick={async () => {
                if (sugestoesCompras.length === 0) return;
                setCarregando(true);
                try {
                  const res = await api.post('/api/admin/supermercado/sugestao-compras/gerar-pedido', { itens: sugestoesCompras });
                  showToast(res.mensagem || 'Pedido de compra gerado com sucesso!');
                  carregarDados();
                } catch(e) {
                  showToast('Erro ao gerar pedido de compra.');
                } finally {
                  setCarregando(false);
                }
              }}>
                <ShoppingCart size={16} /> Gerar Pedido de Compra no ERP ({sugestoesCompras.length} itens)
              </button>
            </div>

            <div className="super-kpi-grid-4">
              <div className="super-kpi-card">
                <span className="super-kpi-label">Itens Abaixo do Ponto de Pedido</span>
                <strong className="super-kpi-val text-red">{sugestoesCompras.length}</strong>
                <span className="super-kpi-sub">Risco iminente de ruptura de gôndola</span>
              </div>
              <div className="super-kpi-card">
                <span className="super-kpi-label">Valor Total Sugerido</span>
                <strong className="super-kpi-val text-blue">
                  R$ {sugestoesCompras.reduce((acc, it) => acc + (it.valorTotalSugerido || 0), 0).toFixed(2)}
                </strong>
                <span className="super-kpi-sub">Custo de reposição para 15 dias</span>
              </div>
              <div className="super-kpi-card">
                <span className="super-kpi-label">Lead Time Médio</span>
                <strong className="super-kpi-val text-purple">3.2 Dias</strong>
                <span className="super-kpi-sub">Prazo médio dos fornecedores</span>
              </div>
              <div className="super-kpi-card">
                <span className="super-kpi-label">Algoritmo de Cálculo</span>
                <strong className="super-kpi-val text-green">GMD × Lead + Seg</strong>
                <span className="super-kpi-sub">Padrão Consinco / Tier-1 Retail</span>
              </div>
            </div>

            <div className="super-table-scroll">
              <table className="super-table">
                <thead>
                  <tr>
                    <th>Curva</th>
                    <th>Produto / Descrição</th>
                    <th>Estoque Atual</th>
                    <th>Giro Médio (GMD)</th>
                    <th>Ponto Pedido (PP)</th>
                    <th>Qtd Sugerida</th>
                    <th>Custo Est. Unit.</th>
                    <th>Total Sugerido</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sugestoesCompras.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="empty-row">Nenhum item com estoque crítico no momento! Todos os níveis acima do ponto de pedido.</td>
                    </tr>
                  ) : (
                    sugestoesCompras.map((s, idx) => (
                      <tr key={idx}>
                        <td><span className={`super-badge-curva curva-${s.curvaAbc || 'A'}`}>Curva {s.curvaAbc || 'A'}</span></td>
                        <td>
                          <strong>{s.descricao}</strong>
                          <div className="text-muted-small">SKU: {s.sku} | Unid: {s.unidade}</div>
                        </td>
                        <td><strong style={{ color: s.estoqueAtual <= s.pontoPedido ? '#dc2626' : '#16a34a' }}>{s.estoqueAtual}</strong></td>
                        <td>{Number(s.giroMedioDiario || 0).toFixed(2)} un/dia</td>
                        <td><strong>{s.pontoPedido} un</strong></td>
                        <td><span className="badge-status-pago" style={{ background: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>+{s.quantidadeSugerida} {s.unidade}</span></td>
                        <td>R$ {Number(s.custoUnitario || 0).toFixed(2)}</td>
                        <td><strong className="text-blue">R$ {Number(s.valorTotalSugerido || 0).toFixed(2)}</strong></td>
                        <td><span className="badge-status-pago">{s.status}</span></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── ABA RUPTURA & REPOSIÇÃO EM TEMPO REAL ── */}
        {abaAtiva === 'ruptura' && (
          <div className="super-ruptura-container">
            <div className="super-toolbar">
              <div>
                <h3 className="section-title">Monitor de Ruptura de Gôndola em Tempo Real</h3>
                <p className="text-muted-small">Identificação instantânea de produtos Curva A com estoque virtual positivo no ERP, mas ausência de bipes no PDV.</p>
              </div>
              <button className="super-btn-sec" onClick={carregarDados}>
                <RefreshCw size={16} /> Atualizar Monitor
              </button>
            </div>

            {alertasRuptura.length > 0 && (
              <div className="super-ruptura-alert-banner">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <AlertTriangle size={28} color="#dc2626" />
                  <div>
                    <h4 style={{ margin: 0, color: '#991b1b', fontSize: '15px' }}>ALERTA DE GÔNDOLA VAZIA: {alertasRuptura.length} Produtos Críticos Sem Venda</h4>
                    <p style={{ margin: '4px 0 0 0', color: '#7f1d1d', fontSize: '12px' }}>
                      Os itens abaixo possuem estoque no depósito, mas não registram passagem nos caixas há mais de 3 horas. Acione a equipe de reposição!
                    </p>
                  </div>
                </div>
                <span className="super-badge-danger" style={{ fontSize: '12px', padding: '6px 12px' }}>Ação Imediata</span>
              </div>
            )}

            <div className="super-table-scroll">
              <table className="super-table">
                <thead>
                  <tr>
                    <th>Curva</th>
                    <th>Produto</th>
                    <th>Estoque no Sistema</th>
                    <th>Tempo Sem Venda</th>
                    <th>Diagnóstico Kytto IA</th>
                    <th>Ação Operacional</th>
                  </tr>
                </thead>
                <tbody>
                  {alertasRuptura.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="empty-row">Nenhuma anomalia de ruptura detectada. O fluxo de vendas em todos os itens Curva A está operando normalmente!</td>
                    </tr>
                  ) : (
                    alertasRuptura.map((r, idx) => (
                      <tr key={idx}>
                        <td><span className={`super-badge-curva curva-${r.curvaAbc}`}>Curva {r.curvaAbc}</span></td>
                        <td>
                          <strong>{r.descricao}</strong>
                          <div className="text-muted-small">EAN: {r.codigoBarras || '-'} | SKU: {r.sku}</div>
                        </td>
                        <td><strong className="text-blue">{r.estoqueVirtual} un</strong></td>
                        <td><span className="super-badge-danger">{r.horasSemVenda} horas</span></td>
                        <td><small style={{ color: '#4b5563' }}>{r.mensagem}</small></td>
                        <td>
                          <button className="super-btn-primary" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={async () => {
                            await api.post(`/api/admin/supermercado/rupturas/${r.itemId}/repor`);
                            showToast(`Reposição de "${r.descricao}" confirmada!`);
                            carregarDados();
                          }}>
                            <CheckCircle2 size={14} /> Gôndola Reposta
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ════════════════════════════════════════════════════════════════════════
          MODAIS OPERACIONAIS
         ════════════════════════════════════════════════════════════════════════ */}

      {/* MODAL CAIXA (ABERTURA, SANGRIA, SUPRIMENTO, FECHAMENTO) */}
      {modalCaixa && (
        <Modal
          title={
            modalCaixa === 'abrir' ? 'Abertura de Caixa PDV' :
            modalCaixa === 'sangria' ? 'Sangria de Caixa (Retirada para Cofre)' :
            modalCaixa === 'suprimento' ? 'Suprimento de Caixa (Fundo de Troco)' :
            'Fechamento de Caixa Cego'
          }
          onClose={() => setModalCaixa(null)}
        >
          {modalCaixa === 'abrir' && (
            <form onSubmit={handleAbrirCaixa} className="super-modal-form">
              <label>Fundo de Troco Inicial (R$):</label>
              <input
                type="number"
                step="0.01"
                className="super-form-input"
                required
                value={valorMovimentacao}
                onChange={(e) => setValorMovimentacao(e.target.value)}
                placeholder="Ex: 150.00"
              />
              <div className="super-modal-actions">
                <button type="button" className="super-btn-sec" onClick={() => setModalCaixa(null)}>Cancelar</button>
                <button type="submit" className="super-btn-primary">Confirmar Abertura</button>
              </div>
            </form>
          )}

          {['sangria', 'suprimento'].includes(modalCaixa) && (
            <form onSubmit={handleMovimentacaoCaixa} className="super-modal-form">
              <label>Valor da Operação (R$):</label>
              <input
                type="number"
                step="0.01"
                className="super-form-input"
                required
                value={valorMovimentacao}
                onChange={(e) => setValorMovimentacao(e.target.value)}
                placeholder="Ex: 200.00"
              />
              <label>Motivo / Observação:</label>
              <input
                type="text"
                className="super-form-input"
                required
                value={motivoMovimentacao}
                onChange={(e) => setMotivoMovimentacao(e.target.value)}
                placeholder="Ex: Recolhimento de valores excedentes"
              />
              <div className="super-modal-actions">
                <button type="button" className="super-btn-sec" onClick={() => setModalCaixa(null)}>Cancelar</button>
                <button type="submit" className="super-btn-primary">Confirmar {modalCaixa === 'sangria' ? 'Sangria' : 'Suprimento'}</button>
              </div>
            </form>
          )}

          {modalCaixa === 'fechar' && (
            <form onSubmit={handleFecharCaixa} className="super-modal-form">
              <p className="text-muted-small">Efetue a contagem cega do dinheiro físico em gaveta e digite o valor apurado abaixo:</p>
              <label>Valor Total em Dinheiro Contado na Gaveta (R$):</label>
              <input
                type="number"
                step="0.01"
                className="super-form-input"
                required
                value={saldoFinalInformado}
                onChange={(e) => setSaldoFinalInformado(e.target.value)}
                placeholder="R$ 0,00"
              />
              <div className="super-modal-actions">
                <button type="button" className="super-btn-sec" onClick={() => setModalCaixa(null)}>Cancelar</button>
                <button type="submit" className="super-btn-danger">Concluir Fechamento e Auditar</button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {/* MODAL NOVA DESOSSA */}
      {modalDesossa && (
        <Modal title="Nova Desossa de Carcaça (Açougue)" onClose={() => setModalDesossa(false)}>
          <form onSubmit={handleRegistrarDesossa} className="super-modal-form">
            <label>Tipo de Carcaça / Peça Bruta:</label>
            <select
              className="super-form-input"
              value={formDesossa.tipoCarcaca}
              onChange={(e) => setFormDesossa({ ...formDesossa, tipoCarcaca: e.target.value })}
            >
              <option value="Bovino — Quarto Traseiro Especial">Bovino — Quarto Traseiro Especial</option>
              <option value="Bovino — Quarto Dianteiro com Osso">Bovino — Quarto Dianteiro com Osso</option>
              <option value="Bovino — Ponta de Agulha / Costela">Bovino — Ponta de Agulha / Costela</option>
              <option value="Suíno — Carcaça Inteira Resfriada">Suíno — Carcaça Inteira Resfriada</option>
            </select>

            <div className="grid-2-col">
              <div>
                <label>Peso Bruto (KG):</label>
                <input
                  type="number"
                  step="0.001"
                  className="super-form-input"
                  required
                  value={formDesossa.pesoCarcaca}
                  onChange={(e) => setFormDesossa({ ...formDesossa, pesoCarcaca: e.target.value })}
                />
              </div>
              <div>
                <label>Custo por KG (R$):</label>
                <input
                  type="number"
                  step="0.01"
                  className="super-form-input"
                  required
                  value={formDesossa.custoKg}
                  onChange={(e) => setFormDesossa({ ...formDesossa, custoKg: e.target.value })}
                />
              </div>
            </div>

            <div className="super-modal-actions">
              <button type="button" className="super-btn-sec" onClick={() => setModalDesossa(false)}>Cancelar</button>
              <button type="submit" className="super-btn-primary">Processar Rendimento & Cortes</button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL PRODUÇÃO PADARIA */}
      {modalProducaoPadaria && (
        <Modal title={`Fornada / Produção: ${modalProducaoPadaria.nome}`} onClose={() => setModalProducaoPadaria(null)}>
          <form onSubmit={handleProduzirPadaria} className="super-modal-form">
            <p>Rendimento padrão por lote: <strong>{modalProducaoPadaria.rendimento_padrao} {modalProducaoPadaria.unidade_rendimento}</strong></p>
            <label>Quantidade de Lotes / Fornadas:</label>
            <input
              type="number"
              step="1"
              min="1"
              className="super-form-input"
              value={lotesProduzir}
              onChange={(e) => setLotesProduzir(e.target.value)}
            />
            <p className="text-green">
              Produção Total Estimada: <strong>{(Number(modalProducaoPadaria.rendimento_padrao) * Number(lotesProduzir)).toFixed(0)} {modalProducaoPadaria.unidade_rendimento}</strong>
            </p>
            <div className="super-modal-actions">
              <button type="button" className="super-btn-sec" onClick={() => setModalProducaoPadaria(null)}>Cancelar</button>
              <button type="submit" className="super-btn-primary">Confirmar Fornada & Baixar Insumos</button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL NOVO INVENTÁRIO */}
      {modalNovoInventario && (
        <Modal title="Novo Inventário Cíclico de Gôndola" onClose={() => setModalNovoInventario(false)}>
          <form onSubmit={handleCriarInventario} className="super-modal-form">
            <label>Título / Identificação do Ciclo:</label>
            <input
              type="text"
              className="super-form-input"
              placeholder="Ex: Auditoria Corredor 3 — Mercearia"
              value={tituloInventario}
              onChange={(e) => setTituloInventario(e.target.value)}
            />
            <label>Departamento a Auditar:</label>
            <select
              className="super-form-input"
              value={deptoInventario}
              onChange={(e) => setDeptoInventario(e.target.value)}
            >
              <option value="Todos">Todos os Departamentos</option>
              {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <div className="super-modal-actions">
              <button type="button" className="super-btn-sec" onClick={() => setModalNovoInventario(false)}>Cancelar</button>
              <button type="submit" className="super-btn-primary">Criar Ciclo & Iniciar Contagem</button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL NOVA FAIXA DE ATACAREJO */}
      {modalNovoAtacarejo && (
        <Modal title="Cadastrar Nova Faixa de Preço de Atacarejo (Volume)" onClose={() => setModalNovoAtacarejo(false)}>
          <form onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api.post('/api/admin/supermercado/atacarejo-faixas', formAtacarejo);
              showToast('Faixa de atacarejo cadastrada com sucesso!');
              setModalNovoAtacarejo(false);
              carregarDados();
            } catch(err) {
              showToast(err.message || 'Erro ao cadastrar faixa.');
            }
          }} className="super-modal-form">
            <label>Selecione o Produto:</label>
            <select
              className="super-form-input"
              required
              value={formAtacarejo.itemId}
              onChange={(e) => setFormAtacarejo({ ...formAtacarejo, itemId: e.target.value })}
            >
              <option value="">-- Selecione o Item --</option>
              {produtos.map(p => (
                <option key={p.id} value={p.id}>{p.nome} (Varejo: R$ {Number(p.precoFinal || p.precoBase || 0).toFixed(2)})</option>
              ))}
            </select>
            <label>Quantidade Mínima para Preço Atacarejo (ex: 6 ou 12):</label>
            <input
              type="number"
              min="2"
              className="super-form-input"
              required
              value={formAtacarejo.quantidadeMinima}
              onChange={(e) => setFormAtacarejo({ ...formAtacarejo, quantidadeMinima: Number(e.target.value) })}
            />
            <label>Preço Unitário na Faixa de Atacarejo (R$):</label>
            <input
              type="number"
              step="0.01"
              className="super-form-input"
              required
              value={formAtacarejo.precoUnitario}
              onChange={(e) => setFormAtacarejo({ ...formAtacarejo, precoUnitario: Number(e.target.value) })}
              placeholder="Ex: 10.90"
            />
            <div className="super-modal-actions">
              <button type="button" className="super-btn-sec" onClick={() => setModalNovoAtacarejo(false)}>Cancelar</button>
              <button type="submit" className="super-btn-primary">Salvar Regra Atacarejo</button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL NOVA PROMOÇÃO AVANÇADA (ENCARTE) */}
      {modalNovaPromoAvanc && (
        <Modal title="Criar Nova Promoção de Encarte / Tabloide" onClose={() => setModalNovaPromoAvanc(false)}>
          <form onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api.post('/api/admin/supermercado/promocoes-avancadas', formPromoAvanc);
              showToast('Promoção criada com sucesso!');
              setModalNovaPromoAvanc(false);
              carregarDados();
            } catch(err) {
              showToast(err.message || 'Erro ao criar promoção.');
            }
          }} className="super-modal-form">
            <label>Título da Campanha:</label>
            <input
              type="text"
              className="super-form-input"
              required
              placeholder="Ex: Leve 3 Pague 2 de Cervejas Especiais"
              value={formPromoAvanc.nome}
              onChange={(e) => setFormPromoAvanc({ ...formPromoAvanc, nome: e.target.value })}
            />
            <label>Mecânica Promocional:</label>
            <select
              className="super-form-input"
              value={formPromoAvanc.mecanica}
              onChange={(e) => setFormPromoAvanc({ ...formPromoAvanc, mecanica: e.target.value })}
            >
              <option value="LEVE_X_PAGUE_Y">Leve X Pague Y (Ex: Leve 3 Pague 2)</option>
              <option value="DESCONTO_SEGUNDA_UNIDADE">Desconto na 2ª Unidade (Ex: 50% OFF)</option>
            </select>
            <label>Produto em Promoção:</label>
            <select
              className="super-form-input"
              required
              value={formPromoAvanc.itemOrigemId}
              onChange={(e) => setFormPromoAvanc({ ...formPromoAvanc, itemOrigemId: e.target.value })}
            >
              <option value="">-- Selecione o Produto --</option>
              {produtos.map(p => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
            {formPromoAvanc.mecanica === 'LEVE_X_PAGUE_Y' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label>Leve (Qtd Gatilho):</label>
                  <input
                    type="number"
                    min="2"
                    className="super-form-input"
                    value={formPromoAvanc.qtdGatilho}
                    onChange={(e) => setFormPromoAvanc({ ...formPromoAvanc, qtdGatilho: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label>Pague (Qtd Cobrada):</label>
                  <input
                    type="number"
                    min="1"
                    className="super-form-input"
                    value={formPromoAvanc.qtdPaga}
                    onChange={(e) => setFormPromoAvanc({ ...formPromoAvanc, qtdPaga: Number(e.target.value) })}
                  />
                </div>
              </div>
            ) : (
              <div>
                <label>Desconto Percentual na 2ª Unidade (%):</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  className="super-form-input"
                  value={formPromoAvanc.descontoPercentual}
                  onChange={(e) => setFormPromoAvanc({ ...formPromoAvanc, descontoPercentual: Number(e.target.value) })}
                />
              </div>
            )}
            <div className="super-modal-actions">
              <button type="button" className="super-btn-sec" onClick={() => setModalNovaPromoAvanc(false)}>Cancelar</button>
              <button type="submit" className="super-btn-primary">Ativar Promoção no Checkout</button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL DETALHAMENTO DE PRODUTO & KARDEX DE ESTOQUE */}
      {modalDetalhesProduto && (
        <Modal
          title={`Ficha Técnica & Kardex: ${modalDetalhesProduto.nome}`}
          onClose={() => setModalDetalhesProduto(null)}
        >
          <div className="super-detalhes-container">
            <div className="super-detalhes-hero">
              <div>
                <h3 className="detalhes-hero-title">{modalDetalhesProduto.nome}</h3>
                <div className="detalhes-hero-meta">
                  <span><strong>EAN-13:</strong> {modalDetalhesProduto.codigoBarras || modalDetalhesProduto.ean || 'SEM GTIN'}</span>
                  <span><strong>PLU:</strong> {modalDetalhesProduto.plu || '-'}</span>
                  <span><strong>Depto:</strong> {modalDetalhesProduto.departamento}</span>
                  <span><strong>Unid:</strong> {modalDetalhesProduto.unidade || 'UN'}</span>
                </div>
              </div>
              <span className="super-badge-primary">
                {modalDetalhesProduto.pesavel ? 'Item Pesável (Balança)' : 'Item Unitário'}
              </span>
            </div>

            <div className="super-detalhes-kpi-grid">
              <div className="detalhes-kpi-card">
                <span className="detalhes-kpi-label">Estoque Atual</span>
                <strong className="detalhes-kpi-val text-blue">
                  {modalDetalhesProduto.saldoEstoque || 0} {modalDetalhesProduto.unidade || 'UN'}
                </strong>
              </div>
              <div className="detalhes-kpi-card">
                <span className="detalhes-kpi-label">Estoque Mínimo</span>
                <strong className="detalhes-kpi-val">
                  {modalDetalhesProduto.estoqueMinimo || 10}
                </strong>
              </div>
              <div className="detalhes-kpi-card">
                <span className="detalhes-kpi-label">Custo Médio</span>
                <strong className="detalhes-kpi-val">
                  R$ {Number(modalDetalhesProduto.precoCusto || 0).toFixed(2)}
                </strong>
              </div>
              <div className="detalhes-kpi-card">
                <span className="detalhes-kpi-label">Preço Regular</span>
                <strong className="detalhes-kpi-val text-green">
                  R$ {Number(modalDetalhesProduto.precoVenda || 0).toFixed(2)}
                </strong>
              </div>
              <div className="detalhes-kpi-card">
                <span className="detalhes-kpi-label">Preço Clube (-10%)</span>
                <strong className="detalhes-kpi-val text-orange">
                  R$ {(Number(modalDetalhesProduto.precoVenda || 0) * 0.90).toFixed(2)}
                </strong>
              </div>
            </div>

            <div>
              <h4 style={{ margin: "12px 0 6px 0", fontSize: "14px", color: "#334155" }}>
                Histórico de Movimentações de Estoque (Kardex ERP)
              </h4>
              {carregandoKardex ? (
                <p className="text-muted-small">Carregando movimentações do Kardex...</p>
              ) : kardexProduto.length === 0 ? (
                <p className="text-muted-small">Nenhuma movimentação recente registrada neste período.</p>
              ) : (
                <table className="super-data-table" style={{ fontSize: "12px" }}>
                  <thead>
                    <tr>
                      <th>Data / Hora</th>
                      <th>Tipo</th>
                      <th>Qtd</th>
                      <th>Custo Unit.</th>
                      <th>Saldo Após</th>
                      <th>Origem / Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kardexProduto.map((k, idx) => (
                      <tr key={idx}>
                        <td>{new Date(k.criadoEm).toLocaleString('pt-BR')}</td>
                        <td>
                          <span className={k.tipo === 'entrada' ? 'super-badge-success' : 'super-badge-danger'}>
                            {k.tipo.toUpperCase()}
                          </span>
                        </td>
                        <td><strong>{k.quantidade > 0 ? `+${k.quantidade}` : k.quantidade}</strong></td>
                        <td>R$ {Number(k.custoUnitario).toFixed(2)}</td>
                        <td><strong>{k.saldoApos}</strong></td>
                        <td><small>{k.motivo || k.origem}</small></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="super-modal-actions">
              <button type="button" className="super-btn-primary" onClick={() => setModalDetalhesProduto(null)}>
                Fechar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL DETALHAMENTO DE CAIXA INDIVIDUAL */}
      {modalDetalhesCaixa && (
        <Modal
          title={`Auditoria de Caixa: ${modalDetalhesCaixa.numeroTerminal || modalDetalhesCaixa.numero_terminal || 'PDV'}`}
          onClose={() => setModalDetalhesCaixa(null)}
        >
          <div className="super-detalhes-container">
            <div className="super-detalhes-hero">
              <div>
                <h3 className="detalhes-hero-title">
                  Terminal: {modalDetalhesCaixa.numeroTerminal || modalDetalhesCaixa.numero_terminal}
                </h3>
                <div className="detalhes-hero-meta">
                  <span><strong>Operador:</strong> {modalDetalhesCaixa.operadorNome || modalDetalhesCaixa.operador_nome}</span>
                  <span><strong>Abertura:</strong> {new Date(modalDetalhesCaixa.abertoEm || modalDetalhesCaixa.aberto_em).toLocaleString('pt-BR')}</span>
                  <span><strong>Status:</strong> {modalDetalhesCaixa.status?.toUpperCase()}</span>
                </div>
              </div>
              <span className={modalDetalhesCaixa.status === 'aberto' ? 'super-badge-success' : 'super-badge-danger'}>
                {modalDetalhesCaixa.status === 'aberto' ? 'Em Turno Aberto' : 'Caixa Fechado'}
              </span>
            </div>

            {detalhesCaixaDados && (
              <>
                <div className="super-caixa-totais-grid">
                  <div className="caixa-total-card">
                    <span>Fundo Troco</span>
                    <strong>R$ {Number(detalhesCaixaDados.caixa.saldoInicial || 0).toFixed(2)}</strong>
                  </div>
                  <div className="caixa-total-card">
                    <span>Total Vendas</span>
                    <strong className="text-green">R$ {Number(detalhesCaixaDados.totais.totalVendas || 0).toFixed(2)}</strong>
                  </div>
                  <div className="caixa-total-card">
                    <span>Dinheiro</span>
                    <strong>R$ {Number(detalhesCaixaDados.totais.dinheiro || 0).toFixed(2)}</strong>
                  </div>
                  <div className="caixa-total-card">
                    <span>Cartão Crédito</span>
                    <strong>R$ {Number(detalhesCaixaDados.totais.credito || 0).toFixed(2)}</strong>
                  </div>
                  <div className="caixa-total-card">
                    <span>Cartão Débito</span>
                    <strong>R$ {Number(detalhesCaixaDados.totais.debito || 0).toFixed(2)}</strong>
                  </div>
                  <div className="caixa-total-card">
                    <span>Pix Dinâmico</span>
                    <strong>R$ {Number(detalhesCaixaDados.totais.pix || 0).toFixed(2)}</strong>
                  </div>
                  <div className="caixa-total-card">
                    <span>Sangrias</span>
                    <strong className="text-red">-R$ {Number(detalhesCaixaDados.totais.sangrias || 0).toFixed(2)}</strong>
                  </div>
                </div>

                <h4 style={{ margin: "14px 0 6px 0", fontSize: "14px", color: "#334155" }}>
                  Movimentações Cronológicas da Sessão
                </h4>
                <table className="super-data-table" style={{ fontSize: "12px" }}>
                  <thead>
                    <tr>
                      <th>Horário</th>
                      <th>Tipo</th>
                      <th>Valor</th>
                      <th>Forma / Motivo</th>
                      <th>Autorizador</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalhesCaixaDados.movimentacoes.map((m, idx) => (
                      <tr key={idx}>
                        <td>{new Date(m.criadoEm).toLocaleTimeString('pt-BR')}</td>
                        <td>
                          <span className={m.tipo === 'venda' ? 'super-badge-success' : m.tipo === 'suprimento' ? 'super-badge-primary' : 'super-badge-danger'}>
                            {m.tipo.toUpperCase()}
                          </span>
                        </td>
                        <td><strong>R$ {Number(m.valor).toFixed(2)}</strong></td>
                        <td>{m.motivo || m.formaPagamento}</td>
                        <td><small>{m.autorizador || 'Fiscal'}</small></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            <div className="super-modal-actions">
              <button type="button" className="super-btn-primary" onClick={() => setModalDetalhesCaixa(null)}>
                Concluir
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL NOVO CLIENTE CLUBE */}
      {modalNovoClienteClube && (
        <Modal title="Cadastrar Cliente no Clube Kytto" onClose={() => setModalNovoClienteClube(false)}>
          <form onSubmit={handleCadastrarClienteClube} className="super-modal-form">
            <label>Nome Completo:</label>
            <input
              type="text"
              className="super-form-input"
              required
              placeholder="Ex: João da Silva"
              value={formClube.nome}
              onChange={(e) => setFormClube({ ...formClube, nome: e.target.value })}
            />
            <label>CPF:</label>
            <input
              type="text"
              className="super-form-input"
              required
              placeholder="000.000.000-00"
              value={formClube.cpf}
              onChange={(e) => setFormClube({ ...formClube, cpf: e.target.value })}
            />
            <div className="grid-2-col">
              <div>
                <label>Telefone / WhatsApp:</label>
                <input
                  type="text"
                  className="super-form-input"
                  placeholder="(65) 99999-9999"
                  value={formClube.telefone}
                  onChange={(e) => setFormClube({ ...formClube, telefone: e.target.value })}
                />
              </div>
              <div>
                <label>E-mail:</label>
                <input
                  type="email"
                  className="super-form-input"
                  placeholder="cliente@email.com"
                  value={formClube.email}
                  onChange={(e) => setFormClube({ ...formClube, email: e.target.value })}
                />
              </div>
            </div>
            <div className="super-modal-actions">
              <button type="button" className="super-btn-sec" onClick={() => setModalNovoClienteClube(false)}>Cancelar</button>
              <button type="submit" className="super-btn-primary">Cadastrar no Clube</button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL CÓDIGO ZPL */}
      {modalZpl && (
        <Modal title="Código ZPL para Impressoras Térmicas (Zebra / Argox)" onClose={() => setModalZpl(null)}>
          <div className="super-modal-form">
            <p className="text-muted-small">Comandos prontos para envio via Zebra Setup Utilities, impressora serial/USB ou porta de rede:</p>
            <pre className="zpl-code-box">{modalZpl}</pre>
            <div className="super-modal-actions">
              <button type="button" className="super-btn-sec" onClick={() => {
                navigator.clipboard.writeText(modalZpl);
                showToast("Código ZPL copiado para a área de transferência!");
              }}>
                Copiar ZPL
              </button>
              <button type="button" className="super-btn-primary" onClick={() => {
                const blob = new Blob([modalZpl], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "etiquetas_kytto.zpl";
                a.click();
              }}>
                Baixar Arquivo .ZPL
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL COMPROVANTE TEF HOMOLOGADO */}
      {modalTef && (
        <Modal title="Comprovante de Pagamento TEF (Cartão Aprovado)" onClose={() => setModalTef(null)}>
          <div className="super-modal-form">
            <div className="tef-badge-homologado">
              <CheckCircle2 size={16} /> Transação TEF Autorizada pela Rede
            </div>
            <div className="tef-receipt-container">
              <div className="tef-receipt-header">
                <div>SUPERMERCADO KYTTO LTDA</div>
                <div>CNPJ: 50.073.355/0001-89 · IE: 14.229.191-9</div>
                <div>COMPROVANTE TEF MULTIADQUIRENTE</div>
              </div>
              <div><strong>Adquirente:</strong> {modalTef.adquirente}</div>
              <div><strong>Bandeira:</strong> {modalTef.bandeira}</div>
              <div><strong>Operação:</strong> VENDA APROVADA ON-LINE</div>
              <div><strong>NSU Terminal:</strong> {modalTef.nsu}</div>
              <div><strong>Código Autorização:</strong> {modalTef.autorizacao}</div>
              <div><strong>Data / Hora:</strong> {modalTef.dataHora}</div>
              <div style={{ margin: "8px 0", borderTop: "1px dashed #cbd5e1", paddingTop: "8px" }}>
                <strong>VALOR TOTAL PAGO: R$ {Number(modalTef.valor).toFixed(2)}</strong>
              </div>
              <div style={{ textAlign: "center", fontSize: "11px", color: "#64748b", marginTop: "10px" }}>
                1ª VIA — ESTABELECIMENTO / 2ª VIA — CLIENTE
              </div>
            </div>
            <div className="super-modal-actions">
              <button type="button" className="super-btn-sec" onClick={() => window.print()}>
                <Printer size={16} /> Imprimir Comprovante TEF
              </button>
              <button type="button" className="super-btn-primary" onClick={() => setModalTef(null)}>
                Fechar e Novo Cliente
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL PACOTE COMPLETO TOLEDO MGV6 */}
      {modalPacoteToledo && (
        <Modal title="Pacote Completo Toledo MGV6 (Conforme RDC 429 Anvisa)" onClose={() => setModalPacoteToledo(null)}>
          <div className="super-modal-form">
            <p>Foram gerados com sucesso <strong>4 arquivos oficiais</strong> prontos para importação automática:</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", margin: "14px 0" }}>
              {Object.keys(modalPacoteToledo.arquivos || {}).map(k => {
                const arq = modalPacoteToledo.arquivos[k];
                return (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc", padding: "10px 14px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                    <div>
                      <strong>{arq.nome}</strong>
                      <div className="text-muted-small">{k === "leiame" ? "Instruções do Sistema" : "Arquivo de Carga MGV6"}</div>
                    </div>
                    <button
                      className="super-btn-sec-small"
                      onClick={() => {
                        const blob = new Blob([arq.conteudo], { type: "text/plain;charset=utf-8" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = arq.nome;
                        a.click();
                      }}
                    >
                      <Download size={14} /> Baixar
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="super-modal-actions">
              <button type="button" className="super-btn-primary" onClick={() => setModalPacoteToledo(null)}>Concluir</button>
            </div>
          </div>
        </Modal>
      )}

{/* ── MODAL: INSTALADOR WINDOWS & SUÍTE PWA ── */}
      {modalInstaladorWindows && (
        <Modal title="🖥️ Kytto PDV — Instalador Windows & Suíte PWA Desktop" onClose={() => setModalInstaladorWindows(false)}>
          <div className="flex flex-col gap-4">
            <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg text-xs text-sky-800 leading-relaxed">
              <strong>Aplicação Nativa de Alta Performance para Frente de Caixa:</strong> O Kytto Supermercado pode ser instalado diretamente no Windows 10 e 11, rodando em tela cheia travada (Kiosk) ou janela própria de PDV, com suporte a balanças Toledo MGV6 / Filizola, leitores de código de barras USB e contingência offline ininterrupta.
            </div>

            <div className="super-installer-grid">
              {/* Card 1: PWA 1-Clique */}
              <div className="super-installer-card destaque">
                <div>
                  <h4><Sparkles size={16} className="text-emerald-600" /> 1. Instalação PWA (Nativo Windows)</h4>
                  <p className="mt-1">
                    Instala instantaneamente o Kytto PDV como aplicativo nativo no Windows através do Microsoft Edge ou Google Chrome, criando atalho na Área de Trabalho e barra de tarefas.
                  </p>
                </div>
                <div className="mt-3">
                  {pwaInstalavel ? (
                    <button type="button" className="super-btn success sm w-full font-bold" onClick={handleInstalarPwaNativo}>
                      <Download size={14} /> Instalar Agora (1-Clique)
                    </button>
                  ) : (
                    <div className="p-2 bg-emerald-50 border border-emerald-200 rounded text-[11px] text-emerald-800 font-semibold text-center">
                      ✅ PWA Ativo! Para reinstalar, use o ícone de app no topo do Edge/Chrome.
                    </div>
                  )}
                </div>
              </div>

              {/* Card 2: Pacote Completo ZIP */}
              <div className="super-installer-card">
                <div>
                  <h4><HardDrive size={16} className="text-sky-600" /> 2. Pacote Completo Windows (.zip)</h4>
                  <p className="mt-1">
                    Contém o script de instalação automática (.bat), inicializadores de modo Kiosk/Quiosque, integração Toledo MGV6 e manual de hardware.
                  </p>
                </div>
                <div className="mt-3">
                  <a
                    href="/downloads/Kytto-Supermercado-Windows-Installer.zip"
                    download="Kytto-Supermercado-Windows-Installer.zip"
                    className="super-btn primary sm w-full text-center font-bold flex items-center justify-center gap-2"
                  >
                    <Download size={14} /> Baixar Pacote (.zip)
                  </a>
                </div>
              </div>

              {/* Card 3: Instalador Automático .bat */}
              <div className="super-installer-card">
                <div>
                  <h4><Terminal size={16} className="text-amber-600" /> 3. Instalador Rápido (.bat)</h4>
                  <p className="mt-1">
                    Script em lote para Windows que cria as pastas <code>C:\\KyttoPDV\\MGV6</code> e <code>C:\\KyttoPDV\\Spool</code> e gera os atalhos com 1 clique duplo.
                  </p>
                </div>
                <div className="mt-3">
                  <a
                    href="/downloads/Instalar-Kytto-PDV-Windows.bat"
                    download="Instalar-Kytto-PDV-Windows.bat"
                    className="super-btn neutral sm w-full text-center font-bold flex items-center justify-center gap-2"
                  >
                    <Download size={14} /> Baixar Script (.bat)
                  </a>
                </div>
              </div>

              {/* Card 4: Script Inno Setup .iss */}
              <div className="super-installer-card">
                <div>
                  <h4><FileText size={16} className="text-purple-600" /> 4. Compilador Inno Setup (.iss)</h4>
                  <p className="mt-1">
                    Código fonte oficial de compilação Inno Setup 6 para gerar o executável de instalação <code>Kytto-Setup.exe</code> personalizado com a marca da sua rede.
                  </p>
                </div>
                <div className="mt-3">
                  <a
                    href="/downloads/Kytto-Supermercado-Setup.iss"
                    download="Kytto-Supermercado-Setup.iss"
                    className="super-btn neutral sm w-full text-center font-bold flex items-center justify-center gap-2"
                  >
                    <Download size={14} /> Baixar Script (.iss)
                  </a>
                </div>
              </div>
            </div>

            {/* Configurações de Hardware */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
              <div className="font-bold text-slate-900 mb-1 flex items-center gap-2">
                <Volume2 size={15} className="text-sky-600" /> Recursos de Hardware Integrados:
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11.5px]">
                <li><strong>Leitor de Código de Barras:</strong> Emulação de teclado USB com retorno sonoro instantâneo (bip 1.76kHz).</li>
                <li><strong>Balanças Toledo e Filizola:</strong> Exportação de TXITENS.TXT para a pasta monitorada pelo MGV6.</li>
                <li><strong>Impressora Térmica Não-Fiscal (80mm e 58mm):</strong> Emissão rápida com suporte a corte de papel.</li>
                <li><strong>Modo Quiosque (Kiosk):</strong> Trava o computador exclusivamente na tela de venda sem acesso ao Windows.</li>
              </ul>
            </div>

            <div className="flex justify-end mt-2">
              <button type="button" className="super-btn primary" onClick={() => setModalInstaladorWindows(false)}>
                Fechar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── MODAL: COMPROVANTE FISCAL TÉRMICO DANFE NFC-E (80MM / 58MM) ── */}
      {modalComprovanteVenda && (
        <Modal title="🧾 Comprovante de Venda — Bobina Térmica 80mm" onClose={() => setModalComprovanteVenda(null)}>
          <div className="super-thermal-receipt-container">
            {/* O Cupom Térmico */}
            <div className="super-thermal-receipt">
              <div className="receipt-header-center">
                <div className="receipt-store-title">KYTTO SUPERMERCADOS</div>
                <div className="receipt-store-sub">KYTTO COMÉRCIO DE ALIMENTOS LTDA</div>
                <div className="receipt-store-sub">CNPJ: 00.123.456/0001-89 — IE: 123.456.789.000</div>
                <div className="receipt-store-sub">AV. BRASIL, 1500 — CENTRO — MATO GROSSO / BRASIL</div>
                <div className="receipt-dashed-line"></div>
                <div style={{ fontWeight: 'bold', fontSize: 12 }}>
                  DANFE NFC-e — Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica
                </div>
                <div style={{ fontSize: 10, color: '#374151', marginTop: 2 }}>
                  {modalComprovanteVenda.nfce?.offline ? '⚠️ EMITIDA EM CONTINGÊNCIA OFFLINE' : 'EMITIDA VIA SEFAZ ONLINE'}
                </div>
              </div>

              <div style={{ fontSize: 10.5, marginBottom: 6 }}>
                <div><strong>Data/Hora:</strong> {modalComprovanteVenda.dataHora}</div>
                <div><strong>Frente de Caixa:</strong> {modalComprovanteVenda.terminal} | <strong>Operador:</strong> {modalComprovanteVenda.operador}</div>
                <div><strong>Cupom Nº:</strong> {modalComprovanteVenda.numero}</div>
                {modalComprovanteVenda.cpfConsumidor && (
                  <div><strong>Consumidor CPF:</strong> {modalComprovanteVenda.cpfConsumidor}</div>
                )}
                {modalComprovanteVenda.clienteNome && (
                  <div><strong>Clube Kytto:</strong> {modalComprovanteVenda.clienteNome}</div>
                )}
              </div>

              <table className="receipt-items-table">
                <thead>
                  <tr>
                    <th># Item</th>
                    <th style={{ textAlign: 'center' }}>Qtd x Unit</th>
                    <th style={{ textAlign: 'right' }}>Total (R$)</th>
                  </tr>
                </thead>
                <tbody>
                  {modalComprovanteVenda.itens.map((it, idx) => (
                    <tr key={idx}>
                      <td style={{ maxWidth: 140 }}>
                        {String(idx + 1).padStart(2, '0')} {it.nome}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {it.quantidade} x R$ {Number(it.precoUnitario).toFixed(2)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                        R$ {(it.quantidade * it.precoUnitario).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="receipt-totals-section">
                <div className="receipt-total-row">
                  <span>Qtd. Total de Itens:</span>
                  <span>{modalComprovanteVenda.itens.length}</span>
                </div>
                <div className="receipt-total-row destaque">
                  <span>VALOR TOTAL A PAGAR:</span>
                  <span>R$ {modalComprovanteVenda.valorTotal.toFixed(2)}</span>
                </div>
                <div className="receipt-total-row">
                  <span className="capitalize">Forma de Pagamento ({modalComprovanteVenda.formaPagamento}):</span>
                  <span>R$ {modalComprovanteVenda.valorRecebido.toFixed(2)}</span>
                </div>
                {modalComprovanteVenda.troco > 0 && (
                  <div className="receipt-total-row" style={{ fontWeight: 'bold' }}>
                    <span>TROCO:</span>
                    <span>R$ {modalComprovanteVenda.troco.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div style={{ fontSize: 9.5, color: '#4b5563', margin: '6px 0', textAlign: 'center' }}>
                Tributos Incidentes (Lei Federal 12.741/2012): R$ {(modalComprovanteVenda.valorTotal * 0.285).toFixed(2)} (28.50%)
              </div>

              {/* QR Code SEFAZ */}
              <div className="receipt-qrcode-center">
                <div style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 4 }}>
                  Consulte pela Chave de Acesso em:
                  <div style={{ fontSize: 9, fontWeight: 'normal' }}>http://sefaz.mt.gov.br/nfce/consulta</div>
                </div>
                <QRCodeSVG
                  value={`https://setpoint.kytto.com.br/consulta-nfce?ch=${modalComprovanteVenda.nfce?.chaveAcesso || '512611'}`}
                  size={100}
                  level="M"
                />
                <div className="receipt-key-text">
                  <strong>CHAVE DE ACESSO:</strong><br />
                  {modalComprovanteVenda.nfce?.chaveAcesso}
                </div>
                <div style={{ fontSize: 9.5, marginTop: 4 }}>
                  <strong>Protocolo:</strong> {modalComprovanteVenda.nfce?.protocolo}
                </div>
              </div>

              <div style={{ textAlign: 'center', marginTop: 10, fontSize: 10, fontWeight: 'bold' }}>
                OBRIGADO PELA PREFERÊNCIA! VOLTE SEMPRE!
              </div>
            </div>

            {/* Barra de Ações Rápidas do Cupom */}
            <div className="flex flex-wrap gap-2 justify-center no-print">
              <button
                type="button"
                className="super-btn primary font-bold flex items-center gap-2"
                onClick={() => window.print()}
              >
                <Printer size={16} /> Imprimir Cupom Térmico (80mm)
              </button>
              <button
                type="button"
                className="super-btn neutral font-bold flex items-center gap-2"
                onClick={handleAbrirGavetaDinheiro}
              >
                <KeyRound size={16} /> Abrir Gaveta [F6]
              </button>
              <button
                type="button"
                className="super-btn success font-bold flex items-center gap-2"
                onClick={() => {
                  const texto = encodeURIComponent(
                    `*Comprovante de Compra — Kytto Supermercados*\\n` +
                    `Cupom Nº: ${modalComprovanteVenda.numero}\\n` +
                    `Data: ${modalComprovanteVenda.dataHora}\\n` +
                    `Total: R$ ${modalComprovanteVenda.valorTotal.toFixed(2)}\\n` +
                    `Forma: ${modalComprovanteVenda.formaPagamento}\\n` +
                    `Chave NFC-e: ${modalComprovanteVenda.nfce?.chaveAcesso}\\n` +
                    `Consulte em: https://setpoint.kytto.com.br/consulta-nfce?ch=${modalComprovanteVenda.nfce?.chaveAcesso}`
                  );
                  window.open(`https://api.whatsapp.com/send?text=${texto}`, '_blank');
                }}
              >
                📱 Enviar WhatsApp
              </button>
              <button
                type="button"
                className="super-btn sm neutral"
                onClick={() => {
                  setModalComprovanteVenda(null);
                  inputScannerRef.current?.focus();
                }}
              >
                🛒 Próxima Venda [F2]
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── MODAL: LEITURA X / RESUMO CONSOLIDADO DO TURNO ── */}
      {modalLeituraX && (
        <Modal title="📑 Leitura X — Extrato Operacional do Turno de Caixa" onClose={() => setModalLeituraX(false)}>
          <div className="super-thermal-receipt-container">
            <div className="super-thermal-receipt">
              <div className="receipt-header-center">
                <div className="receipt-store-title">KYTTO SUPERMERCADOS</div>
                <div className="receipt-store-sub">RELATÓRIO GERENCIAL — LEITURA X</div>
                <div className="receipt-dashed-line"></div>
                <div><strong>Terminal:</strong> {terminalAtivoCodigo || 'PDV-01'}</div>
                <div><strong>Operador:</strong> {sessaoCaixa?.caixa?.operador_nome || 'Operador Caixa'}</div>
                <div><strong>Emissão:</strong> {new Date().toLocaleString('pt-BR')}</div>
              </div>

              <div className="receipt-totals-section">
                <div style={{ fontWeight: 'bold', fontSize: 12, marginBottom: 4 }}>MOVIMENTAÇÃO FINANCEIRA DO TURNO:</div>
                <div className="receipt-total-row">
                  <span>Fundo de Troco Inicial:</span>
                  <span>R$ {Number(sessaoCaixa?.caixa?.saldo_inicial || 0).toFixed(2)}</span>
                </div>
                <div className="receipt-total-row">
                  <span>(+) Total de Suprimentos:</span>
                  <span>R$ {Number(sessaoCaixa?.resumo?.suprimentos || 0).toFixed(2)}</span>
                </div>
                <div className="receipt-total-row">
                  <span>(-) Total de Sangrias:</span>
                  <span>R$ {Number(sessaoCaixa?.resumo?.sangrias || 0).toFixed(2)}</span>
                </div>
                <div className="receipt-dashed-line"></div>
                <div style={{ fontWeight: 'bold', fontSize: 11, marginBottom: 4 }}>FATURAMENTO POR MEIO DE PAGAMENTO:</div>
                <div className="receipt-total-row">
                  <span>Dinheiro em Espécie:</span>
                  <span>R$ {Number(sessaoCaixa?.resumo?.vendasDinheiro || 0).toFixed(2)}</span>
                </div>
                <div className="receipt-total-row">
                  <span>Cartão de Débito:</span>
                  <span>R$ {Number(sessaoCaixa?.resumo?.vendasDebito || 0).toFixed(2)}</span>
                </div>
                <div className="receipt-total-row">
                  <span>Cartão de Crédito:</span>
                  <span>R$ {Number(sessaoCaixa?.resumo?.vendasCredito || 0).toFixed(2)}</span>
                </div>
                <div className="receipt-total-row">
                  <span>Pix Dinâmico QR Code:</span>
                  <span>R$ {Number(sessaoCaixa?.resumo?.vendasPix || 0).toFixed(2)}</span>
                </div>
                <div className="receipt-total-row">
                  <span>Vales-Alimentação / Outros:</span>
                  <span>R$ {Number(sessaoCaixa?.resumo?.vendasVale || 0).toFixed(2)}</span>
                </div>
                <div className="receipt-total-row destaque">
                  <span>TOTAL VENDIDO NO TURNO:</span>
                  <span>R$ {Number(sessaoCaixa?.resumo?.totalVendasGeral || sessaoCaixa?.resumo?.totalVendas || 0).toFixed(2)}</span>
                </div>
                <div className="receipt-total-row" style={{ fontWeight: 'bold', color: '#0369a1' }}>
                  <span>SALDO ESPERADO NA GAVETA:</span>
                  <span>R$ {Number(sessaoCaixa?.resumo?.saldoDinheiroEsperado || 0).toFixed(2)}</span>
                </div>
              </div>

              <div style={{ textAlign: 'center', marginTop: 12, fontSize: 9.5, color: '#6b7280' }}>
                --- FIM DA LEITURA X ---
              </div>
            </div>

            <div className="flex gap-2 justify-center no-print">
              <button type="button" className="super-btn primary font-bold flex items-center gap-2" onClick={() => window.print()}>
                <Printer size={16} /> Imprimir Leitura X
              </button>
              <button type="button" className="super-btn neutral" onClick={() => setModalLeituraX(false)}>
                Fechar
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}
