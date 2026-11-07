import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Store, ShoppingCart, Barcode, Tag, AlertTriangle, ArrowRightLeft,
  Truck, TrendingUp, RefreshCw, Plus, Trash2, Printer, CheckCircle2,
  Download, Search, DollarSign, Calendar, Layers, ShieldCheck,
  Beef, UtensilsCrossed, Scale, Users, ClipboardCheck, Sparkles,
  Percent, ArrowDownRight, ArrowUpRight, Lock, KeyRound, AlertCircle, FileText, Apple, Boxes, ShieldAlert, Tv, CreditCard, Receipt, Wifi, WifiOff, Eye, ArrowUpCircle, CheckSquare, RotateCcw, History, List
} from 'lucide-react';
import { api } from '../../lib/api';
import Modal from '../../components/Modal';
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

      // 1. Dashboard
      const rDash = await api.get('/api/admin/supermercado/dashboard').catch(() => null);
      if (rDash) setResumo(rDash.dashboard || rDash);

      // 2. Produtos
      const rProd = await api.get('/api/admin/supermercado/produtos').catch(() => null);
      if (rProd && Array.isArray(rProd.produtos)) setProdutos(rProd.produtos);

      // 3. Sessão Caixa
      const rCaixa = await api.get('/api/admin/supermercado/caixa/sessao').catch(() => null);
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
      if (e.key === "F2") {
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
        adicionarAoCarrinho(prod, multiplicador);
        showToast(`Item adicionado: ${prod.nome} (${multiplicador}x)`);
      } else {
        showToast(`Produto com código "${codigoLimpo}" não encontrado no mix.`);
      }
      setLeitorCodigo('');
    }
  };

  const removerDoCarrinho = (index) => {
    setCarrinho(prev => prev.filter((_, i) => i !== index));
  };

  const totalCarrinho = useMemo(() => {
    return carrinho.reduce((acc, it) => acc + (it.precoUnitario * it.quantidade), 0);
  }, [carrinho]);

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

      setNfceEmitida({
        chaveAcesso: '512611' + String(Date.now()).padStart(38, '0').slice(-38),
        protocolo: '15126' + String(Date.now()).slice(-10) + ' (CONTINGÊNCIA)',
        total: totalCarrinho,
        offline: true
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
      setNfceEmitida(res.nfce || {
        chaveAcesso: '512611000' + String(Date.now()).padStart(35, '0'),
        protocolo: '15126000' + String(Date.now()).slice(-8),
        numero: String(Date.now()).slice(-6),
        total: totalCarrinho
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
        <button className={`super-tab-btn ${abaAtiva === 'promocoes' ? 'active' : ''}`} onClick={() => setAbaAtiva('promocoes')}>
          <Percent size={16} /> Promoções & Tabloides ({promocoes.length})
        </button>
        <button className={`super-tab-btn ${abaAtiva === 'transferencias' ? 'active' : ''}`} onClick={() => setAbaAtiva('transferencias')}>
          <ArrowRightLeft size={16} /> Transferências & CD ({transferencias.length})
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
                      carrinho.map((it, idx) => (
                        <tr key={idx}>
                          <td>
                            <strong>{it.nome}</strong>
                            <div className="text-muted-small">{it.departamento}</div>
                          </td>
                          <td>{it.quantidade.toFixed(it.unidade === 'KG' ? 3 : 0)} {it.unidade}</td>
                          <td>
                            R$ {it.precoUnitario.toFixed(2)}
                            {it.precoOriginal > it.precoUnitario && (
                              <span className="badge-desconto-clube">Clube</span>
                            )}
                          </td>
                          <td><strong>R$ {(it.precoUnitario * it.quantidade).toFixed(2)}</strong></td>
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

    </div>
  );
}
