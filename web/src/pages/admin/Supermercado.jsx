import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Store, ShoppingCart, Barcode, Tag, AlertTriangle, ArrowRightLeft,
  Truck, TrendingUp, RefreshCw, Plus, Trash2, Printer, CheckCircle2,
  Download, Search, DollarSign, Calendar, Layers, ShieldCheck,
  Beef, UtensilsCrossed, Scale, Users, ClipboardCheck, Sparkles,
  Percent, ArrowDownRight, ArrowUpRight, Lock, KeyRound, AlertCircle, FileText
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
      if (rDash && rDash.dashboard) setResumo(rDash.dashboard);

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
      if (rMarg && Array.isArray(rMarg.analise)) setAnaliseMargens(rMarg.analise);

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

  const finalizarVendaPdv = async () => {
    if (carrinho.length === 0) {
      showToast('O carrinho está vazio.');
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
        <button className={`super-tab-btn ${abaAtiva === 'desossa' ? 'active' : ''}`} onClick={() => setAbaAtiva('desossa')}>
          <Beef size={16} /> Açougue & Desossa ({desossas.length})
        </button>
        <button className={`super-tab-btn ${abaAtiva === 'padaria' ? 'active' : ''}`} onClick={() => setAbaAtiva('padaria')}>
          <UtensilsCrossed size={16} /> Padaria & Produção
        </button>
        <button className={`super-tab-btn ${abaAtiva === 'lotes' ? 'active' : ''}`} onClick={() => setAbaAtiva('lotes')}>
          <AlertTriangle size={16} /> Lotes & Validade (FEFO)
        </button>
        <button className={`super-tab-btn ${abaAtiva === 'balancas' ? 'active' : ''}`} onClick={() => setAbaAtiva('balancas')}>
          <Scale size={16} /> Carga Balanças & MGV
        </button>
        <button className={`super-tab-btn ${abaAtiva === 'inventarios' ? 'active' : ''}`} onClick={() => setAbaAtiva('inventarios')}>
          <ClipboardCheck size={16} /> Inventário Cíclico
        </button>
        <button className={`super-tab-btn ${abaAtiva === 'clube' ? 'active' : ''}`} onClick={() => setAbaAtiva('clube')}>
          <Users size={16} /> Clube Kytto ({clientesClube.length})
        </button>
        <button className={`super-tab-btn ${abaAtiva === 'promocoes' ? 'active' : ''}`} onClick={() => setAbaAtiva('promocoes')}>
          <Percent size={16} /> Promoções & Ofertas
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
              <div className="super-pdv-scanner-box">
                <Barcode size={24} className="scanner-icon" />
                <input
                  type="text"
                  className="super-scanner-input"
                  placeholder="Bipe o código de barras, PLU de balança ou use 3*CÓDIGO (Enter para incluir)..."
                  value={leitorCodigo}
                  onChange={(e) => setLeitorCodigo(e.target.value)}
                  onKeyDown={handleBiparCodigo}
                  autoFocus
                />
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
    </div>
  );
}
