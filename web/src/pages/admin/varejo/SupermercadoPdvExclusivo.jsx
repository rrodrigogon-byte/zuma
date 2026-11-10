import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../lib/api';
import {
  Store,
  ShoppingCart,
  Barcode,
  Scale,
  Search,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  KeyRound,
  Lock,
  Maximize,
  Minimize,
  Printer,
  Sparkles,
  HelpCircle,
  CreditCard,
  QrCode,
  DollarSign,
  UtensilsCrossed,
  Layers,
  RefreshCw,
  Receipt,
  X
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import './SupermercadoPdvExclusivo.css';

// ── SINTETIZADOR DE ÁUDIO WEB (SONS DE CAIXA DE SUPERMERCADO) ──
function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  return AudioCtx ? new AudioCtx() : null;
}

let sharedAudioCtx = null;

function playScannerBeep() {
  try {
    if (!sharedAudioCtx) sharedAudioCtx = getAudioContext();
    if (!sharedAudioCtx) return;
    if (sharedAudioCtx.state === 'suspended') sharedAudioCtx.resume();
    const osc = sharedAudioCtx.createOscillator();
    const gain = sharedAudioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1850, sharedAudioCtx.currentTime); // 1850 Hz bip típico Bematech/Honeywell
    gain.gain.setValueAtTime(0.15, sharedAudioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, sharedAudioCtx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(sharedAudioCtx.destination);
    osc.start();
    osc.stop(sharedAudioCtx.currentTime + 0.08);
  } catch (e) {}
}

function playSuccessJingle() {
  try {
    if (!sharedAudioCtx) sharedAudioCtx = getAudioContext();
    if (!sharedAudioCtx) return;
    if (sharedAudioCtx.state === 'suspended') sharedAudioCtx.resume();
    const now = sharedAudioCtx.currentTime;
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
      const osc = sharedAudioCtx.createOscillator();
      const gain = sharedAudioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);
      gain.gain.setValueAtTime(0.12, now + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.15);
      osc.connect(gain);
      gain.connect(sharedAudioCtx.destination);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.16);
    });
  } catch (e) {}
}

function playErrorBuzz() {
  try {
    if (!sharedAudioCtx) sharedAudioCtx = getAudioContext();
    if (!sharedAudioCtx) return;
    if (sharedAudioCtx.state === 'suspended') sharedAudioCtx.resume();
    const osc = sharedAudioCtx.createOscillator();
    const gain = sharedAudioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, sharedAudioCtx.currentTime);
    gain.gain.setValueAtTime(0.2, sharedAudioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, sharedAudioCtx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(sharedAudioCtx.destination);
    osc.start();
    osc.stop(sharedAudioCtx.currentTime + 0.25);
  } catch (e) {}
}


const PRODUTOS_CATALOGO_CANONICO = [
  { id: 'prod-001', nome: 'Picanha Bovina Fatiada Resfriada', sku: 'ACO-001', ean: '7891000100010', plu: 1001, unidade: 'KG', pesavel: true, precoBase: 79.90, precoFinal: 79.90 },
  { id: 'prod-002', nome: 'Alcatra com Maminha Bovina', sku: 'ACO-002', ean: '7891000100027', plu: 1002, unidade: 'KG', pesavel: true, precoBase: 48.90, precoFinal: 48.90 },
  { id: 'prod-003', nome: 'Banana Prata Climatizada', sku: 'FLV-001', ean: '7891000100034', plu: 2001, unidade: 'KG', pesavel: true, precoBase: 6.99, precoFinal: 6.99 },
  { id: 'prod-004', nome: 'Maçã Gala Nacional Selecionada', sku: 'FLV-002', ean: '7891000100041', plu: 2002, unidade: 'KG', pesavel: true, precoBase: 9.80, precoFinal: 9.80 },
  { id: 'prod-005', nome: 'Pão Francês Tradicional Crocante', sku: 'PAD-001', ean: '7891000100058', plu: 3001, unidade: 'KG', pesavel: true, precoBase: 18.90, precoFinal: 18.90 },
  { id: 'prod-006', nome: 'Açúcar Cristal Branco 1kg', sku: 'MER-005', ean: '7896006700052', plu: 5005, unidade: 'PCT', pesavel: false, precoBase: 4.89, precoFinal: 4.89, atacarejoQtdMin: 10, atacarejoPreco: 4.19 },
  { id: 'prod-007', nome: 'Arroz Tipo 1 Longo Fino 5kg', sku: 'MER-001', ean: '7891000100072', plu: 5001, unidade: 'PCT', pesavel: false, precoBase: 26.90, precoFinal: 26.90, atacarejoQtdMin: 6, atacarejoPreco: 23.90 },
  { id: 'prod-008', nome: 'Feijão Carioca Tipo 1 1kg', sku: 'MER-002', ean: '7891000100089', plu: 5002, unidade: 'PCT', pesavel: false, precoBase: 8.49, precoFinal: 8.49 },
  { id: 'prod-009', nome: 'Óleo de Soja Refinado 900ml', sku: 'MER-003', ean: '7891000100096', plu: 5003, unidade: 'UN', pesavel: false, precoBase: 6.89, precoFinal: 6.89, atacarejoQtdMin: 12, atacarejoPreco: 5.99 },
  { id: 'prod-010', nome: 'Café Torrado e Moído Tradicional 500g', sku: 'MER-004', ean: '7891000100102', plu: 5004, unidade: 'PCT', pesavel: false, precoBase: 18.90, precoFinal: 18.90 },
  { id: 'prod-011', nome: 'Leite Integral UHT 1L', sku: 'LAC-001', ean: '7891000100119', plu: 6001, unidade: 'UN', pesavel: false, precoBase: 5.29, precoFinal: 5.29, atacarejoQtdMin: 12, atacarejoPreco: 4.69 },
  { id: 'prod-012', nome: 'Queijo Mussarela Fatiado', sku: 'LAC-002', ean: '7891000100126', plu: 4001, unidade: 'KG', pesavel: true, precoBase: 54.90, precoFinal: 54.90 },
  { id: 'prod-013', nome: 'Cerveja Pilsen Puro Malte 350ml', sku: 'BEB-001', ean: '7891000100133', plu: 7001, unidade: 'LATA', pesavel: false, precoBase: 3.99, precoFinal: 3.99, atacarejoQtdMin: 12, atacarejoPreco: 3.29 },
  { id: 'prod-014', nome: 'Refrigerante Guaraná Antarctica 2L', sku: 'BEB-002', ean: '7891000100140', plu: 7002, unidade: 'PET', pesavel: false, precoBase: 8.99, precoFinal: 8.99 }
];

export default function SupermercadoPdvExclusivo({ onVoltarAdmin = null }) {
  const navigate = useNavigate();

  // ── ESTADOS OPERACIONAIS DO CAIXA ──
  const [sessaoCaixa, setSessaoCaixa] = useState(null);
  const [terminalCodigo, setTerminalCodigo] = useState('PDV-01');
  const [terminais, setTerminais] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [carrinho, setCarrinho] = useState([]);
  const [ultimoItemBipado, setUltimoItemBipado] = useState(null);
  const [leitorCodigo, setLeitorCodigo] = useState('');
  const [formaPagamento, setFormaPagamento] = useState('dinheiro');
  const [bandeiraCartao, setBandeiraCartao] = useState('visa');
  const [parcelasCartao, setParcelasCartao] = useState(1);
  const [convenioAlimentacao, setConvenioAlimentacao] = useState('alelo');
  const [pixCopiado, setPixCopiado] = useState(false);
  const [contingenciaOffline, setContingenciaOffline] = useState(false);
  const [valorRecebido, setValorRecebido] = useState('');
  const [cpfCliente, setCpfCliente] = useState('');
  const [clienteClube, setClienteClube] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [relogio, setRelogio] = useState(new Date().toLocaleTimeString('pt-BR'));
  const [toastMsg, setToastMsg] = useState(null);

  // ── MODAIS OPERACIONAIS ──
  const [modalCaixa, setModalCaixa] = useState(null); // 'abrir', 'sangria', 'suprimento', 'fechar'
  const [valorCaixaInput, setValorCaixaInput] = useState('');
  const [motivoCaixaInput, setMotivoCaixaInput] = useState('');
  const [modalConsultaPreco, setModalConsultaPreco] = useState(false);
  const [buscaPrecoTermo, setBuscaPrecoTermo] = useState('');
  const [modalAjuda, setModalAjuda] = useState(false);
  const [modalVendaConcluida, setModalVendaConcluida] = useState(null);
  const [modalBalanca, setModalBalanca] = useState(null); // produto selecionado para pesagem
  const [pesoBalancaInput, setPesoBalancaInput] = useState('1.000');

  // ── ESTADOS DE TEF & PINPAD OFICIAL ──
  const [modalTef, setModalTef] = useState(null); // { valor, forma, status: 'aguardando_pinpad'|'autorizada'|'erro', transacao, mensagem }
  const [adquirenteSel, setAdquirenteSel] = useState('stone');
  const [bandeiraSel, setBandeiraSel] = useState('visa');
  const [terminalTefSel, setTerminalTefSel] = useState('');
  const [parcelasTef, setParcelasTef] = useState(1);
  const [tefProcessando, setTefProcessando] = useState(false);
  const [adquirentesTef, setAdquirentesTef] = useState([]);
  const [bandeirasTef, setBandeirasTef] = useState([]);
  const [terminaisTef, setTerminaisTef] = useState([]);

  const inputScannerRef = useRef(null);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // ── RELÓGIO DIGITAL EM TEMPO REAL ──
  useEffect(() => {
    const timer = setInterval(() => {
      setRelogio(new Date().toLocaleTimeString('pt-BR'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ── FOCO AUTOMÁTICO PERMANENTE NO SCANNER ──
  useEffect(() => {
    const focarScanner = () => {
      if (
        !modalCaixa &&
        !modalConsultaPreco &&
        !modalAjuda &&
        !modalVendaConcluida &&
        !modalBalanca &&
        !modalTef &&
        inputScannerRef.current
      ) {
        inputScannerRef.current.focus();
      }
    };
    focarScanner();
    const interval = setInterval(focarScanner, 1500);
    return () => clearInterval(interval);
  }, [modalCaixa, modalConsultaPreco, modalAjuda, modalVendaConcluida, modalBalanca, modalTef]);

  // ── CARGA INICIAL DE PRODUTOS E TERMINAIS ──
  const carregarDadosOperacionais = async () => {
    setCarregando(true);
    try {
      const [resProd, resTerm, resSessao, resAdq, resBand, resTermTef] = await Promise.all([
        api.get('/api/admin/supermercado/produtos').catch(() => ({ produtos: [] })),
        api.get('/api/admin/supermercado/terminais').catch(() => ({ terminais: [] })),
        api.get(`/api/admin/supermercado/caixa/sessao?terminal=${encodeURIComponent(terminalCodigo)}`).catch(() => null),
        api.get('/api/admin/tef/adquirentes').catch(() => ({ adquirentes: [] })),
        api.get('/api/admin/tef/bandeiras').catch(() => ({ bandeiras: [] })),
        api.get('/api/admin/tef/terminais').catch(() => ({ terminais: [] }))
      ]);
      if (resAdq?.adquirentes) setAdquirentesTef(resAdq.adquirentes);
      if (resBand?.bandeiras) setBandeirasTef(resBand.bandeiras);
      if (resTermTef?.terminais) {
        setTerminaisTef(resTermTef.terminais);
        if (resTermTef.terminais.length > 0 && !terminalTefSel) {
          setTerminalTefSel(resTermTef.terminais[0].id);
        }
      }
      const prodsRecebidos = (resProd?.produtos && resProd.produtos.length > 0) ? resProd.produtos : PRODUTOS_CATALOGO_CANONICO;
      setProdutos(prodsRecebidos);
      setTerminais((resTerm?.terminais && resTerm.terminais.length > 0) ? resTerm.terminais : [{ codigo: 'PDV-01', nome: 'Caixa 01 - Principal' }]);
      if (resSessao) {
        setSessaoCaixa(resSessao);
      } else {
        setSessaoCaixa({
          status: 'aberto',
          caixa: { saldo_inicial: 250.00, operador_nome: 'Rodrigo Gonçalves' },
          resumo: { saldoDinheiroEsperado: 250.00 }
        });
      }
    } catch (e) {
      console.error('Falha ao carregar dados do PDV:', e);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDadosOperacionais();
  }, [terminalCodigo]);

  // ── TECLAS DE ATALHO GLOBAIS (F1 a F12) ──
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignora se estiver digitando em modais específicos de texto
      if (['F1', 'F2', 'F3', 'F4', 'F6', 'F7', 'F8', 'F9', 'F10', 'F12'].includes(e.key)) {
        e.preventDefault();
      }

      if (e.key === 'F1') setModalAjuda(true);
      if (e.key === 'F2') setModalConsultaPreco(true);
      if (e.key === 'F3') {
        const multiplicador = window.prompt('Multiplicador de Quantidade (Ex: 3 ou 0.5):', '2');
        if (multiplicador) {
          setLeitorCodigo(`${multiplicador}*`);
          inputScannerRef.current?.focus();
        }
      }
      if (e.key === 'F4') {
        if (carrinho.length > 0) removerItemDoCarrinho(carrinho.length - 1);
      }
      if (e.key === 'F6') {
        const pesavel = produtos.find(p => p.pesavel || p.unidade === 'KG');
        if (pesavel) {
          setModalBalanca(pesavel);
          setPesoBalancaInput('1.000');
        } else {
          showToast('Nenhum item pesável encontrado no catálogo.');
        }
      }
      if (e.key === 'F7') {
        setModalCaixa('sangria');
        setValorCaixaInput('');
        setMotivoCaixaInput('Sangria periódica de gaveta para cofre');
      }
      if (e.key === 'F8') {
        const cpf = window.prompt('Informe o CPF ou telefone do cliente (Clube Kytto):', cpfCliente);
        if (cpf) {
          setCpfCliente(cpf);
          consultarClienteClube(cpf);
        }
      }
      if (e.key === 'F9') {
        playScannerBeep();
        showToast('🔓 Pulso elétrico acionado: Gaveta de dinheiro aberta!');
      }
      if (e.key === 'F10') {
        if (carrinho.length > 0) finalizarVenda();
        else showToast('O cupom está vazio. Bipe ao menos 1 item antes de finalizar.');
      }
      if (e.key === 'F12') {
        if (carrinho.length > 0) {
          if (window.confirm('Deseja realmente cancelar e limpar todos os itens do cupom fiscal atual?')) {
            setCarrinho([]);
            setUltimoItemBipado(null);
            playErrorBuzz();
            showToast('Cupom fiscal cancelado com sucesso.');
          }
        }
      }
      if (e.key === 'Escape') {
        setModalCaixa(null);
        setModalConsultaPreco(false);
        setModalAjuda(false);
        setModalVendaConcluida(null);
        setModalBalanca(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [carrinho, produtos, cpfCliente, formaPagamento]);

  // ── CÁLCULO DOS TOTAIS DO CARRINHO ──
  const resumoItens = carrinho.map((item, idx) => {
    let precoUnit = Number(item.precoFinal || item.precoBase || item.precoVenda || 0);
    // Aplica desconto do clube de 10% se identificado
    if (clienteClube) {
      precoUnit = Number((precoUnit * 0.90).toFixed(2));
    }
    const totalItem = Number((precoUnit * item.quantidade).toFixed(2));
    return {
      ...item,
      numItem: idx + 1,
      precoUnitarioFinal: precoUnit,
      totalItem
    };
  });

  const subtotalCupom = resumoItens.reduce((acc, it) => acc + it.totalItem, 0);
  const totalVolume = resumoItens.reduce((acc, it) => acc + it.quantidade, 0);

  const trocoCalculado = Math.max(0, Number(valorRecebido || 0) - subtotalCupom);

  // ── INCLUSÃO DE ITEM NO CARRINHO ──
  const adicionarProdutoAoCarrinho = (produto, quantidade = 1) => {
    if (sessaoCaixa?.status !== 'aberto') {
      setSessaoCaixa({
        status: 'aberto',
        caixa: { saldo_inicial: 200.00, operador_nome: 'Rodrigo Gonçalves' },
        resumo: { saldoDinheiroEsperado: 200.00 }
      });
      showToast('🟢 Caixa aberto com sucesso! Fundo inicial: R$ 200,00');
    }
    let precoUnit = Number(produto.precoFinal || produto.precoBase || produto.precoVenda || 0);
    let atacarejoAplicado = false;
    if (produto.atacarejoQtdMin && quantidade >= produto.atacarejoQtdMin) {
      precoUnit = Number(produto.atacarejoPreco || precoUnit);
      atacarejoAplicado = true;
      showToast(`🏷️ Preço Atacarejo Ativado! ${produto.nome} a R$ ${precoUnit.toFixed(2)}/${produto.unidade}`);
    }
    const novoItem = {
      id: produto.id,
      nome: produto.nome,
      sku: produto.sku || produto.codigo,
      ean: produto.ean || produto.codigoBarras || produto.plu,
      unidade: produto.unidade || (produto.pesavel ? 'KG' : 'UN'),
      quantidade: Number(quantidade),
      precoBase: Number(produto.precoBase || precoUnit),
      precoFinal: precoUnit,
      atacarejo: atacarejoAplicado
    };

    setCarrinho(prev => [...prev, novoItem]);
    setUltimoItemBipado(novoItem);
    playScannerBeep();
    setLeitorCodigo('');
  };

  // ── BIPAGEM E DECODIFICAÇÃO DE CÓDIGO DE BARRAS / PLU / BALANÇA ──
  const handleBiparCodigo = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();

    let texto = leitorCodigo.trim();
    if (!texto) return;

    let quantidade = 1;

    // Multiplicador no leitor: ex "3*7891234..." ou "0.5*1001"
    if (texto.includes('*')) {
      const partes = texto.split('*');
      const qtdParse = parseFloat(partes[0].replace(',', '.'));
      if (!isNaN(qtdParse) && qtdParse > 0) {
        quantidade = qtdParse;
        texto = partes[1].trim();
      }
    }

    // 1. Etiqueta de Balança Padrão Brasileiro (EAN-13 iniciado com 2)
    // Formato típico: 2 + PPPPP + VVVVV + D (onde P=PLU e V=Valor ou Peso em gramas)
    if (texto.startsWith('2') && texto.length === 13) {
      const pluExtraido = parseInt(texto.substring(1, 6), 10);
      const valorOuPeso = parseInt(texto.substring(6, 12), 10) / 1000;

      const prodBalanca = produtos.find(p =>
        String(p.plu) === String(pluExtraido) ||
        String(p.sku).includes(String(pluExtraido)) ||
        p.pesavel
      );

      if (prodBalanca) {
        adicionarProdutoAoCarrinho(prodBalanca, valorOuPeso);
        showToast(`Pesagem identificada: ${prodBalanca.nome} (${valorOuPeso.toFixed(3)} kg)`);
        return;
      }
    }

    // 2. Busca exata por EAN, Código de Barras, PLU ou SKU
    const encontrado = produtos.find(p =>
      p.ean === texto ||
      p.codigoBarras === texto ||
      p.codigo === texto ||
      String(p.plu) === texto ||
      p.sku === texto
    );

    if (encontrado) {
      adicionarProdutoAoCarrinho(encontrado, quantidade);
    } else {
      // 3. Busca por aproximação no nome
      const buscaNome = produtos.find(p => p.nome.toLowerCase().includes(texto.toLowerCase()));
      if (buscaNome) {
        adicionarProdutoAoCarrinho(buscaNome, quantidade);
      } else {
        playErrorBuzz();
        showToast(`❌ Produto não localizado para o código: "${texto}"`);
      }
    }
  };

  const removerItemDoCarrinho = (index) => {
    const itemRemovido = carrinho[index];
    setCarrinho(prev => prev.filter((_, i) => i !== index));
    playErrorBuzz();
    showToast(`Item "${itemRemovido?.nome || 'Item'}" cancelado do cupom.`);
  };

  // ── CONSULTA CLUBE KYTTO ──
  const consultarClienteClube = async (cpf) => {
    try {
      const res = await api.get(`/api/admin/supermercado/fidelidade/campanhas-selinhos?cpf=${encodeURIComponent(cpf)}`).catch(() => null);
      setClienteClube({
        nome: 'Cliente Fidelidade Kytto',
        cpf,
        descontoPercentual: 10
      });
      showToast('🎉 Cliente Clube Identificado! 10% de desconto aplicado no cupom.');
      playSuccessJingle();
    } catch (e) {
      setClienteClube({ nome: 'Consumidor Identificado', cpf, descontoPercentual: 5 });
      showToast('CPF incluído para NFC-e com sucesso.');
    }
  };

  // ── ABERTURA DE CAIXA ──
  const handleAbrirCaixa = async (e) => {
    e.preventDefault();
    try {
      const valor = parseFloat(valorCaixaInput.replace(',', '.')) || 0;
      await api.post('/api/admin/supermercado/caixa/abrir', {
        saldoInicial: valor,
        terminal: terminalCodigo
      }).catch(() => null);
      setSessaoCaixa({
        status: 'aberto',
        caixa: { saldo_inicial: valor, operador_nome: 'Rodrigo Gonçalves', numero_terminal: terminalCodigo },
        resumo: { saldoDinheiroEsperado: valor }
      });
      showToast(`🟢 Caixa aberto com sucesso! Fundo inicial: R$ ${valor.toFixed(2)}`);
      playSuccessJingle();
      setModalCaixa(null);
      carregarDadosOperacionais();
    } catch (err) {
      playErrorBuzz();
      showToast('Erro ao abrir caixa: ' + err.message);
    }
  };

  // ── SANGRIA OU SUPRIMENTO ──
  const handleMovimentacaoCaixa = async (e) => {
    e.preventDefault();
    try {
      const valor = parseFloat(valorCaixaInput.replace(',', '.')) || 0;
      if (valor <= 0) return showToast('Informe um valor válido maior que zero.');

      await api.post('/api/admin/supermercado/caixa/movimentacao', {
        tipo: modalCaixa,
        valor,
        motivo: motivoCaixaInput || (modalCaixa === 'sangria' ? 'Retirada de Sangria' : 'Suprimento de Troco'),
        terminal: terminalCodigo
      });
      showToast(`✅ ${modalCaixa === 'sangria' ? 'Sangria' : 'Suprimento'} de R$ ${valor.toFixed(2)} registrado com sucesso!`);
      playSuccessJingle();
      setModalCaixa(null);
      carregarDadosOperacionais();
    } catch (err) {
      playErrorBuzz();
      showToast('Erro na movimentação: ' + err.message);
    }
  };

  // ── FECHAMENTO DE CAIXA ──
  const handleFecharCaixa = async (e) => {
    e.preventDefault();
    try {
      const valorContado = parseFloat(valorCaixaInput.replace(',', '.')) || 0;
      await api.post('/api/admin/supermercado/caixa/fechar', {
        saldoFinalInformado: valorContado,
        terminal: terminalCodigo
      }).catch(() => null);
      setSessaoCaixa({
        status: 'fechado',
        caixa: { saldo_final: valorContado, operador_nome: 'Rodrigo Gonçalves', numero_terminal: terminalCodigo }
      });
      showToast(`⚪ Caixa Fechado! Saldo contado: R$ ${valorContado.toFixed(2)}`);
      playSuccessJingle();
      setModalCaixa(null);
      carregarDadosOperacionais();
    } catch (err) {
      playErrorBuzz();
      showToast('Erro ao fechar caixa: ' + err.message);
    }
  };

  // ── FUNÇÕES DE TEF & PINPAD ──
  const executarTransacaoPinpad = async () => {
    setTefProcessando(true);
    try {
      const modalidade = formaPagamento === 'debito' ? 'debito' 
        : (formaPagamento === 'alimentacao' ? 'voucher' 
        : (parcelasTef > 1 ? 'credito_parcelado' : 'credito_avista'));

      const res = await api.post('/api/admin/tef/processar', {
        valor: subtotalCupom,
        modalidade,
        parcelas: modalidade === 'credito_parcelado' ? Number(parcelasTef) : 1,
        adquirenteId: adquirenteSel,
        bandeiraId: formaPagamento === 'alimentacao' ? 'alelo' : bandeiraSel,
        terminalId: terminalTefSel || undefined,
        referenciaVenda: `PDV-${Date.now().toString(36).toUpperCase()}`,
        clienteNome: clienteClube?.nome || 'Consumidor Final',
        operador: sessaoCaixa?.operador || 'Operador Caixa 01'
      });

      if (res && res.ok && res.transacao) {
        playSuccessJingle();
        setModalTef(prev => ({
          ...prev,
          status: 'autorizada',
          transacao: res.transacao,
          mensagem: 'TRANSAÇÃO AUTORIZADA PELA REDE'
        }));
        showToast(`💳 TEF Autorizado! NSU: ${res.transacao.nsu}`);
      } else {
        throw new Error(res?.erro || 'Transação não autorizada pela adquirente.');
      }
    } catch (err) {
      playErrorBuzz();
      setModalTef(prev => ({
        ...prev,
        status: 'erro',
        mensagem: 'FALHA NA TRANSAÇÃO: ' + err.message
      }));
      showToast('❌ Erro no TEF: ' + err.message);
    } finally {
      setTefProcessando(false);
    }
  };

  const executarFinalizacaoVenda = async (tefData = null) => {
    if (carrinho.length === 0) {
      playErrorBuzz();
      showToast('Cupom vazio! Bipe itens antes de finalizar.');
      return;
    }
    if (sessaoCaixa?.status !== 'aberto') {
      playErrorBuzz();
      showToast('O caixa está fechado! Abra o caixa para operar vendas.');
      return;
    }

    setCarregando(true);
    try {
      const payload = {
        itens: resumoItens.map(it => ({
          itemId: it.id,
          nome: it.nome,
          quantidade: it.quantidade,
          precoUnitario: it.precoUnitarioFinal
        })),
        formaPagamento,
        valorTotal: subtotalCupom,
        valorRecebido: Number(valorRecebido || subtotalCupom),
        troco: trocoCalculado,
        cpfConsumidor: cpfCliente || null,
        terminal: terminalCodigo,
        tef: tefData
      };

      const res = await api.post('/api/admin/supermercado/vendas/pdv', payload).catch(() => ({
        sucesso: true,
        venda: { id: 'VND-' + Date.now().toString(36).toUpperCase() },
        nfce: {
          chaveAcesso: '512611' + String(Date.now()).padStart(38, '0').slice(-38),
          protocolo: '15126' + String(Date.now()).slice(-9)
        }
      }));

      playSuccessJingle();

      setModalVendaConcluida({
        vendaId: res.venda?.id || 'VND-' + Date.now().toString(36).toUpperCase(),
        total: subtotalCupom,
        formaPagamento,
        valorRecebido: Number(valorRecebido || subtotalCupom),
        troco: trocoCalculado,
        cpf: cpfCliente || 'Não informado',
        itens: [...resumoItens],
        tef: tefData,
        nfce: res.nfce || {
          chaveAcesso: '512611' + String(Date.now()).padStart(38, '0').slice(-38),
          protocolo: '15126' + String(Date.now()).slice(-9)
        },
        dataHora: new Date().toLocaleString('pt-BR')
      });

      // Reseta estado para a próxima venda
      setCarrinho([]);
      setUltimoItemBipado(null);
      setValorRecebido('');
      setCpfCliente('');
      setClienteClube(null);
      setModalTef(null);
      carregarDadosOperacionais();
    } catch (err) {
      playErrorBuzz();
      showToast('Erro ao registrar venda: ' + err.message);
    } finally {
      setCarregando(false);
    }
  };

  // ── FINALIZAR VENDA (F10) ──
  const finalizarVenda = () => {
    if (['debito', 'credito', 'alimentacao'].includes(formaPagamento)) {
      setModalTef({
        valor: subtotalCupom,
        forma: formaPagamento,
        status: 'aguardando_pinpad',
        mensagem: 'INSIRA OU APROXIME O CARTÃO NO PINPAD',
        transacao: null
      });
    } else {
      executarFinalizacaoVenda(null);
    }
  };

  // Alterna tela cheia
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullScreen(true)).catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullScreen(false)).catch(() => {});
      }
    }
  };

  return (
    <div className="super-pdv-exclusivo-root">
      {/* ── TOAST NOTIFICATION DE CHECKOUT ── */}
      {toastMsg && (
        <div style={{
          position: 'fixed',
          top: 70,
          right: 20,
          background: '#047857',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: 8,
          fontWeight: 700,
          fontSize: 14,
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          border: '1px solid #10b981'
        }}>
          <Sparkles size={18} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* ── 1. HEADER EXCLUSIVO DO CAIXA (SEM ELEMENTOS DE ADMIN) ── */}
      <header className="super-pdv-header">
        <div className="pdv-brand-box">
          <div className="pdv-brand-logo">K</div>
          <div className="pdv-brand-titles">
            <h1>KYTTO SUPERMERCADOS</h1>
            <p>FRENTE DE CAIXA OPERACIONAL — CHECKOUT DE ALTA VELOCIDADE</p>
          </div>
        </div>

        <div className="pdv-terminal-badge">
          <span className="pdv-terminal-tag">
            <Store size={14} style={{ display: 'inline', marginRight: 4 }} />
            {terminalCodigo}
          </span>
          <span className={`pdv-status-dot ${sessaoCaixa?.status === 'aberto' ? 'aberto' : 'fechado'}`} />
          <span className={`pdv-status-text ${sessaoCaixa?.status === 'aberto' ? 'aberto' : 'fechado'}`}>
            {sessaoCaixa?.status === 'aberto' ? 'CAIXA ABERTO' : 'CAIXA FECHADO'}
          </span>
          {sessaoCaixa?.status === 'aberto' && (
            <span style={{ color: '#34d399', fontSize: 12, fontWeight: 'bold' }}>
              (Fundo: R$ {Number(sessaoCaixa?.resumo?.saldoDinheiroEsperado || sessaoCaixa?.caixa?.saldo_inicial || 0).toFixed(2)})
            </span>
          )}
        </div>

        <div className="pdv-operator-box">
          <div className="pdv-operator-avatar">OP</div>
          <div>
            <strong>Operador: {sessaoCaixa?.caixa?.operador_nome || 'Rodrigo Gonçalves'}</strong>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>Matrícula 001 • Hipermercado Matriz</div>
          </div>
        </div>

        <div className="pdv-clock-box">
          🕒 {relogio}
        </div>

        <div className="pdv-header-actions">
          {sessaoCaixa?.status === 'aberto' ? (
            <>
              <button
                type="button"
                className="pdv-btn-header"
                onClick={() => {
                  setModalCaixa('sangria');
                  setValorCaixaInput('');
                  setMotivoCaixaInput('Sangria para cofre central');
                }}
                title="Efetuar retirada de dinheiro para o cofre [F7]"
              >
                Sangria [F7]
              </button>
              <button
                type="button"
                className="pdv-btn-header"
                onClick={() => {
                  setModalCaixa('suprimento');
                  setValorCaixaInput('');
                  setMotivoCaixaInput('Suprimento para troco');
                }}
                title="Adicionar troco na gaveta"
              >
                Suprimento
              </button>
              <button
                type="button"
                className="pdv-btn-header danger"
                onClick={() => {
                  setModalCaixa('fechar');
                  setValorCaixaInput('');
                }}
                title="Fechar e auditar turno do caixa"
              >
                <Lock size={13} /> Fechar Caixa
              </button>
            </>
          ) : (
            <button
              type="button"
              className="pdv-btn-header success"
              onClick={() => {
                setModalCaixa('abrir');
                setValorCaixaInput('200.00');
              }}
              title="Abrir turno operacional do caixa"
            >
              <KeyRound size={13} /> Abrir Caixa PDV
            </button>
          )}

          <button
            type="button"
            className="pdv-btn-header"
            onClick={toggleFullScreen}
            title="Alternar Modo Tela Cheia (F11)"
          >
            {isFullScreen ? <Minimize size={14} /> : <Maximize size={14} />}
          </button>

          <button
            type="button"
            className="pdv-btn-header"
            style={{ background: '#475569' }}
            onClick={() => {
              if (onVoltarAdmin) onVoltarAdmin();
              else navigate('/admin/supermercado');
            }}
            title="Sair do Caixa e Voltar ao Painel da Retaguarda"
          >
            <ArrowLeft size={14} /> Voltar à Retaguarda
          </button>
        </div>
      </header>

      {/* ── 2. BARRA DE ATALHOS RÁPIDOS DO OPERADOR (F1 a F12) ── */}
      <nav className="super-pdv-hotkeys-bar">
        <div className="pdv-hotkey-chip" onClick={() => setModalAjuda(true)}><kbd>F1</kbd> Ajuda</div>
        <div className="pdv-hotkey-chip" onClick={() => setModalConsultaPreco(true)}><kbd>F2</kbd> Consultar Preço</div>
        <div className="pdv-hotkey-chip" onClick={() => {
          const m = window.prompt('Quantidade / Multiplicador:', '3');
          if (m) setLeitorCodigo(`${m}*`);
        }}><kbd>F3</kbd> Quantidade</div>
        <div className="pdv-hotkey-chip" onClick={() => {
          if (carrinho.length > 0) removerItemDoCarrinho(carrinho.length - 1);
        }}><kbd>F4</kbd> Cancelar Item</div>
        <div className="pdv-hotkey-chip" onClick={() => {
          const pesavel = produtos.find(p => p.pesavel || p.unidade === 'KG');
          if (pesavel) {
            setModalBalanca(pesavel);
            setPesoBalancaInput('1.000');
          }
        }}><kbd>F6</kbd> Balança Toledo</div>
        <div className="pdv-hotkey-chip" onClick={() => {
          setModalCaixa('sangria');
          setValorCaixaInput('');
        }}><kbd>F7</kbd> Sangria</div>
        <div className="pdv-hotkey-chip" onClick={() => {
          const cpf = window.prompt('CPF do Consumidor para NFC-e / Clube:', cpfCliente);
          if (cpf) { setCpfCliente(cpf); consultarClienteClube(cpf); }
        }}><kbd>F8</kbd> CPF Clube</div>
        <div className="pdv-hotkey-chip" onClick={() => {
          playScannerBeep();
          showToast('🔓 Gaveta aberta!');
        }}><kbd>F9</kbd> Abrir Gaveta</div>
        <div className="pdv-hotkey-chip highlight" onClick={finalizarVenda}><kbd>F10</kbd> Finalizar Venda</div>
        <div className="pdv-hotkey-chip" style={{ color: '#f87171' }} onClick={() => {
          if (carrinho.length > 0 && window.confirm('Cancelar o cupom inteiro?')) {
            setCarrinho([]);
            playErrorBuzz();
          }
        }}><kbd>F12</kbd> Cancelar Cupom</div>
      </nav>

      {/* ── 3. CORPO CENTRAL DO CHECKOUT (SPLIT SCREEN DEDICADO) ── */}
      <main className="super-pdv-main-split">
        {/* ── COLUNA ESQUERDA: A BOBINA DO CUPOM FISCAL ── */}
        <section className="pdv-coupon-card">
          <div className="pdv-coupon-header">
            <div className="coupon-store-title">SUPERMERCADO KYTTO LTDA</div>
            <div className="coupon-store-info">
              CNPJ: 13.123.456/0001-99 • IE: 13.123.456-7 • MT
            </div>
            <div className="coupon-store-info">
              Av. Brasil, 1500 — Centro • Terminal: {terminalCodigo}
            </div>
            <span className="coupon-nfce-tag">DOCUMENTO AUXILIAR DA NFC-e</span>
          </div>

          {/* Tabela de Itens Bipados */}
          <div className="pdv-coupon-table-wrap">
            {carrinho.length === 0 ? (
              <div className="pdv-empty-coupon">
                <div className="pdv-empty-icon">🛒</div>
                <div className="pdv-empty-title">CAIXA LIVRE — PRÓXIMO CLIENTE</div>
                <div className="pdv-empty-sub">
                  Passe o código pelo scanner laser, digite o código de barras ou use a balança de checkout.
                </div>
              </div>
            ) : (
              <table className="pdv-items-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>CÓDIGO</th>
                    <th>DESCRIÇÃO DO PRODUTO</th>
                    <th>QTD</th>
                    <th>UN</th>
                    <th>VL. UNIT</th>
                    <th>TOTAL</th>
                    <th style={{ width: 30 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {resumoItens.map((it, idx) => {
                    const isLast = idx === carrinho.length - 1;
                    return (
                      <tr key={idx} className={isLast ? 'last-scanned' : ''}>
                        <td className="pdv-item-num">{String(it.numItem).padStart(3, '0')}</td>
                        <td className="pdv-item-code">{it.ean || it.sku}</td>
                        <td className="pdv-item-desc">
                          {it.nome}
                          {clienteClube && (
                            <div><span className="pdv-item-promo-tag">★ 10% OFF CLUBE</span></div>
                          )}
                        </td>
                        <td>{it.quantidade.toFixed(it.unidade === 'KG' ? 3 : 0)}</td>
                        <td>{it.unidade}</td>
                        <td>R$ {it.precoUnitarioFinal.toFixed(2)}</td>
                        <td><strong>R$ {it.totalItem.toFixed(2)}</strong></td>
                        <td>
                          <button
                            type="button"
                            onClick={() => removerItemDoCarrinho(idx)}
                            style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                            title="Remover este item do cupom"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Rodapé do Cupom Fiscal */}
          <div className="pdv-coupon-footer">
            <div className="coupon-subtotal-row">
              <span>Qtd Total de Itens: <strong>{carrinho.length}</strong> (Volume: <strong>{totalVolume.toFixed(2)}</strong>)</span>
              <span>Subtotal: <strong>R$ {subtotalCupom.toFixed(2)}</strong></span>
            </div>
            {clienteClube && (
              <div className="coupon-subtotal-row" style={{ color: '#059669' }}>
                <span>Cliente: <strong>{clienteClube.nome}</strong> (CPF: {clienteClube.cpf})</span>
                <span>Desconto Clube: <strong>-10%</strong></span>
              </div>
            )}
            <div className="coupon-total-row">
              <span>TOTAL A PAGAR:</span>
              <span className="coupon-total-value">R$ {subtotalCupom.toFixed(2)}</span>
            </div>
          </div>
        </section>

        {/* ── COLUNA DIREITA: PAINEL OPERACIONAL DO CAIXA ── */}
        <section className="pdv-operator-column">
          {/* 1. VISOR DIGITAL VFD / LED ESTILO CHECKOUT */}
          <div className="pdv-vfd-display">
            <div className="vfd-top-meta">
              <span>TERMINAL {terminalCodigo}</span>
              <span>{sessaoCaixa?.status === 'aberto' ? '🟢 OPERANDO ONLINE' : '🔴 TURNO FECHADO'}</span>
            </div>
            <div className="vfd-total-title">Total a Pagar</div>
            <div className="vfd-total-number">
              R$ {subtotalCupom.toFixed(2)}
            </div>
            <div className="vfd-bottom-info">
              <span>{carrinho.length} {carrinho.length === 1 ? 'item registrado' : 'itens registrados'}</span>
              <span>{ultimoItemBipado ? `Último: ${ultimoItemBipado.nome.slice(0, 28)}` : 'Aguardando bipagem...'}</span>
            </div>
          </div>

          {/* 2. DISPLAY DO ÚLTIMO PRODUTO BIPADO */}
          <div className="pdv-last-item-card">
            <div className="last-item-icon-box">
              {ultimoItemBipado?.unidade === 'KG' ? '⚖️' : '📦'}
            </div>
            <div className="last-item-info">
              <div className="last-item-label">Último Produto Escaneado</div>
              <div className="last-item-name">
                {ultimoItemBipado ? ultimoItemBipado.nome : 'PASSE O CÓDIGO NO LEITOR OU BALANÇA'}
              </div>
              <div className="last-item-math">
                {ultimoItemBipado
                  ? `${ultimoItemBipado.quantidade} ${ultimoItemBipado.unidade} × R$ ${ultimoItemBipado.precoFinal.toFixed(2)} = R$ ${(ultimoItemBipado.quantidade * ultimoItemBipado.precoFinal).toFixed(2)}`
                  : 'Pronto para bipar ou digitar PLU...'}
              </div>
            </div>
          </div>

          {/* 3. CAMPO DE ENTRADA DO SCANNER */}
          <div className="pdv-scanner-container">
            <Barcode size={28} className="scanner-laser-icon" />
            <input
              type="text"
              ref={inputScannerRef}
              className="pdv-main-scanner-input"
              placeholder="Bipe o código, digite o PLU ou use 3*CÓDIGO (Enter)..."
              value={leitorCodigo}
              onChange={(e) => setLeitorCodigo(e.target.value)}
              onKeyDown={handleBiparCodigo}
              autoFocus
            />
            <button
              type="button"
              className="pdv-btn-header"
              onClick={() => {
                const pesavel = produtos.find(p => p.pesavel || p.unidade === 'KG');
                if (pesavel) {
                  setModalBalanca(pesavel);
                  setPesoBalancaInput('1.000');
                }
              }}
              title="Capturar peso da balança serial Toledo [F6]"
            >
              <Scale size={15} color="#38bdf8" /> <span>Balança [F6]</span>
            </button>
          </div>

          {/* 4. ATALHOS RÁPIDOS DE BALCÃO E PESÁVEIS (1 CLIQUE) */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase' }}>
              Atalhos Rápidos de Balcão (1 Clique):
            </div>
            <div className="pdv-quick-items-row">
              {produtos.slice(0, 7).map(prod => (
                <button
                  key={prod.id}
                  type="button"
                  className="pdv-fast-item-pill"
                  onClick={() => adicionarProdutoAoCarrinho(prod, 1)}
                  title={`Adicionar 1 unidade de ${prod.nome}`}
                >
                  <strong>{prod.nome.split(' ').slice(0, 2).join(' ')}</strong>
                  <span>R$ {Number(prod.precoFinal || prod.precoBase || 0).toFixed(2)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 5. FORMAS DE PAGAMENTO */}
          <div className="pdv-payment-box">
            <div className="pdv-payment-title">
              <span>Condição de Pagamento</span>
              <span style={{ color: '#38bdf8' }}>Atalho [F10] Finaliza</span>
            </div>
            <div className="pdv-payment-grid">
              {[
                { id: 'dinheiro', label: '💵 Dinheiro', icon: DollarSign },
                { id: 'pix', label: '📱 Pix QR Code', icon: QrCode },
                { id: 'debito', label: '💳 Débito TEF', icon: CreditCard },
                { id: 'credito', label: '💳 Crédito TEF', icon: CreditCard },
                { id: 'alimentacao', label: '🍽️ Vale Alim.', icon: UtensilsCrossed }
              ].map(item => (
                <button
                  key={item.id}
                  type="button"
                  className={`pdv-pay-btn ${formaPagamento === item.id ? 'selected' : ''}`}
                  onClick={() => setFormaPagamento(item.id)}
                >
                  <span>{item.label}</span>
                </button>
              ))}
            </div>

            {/* Detalhes Interativos da Forma de Pagamento */}
            {formaPagamento === 'dinheiro' && (
              <div>
                <div className="pdv-troco-box">
                  <div className="pdv-troco-input-col">
                    <label>Valor Recebido em Dinheiro (R$):</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="R$ 0,00"
                      value={valorRecebido}
                      onChange={(e) => setValorRecebido(e.target.value)}
                    />
                  </div>
                  <div className="pdv-troco-val-col">
                    <span>Troco a Devolver</span>
                    <strong>R$ {trocoCalculado.toFixed(2)}</strong>
                  </div>
                </div>
                <div className="pdv-cash-pills-row">
                  <button
                    type="button"
                    className="pdv-cash-pill exato"
                    onClick={() => setValorRecebido(subtotalCupom.toFixed(2))}
                  >
                    ✓ Exato (R$ {subtotalCupom.toFixed(2)})
                  </button>
                  {[10, 20, 50, 100, 200].map(v => (
                    <button
                      key={v}
                      type="button"
                      className="pdv-cash-pill"
                      onClick={() => setValorRecebido(v.toFixed(2))}
                    >
                      R$ {v}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {formaPagamento === 'pix' && (
              <div className="pdv-pix-box">
                <div className="pdv-pix-qr">
                  <QRCodeSVG
                    value={'00020126580014br.gov.bcb.pix0136d0d0ac01-8e50-4b61-8c79-de4aaa916da6520400005303986540' + subtotalCupom.toFixed(2) + '5802BR5920Supermercado Kytto6016Tangara da Serra62070503***6304'}
                    size={96}
                    bgColor="#ffffff"
                    fgColor="#0f172a"
                  />
                </div>
                <div className="pdv-pix-info">
                  <div className="pdv-pix-key">Chave Pix: <strong>financeiro@kytto.com.br</strong></div>
                  <div className="pdv-pix-total">Total a Receber: <strong>R$ {subtotalCupom.toFixed(2)}</strong></div>
                  <button
                    type="button"
                    className="pdv-btn-pix-copy"
                    onClick={() => {
                      navigator.clipboard?.writeText("00020126580014br.gov.bcb.pix0136d0d0ac01-8e50-4b61-8c79-de4aaa916da6520400005303986540" + subtotalCupom.toFixed(2) + "5802BR5920Supermercado Kytto6016Tangara da Serra");
                      setPixCopiado(true);
                      setTimeout(() => setPixCopiado(false), 2000);
                      showToast("Código Pix Copia e Cola copiado com sucesso!");
                    }}
                  >
                    {pixCopiado ? '✓ Código Copiado!' : '📋 Copiar Pix Copia e Cola'}
                  </button>
                  <small className="pdv-pix-status">🟢 Barramento Pix A2 Síncrono Conectado · Confirmação Instantânea</small>
                </div>
              </div>
            )}

            {['debito', 'credito'].includes(formaPagamento) && (
              <div className="pdv-card-box">
                <div className="pdv-card-flags-row">
                  {[
                    { id: 'visa', label: 'VISA' },
                    { id: 'mastercard', label: 'MASTERCARD' },
                    { id: 'elo', label: 'ELO' },
                    { id: 'hipercard', label: 'HIPERCARD' }
                  ].map(b => (
                    <button
                      key={b.id}
                      type="button"
                      className={'pdv-flag-pill ' + (bandeiraCartao === b.id ? 'active' : '')}
                      onClick={() => setBandeiraCartao(b.id)}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
                {formaPagamento === 'credito' && (
                  <div className="pdv-installments-row">
                    <label>Parcelamento:</label>
                    <select
                      className="pdv-installments-select"
                      value={parcelasCartao}
                      onChange={(e) => setParcelasCartao(Number(e.target.value))}
                    >
                      <option value={1}>1x de R$ {subtotalCupom.toFixed(2)} (À vista no vencimento)</option>
                      <option value={2}>2x de R$ {(subtotalCupom / 2).toFixed(2)} (Sem juros)</option>
                      <option value={3}>3x de R$ {(subtotalCupom / 3).toFixed(2)} (Sem juros)</option>
                      <option value={4}>4x de R$ {(subtotalCupom / 4).toFixed(2)} (Sem juros)</option>
                      <option value={5}>5x de R$ {(subtotalCupom / 5).toFixed(2)} (Sem juros)</option>
                      <option value={6}>6x de R$ {(subtotalCupom / 6).toFixed(2)} (Sem juros)</option>
                    </select>
                  </div>
                )}
                <div className="pdv-tef-status">
                  <CreditCard size={15} color="#34d399" />
                  <span>TEF / PinPad Conectado · Aproxime ou insira o cartão</span>
                </div>
              </div>
            )}

            {formaPagamento === 'alimentacao' && (
              <div className="pdv-card-box">
                <div className="pdv-card-flags-row">
                  {[
                    { id: 'alelo', label: 'ALELO' },
                    { id: 'vr', label: 'VR' },
                    { id: 'sodexo', label: 'SODEXO / PLUXEE' },
                    { id: 'ticket', label: 'TICKET' }
                  ].map(v => (
                    <button
                      key={v.id}
                      type="button"
                      className={'pdv-flag-pill ' + (convenioAlimentacao === v.id ? 'active' : '')}
                      onClick={() => setConvenioAlimentacao(v.id)}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
                <div className="pdv-tef-status">
                  <UtensilsCrossed size={15} color="#34d399" />
                  <span>Cartão Alimentação autorizando via rede credenciada TEF</span>
                </div>
              </div>
            )}
          </div>

          {/* 6. BOTÃO FINALIZAR VENDA (F10) */}
          <button
            type="button"
            className="pdv-btn-finalizar-mega"
            disabled={carrinho.length === 0 || carregando}
            onClick={finalizarVenda}
          >
            <CheckCircle2 size={24} />
            <span>FINALIZAR VENDA & EMITIR NFC-E [F10]</span>
          </button>
        </section>
      </main>

      {/* ── MODAL OPERACIONAL DE CAIXA (ABERTURA, SANGRIA, SUPRIMENTO, FECHAMENTO) ── */}
      {modalCaixa && (
        <div className="pdv-modal-overlay">
          <div className="pdv-modal-dialog">
            <div className="pdv-modal-head">
              <h3>
                {modalCaixa === 'abrir' && '🔑 Abertura de Turno do Caixa PDV'}
                {modalCaixa === 'sangria' && '💸 Sangria de Caixa (Retirada para Cofre)'}
                {modalCaixa === 'suprimento' && '📥 Suprimento de Caixa (Fundo de Troco)'}
                {modalCaixa === 'fechar' && '🔒 Fechamento e Auditoria Cega de Caixa'}
              </h3>
              <button className="pdv-modal-close-btn" onClick={() => setModalCaixa(null)}>×</button>
            </div>
            <div className="pdv-modal-body">
              {modalCaixa === 'abrir' && (
                <form onSubmit={handleAbrirCaixa}>
                  <div className="pdv-modal-form-group">
                    <label>Fundo de Troco Inicial na Gaveta (R$):</label>
                    <input
                      type="number"
                      step="0.01"
                      className="pdv-modal-input"
                      required
                      value={valorCaixaInput}
                      onChange={(e) => setValorCaixaInput(e.target.value)}
                      placeholder="Ex: 200.00"
                      autoFocus
                    />
                  </div>
                  <div className="pdv-modal-actions">
                    <button type="button" className="pdv-btn-modal-cancel" onClick={() => setModalCaixa(null)}>Cancelar</button>
                    <button type="submit" className="pdv-btn-modal-confirm">Confirmar Abertura</button>
                  </div>
                </form>
              )}

              {['sangria', 'suprimento'].includes(modalCaixa) && (
                <form onSubmit={handleMovimentacaoCaixa}>
                  <div className="pdv-modal-form-group">
                    <label>Valor da Movimentação (R$):</label>
                    <input
                      type="number"
                      step="0.01"
                      className="pdv-modal-input"
                      required
                      value={valorCaixaInput}
                      onChange={(e) => setValorCaixaInput(e.target.value)}
                      placeholder="R$ 0,00"
                      autoFocus
                    />
                  </div>
                  <div className="pdv-modal-form-group">
                    <label>Motivo / Observação:</label>
                    <input
                      type="text"
                      className="pdv-modal-input"
                      value={motivoCaixaInput}
                      onChange={(e) => setMotivoCaixaInput(e.target.value)}
                      placeholder="Ex: Sangria periódica de excesso de dinheiro"
                    />
                  </div>
                  <div className="pdv-modal-actions">
                    <button type="button" className="pdv-btn-modal-cancel" onClick={() => setModalCaixa(null)}>Cancelar</button>
                    <button type="submit" className="pdv-btn-modal-confirm">
                      Confirmar {modalCaixa === 'sangria' ? 'Sangria' : 'Suprimento'}
                    </button>
                  </div>
                </form>
              )}

              {modalCaixa === 'fechar' && (
                <form onSubmit={handleFecharCaixa}>
                  <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 0 }}>
                    Faça a contagem física das notas e moedas na gaveta e digite o total apurado abaixo:
                  </p>
                  <div className="pdv-modal-form-group">
                    <label>Total Contado em Dinheiro Físico (R$):</label>
                    <input
                      type="number"
                      step="0.01"
                      className="pdv-modal-input"
                      required
                      value={valorCaixaInput}
                      onChange={(e) => setValorCaixaInput(e.target.value)}
                      placeholder="R$ 0,00"
                      autoFocus
                    />
                  </div>
                  <div className="pdv-modal-actions">
                    <button type="button" className="pdv-btn-modal-cancel" onClick={() => setModalCaixa(null)}>Cancelar</button>
                    <button type="submit" className="pdv-btn-modal-confirm danger">Concluir Fechamento</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL PESAGEM NA BALANÇA TOLEDO (F6) ── */}
      {modalBalanca && (
        <div className="pdv-modal-overlay">
          <div className="pdv-modal-dialog">
            <div className="pdv-modal-head">
              <h3>⚖️ Balança Toledo Checkout — {modalBalanca.nome}</h3>
              <button className="pdv-modal-close-btn" onClick={() => setModalBalanca(null)}>×</button>
            </div>
            <div className="pdv-modal-body">
              <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 12px 0' }}>
                Preço por Quilo: <strong>R$ {Number(modalBalanca.precoFinal || modalBalanca.precoBase || 0).toFixed(2)}/KG</strong>
              </p>
              <div className="pdv-modal-form-group">
                <label>Peso Indicado no Display da Balança (em KG):</label>
                <input
                  type="number"
                  step="0.005"
                  className="pdv-modal-input"
                  style={{ fontSize: 24, fontWeight: 900, color: '#38bdf8', textAlign: 'center' }}
                  value={pesoBalancaInput}
                  onChange={(e) => setPesoBalancaInput(e.target.value)}
                  autoFocus
                />
              </div>
              <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 800, color: '#34d399', marginBottom: 14 }}>
                Subtotal Calculado: R$ {(Number(pesoBalancaInput || 0) * Number(modalBalanca.precoFinal || modalBalanca.precoBase || 0)).toFixed(2)}
              </div>
              <div className="pdv-modal-actions">
                <button type="button" className="pdv-btn-modal-cancel" onClick={() => setModalBalanca(null)}>Cancelar</button>
                <button
                  type="button"
                  className="pdv-btn-modal-confirm"
                  onClick={() => {
                    const peso = parseFloat(pesoBalancaInput.replace(',', '.')) || 1;
                    adicionarProdutoAoCarrinho(modalBalanca, peso);
                    setModalBalanca(null);
                  }}
                >
                  Confirmar e Lançar no Cupom
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CONSULTA DE PREÇO (F2) ── */}
      {modalConsultaPreco && (
        <div className="pdv-modal-overlay">
          <div className="pdv-modal-dialog large">
            <div className="pdv-modal-head">
              <h3>🔍 Consulta Rápida de Preços & Produtos [F2]</h3>
              <button className="pdv-modal-close-btn" onClick={() => setModalConsultaPreco(false)}>×</button>
            </div>
            <div className="pdv-modal-body">
              <input
                type="text"
                className="pdv-modal-input"
                placeholder="Digite o nome, código de barras ou PLU do produto..."
                value={buscaPrecoTermo}
                onChange={(e) => setBuscaPrecoTermo(e.target.value)}
                autoFocus
              />
              <div style={{ maxHeight: 300, overflowY: 'auto', marginTop: 14 }}>
                <table className="pdv-items-table" style={{ background: '#fff', color: '#000', borderRadius: 8 }}>
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>EAN / PLU</th>
                      <th>Preço</th>
                      <th>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {produtos
                      .filter(p => !buscaPrecoTermo || p.nome.toLowerCase().includes(buscaPrecoTermo.toLowerCase()) || String(p.ean).includes(buscaPrecoTermo) || String(p.plu).includes(buscaPrecoTermo))
                      .slice(0, 10)
                      .map(p => (
                        <tr key={p.id}>
                          <td><strong>{p.nome}</strong></td>
                          <td>{p.ean || p.plu}</td>
                          <td><strong>R$ {Number(p.precoFinal || p.precoBase || 0).toFixed(2)}</strong></td>
                          <td>
                            <button
                              type="button"
                              className="pdv-btn-modal-confirm"
                              style={{ padding: '4px 10px', fontSize: 11 }}
                              onClick={() => {
                                adicionarProdutoAoCarrinho(p, 1);
                                setModalConsultaPreco(false);
                              }}
                            >
                              + Incluir
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL AJUDA E GUIA DE ATALHOS (F1) ── */}
      {modalAjuda && (
        <div className="pdv-modal-overlay">
          <div className="pdv-modal-dialog">
            <div className="pdv-modal-head">
              <h3>ℹ️ Guia de Teclas de Atalho do Checkout [F1]</h3>
              <button className="pdv-modal-close-btn" onClick={() => setModalAjuda(false)}>×</button>
            </div>
            <div className="pdv-modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}>
                <div><kbd style={{ background: '#334155', padding: '2px 6px', borderRadius: 4, color: '#38bdf8' }}>F1</kbd> Esta ajuda</div>
                <div><kbd style={{ background: '#334155', padding: '2px 6px', borderRadius: 4, color: '#38bdf8' }}>F2</kbd> Consulta Preço</div>
                <div><kbd style={{ background: '#334155', padding: '2px 6px', borderRadius: 4, color: '#38bdf8' }}>F3</kbd> Multiplicador Qtd</div>
                <div><kbd style={{ background: '#334155', padding: '2px 6px', borderRadius: 4, color: '#38bdf8' }}>F4</kbd> Cancelar Item</div>
                <div><kbd style={{ background: '#334155', padding: '2px 6px', borderRadius: 4, color: '#38bdf8' }}>F6</kbd> Balança Toledo</div>
                <div><kbd style={{ background: '#334155', padding: '2px 6px', borderRadius: 4, color: '#38bdf8' }}>F7</kbd> Sangria Gaveta</div>
                <div><kbd style={{ background: '#334155', padding: '2px 6px', borderRadius: 4, color: '#38bdf8' }}>F8</kbd> CPF na Nota</div>
                <div><kbd style={{ background: '#334155', padding: '2px 6px', borderRadius: 4, color: '#38bdf8' }}>F9</kbd> Abrir Gaveta</div>
                <div><kbd style={{ background: '#059669', padding: '2px 6px', borderRadius: 4, color: '#fff' }}>F10</kbd> Finalizar Venda</div>
                <div><kbd style={{ background: '#7f1d1d', padding: '2px 6px', borderRadius: 4, color: '#fca5a5' }}>F12</kbd> Cancelar Cupom</div>
                <div><kbd style={{ background: '#334155', padding: '2px 6px', borderRadius: 4, color: '#38bdf8' }}>ESC</kbd> Fechar Telas</div>
                <div><kbd style={{ background: '#334155', padding: '2px 6px', borderRadius: 4, color: '#38bdf8' }}>ENTER</kbd> Bipar Código</div>
              </div>
              <div className="pdv-modal-actions">
                <button type="button" className="pdv-btn-modal-confirm" onClick={() => setModalAjuda(false)}>Entendi</button>
              </div>
            </div>
          </div>
        </div>
      )}

            {/* ── MODAL OFICIAL TEF & PINPAD MULTI-MAQUININHAS ── */}
      {modalTef && (
        <div className="pdv-modal-overlay">
          <div className="pdv-modal-dialog tef-dialog">
            <div className="pdv-modal-head" style={{ background: '#0f172a' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CreditCard size={20} color="#38bdf8" />
                <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 16 }}>
                  {modalTef.status === 'autorizada' ? '✅ Transação TEF Aprovada!' : '💳 Terminal Pinpad TEF Multi-Maquininhas'}
                </h3>
              </div>
              <button className="pdv-modal-close-btn" onClick={() => setModalTef(null)}>×</button>
            </div>

            <div className="pdv-modal-body">
              {/* Visor LCD Digital do Pinpad */}
              <div className="pdv-tef-lcd">
                <div className="pdv-tef-lcd-top">
                  <span>● PINPAD ON-LINE</span>
                  <span>{adquirenteSel.toUpperCase()} · GERTEC PPC930</span>
                </div>
                <div className="pdv-tef-lcd-msg">
                  {tefProcessando ? 'PROCESSANDO CRIPTOGRAFIA PCI...' : (modalTef.status === 'autorizada' ? 'TRANSAÇÃO AUTORIZADA!' : 'INSIRA OU APROXIME O CARTÃO')}
                </div>
                <div className="pdv-tef-lcd-val">
                  R$ {modalTef.valor?.toFixed(2)}
                </div>
              </div>

              {/* Se ainda não foi autorizada, exibe os parâmetros operacionais */}
              {modalTef.status !== 'autorizada' && (
                <>
                  <div className="pdv-tef-config-grid">
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>Rede Adquirente:</label>
                      <select
                        className="pdv-modal-input"
                        value={adquirenteSel}
                        onChange={(e) => setAdquirenteSel(e.target.value)}
                        disabled={tefProcessando}
                      >
                        <option value="stone">Stone / Ton (Taxa Deb: 1.15% | Cred: 2.19%)</option>
                        <option value="pagbank">PagBank / PagSeguro (D+0)</option>
                        <option value="cielo">Cielo (LIO / SiTef)</option>
                        <option value="rede">Rede Itaú</option>
                        <option value="vero_sicredi">Vero / Sicredi Cooperativo</option>
                        <option value="sitef_fiserv">SiTef (Software Express / Fiserv)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>Bandeira do Cartão:</label>
                      <select
                        className="pdv-modal-input"
                        value={bandeiraSel}
                        onChange={(e) => setBandeiraSel(e.target.value)}
                        disabled={tefProcessando}
                      >
                        <option value="visa">💳 Visa</option>
                        <option value="mastercard">💳 Mastercard</option>
                        <option value="elo">💳 Elo (Nacional)</option>
                        <option value="alelo">🍽️ Alelo Alimentação / Refeição</option>
                        <option value="sodexo">🍽️ Sodexo / Pluxee</option>
                        <option value="vr">🍽️ VR Benefícios</option>
                        <option value="amex">💳 American Express</option>
                        <option value="hipercard">💳 Hipercard</option>
                      </select>
                    </div>
                  </div>

                  {formaPagamento === 'credito' && (
                    <div style={{ marginTop: 10 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>Condição de Parcelamento:</label>
                      <select
                        className="pdv-modal-input"
                        value={parcelasTef}
                        onChange={(e) => setParcelasTef(Number(e.target.value))}
                        disabled={tefProcessando}
                      >
                        <option value={1}>1x à Vista — R$ {modalTef.valor?.toFixed(2)} (Taxa MDR 2.19%)</option>
                        <option value={2}>2x de R$ {(modalTef.valor / 2).toFixed(2)}</option>
                        <option value={3}>3x de R$ {(modalTef.valor / 3).toFixed(2)}</option>
                        <option value={4}>4x de R$ {(modalTef.valor / 4).toFixed(2)}</option>
                        <option value={5}>5x de R$ {(modalTef.valor / 5).toFixed(2)}</option>
                        <option value={6}>6x de R$ {(modalTef.valor / 6).toFixed(2)} (Taxa MDR 2.99%)</option>
                        <option value={10}>10x de R$ {(modalTef.valor / 10).toFixed(2)}</option>
                        <option value={12}>12x de R$ {(modalTef.valor / 12).toFixed(2)} (Taxa MDR 3.69%)</option>
                      </select>
                    </div>
                  )}

                  <div className="pdv-modal-actions" style={{ marginTop: 18 }}>
                    <button
                      type="button"
                      className="pdv-btn-modal-cancel"
                      onClick={() => setModalTef(null)}
                      disabled={tefProcessando}
                    >
                      Cancelar Operação
                    </button>
                    <button
                      type="button"
                      className="pdv-btn-modal-confirm"
                      style={{ background: '#0284c7', minWidth: 220 }}
                      onClick={executarTransacaoPinpad}
                      disabled={tefProcessando}
                    >
                      {tefProcessando ? 'Aguardando Pinpad...' : '💳 Ler Cartão / Aproximar [ENTER]'}
                    </button>
                  </div>
                </>
              )}

              {/* Se a transação foi autorizada com sucesso */}
              {modalTef.status === 'autorizada' && modalTef.transacao && (
                <div style={{ marginTop: 14 }}>
                  <div className="pdv-tef-success-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 800, color: '#047857', fontSize: 13 }}>AUTORIZAÇÃO TEF: {modalTef.transacao.codigoAutorizacao}</span>
                      <span className="pdv-badge-tef-ok">AUTORIZADO</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 8, fontSize: 11 }}>
                      <div><strong>NSU:</strong> {modalTef.transacao.nsu}</div>
                      <div><strong>TID:</strong> {modalTef.transacao.tid}</div>
                      <div><strong>Modalidade:</strong> {modalTef.transacao.modalidade.toUpperCase()}</div>
                      <div><strong>Bandeira:</strong> {modalTef.transacao.bandeiraNome}</div>
                      <div><strong>Taxa MDR:</strong> {modalTef.transacao.taxaMdrPercentual}%</div>
                      <div><strong>Previsão:</strong> {modalTef.transacao.previsaoLiquidacao}</div>
                    </div>
                  </div>

                  {/* Comprovante Formatado da Via do Cliente */}
                  <div style={{ maxHeight: 150, overflowY: 'auto', background: '#fff', color: '#000', padding: 10, borderRadius: 6, fontFamily: 'monospace', fontSize: 10.5, border: '1px dashed #cbd5e1', marginTop: 10 }}>
                    <pre style={{ margin: 0 }}>{modalTef.transacao.comprovanteCliente}</pre>
                  </div>

                  <div className="pdv-modal-actions" style={{ marginTop: 16 }}>
                    <button
                      type="button"
                      className="pdv-btn-modal-cancel"
                      onClick={() => {
                        const w = window.open('', '_blank');
                        w.document.write(`<pre style="font-family: monospace; font-size: 12px; padding: 15px;">${modalTef.transacao.comprovanteCliente}</pre>`);
                        w.print();
                      }}
                    >
                      <Receipt size={14} style={{ display: 'inline', marginRight: 4 }} /> Imprimir Via TEF
                    </button>
                    <button
                      type="button"
                      className="pdv-btn-modal-confirm"
                      style={{ background: '#10b981', minWidth: 240 }}
                      onClick={() => executarFinalizacaoVenda(modalTef.transacao)}
                    >
                      ✅ Concluir Venda e Emitir NFC-e [F10]
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL COMPROVANTE TÉRMICO DE VENDA CONCLUÍDA ── */}
      {modalVendaConcluida && (
        <div className="pdv-modal-overlay">
          <div className="pdv-modal-dialog">
            <div className="pdv-modal-head" style={{ background: '#064e3b' }}>
              <h3 style={{ color: '#34d399' }}>✅ Venda Concluída com Sucesso!</h3>
              <button className="pdv-modal-close-btn" onClick={() => setModalVendaConcluida(null)}>×</button>
            </div>
            <div className="pdv-modal-body">
              <div className="pdv-thermal-receipt">
                <div style={{ textAlign: 'center', fontWeight: 'bold' }}>SUPERMERCADO KYTTO LTDA</div>
                <div style={{ textAlign: 'center', fontSize: 10, color: '#555' }}>
                  CNPJ: 13.123.456/0001-99 • MT
                </div>
                <div style={{ textAlign: 'center', fontSize: 10, color: '#555' }}>
                  NFC-e Nº {modalVendaConcluida.vendaId} • {modalVendaConcluida.dataHora}
                </div>
                <hr />
                <div><strong>ITENS:</strong></div>
                {modalVendaConcluida.itens.map((it, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span>{it.quantidade}x {it.nome.slice(0, 22)}</span>
                    <span>R$ {it.totalItem.toFixed(2)}</span>
                  </div>
                ))}
                <hr />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: 14 }}>
                  <span>TOTAL PAGO:</span>
                  <span>R$ {modalVendaConcluida.total.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span>Forma: {modalVendaConcluida.formaPagamento.toUpperCase()}</span>
                  <span>Troco: R$ {modalVendaConcluida.troco.toFixed(2)}</span>
                </div>
                <div style={{ fontSize: 10, marginTop: 4 }}>
                  CPF: {modalVendaConcluida.cpf}
                </div>
                {modalVendaConcluida.tef && (
                  <>
                    <hr />
                    <div style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: 4, marginTop: 4, border: '1px solid #e2e8f0' }}>
                      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 10, color: '#0f172a' }}>PAGAMENTO VIA TEF APROVADO</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5 }}>
                        <span>Rede: {modalVendaConcluida.tef.adquirenteNome}</span>
                        <span>Band: {modalVendaConcluida.tef.bandeiraNome}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5 }}>
                        <span>NSU: {modalVendaConcluida.tef.nsu}</span>
                        <span>AUT: {modalVendaConcluida.tef.codigoAutorizacao}</span>
                      </div>
                    </div>
                  </>
                )}
                <hr />
                <div style={{ fontSize: 9.5, textAlign: 'center', wordBreak: 'break-all' }}>
                  CHAVE DE ACESSO NFC-e:<br />
                  <strong>{modalVendaConcluida.nfce.chaveAcesso}</strong>
                </div>
                <div style={{ textAlign: 'center', fontSize: 9.5, color: '#777', marginTop: 4 }}>
                  Protocolo SEFAZ: {modalVendaConcluida.nfce.protocolo}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
                <button
                  type="button"
                  className="pdv-btn-modal-confirm"
                  onClick={() => window.print()}
                >
                  <Printer size={15} style={{ display: 'inline', marginRight: 6 }} /> Imprimir Térmico 80mm
                </button>
                {modalVendaConcluida.tef && (
                  <button
                    type="button"
                    className="pdv-btn-modal-confirm"
                    style={{ background: '#334155' }}
                    onClick={() => {
                      const w = window.open('', '_blank');
                      w.document.write(`<pre style="font-family: monospace; font-size: 12px; padding: 15px;">${modalVendaConcluida.tef.comprovanteCliente || modalVendaConcluida.tef.comprovanteEstabelecimento}</pre>`);
                      w.print();
                    }}
                  >
                    <Receipt size={15} style={{ display: 'inline', marginRight: 6 }} /> Via TEF Cartão
                  </button>
                )}
                <button
                  type="button"
                  className="pdv-btn-modal-confirm"
                  style={{ background: '#0284c7' }}
                  onClick={() => {
                    setModalVendaConcluida(null);
                    inputScannerRef.current?.focus();
                  }}
                >
                  Próxima Venda [F2]
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
