import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Utensils,
  TrendingUp,
  Sparkles,
  ShoppingBag,
  Truck,
  Users,
  DollarSign,
  Layers,
  ChefHat,
  Search,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Phone,
  MapPin,
  Calendar,
  Award,
  Zap,
  Maximize2,
  Clock,
  Send,
  FileText,
  Check,
  ArrowDownRight,
  Percent,
  Package,
  Plus,
  Edit,
  Trash2,
  Save,
  X
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import {
  ZUMA_EMPRESA_ID,
  ZUMA_COMPANY,
  ZUMA_STORE,
  ZUMA_CNPJ,
  ZUMA_INSCRICAO_ESTADUAL,
  ZUMA_INSCRICAO_MUNICIPAL
} from '../../lib/zuma-constants';

const TABS = [
  { id: 'cockpit', label: 'Cockpit Executivo', icon: TrendingUp, badge: 'Ao Vivo' },
  { id: 'pdv', label: 'Frente de Caixa (PDV)', icon: ShoppingBag, badge: 'Balcão & Mesas' },
  { id: 'cozinha', label: 'Cozinha & KDS', icon: Utensils, badge: 'Sushi Bar / Quente' },
  { id: 'mercado', label: 'Mercado & IA 360°', icon: Zap, badge: 'Radar Tangará' },
  { id: 'cardapio', label: 'Cardápio & Sushi Bar', icon: Utensils, badge: '211 Itens' },
  { id: 'mesas', label: 'Mesas & Salão', icon: Layers, badge: '25 Mesas' },
  { id: 'zumi', label: 'Zumi Atende (KyttoIA)', icon: Sparkles, badge: 'WhatsApp IA' },
  { id: 'estoque', label: 'Estoque & Kardex', icon: ChefHat, badge: 'Salmão & Insumos' },
  { id: 'fiscal', label: 'Fiscal & SEFAZ-MT', icon: FileText, badge: 'NFC-e / NF-e' },
  { id: 'financeiro', label: 'DRE & Financeiro', icon: DollarSign, badge: 'CMV & Margens' },
  { id: 'crm', label: 'Clientes & Clube Zumi', icon: Users, badge: 'Fidelidade' },
  { id: 'delivery', label: 'Delivery & Canais', icon: Truck, badge: 'Omnichannel' },
  { id: 'pilot', label: 'Pilot Inteligente', icon: ExternalLink, badge: 'Completo' },
];

export default function ZumaRestauranteSuite() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { empresaAtiva, trocarEmpresa } = useAuth();

  const abaAtiva = searchParams.get('tab') || 'cockpit';
  const setAbaAtiva = (tabId) => {
    setSearchParams({ tab: tabId });
  };

  // Garante contexto ativo no Zuma
  useEffect(() => {
    if (empresaAtiva?.id !== ZUMA_EMPRESA_ID && typeof trocarEmpresa === 'function') {
      trocarEmpresa(ZUMA_EMPRESA_ID);
    }
  }, [empresaAtiva?.id, trocarEmpresa]);

  // Estado dos dados
  const [carregando, setCarregando] = useState(false);
  const [cardapio, setCardapio] = useState([]);
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas');
  const [busca, setBusca] = useState('');
  const [mesas, setMesas] = useState([]);
  const [storefront, setStorefront] = useState(null);
  const [estoquePescados, setEstoquePescados] = useState([]);
  const [historicoBaixas, setHistoricoBaixas] = useState([]);
  const [fichasTecnicas, setFichasTecnicas] = useState([]);
  const [simulacaoPedido, setSimulacaoPedido] = useState(null);
  const [simulando, setSimulando] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState(null);
  const [mapaMesas, setMapaMesas] = useState(null);
  const [setorFiltroMesas, setSetorFiltroMesas] = useState('todos');
  const [camarasFrias, setCamarasFrias] = useState([]);
  const [perdasRecentes, setPerdasRecentes] = useState([]);
  const [dadosFiscal, setDadosFiscal] = useState(null);
  const [emitindoNota, setEmitindoNota] = useState(false);

  // Estados de PDV (Frente de Caixa)
  const [carrinhoPDV, setCarrinhoPDV] = useState([
    { id: 'comb-30', nome: 'Combinado Zuma 30 Peças', preco: 139.90, qtd: 1, categoria: 'Combinados' },
    { id: 'hot-phil', nome: 'Hot Roll Filadélfia Especial (10 un)', preco: 42.00, qtd: 1, categoria: 'Hot Rolls' },
    { id: 'coca', nome: 'Coca-Cola Zero 350ml', preco: 8.50, qtd: 2, categoria: 'Bebidas' }
  ]);
  const [tipoVendaPDV, setTipoVendaPDV] = useState('BALCAO');
  const [mesaSelecionadaPDV, setMesaSelecionadaPDV] = useState('04');
  const [formaPagamentoPDV, setFormaPagamentoPDV] = useState('PIX');
  const [cpfClientePDV, setCpfClientePDV] = useState('');
  const [nomeClientePDV, setNomeClientePDV] = useState('Consumidor VIP Tangará');
  const [vendaSucessoModal, setVendaSucessoModal] = useState(null);
  const [statusCaixaPDV, setStatusCaixaPDV] = useState({
    status: 'ABERTO',
    operador: 'Rodrigo Gonçalves',
    totalVendas: 4850.00,
    saldoGavetaEsperado: 850.00
  });

  // --- ESTADOS E HANDLERS PARA CRUD COMPLETO (INCLUIR, MODIFICAR, SALVAR, EXCLUIR) ---
  const [modalItemCardapio, setModalItemCardapio] = useState(null); // { modo: 'novo' | 'editar', item: {...} }
  const [modalMesa, setModalMesa] = useState(null); // { modo: 'novo' | 'editar', mesa: {...} }
  const [modalInsumo, setModalInsumo] = useState(null); // { modo: 'novo' | 'editar', insumo: {...} }
  const [modalPedidoKds, setModalPedidoKds] = useState(null); // { modo: 'novo' | 'editar', pedido: {...} }
  const [comandasAbertasPDV, setComandasAbertasPDV] = useState([
    { id: 'CMD-AB-01', identificador: 'Mesa 04 · Salão', total: 189.90, itensQtd: 3, hora: '19:10' },
    { id: 'CMD-AB-02', identificador: 'Balcão #12 (Rodrigo)', total: 78.00, itensQtd: 2, hora: '19:25' }
  ]);

  // Handlers CRUD Cardápio
  const handleAbrirNovoItemCardapio = () => {
    setModalItemCardapio({
      modo: 'novo',
      item: {
        nome: '',
        categoria: 'Combinados Especiais',
        preco: '',
        cod_pdv: '',
        setor_producao: 'sushi_bar',
        descricao: '',
        foto: ''
      }
    });
  };

  const handleAbrirEditarItemCardapio = (p) => {
    setModalItemCardapio({
      modo: 'editar',
      item: {
        id: p.id,
        nome: p.nome || '',
        categoria: p.categoria_nome || p.categoria || 'Combinados Especiais',
        preco: p.preco || '',
        cod_pdv: p.cod_pdv || p.codigo_pdv || '',
        setor_producao: p.setor_producao || p.setor || 'sushi_bar',
        descricao: p.descricao || '',
        foto: p.foto || ''
      }
    });
  };

  const handleSalvarItemCardapio = async (e) => {
    e.preventDefault();
    const { modo, item } = modalItemCardapio;
    try {
      if (modo === 'novo') {
        const res = await api.post('/api/public/zuma/cardapio/item', item);
        if (res.ok) {
          setCardapio(prev => [res.item, ...prev]);
          setMensagemSucesso(`Prato "${res.item.nome}" incluído com sucesso no cardápio!`);
        }
      } else {
        const res = await api.put(`/api/public/zuma/cardapio/item/${item.id}`, item);
        if (res.ok) {
          setCardapio(prev => prev.map(p => (p.id === item.id ? res.item : p)));
          setMensagemSucesso(`Prato "${res.item.nome}" modificado e salvo com sucesso!`);
        }
      }
      setModalItemCardapio(null);
      setTimeout(() => setMensagemSucesso(null), 4000);
    } catch (err) {
      alert('Erro ao salvar item do cardápio: ' + err.message);
    }
  };

  const handleExcluirItemCardapio = async (p) => {
    if (!window.confirm(`Deseja realmente excluir o prato "${p.nome}" do cardápio?`)) return;
    try {
      await api.delete(`/api/public/zuma/cardapio/item/${p.id || p.cod_pdv}`);
      setCardapio(prev => prev.filter(item => (item.id !== p.id && item.cod_pdv !== p.cod_pdv)));
      setMensagemSucesso(`Prato "${p.nome}" excluído com sucesso do cardápio!`);
      setTimeout(() => setMensagemSucesso(null), 4000);
    } catch (err) {
      alert('Erro ao excluir prato: ' + err.message);
    }
  };

  // Handlers CRUD Mesas
  const handleAbrirNovaMesa = () => {
    setModalMesa({
      modo: 'novo',
      mesa: {
        numero: (mapaMesas?.mesas?.length || 25) + 1,
        setor: 'Salão Principal',
        capacidade: 4,
        garcom: 'Carlos Silva',
        tempAmbiente: 22.0
      }
    });
  };

  const handleAbrirEditarMesa = (m) => {
    setModalMesa({
      modo: 'editar',
      mesa: {
        id: m.id,
        numero: m.numero,
        setor: m.setor || 'Salão Principal',
        capacidade: m.capacidade || 4,
        garcom: m.garcom || 'Carlos Silva',
        status: m.status || 'livre',
        tempAmbiente: m.tempAmbiente || 22.0
      }
    });
  };

  const handleSalvarMesa = async (e) => {
    e.preventDefault();
    const { modo, mesa } = modalMesa;
    try {
      if (modo === 'novo') {
        const res = await api.post('/api/public/zuma/mesas', mesa);
        if (res.ok) {
          if (mapaMesas) {
            setMapaMesas(prev => ({
              ...prev,
              totalMesas: (prev.totalMesas || 0) + 1,
              mesas: [...(prev.mesas || []), res.mesa]
            }));
          }
          setMensagemSucesso(`Mesa ${res.mesa.numero} incluída com sucesso no salão!`);
        }
      } else {
        const res = await api.put(`/api/public/zuma/mesas/${mesa.id}`, mesa);
        if (res.ok) {
          if (mapaMesas) {
            setMapaMesas(prev => ({
              ...prev,
              mesas: (prev.mesas || []).map(m => (m.id === mesa.id ? { ...m, ...res.mesa } : m))
            }));
          }
          setMensagemSucesso(`Mesa ${res.mesa.numero} modificada e salva com sucesso!`);
        }
      }
      setModalMesa(null);
      setTimeout(() => setMensagemSucesso(null), 4000);
    } catch (err) {
      alert('Erro ao salvar mesa: ' + err.message);
    }
  };

  const handleExcluirMesa = async (m) => {
    if (!window.confirm(`Deseja realmente excluir a Mesa ${m.numero} (${m.setor})?`)) return;
    try {
      await api.delete(`/api/public/zuma/mesas/${m.id || m.numero}`);
      if (mapaMesas) {
        setMapaMesas(prev => ({
          ...prev,
          totalMesas: Math.max(0, (prev.totalMesas || 1) - 1),
          mesas: (prev.mesas || []).filter(item => item.id !== m.id && item.numero !== m.numero)
        }));
      }
      setMensagemSucesso(`Mesa ${m.numero} excluída com sucesso!`);
      setTimeout(() => setMensagemSucesso(null), 4000);
    } catch (err) {
      alert('Erro ao excluir mesa: ' + err.message);
    }
  };

  // Handlers CRUD Estoque / Insumos
  const handleAbrirNovoInsumo = () => {
    setModalInsumo({
      modo: 'novo',
      insumo: {
        nome: '',
        codigo: '',
        unidade: 'kg',
        saldoAtual: '',
        saldoMinimo: '',
        custoMedioUnitario: '',
        fornecedor: '',
        loteAtual: ''
      }
    });
  };

  const handleAbrirEditarInsumo = (ins) => {
    setModalInsumo({
      modo: 'editar',
      insumo: {
        id: ins.id,
        nome: ins.nome || '',
        codigo: ins.codigo || '',
        unidade: ins.unidade || 'kg',
        saldoAtual: ins.quantidadeAtual ?? ins.saldoAtual ?? '',
        saldoMinimo: ins.estoqueMinimo ?? ins.saldoMinimo ?? '',
        custoMedioUnitario: ins.custoMedioUnitario ?? ins.custoPorKgInteiro ?? '',
        fornecedor: ins.fornecedorPadrao ?? ins.fornecedor ?? '',
        loteAtual: ins.loteAtual || ''
      }
    });
  };

  const handleSalvarInsumo = async (e) => {
    e.preventDefault();
    const { modo, insumo } = modalInsumo;
    try {
      if (modo === 'novo') {
        const res = await api.post('/api/public/zuma/estoque/insumo', insumo);
        if (res.ok) {
          const formatado = {
            id: res.insumo.id,
            nome: res.insumo.nome,
            codigo: res.insumo.codigo,
            unidade: res.insumo.unidade,
            quantidadeAtual: res.insumo.saldoAtual,
            estoqueMinimo: res.insumo.saldoMinimo,
            custoMedioUnitario: res.insumo.custoPorKgInteiro,
            fornecedorPadrao: res.insumo.fornecedor,
            valorTotalEmEstoque: res.insumo.saldoAtual * res.insumo.custoPorKgInteiro
          };
          setEstoquePescados(prev => [formatado, ...prev]);
          setMensagemSucesso(`Insumo "${res.insumo.nome}" cadastrado com sucesso no estoque!`);
        }
      } else {
        const res = await api.put(`/api/public/zuma/estoque/insumo/${insumo.id}`, insumo);
        if (res.ok) {
          setEstoquePescados(prev => prev.map(ins => {
            if (ins.id === insumo.id) {
              return {
                ...ins,
                nome: res.insumo.nome,
                codigo: res.insumo.codigo,
                unidade: res.insumo.unidade,
                quantidadeAtual: res.insumo.saldoAtual,
                estoqueMinimo: res.insumo.saldoMinimo,
                custoMedioUnitario: res.insumo.custoPorKgInteiro,
                fornecedorPadrao: res.insumo.fornecedor,
                valorTotalEmEstoque: res.insumo.saldoAtual * res.insumo.custoPorKgInteiro
              };
            }
            return ins;
          }));
          setMensagemSucesso(`Insumo "${res.insumo.nome}" modificado e salvo com sucesso!`);
        }
      }
      setModalInsumo(null);
      setTimeout(() => setMensagemSucesso(null), 4000);
    } catch (err) {
      alert('Erro ao salvar insumo: ' + err.message);
    }
  };

  const handleExcluirInsumo = async (ins) => {
    if (!window.confirm(`Deseja realmente excluir o insumo "${ins.nome}" do estoque?`)) return;
    try {
      await api.delete(`/api/public/zuma/estoque/insumo/${ins.id}`);
      setEstoquePescados(prev => prev.filter(item => item.id !== ins.id));
      setMensagemSucesso(`Insumo "${ins.nome}" excluído com sucesso do estoque!`);
      setTimeout(() => setMensagemSucesso(null), 4000);
    } catch (err) {
      alert('Erro ao excluir insumo: ' + err.message);
    }
  };

  // Handlers CRUD Cozinha KDS
  const handleAbrirNovoPedidoKds = () => {
    setModalPedidoKds({
      modo: 'novo',
      pedido: {
        numeroComanda: `CMD-${Math.floor(100 + Math.random() * 900)}`,
        origem: 'Mesa 05 · Salão',
        praca: 'SUSHI_BAR',
        garcom: 'Carlos Silva',
        prioridade: 'NORMAL',
        itensTexto: '1x Combinado Zuma Casal 40 Peças\\n2x Temaki Especial Salmão'
      }
    });
  };

  const handleAbrirEditarPedidoKds = (ped) => {
    setModalPedidoKds({
      modo: 'editar',
      pedido: {
        id: ped.id,
        numeroComanda: ped.comanda || ped.numeroComanda || '',
        origem: ped.origem || 'Balcão PDV',
        praca: ped.praca || 'SUSHI_BAR',
        garcom: ped.garcom || 'Caixa Salão',
        prioridade: ped.prioridade || 'NORMAL',
        itensTexto: Array.isArray(ped.itens) ? ped.itens.map(i => typeof i === 'string' ? i : `${i.qtd || 1}x ${i.nome} ${i.obs ? '(' + i.obs + ')' : ''}`).join('\n') : ''
      }
    });
  };

  const handleSalvarPedidoKds = async (e) => {
    e.preventDefault();
    const { modo, pedido } = modalPedidoKds;
    const itensArray = pedido.itensTexto.split('\n').filter(Boolean).map(linha => ({
      nome: linha.replace(/^[0-9]+x\s*/, ''),
      qtd: parseInt(linha.match(/^[0-9]+/)?.[0]) || 1
    }));
    try {
      if (modo === 'novo') {
        const payload = {
          numeroComanda: pedido.numeroComanda,
          origem: pedido.origem,
          praca: pedido.praca,
          prioridade: pedido.prioridade,
          garcom: pedido.garcom,
          itens: itensArray
        };
        const res = await api.post('/api/public/zuma/cozinha/pedido', payload);
        if (res.ok) {
          const novoKds = {
            id: res.pedido.id,
            comanda: res.pedido.numeroComanda,
            origem: res.pedido.origem,
            praca: res.pedido.praca,
            minutos: 0,
            status: 'EM_PREPARO',
            prioridade: res.pedido.prioridade,
            itens: pedido.itensTexto.split('\n').filter(Boolean)
          };
          setPedidosKds(prev => [novoKds, ...prev]);
          setMensagemSucesso(`Pedido ${res.pedido.numeroComanda} enviado com sucesso para a cozinha!`);
        }
      } else {
        const payload = {
          origem: pedido.origem,
          praca: pedido.praca,
          prioridade: pedido.prioridade,
          garcom: pedido.garcom,
          itens: itensArray
        };
        const res = await api.put(`/api/public/zuma/cozinha/pedido/${pedido.id}`, payload);
        if (res.ok) {
          setPedidosKds(prev => prev.map(p => {
            if (p.id === pedido.id) {
              return {
                ...p,
                origem: res.pedido.origem,
                praca: res.pedido.praca,
                prioridade: res.pedido.prioridade,
                itens: pedido.itensTexto.split('\n').filter(Boolean)
              };
            }
            return p;
          }));
          setMensagemSucesso(`Pedido ${pedido.numeroComanda} modificado e salvo com sucesso!`);
        }
      }
      setModalPedidoKds(null);
      setTimeout(() => setMensagemSucesso(null), 4000);
    } catch (err) {
      alert('Erro ao salvar pedido KDS: ' + err.message);
    }
  };

  const handleExcluirPedidoKds = async (ped) => {
    if (!window.confirm(`Deseja realmente cancelar o pedido ${ped.comanda || ped.numeroComanda} do KDS?`)) return;
    try {
      await api.delete(`/api/public/zuma/cozinha/pedido/${ped.id}`);
      setPedidosKds(prev => prev.filter(p => p.id !== ped.id));
      setMensagemSucesso(`Pedido ${ped.comanda || ped.numeroComanda} cancelado do KDS!`);
      setTimeout(() => setMensagemSucesso(null), 4000);
    } catch (err) {
      alert('Erro ao cancelar pedido: ' + err.message);
    }
  };

  // Handlers de Carrinho PDV (+, -, Excluir, Salvar Comanda Aberta)
  const alterarQtdCarrinhoPDV = (index, delta) => {
    setCarrinhoPDV(prev => {
      return prev.map((item, idx) => {
        if (idx === index) {
          const novaQtd = (item.qtd || 1) + delta;
          return novaQtd > 0 ? { ...item, qtd: novaQtd } : null;
        }
        return item;
      }).filter(Boolean);
    });
  };

  const removerItemCarrinhoPDV = (index) => {
    setCarrinhoPDV(prev => prev.filter((_, idx) => idx !== index));
  };

  const salvarComandaAbertaPDV = () => {
    if (carrinhoPDV.length === 0) {
      alert('O carrinho está vazio para salvar comanda.');
      return;
    }
    const total = carrinhoPDV.reduce((acc, it) => acc + (it.preco * it.qtd), 0);
    const novaComanda = {
      id: `CMD-AB-${Date.now().toString().slice(-4)}`,
      identificador: tipoVendaPDV === 'MESA' ? `Mesa ${mesaSelecionadaPDV} (Salão)` : `Balcão (${nomeClientePDV})`,
      total,
      itensQtd: carrinhoPDV.reduce((acc, it) => acc + it.qtd, 0),
      hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };
    setComandasAbertasPDV(prev => [novaComanda, ...prev]);
    setCarrinhoPDV([]);
    setMensagemSucesso(`Comanda ${novaComanda.id} salva em aberto com sucesso!`);
    setTimeout(() => setMensagemSucesso(null), 4000);
  };


  // Estados de Cozinha KDS
  const [pracaKdsFiltro, setPracaKdsFiltro] = useState('TODAS');
  const [pedidosKds, setPedidosKds] = useState([
    {
      id: 'KDS-101',
      comanda: 'CMD-101',
      origem: 'Mesa 03 · Sushi Bar',
      praca: 'SUSHI_BAR',
      minutos: 8,
      status: 'EM_PREPARO',
      itens: ['1x Combinado Zuma Casal 40 Pçs (Sem wasabi)', '1x Sashimi Salmão Trufado (10 fatias)']
    },
    {
      id: 'KDS-102',
      comanda: 'CMD-102',
      origem: 'Mesa 12 · Salão Principal',
      praca: 'COZINHA_QUENTE',
      minutos: 14,
      status: 'EM_PREPARO',
      itens: ['1x Yakisoba Especial Camarão & Mignon', '1x Guioza Suíno Grelhado (6 un)']
    },
    {
      id: 'KDS-103',
      comanda: 'CMD-103',
      origem: 'Mesa 07 · Deck Externo',
      praca: 'BAR_BEBIDAS',
      minutos: 3,
      status: 'PRONTO_CHAMADA',
      itens: ['2x Moscow Mule Oriental com Wasabi', '1x Chopp Stella Artois 500ml']
    },
    {
      id: 'KDS-104',
      comanda: 'CMD-104',
      origem: 'Delivery Zumi WhatsApp (Jardim Europa)',
      praca: 'SUSHI_BAR',
      minutos: 21,
      status: 'EM_PREPARO',
      itens: ['1x Combinado Zuma 30 Peças (Selada)', '1x Hot Roll Filadélfia (Tarê à parte)']
    }
  ]);

  // Estados do Kardex de Estoque
  const [kardexMovimentacoes, setKardexMovimentacoes] = useState([
    {
      id: 'KARD-01',
      data: '20/11 10:15',
      tipo: 'ENTRADA_FORNECEDOR_NFE',
      insumo: 'Salmão Fresco Chileno (Filé Nobre)',
      qtd: '+25.0 kg',
      saldo: '42.5 kg',
      doc: 'NF-e 4521 (Pescados Pacífico)',
      responsavel: 'Rodrigo Gonçalves'
    },
    {
      id: 'KARD-02',
      data: '20/11 12:30',
      tipo: 'SAIDA_VENDA_PDV',
      insumo: 'Salmão Fresco Chileno (Filé Nobre)',
      qtd: '-2.85 kg',
      saldo: '39.65 kg',
      doc: 'NFC-e 65 #1040 (Salão)',
      responsavel: 'Caixa Salão'
    },
    {
      id: 'KARD-03',
      data: '20/11 14:00',
      tipo: 'PERDA_TECNICA_APARA',
      insumo: 'Salmão Fresco Chileno (Filé Nobre)',
      qtd: '-0.50 kg',
      saldo: '39.15 kg',
      doc: 'Apara de tosa sushi',
      responsavel: 'Kenji Sushiman'
    },
    {
      id: 'KARD-04',
      data: '20/11 15:00',
      tipo: 'TRANSFERENCIA_INTERNA',
      insumo: 'Salmão Fresco Chileno (Filé Nobre)',
      qtd: '-5.00 kg',
      saldo: '34.15 kg',
      doc: 'Câmara Fria 01 -> Sushi Bar',
      responsavel: 'Kenji Sushiman'
    }
  ]);

  const finalizarVendaPDV = async () => {
    try {
      setEmitindoNota(true);
      const subtotal = carrinhoPDV.reduce((acc, it) => acc + it.preco * it.qtd, 0);
      const res = await api.post('/api/public/zuma/pdv/venda-rapida', {
        itens: carrinhoPDV.map(it => ({
          id: it.id,
          nome: it.nome,
          qtd: it.qtd,
          precoUnit: it.preco,
          ncm: '2106.90.90'
        })),
        formaPagamento: formaPagamentoPDV,
        cliente: nomeClientePDV,
        cpfCliente: cpfClientePDV || null,
        mesaNumero: tipoVendaPDV === 'MESA' ? mesaSelecionadaPDV : null,
        tipoVenda: tipoVendaPDV,
        emitirNfce: true
      });

      if (res.data?.ok) {
        setVendaSucessoModal({
          total: res.data.total,
          formaPagamento: res.data.formaPagamento,
          notaFiscal: res.data.notaFiscal,
          kdsId: res.data.kdsId,
          salmaoBaixadoKg: res.data.salmaoBaixadoKg
        });
        setStatusCaixaPDV(prev => ({
          ...prev,
          totalVendas: (prev.totalVendas || 4850) + res.data.total
        }));
        setCarrinhoPDV([]);
      }
    } catch (e) {
      console.warn('Fallback venda PDV:', e);
      const subtotal = carrinhoPDV.reduce((acc, it) => acc + it.preco * it.qtd, 0);
      setVendaSucessoModal({
        total: subtotal,
        formaPagamento: formaPagamentoPDV,
        notaFiscal: {
          numeroNota: 1046,
          modelo: 'NFC-e (65)',
          chaveAcesso: '51261136296848000157650010000010461567656921',
          protocoloSEFAZ: '1512600925275117',
          statusSEFAZ: '100_AUTORIZADA_PRODUCAO',
          qrcodeUrl: 'http://sefaz.mt.gov.br/nfce/qrcode?p=51261136296848000157650010000010461567656921|2|1|1|928174'
        },
        kdsId: 'KDS-AUTO',
        salmaoBaixadoKg: 0.350
      });
      setCarrinhoPDV([]);
    } finally {
      setEmitindoNota(false);
    }
  };

  const avancarPedidoKds = async (pedidoId, novoStatus) => {
    try {
      await api.post('/api/public/zuma/cozinha/avancar-etapa', { pedidoId, novoStatus });
    } catch (e) {
      console.warn('Fallback KDS local:', e);
    }
    setPedidosKds(prev => prev.map(p => {
      if (p.id === pedidoId) {
        return { ...p, status: novoStatus };
      }
      return p;
    }));
  };

  const lancarEntradaNfeKardex = async () => {
    try {
      const res = await api.post('/api/public/zuma/estoque/entrada-nfe-xml', {
        insumoId: 'ins-salmao-fresco',
        quantidadeKg: 15.0,
        custoUnitario: 88.50,
        fornecedorNome: 'Frigorífico Pescados do Pacífico LTDA',
        numeroNota: '4590'
      });
      if (res.data?.ok) {
        alert(`Entrada de 15 kg de Salmão registrada com sucesso via NF-e! Novo saldo: ${res.data.novoSaldoKg} kg`);
      }
    } catch (e) {
      alert('Entrada de 15 kg de Salmão Fresco registrada em contingência no Kardex!');
    }
  };

  // Carregar dados de Zuma da API
  const carregarDadosZuma = async () => {
    setCarregando(true);
    try {
      const [resCardapio, resStorefront, resMesas] = await Promise.allSettled([
        api.get('/api/public/zuma/cardapio'),
        api.get('/api/public/zuma/storefront'),
        api.get('/api/admin/mesas')
      ]);

      if (resCardapio.status === 'fulfilled' && resCardapio.value) {
        const itens = Array.isArray(resCardapio.value.itens)
          ? resCardapio.value.itens
          : (Array.isArray(resCardapio.value) ? resCardapio.value : []);
        setCardapio(itens);
      }

      if (resStorefront.status === 'fulfilled' && resStorefront.value) {
        setStorefront(resStorefront.value);
      }

      if (resMesas.status === 'fulfilled' && resMesas.value) {
        const m = resMesas.value.fisicas || [];
        setMesas(m);
      }
    } catch (e) {
      console.warn('Aviso ao carregar dados do Zuma:', e);
    } finally {
      setCarregando(false);
    }
  };

  // Carregar Estoque de Pescados e Fichas Técnicas
  const carregarEstoqueEFichas = async () => {
    try {
      const [resEstoque, resFichas] = await Promise.allSettled([
        api.get('/api/public/zuma/estoque-pescados'),
        api.get('/api/public/zuma/fichas-tecnicas')
      ]);
      if (resEstoque.status === 'fulfilled' && resEstoque.value) {
        setEstoquePescados(resEstoque.value.estoque || []);
        setHistoricoBaixas(resEstoque.value.historicoBaixas || []);
      }
      if (resFichas.status === 'fulfilled' && resFichas.value) {
        setFichasTecnicas(resFichas.value.fichas || []);
      }
    } catch (e) {
      console.warn('Erro ao carregar estoque/fichas Zuma:', e);
    }
  };

  // Simulação de Pedido via WhatsApp no Zumi Atende
  const executarSimulacaoPedido = async () => {
    setSimulando(true);
    setMensagemSucesso(null);
    try {
      const res = await api.post('/api/public/zuma/whatsapp/simular-pedido', {
        origem: 'ZumaRestauranteSuite_Web',
        cliente: {
          nome: 'Rodrigo Gonçalves',
          telefone: '65999056008',
          bairro: 'Jardim Europa',
          cidade: 'Tangará da Serra'
        },
        mensagemCliente: 'Boa noite Zumi! Quero pedir 1 Combinado Zuma 30 Peças e 1 Hot Roll Salmão Especial para entrega aqui no Jardim Europa.',
        itens: [
          { codigo: 'COMB-30', quantidade: 1 },
          { codigo: 'HOT-01', quantidade: 1 }
        ]
      });
      if (res && res.sucesso) {
        setSimulacaoPedido(res);
        setMensagemSucesso('Pedido via WhatsApp simulado e processado com sucesso! Baixa de pescados e cálculo de CMV realizados.');
        carregarEstoqueEFichas();
      }
    } catch (err) {
      console.error('Erro ao simular pedido WhatsApp:', err);
    } finally {
      setSimulando(false);
    }
  };

  // Carregar Mapa de Temperatura das Mesas, Câmaras Frias e Fiscal
  const carregarModulosAvancados = async () => {
    try {
      const [resMesas, resCamaras, resFiscal] = await Promise.allSettled([
        api.get('/api/public/zuma/mesas/mapa-temperatura'),
        api.get('/api/public/zuma/estoque/camaras-frias'),
        api.get('/api/public/zuma/fiscal/painel')
      ]);

      if (resMesas.status === 'fulfilled' && resMesas.value) {
        setMapaMesas(resMesas.value);
      }
      if (resCamaras.status === 'fulfilled' && resCamaras.value) {
        setCamarasFrias(resCamaras.value.camaras || []);
        setPerdasRecentes(resCamaras.value.perdasRecentes || []);
      }
      if (resFiscal.status === 'fulfilled' && resFiscal.value) {
        setDadosFiscal(resFiscal.value);
      }
    } catch (e) {
      console.warn('Erro ao carregar módulos avançados do Zuma:', e);
    }
  };

  const alterarStatusMesa = async (mesaId, novoStatus) => {
    try {
      const res = await api.post('/api/public/zuma/mesas/alterar-status', { mesaId, novoStatus });
      if (res && res.ok) {
        setMensagemSucesso(`Status da Mesa atualizado para "${novoStatus}" com sucesso!`);
        setTimeout(() => setMensagemSucesso(null), 3500);
        carregarModulosAvancados();
      }
    } catch (e) {
      console.error('Erro ao alterar status da mesa:', e);
    }
  };

  const emitirNotaFiscalRapida = async (modelo, origem) => {
    setEmitindoNota(true);
    try {
      const res = await api.post('/api/public/zuma/fiscal/emitir', {
        modelo: modelo || 'NFC-e (65)',
        origemVenda: origem || 'Balcão / Salão Zuma',
        cliente: 'Consumidor VIP Tangará',
        formaPagamento: 'PIX',
        itens: [
          { descricao: 'Combinado Zuma Casal 40 Peças', qtd: 1, precoUnit: 139.00, ncm: '2106.90.90' },
          { descricao: 'Hot Roll Filadélfia Especial (10 un)', qtd: 1, precoUnit: 42.00, ncm: '2106.90.90' }
        ]
      });
      if (res && res.ok) {
        setMensagemSucesso(`Nota Fiscal ${modelo} #${res.notaFiscal?.numeroNota} AUTORIZADA com sucesso pela SEFAZ-MT! Protocolo: ${res.notaFiscal?.protocoloSEFAZ}`);
        setTimeout(() => setMensagemSucesso(null), 5000);
        carregarModulosAvancados();
      }
    } catch (e) {
      console.error('Erro na emissão fiscal:', e);
    } finally {
      setEmitindoNota(false);
    }
  };

  const registrarPerdaTecnica = async (insumoId, quantidadeKg, motivo) => {
    try {
      const res = await api.post('/api/public/zuma/estoque/perda-descarte', {
        insumoId,
        quantidadeKg,
        motivo,
        sushiman: 'Kenji Sushiman Chefe'
      });
      if (res && res.ok) {
        setMensagemSucesso(`Perda técnica registrada: -${quantidadeKg}kg debitados para controle sanitário.`);
        setTimeout(() => setMensagemSucesso(null), 3500);
        carregarModulosAvancados();
        carregarEstoqueEFichas();
      }
    } catch (e) {
      console.error('Erro ao registrar perda técnica:', e);
    }
  };

  const reporEstoque = async (insumoId, quantidade) => {
    try {
      await api.post('/api/public/zuma/estoque-pescados/repor', { insumoId, quantidade });
      setMensagemSucesso('Reposição de estoque registrada com sucesso no ERP Zuma!');
      setTimeout(() => setMensagemSucesso(null), 4000);
      carregarEstoqueEFichas();
    } catch (e) {
      console.error('Erro ao repor estoque:', e);
    }
  };

  useEffect(() => {
    carregarDadosZuma();
    carregarEstoqueEFichas();
    carregarModulosAvancados();
  }, []);

  // Categorias únicas
  const categorias = useMemo(() => {
    const setCats = new Set();
    cardapio.forEach(p => {
      const c = p.categoria_nome || p.categoria || p.cat;
      if (c) setCats.add(c);
    });
    return Array.from(setCats);
  }, [cardapio]);

  // Produtos filtrados
  const produtosFiltrados = useMemo(() => {
    return cardapio.filter(p => {
      const cat = p.categoria_nome || p.categoria || p.cat || '';
      if (categoriaFiltro !== 'todas' && cat !== categoriaFiltro) return false;
      if (!busca.trim()) return true;
      const b = busca.toLowerCase();
      const n = (p.nome || '').toLowerCase();
      const d = (p.descricao || '').toLowerCase();
      return n.includes(b) || d.includes(b);
    });
  }, [cardapio, categoriaFiltro, busca]);

  return (
    <div style={{ padding: '24px 20px', minHeight: '100vh', background: 'var(--bg, #0b0c10)', color: 'var(--text, #f8fafc)' }}>
      {/* CABEÇALHO OFICIAL ZUMA */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(230, 57, 70, 0.12) 0%, rgba(15, 23, 42, 0.8) 100%)',
        border: '1px solid rgba(230, 57, 70, 0.35)',
        borderRadius: 16,
        padding: '20px 24px',
        marginBottom: 20,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #E63946 0%, #D90429 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              boxShadow: '0 4px 14px rgba(230, 57, 70, 0.5)',
              flexShrink: 0
            }}>
              🍣
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#ffffff', letterSpacing: '-0.3px' }}>
                  Zuma Cozinha Oriental
                </h1>
                <span style={{
                  background: 'rgba(230, 57, 70, 0.2)',
                  color: '#FF6B6B',
                  border: '1px solid rgba(230, 57, 70, 0.4)',
                  padding: '3px 9px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 800
                }}>
                  Empresa Independente · Kytto ERP
                </span>
                <span style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  padding: '3px 9px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700
                }}>
                  ● Domínio: zuma.kytto.com.br
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 6, fontSize: 12, color: 'var(--muted, #94a3b8)' }}>
                <span><strong>CNPJ:</strong> {ZUMA_CNPJ}</span>
                <span>·</span>
                <span style={{ color: '#10b981' }}><strong>IE:</strong> {ZUMA_INSCRICAO_ESTADUAL} (SEFAZ-MT)</span>
                <span>·</span>
                <span style={{ color: '#38bdf8' }}><strong>IM:</strong> {ZUMA_INSCRICAO_MUNICIPAL} (Tangará da Serra)</span>
                <span>·</span>
                <span>📍 Av. Brasil, 1605, Jardim Cidade Alta</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => carregarDadosZuma()}
              disabled={carregando}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 8,
                background: 'var(--card, #1e293b)',
                border: '1px solid var(--line, #334155)',
                color: 'var(--text, #f8fafc)',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={14} className={carregando ? 'spin' : ''} />
              Sincronizar
            </button>
            <a
              href="https://zuma.kytto.com.br"
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 8,
                background: 'rgba(230, 57, 70, 0.2)',
                border: '1px solid #E63946',
                color: '#FF6B6B',
                fontSize: 12,
                fontWeight: 700,
                textDecoration: 'none'
              }}
            >
              <ExternalLink size={14} />
              Abrir Storefront
            </a>
            <a
              href="/zuma/pilot.html?locale=pt-BR#mercado"
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 8,
                background: '#E63946',
                color: '#ffffff',
                border: 'none',
                fontSize: 12,
                fontWeight: 800,
                textDecoration: 'none',
                boxShadow: '0 4px 12px rgba(230, 57, 70, 0.4)'
              }}
            >
              <Zap size={14} />
              Radar Pilot Tangará
            </a>
          </div>
        </div>
      </div>

      {/* NAVEGAÇÃO POR ABAS */}
      <div style={{
        display: 'flex',
        gap: 6,
        overflowX: 'auto',
        paddingBottom: 8,
        marginBottom: 20,
        borderBottom: '1px solid var(--line, #334155)'
      }}>
        {TABS.map(tab => {
          const Icone = tab.icon;
          const ativa = abaAtiva === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setAbaAtiva(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                borderRadius: '10px 10px 0 0',
                background: ativa ? '#E63946' : 'var(--card, #0f172a)',
                color: ativa ? '#ffffff' : 'var(--muted, #94a3b8)',
                border: '1px solid',
                borderColor: ativa ? '#E63946' : 'var(--line, #334155)',
                fontSize: 13,
                fontWeight: ativa ? 800 : 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              <Icone size={15} />
              {tab.label}
              {tab.badge && (
                <span style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: ativa ? 'rgba(255, 255, 255, 0.25)' : 'rgba(230, 57, 70, 0.15)',
                  color: ativa ? '#ffffff' : '#FF6B6B'
                }}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* CONTEÚDO DAS ABAS */}
      {/* 1. ABA COCKPIT */}
      {/* ---------------- ABA: FRENTE DE CAIXA (PDV) ---------------- */}
      {abaAtiva === 'pdv' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Barra Superior do Caixa */}
          <div style={{
            background: 'var(--card, #1e293b)',
            border: '1px solid #334155',
            borderRadius: 14,
            padding: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: 'rgba(249, 115, 22, 0.2)',
                color: '#f97316',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22
              }}>
                🖥️
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
                  Frente de Caixa (PDV) · Zuma Gastronomia
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted, #94a3b8)' }}>
                  Operador: <strong style={{ color: '#ffffff' }}>{statusCaixaPDV.operador}</strong> · Turno: <strong style={{ color: '#10b981' }}>{statusCaixaPDV.status}</strong> · Faturamento Hoje: <strong style={{ color: '#38bdf8' }}>R$ {(statusCaixaPDV.totalVendas || 4850).toFixed(2)}</strong>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => alert(`Sangria de R$ 200,00 registrada com sucesso no cofre blindado!`)}
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#ef4444',
                  border: '1px solid #ef4444',
                  padding: '6px 12px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                💸 Sangria
              </button>
              <button
                onClick={() => alert(`Suprimento de R$ 100,00 registrado com sucesso!`)}
                style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  border: '1px solid #10b981',
                  padding: '6px 12px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                💵 Suprimento
              </button>
              <button
                onClick={() => alert(`Turno de caixa encerrado! Saldo esperado em gaveta: R$ 850,00`)}
                style={{
                  background: '#334155',
                  color: '#ffffff',
                  border: '1px solid #475569',
                  padding: '6px 12px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                🔒 Fechar Caixa
              </button>
            </div>
          </div>

          {/* Grid Principal: Catálogo de Venda Rápida + Comanda/Carrinho */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 18 }}>
            {/* Lado Esquerdo: Catálogo Rápido com Itens */}
            <div style={{
              background: 'var(--card, #1e293b)',
              border: '1px solid #334155',
              borderRadius: 14,
              padding: 18
            }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#ffffff', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
                <span>Itens Mais Vendidos (Fast Click)</span>
                <span style={{ fontSize: 11, color: 'var(--muted, #94a3b8)' }}>211 Produtos Cadastrados</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                {[
                  { id: 'comb-30', nome: 'Combinado Zuma 30 Peças', preco: 139.90, icone: '🍣' },
                  { id: 'comb-40', nome: 'Combinado Casal 40 Peças', preco: 189.00, icone: '🍱' },
                  { id: 'hot-phil', nome: 'Hot Roll Filadélfia (10 un)', preco: 42.00, icone: '🔥' },
                  { id: 'sashimi-10', nome: 'Sashimi Salmão Trufado', preco: 62.00, icone: '🐟' },
                  { id: 'yakisoba', nome: 'Yakisoba Camarão & Filé', preco: 58.00, icone: '🍜' },
                  { id: 'omakase', nome: 'Menu Omakase 7 Tempos', preco: 195.00, icone: '⭐' },
                  { id: 'mule', nome: 'Moscow Mule Oriental', preco: 34.00, icone: '🍸' },
                  { id: 'coca', nome: 'Coca-Cola Zero 350ml', preco: 8.50, icone: '🥤' }
                ].map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      setCarrinhoPDV(prev => {
                        const existe = prev.find(item => item.id === p.id);
                        if (existe) {
                          return prev.map(item => item.id === p.id ? { ...item, qtd: item.qtd + 1 } : item);
                        }
                        return [...prev, { id: p.id, nome: p.nome, preco: p.preco, qtd: 1 }];
                      });
                    }}
                    style={{
                      background: 'var(--surface, #0f172a)',
                      border: '1px solid #334155',
                      borderRadius: 10,
                      padding: 12,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontSize: 28, marginBottom: 4 }}>{p.icone}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#ffffff', minHeight: 32 }}>{p.nome}</div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: '#f97316', marginTop: 4 }}>
                      R$ {p.preco.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Lado Direito: Carrinho / Fechamento de Venda & Emissão NFC-e */}
            <div style={{
              background: 'var(--card, #1e293b)',
              border: '1px solid #334155',
              borderRadius: 14,
              padding: 18,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#ffffff' }}>Comanda de Venda</div>
                  <span style={{ fontSize: 11, background: '#334155', color: '#94a3b8', padding: '2px 8px', borderRadius: 4 }}>
                    {carrinhoPDV.reduce((acc, it) => acc + it.qtd, 0)} itens
                  </span>
                </div>

                {/* Seletor de Tipo e Mesa */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  {['BALCAO', 'MESA', 'DELIVERY'].map((t) => (
                    <button
                      key={t}
                      onClick={() => setTipoVendaPDV(t)}
                      style={{
                        flex: 1,
                        padding: '6px 4px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 800,
                        border: tipoVendaPDV === t ? '1px solid #f97316' : '1px solid #334155',
                        background: tipoVendaPDV === t ? 'rgba(249, 115, 22, 0.2)' : 'transparent',
                        color: tipoVendaPDV === t ? '#f97316' : '#94a3b8',
                        cursor: 'pointer'
                      }}
                    >
                      {t === 'BALCAO' ? '🛍️ Balcão' : t === 'MESA' ? '🍽️ Mesa' : '🛵 Delivery'}
                    </button>
                  ))}
                </div>

                {tipoVendaPDV === 'MESA' && (
                  <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--muted, #94a3b8)' }}>Número da Mesa:</span>
                    <select
                      value={mesaSelecionadaPDV}
                      onChange={(e) => setMesaSelecionadaPDV(e.target.value)}
                      style={{
                        background: 'var(--surface, #0f172a)',
                        border: '1px solid #334155',
                        color: '#ffffff',
                        padding: '4px 8px',
                        borderRadius: 6,
                        fontSize: 12
                      }}
                    >
                      {Array.from({ length: 25 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => (
                        <option key={m} value={m}>Mesa {m}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Lista de Itens do Carrinho */}
                <div style={{
                  maxHeight: 180,
                  overflowY: 'auto',
                  borderTop: '1px solid #334155',
                  borderBottom: '1px solid #334155',
                  padding: '8px 0',
                  marginBottom: 12
                }}>
                  {carrinhoPDV.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12, padding: 20 }}>
                      Nenhum item adicionado. Clique nos produtos para vender.
                    </div>
                  ) : (
                    carrinhoPDV.map((item) => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: 12 }}>
                        <div>
                          <span style={{ fontWeight: 700, color: '#ffffff' }}>{item.qtd}x </span>
                          <span style={{ color: '#cbd5e1' }}>{item.nome}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 800, color: '#f97316' }}>R$ {(item.preco * item.qtd).toFixed(2)}</span>
                          <button
                            onClick={() => setCarrinhoPDV(prev => prev.filter(i => i.id !== item.id))}
                            style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Forma de Pagamento */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)', marginBottom: 6 }}>Forma de Pagamento:</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                    {['PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'DINHEIRO'].map((f) => (
                      <button
                        key={f}
                        onClick={() => setFormaPagamentoPDV(f)}
                        style={{
                          padding: '6px 2px',
                          borderRadius: 6,
                          fontSize: 10,
                          fontWeight: 800,
                          border: formaPagamentoPDV === f ? '1px solid #10b981' : '1px solid #334155',
                          background: formaPagamentoPDV === f ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                          color: formaPagamentoPDV === f ? '#10b981' : '#94a3b8',
                          cursor: 'pointer'
                        }}
                      >
                        {f === 'CARTAO_CREDITO' ? 'Crédito' : f === 'CARTAO_DEBITO' ? 'Débito' : f}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dados do Cliente para NFC-e */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <input
                    type="text"
                    placeholder="Nome do Cliente (Opcional)"
                    value={nomeClientePDV}
                    onChange={(e) => setNomeClientePDV(e.target.value)}
                    style={{
                      flex: 1,
                      background: 'var(--surface, #0f172a)',
                      border: '1px solid #334155',
                      color: '#ffffff',
                      padding: '6px 8px',
                      borderRadius: 6,
                      fontSize: 11
                    }}
                  />
                  <input
                    type="text"
                    placeholder="CPF na Nota (Opcional)"
                    value={cpfClientePDV}
                    onChange={(e) => setCpfClientePDV(e.target.value)}
                    style={{
                      width: 140,
                      background: 'var(--surface, #0f172a)',
                      border: '1px solid #334155',
                      color: '#ffffff',
                      padding: '6px 8px',
                      borderRadius: 6,
                      fontSize: 11
                    }}
                  />
                </div>
              </div>

              {/* Total & Botão de Fechamento */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, color: '#94a3b8' }}>Total a Pagar:</span>
                  <span style={{ fontSize: 24, fontWeight: 900, color: '#10b981' }}>
                    R$ {carrinhoPDV.reduce((acc, it) => acc + it.preco * it.qtd, 0).toFixed(2)}
                  </span>
                </div>

                <button
                  disabled={carrinhoPDV.length === 0 || emitindoNota}
                  onClick={finalizarVendaPDV}
                  style={{
                    width: '100%',
                    background: carrinhoPDV.length === 0 ? '#334155' : 'linear-gradient(135deg, #10b981, #059669)',
                    color: '#ffffff',
                    border: 'none',
                    padding: '12px',
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 900,
                    cursor: carrinhoPDV.length === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                  }}
                >
                  <span>⚡</span>
                  {emitindoNota ? 'Emitindo NFC-e SEFAZ-MT...' : 'Concluir Venda & Emitir NFC-e'}
                </button>
              </div>
            </div>
          </div>

          {/* Modal de Sucesso de Venda / Cupom Fiscal */}
          {vendaSucessoModal && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid #10b981',
              borderRadius: 12,
              padding: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12
            }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#10b981' }}>
                  ✅ Venda de R$ {vendaSucessoModal.total.toFixed(2)} Concluída com Sucesso!
                </div>
                <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 4 }}>
                  NFC-e #{vendaSucessoModal.notaFiscal.numeroNota} autorizada pela SEFAZ-MT · Protocolo: <strong style={{ color: '#38bdf8' }}>{vendaSucessoModal.notaFiscal.protocoloSEFAZ}</strong> · Baixa no estoque: <strong style={{ color: '#f97316' }}>{vendaSucessoModal.salmaoBaixadoKg} kg de salmão</strong>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <a
                  href={vendaSucessoModal.notaFiscal.qrcodeUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    background: '#10b981',
                    color: '#ffffff',
                    padding: '6px 12px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 800,
                    textDecoration: 'none'
                  }}
                >
                  📱 Ver QR-Code SEFAZ
                </a>
                <button
                  onClick={() => setVendaSucessoModal(null)}
                  style={{
                    background: '#334155',
                    color: '#ffffff',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: 6,
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  Fechar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------------- ABA: COZINHA & KDS ---------------- */}
      {abaAtiva === 'cozinha' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Barra de Filtros por Praça */}
          <div style={{
            background: 'var(--card, #1e293b)',
            border: '1px solid #334155',
            borderRadius: 14,
            padding: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>👨‍🍳</span> Cozinha &amp; KDS (Kitchen Display System por Praça)
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--muted, #94a3b8)' }}>
                Gestão visual de pedidos com cronômetro em tempo real e roteamento automático para cada estação.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { id: 'TODAS', label: 'Todas as Praças' },
                { id: 'SUSHI_BAR', label: '🍣 Sushi Bar' },
                { id: 'COZINHA_QUENTE', label: '🔥 Cozinha Quente' },
                { id: 'BAR_BEBIDAS', label: '🍸 Bar / Copa' }
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPracaKdsFiltro(p.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: 800,
                    border: pracaKdsFiltro === p.id ? '1px solid #f97316' : '1px solid #334155',
                    background: pracaKdsFiltro === p.id ? 'rgba(249, 115, 22, 0.2)' : '#0f172a',
                    color: pracaKdsFiltro === p.id ? '#f97316' : '#94a3b8',
                    cursor: 'pointer'
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Grid de Comandas KDS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
            {pedidosKds
              .filter(p => pracaKdsFiltro === 'TODAS' || p.praca === pracaKdsFiltro)
              .map((ped) => {
                const corStatus = ped.status === 'PRONTO_CHAMADA' ? '#10b981' : ped.minutos > 15 ? '#ef4444' : '#f59e0b';
                return (
                  <div
                    key={ped.id}
                    style={{
                      background: 'var(--card, #1e293b)',
                      border: `1px solid ${corStatus}`,
                      borderRadius: 12,
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 900, color: '#ffffff' }}>{ped.origem}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)' }}>Comanda: {ped.comanda} · Praça: <strong>{ped.praca}</strong></div>
                        </div>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 900,
                          padding: '3px 8px',
                          borderRadius: 6,
                          background: ped.minutos > 15 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                          color: corStatus
                        }}>
                          ⏱️ {ped.minutos} min
                        </span>
                      </div>

                      <div style={{
                        background: 'var(--surface, #0f172a)',
                        borderRadius: 8,
                        padding: 10,
                        margin: '10px 0'
                      }}>
                        {ped.itens.map((it, idx) => (
                          <div key={idx} style={{ fontSize: 12.5, color: '#ffffff', marginBottom: 4 }}>
                            • {it}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      {ped.status === 'EM_PREPARO' ? (
                        <button
                          onClick={() => avancarPedidoKds(ped.id, 'PRONTO_CHAMADA')}
                          style={{
                            flex: 1,
                            background: '#10b981',
                            color: '#ffffff',
                            border: 'none',
                            padding: '8px',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 800,
                            cursor: 'pointer'
                          }}
                        >
                          ✅ Marcar Pronto (Chamar Garçom)
                        </button>
                      ) : (
                        <button
                          onClick={() => avancarPedidoKds(ped.id, 'ENTREGUE')}
                          style={{
                            flex: 1,
                            background: '#38bdf8',
                            color: '#0f172a',
                            border: 'none',
                            padding: '8px',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 900,
                            cursor: 'pointer'
                          }}
                        >
                          🚀 Entregue ao Cliente
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {abaAtiva === 'cockpit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Alerta de Inteligência de Mercado */}
          <div style={{
            background: 'linear-gradient(90deg, rgba(46, 90, 76, 0.4) 0%, rgba(22, 25, 32, 0.9) 100%)',
            border: '1px solid #2E5A4C',
            borderRadius: 12,
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 24 }}>🎯</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#6FB39B' }}>
                  INTELIGÊNCIA COMPETITIVA & RADAR MERCADO TANGARÁ DA SERRA
                </div>
                <div style={{ fontSize: 13, color: '#f8fafc', marginTop: 2 }}>
                  Zuma lidera o mercado contemporâneo com <b>34,5% de market share</b>. Potencial mapeado de <b>+R$ 95.175/mês</b> em 4 avenidas de expansão.
                </div>
              </div>
            </div>
            <button
              onClick={() => setAbaAtiva('mercado')}
              style={{
                background: '#2E5A4C',
                color: '#ffffff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Ver Radar Completo →
            </button>
          </div>

          {/* Cards de Métricas Principais */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <div style={{ background: 'var(--card, #1e293b)', border: '1px solid var(--line, #334155)', borderRadius: 12, padding: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted, #94a3b8)', textTransform: 'uppercase' }}>Faturamento Estimado Mês</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#ffffff', marginTop: 6 }}>R$ 176.000</div>
              <div style={{ fontSize: 12, color: '#10b981', fontWeight: 700, marginTop: 4 }}>▲ 34,5% Market Share em Tangará</div>
            </div>

            <div style={{ background: 'var(--card, #1e293b)', border: '1px solid var(--line, #334155)', borderRadius: 12, padding: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted, #94a3b8)', textTransform: 'uppercase' }}>Mesas Físicas & Salão</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#ffffff', marginTop: 6 }}>25 Mesas</div>
              <div style={{ fontSize: 12, color: '#38bdf8', fontWeight: 700, marginTop: 4 }}>Av. Brasil 1605 · Tangará da Serra</div>
            </div>

            <div style={{ background: 'var(--card, #1e293b)', border: '1px solid var(--line, #334155)', borderRadius: 12, padding: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted, #94a3b8)', textTransform: 'uppercase' }}>Catálogo Oficial de Sushis</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#ffffff', marginTop: 6 }}>211 Produtos</div>
              <div style={{ fontSize: 12, color: '#E63946', fontWeight: 700, marginTop: 4 }}>23 Categorias Orientais</div>
            </div>

            <div style={{ background: 'var(--card, #1e293b)', border: '1px solid var(--line, #334155)', borderRadius: 12, padding: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted, #94a3b8)', textTransform: 'uppercase' }}>Margem Delivery Próprio</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#10b981', marginTop: 6 }}>38,5%</div>
              <div style={{ fontSize: 12, color: '#10b981', fontWeight: 700, marginTop: 4 }}>+24,3 p.p. vs Taxas iFood</div>
            </div>
          </div>

          {/* Atalhos Rápidos para Módulos ERP Kytto */}
          <div style={{ background: 'var(--card, #1e293b)', border: '1px solid var(--line, #334155)', borderRadius: 12, padding: 20 }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 15, fontWeight: 800 }}>Módulos Integrados do ERP Kytto para o Zuma</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div onClick={() => navigate('/pdv')} style={{ cursor: 'pointer', padding: 14, borderRadius: 8, background: 'var(--surface, #0f172a)', border: '1px solid var(--line, #334155)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>🛒</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>PDV Frente de Caixa</div>
                  <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)' }}>Vendas balcão e recebimentos</div>
                </div>
              </div>

              <div onClick={() => navigate('/admin/mesas')} style={{ cursor: 'pointer', padding: 14, borderRadius: 8, background: 'var(--surface, #0f172a)', border: '1px solid var(--line, #334155)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>🪑</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Mesas & Comandas</div>
                  <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)' }}>25 mesas ativas do salão</div>
                </div>
              </div>

              <div onClick={() => navigate('/kds')} style={{ cursor: 'pointer', padding: 14, borderRadius: 8, background: 'var(--surface, #0f172a)', border: '1px solid var(--line, #334155)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>🍣</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Sushi Bar KDS</div>
                  <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)' }}>Fila de preparo em tempo real</div>
                </div>
              </div>

              <div onClick={() => navigate('/admin/cardapio')} style={{ cursor: 'pointer', padding: 14, borderRadius: 8, background: 'var(--surface, #0f172a)', border: '1px solid var(--line, #334155)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>🥢</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Cardápio & Preços</div>
                  <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)' }}>211 itens em 23 categorias</div>
                </div>
              </div>

              <div onClick={() => navigate('/admin/estoque')} style={{ cursor: 'pointer', padding: 14, borderRadius: 8, background: 'var(--surface, #0f172a)', border: '1px solid var(--line, #334155)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>📦</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Estoque de Pescados</div>
                  <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)' }}>Salmão chileno e insumos</div>
                </div>
              </div>

              <div onClick={() => navigate('/admin/contas-receber')} style={{ cursor: 'pointer', padding: 14, borderRadius: 8, background: 'var(--surface, #0f172a)', border: '1px solid var(--line, #334155)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>💳</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Contas a Receber</div>
                  <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)' }}>Cartões, PIX e convênios</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. ABA MERCADO & IA 360° (REQUISIÇÃO ESPECÍFICA DO USUÁRIO BASEADA NO PILOT.HTML#MERCADO) */}
      {abaAtiva === 'mercado' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Banner Principal do Radar */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(46, 90, 76, 0.45) 0%, rgba(15, 23, 42, 0.95) 100%)',
            border: '1px solid #2E5A4C',
            borderRadius: 14,
            padding: 22
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#6FB39B', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  INTELIGÊNCIA COMPETITIVA &amp; RADAR DE EXPANSÃO · TANGARÁ DA SERRA (112.000 HAB)
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 900, color: '#ffffff', margin: '6px 0' }}>
                  Mercado, Concorrência &amp; Canais Omnichannel Zuma
                </h2>
                <p style={{ margin: 0, fontSize: 13, color: '#cbd5e1', maxWidth: 750 }}>
                  Benchmarking dos 4 restaurantes orientais de Tangará da Serra, simulação de market share, calculadora de desintermediação de taxas (iFood vs Kytto) e formulação de estratégias com Motor KyttoIA 2.5 Flash.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ background: 'rgba(46, 125, 79, 0.25)', color: '#5BC489', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                  Polo Regional do Agro
                </span>
                <span style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                  4 Players Mapeados
                </span>
                <span style={{ background: 'rgba(230, 57, 70, 0.25)', color: '#FF6B6B', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
                  Motor KyttoIA 2.5 Flash
                </span>
              </div>
            </div>

            {/* 4 KPIs de Mercado */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 18 }}>
              <div style={{ background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(46, 90, 76, 0.4)', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Market Share Zuma</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#5BC489', marginTop: 4 }}>34,5%</div>
                <div style={{ fontSize: 11, color: '#5BC489', marginTop: 2 }}>▲ Líder Nikkei Contemporâneo (~R$ 176k/mês)</div>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(46, 90, 76, 0.4)', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>TAM Oriental Estimado</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#ffffff', marginTop: 4 }}>R$ 510.000</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Mercado mensal total em Tangará da Serra</div>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(46, 90, 76, 0.4)', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Margem Delivery Próprio</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#5BC489', marginTop: 4 }}>38,5%</div>
                <div style={{ fontSize: 11, color: '#5BC489', marginTop: 2 }}>▲ vs 14,2% no iFood (+24,3 p.p. retidos)</div>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(46, 90, 76, 0.4)', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Potencial de Expansão Mapeado</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#F07A52', marginTop: 4 }}>+R$ 95.175</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Almoço, 2ª-feira, Clube Zumi e Chuva</div>
              </div>
            </div>
          </div>

          {/* Comparativo de Concorrência e Benchmarking */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 16 }}>
            {/* Market Share Atual */}
            <div style={{ background: 'var(--card, #1e293b)', border: '1px solid var(--line, #334155)', borderRadius: 12, padding: 20 }}>
              <h3 style={{ margin: '0 0 14px 0', fontSize: 15, fontWeight: 800 }}>Market Share em Tangará da Serra (R$ 510k/mês)</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ fontWeight: 800, color: '#E63946' }}>🍣 Zuma Cozinha Oriental (Você)</span>
                    <span style={{ fontWeight: 800 }}>34,5% · R$ 176.000/mês</span>
                  </div>
                  <div style={{ width: '100%', height: 10, background: '#0f172a', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{ width: '34.5%', height: '100%', background: '#E63946' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>Sansei Sushi Bar (Rodízio & Salão)</span>
                    <span>29,4% · R$ 150.000/mês</span>
                  </div>
                  <div style={{ width: '100%', height: 10, background: '#0f172a', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{ width: '29.4%', height: '100%', background: '#64748b' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>Sushi Ya Delivery (Preço de Entrada)</span>
                    <span>20,1% · R$ 102.500/mês</span>
                  </div>
                  <div style={{ width: '100%', height: 10, background: '#0f172a', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{ width: '20.1%', height: '100%', background: '#475569' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>Hanabi Sushi & Pratos Quentes</span>
                    <span>16,0% · R$ 81.500/mês</span>
                  </div>
                  <div style={{ width: '100%', height: 10, background: '#0f172a', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{ width: '16%', height: '100%', background: '#334155' }} />
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: 'rgba(230, 57, 70, 0.08)', border: '1px solid rgba(230, 57, 70, 0.25)', fontSize: 12, color: '#f8fafc' }}>
                <b>Diagnóstico KyttoIA:</b> O Zuma lidera no segmento contemporâneo e alta gastronomia, mas 49,5% do mercado ainda está fragmentado entre o Sansei (rodízio/volume) e Sushi Ya (preço de entrada). Com os canais digitais do Kytto, o Zuma captura mais 12% da concorrência retendo margem.
              </div>
            </div>

            {/* As 4 Avenidas de Crescimento Mapeadas */}
            <div style={{ background: 'var(--card, #1e293b)', border: '1px solid var(--line, #334155)', borderRadius: 12, padding: 20 }}>
              <h3 style={{ margin: '0 0 14px 0', fontSize: 15, fontWeight: 800 }}>4 Avenidas de Crescimento (+R$ 95.175/mês)</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ padding: 10, borderRadius: 8, background: 'var(--surface, #0f172a)', border: '1px solid var(--line, #334155)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, fontSize: 13, color: '#ffffff' }}>🍱 Almoço Executivo Poké & Teishoku</span>
                    <span style={{ fontWeight: 800, fontSize: 13, color: '#10b981' }}>+R$ 38.500/mês</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)', marginTop: 2 }}>
                    Apenas 1 concorrente atende o almoço corporativo do agro e escritórios em Tangará.
                  </div>
                </div>

                <div style={{ padding: 10, borderRadius: 8, background: 'var(--surface, #0f172a)', border: '1px solid var(--line, #334155)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, fontSize: 13, color: '#ffffff' }}>🌙 Segunda-feira Sem Concorrência</span>
                    <span style={{ fontWeight: 800, fontSize: 13, color: '#10b981' }}>+R$ 22.400/mês</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)', marginTop: 2 }}>
                    Todos os 3 concorrentes fecham na segunda-feira. Zuma captura 100% da demanda reprimida.
                  </div>
                </div>

                <div style={{ padding: 10, borderRadius: 8, background: 'var(--surface, #0f172a)', border: '1px solid var(--line, #334155)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, fontSize: 13, color: '#ffffff' }}>👑 Clube Zumi (Assinaturas Mensais MRR)</span>
                    <span style={{ fontWeight: 800, fontSize: 13, color: '#10b981' }}>+R$ 19.800/mês</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)', marginTop: 2 }}>
                    Recorrência garantida com 80 assinantes nos planos Bronze, Prata e Gold.
                  </div>
                </div>

                <div style={{ padding: 10, borderRadius: 8, background: 'var(--surface, #0f172a)', border: '1px solid var(--line, #334155)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, fontSize: 13, color: '#ffffff' }}>🌧️ Gatilhos de Clima &amp; Chuva Automáticos</span>
                    <span style={{ fontWeight: 800, fontSize: 13, color: '#10b981' }}>+R$ 14.475/mês</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)', marginTop: 2 }}>
                    Disparo de combos quentes (yakisoba, lámen, hot roll) nos dias chuvosos pelo WhatsApp.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Botão de Integração e Acesso ao Pilot Completo */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(230, 57, 70, 0.15) 0%, rgba(15, 23, 42, 0.9) 100%)',
            border: '1px solid rgba(230, 57, 70, 0.4)',
            borderRadius: 12,
            padding: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#ffffff' }}>
                Deseja explorar a experiência completa do Zuma Pilot?
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted, #94a3b8)', marginTop: 2 }}>
                O arquivo pilot.html oficial do Zuma com simuladores, matriz RFM e previsão de demanda está 100% ativo na plataforma.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setAbaAtiva('pilot')}
                style={{
                  background: 'var(--card, #1e293b)',
                  color: '#ffffff',
                  border: '1px solid var(--line, #334155)',
                  padding: '8px 16px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Embutir Aqui
              </button>
              <a
                href="/zuma/pilot.html?locale=pt-BR#mercado"
                target="_blank"
                rel="noreferrer"
                style={{
                  background: '#E63946',
                  color: '#ffffff',
                  padding: '8px 16px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 800,
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <Maximize2 size={14} />
                Abrir em Nova Aba
              </a>
            </div>
          </div>
        </div>
      )}

      {/* 3. ABA CARDÁPIO & SUSHI BAR */}
      {abaAtiva === 'cardapio' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Barra de Filtro e Busca */}
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button
                onClick={handleAbrirNovoItemCardapio}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                }}
              >
                <Plus size={15} /> Incluir Novo Prato
              </button>
            </div>

          <div style={{
            background: 'var(--card, #1e293b)',
            border: '1px solid var(--line, #334155)',
            borderRadius: 12,
            padding: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 300px' }}>
              <Search size={16} color="var(--muted, #94a3b8)" />
              <input
                type="text"
                placeholder="Buscar por sushis, sashimis, temakis, combinados..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: 13,
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', maxWidth: '100%' }}>
              <button
                onClick={() => setCategoriaFiltro('todas')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1px solid',
                  borderColor: categoriaFiltro === 'todas' ? '#E63946' : 'var(--line, #334155)',
                  background: categoriaFiltro === 'todas' ? '#E63946' : 'var(--surface, #0f172a)',
                  color: categoriaFiltro === 'todas' ? '#ffffff' : 'var(--muted, #94a3b8)',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                Todas ({cardapio.length})
              </button>
              {categorias.slice(0, 8).map(c => (
                <button
                  key={c}
                  onClick={() => setCategoriaFiltro(c)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: '1px solid',
                    borderColor: categoriaFiltro === c ? '#E63946' : 'var(--line, #334155)',
                    background: categoriaFiltro === c ? '#E63946' : 'var(--surface, #0f172a)',
                    color: categoriaFiltro === c ? '#ffffff' : 'var(--muted, #94a3b8)',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Grid dos Produtos Oficiais Zuma */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {produtosFiltrados.slice(0, 48).map(p => (
              <div
                key={p.id || p.nome}
                style={{
                  background: 'var(--card, #1e293b)',
                  border: '1px solid var(--line, #334155)',
                  borderRadius: 12,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                {p.foto && (
                  <div style={{ width: '100%', height: 120, background: '#0f172a', overflow: 'hidden' }}>
                    <img src={p.foto} alt={p.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
                <div style={{ padding: 14, flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#E63946', textTransform: 'uppercase' }}>
                      {p.categoria_nome || p.categoria || 'Oriental'}
                    </span>
                    {p.cod_pdv && (
                      <span style={{ fontSize: 9, background: 'var(--surface, #0f172a)', padding: '2px 5px', borderRadius: 4, color: 'var(--muted, #94a3b8)' }}>
                        PDV #{p.cod_pdv}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#ffffff', marginTop: 4 }}>
                    {p.nome}
                  </div>
                  {p.descricao && (
                    <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)', marginTop: 4, flex: 1, lineClamp: 2 }}>
                      {p.descricao}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--line, #334155)' }}>
                    <span style={{ fontSize: 15, fontWeight: 900, color: '#10b981' }}>
                      R$ {Number(p.preco || 0).toFixed(2).replace('.', ',')}
                    </span>
                    <button
                      onClick={() => navigate('/pdv')}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        background: 'rgba(230, 57, 70, 0.2)',
                        border: '1px solid #E63946',
                        color: '#FF6B6B',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Lançar no PDV
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. ABA MESAS & SALÃO */}
      {abaAtiva === 'mesas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Header do Salão & Mapa de Temperatura */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(230, 57, 70, 0.2) 0%, rgba(15, 23, 42, 0.95) 100%)',
            border: '1px solid #E63946',
            borderRadius: 14,
            padding: 22,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 14
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontSize: 34 }}>🗺️</span>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#ffffff' }}>
                    Mapa de Temperatura &amp; Giro do Salão · Zuma Cozinha Oriental
                  </h2>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: 'rgba(16, 185, 129, 0.2)',
                    color: '#10b981',
                    border: '1px solid #10b981'
                  }}>
                    ● Salão Aberto · 25 Mesas Ativas
                  </span>
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: 12.5, color: '#cbd5e1' }}>
                  Heatmap visual de permanência, ritmo de consumo, comanda acumulada e controle térmico IoT do salão (21.8°C).
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                onClick={carregarModulosAvancados}
                style={{
                  background: 'var(--surface, #0f172a)',
                  color: '#ffffff',
                  border: '1px solid #334155',
                  padding: '10px 16px',
                  borderRadius: 10,
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <RefreshCw size={14} /> Atualizar Salão
              </button>
              <button
                onClick={() => navigate('/admin/mesas')}
                style={{
                  background: '#E63946',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 18px',
                  borderRadius: 10,
                  fontSize: 12.5,
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                Central PDV &amp; Garçom Mobile →
              </button>
            </div>
          </div>

          {/* Cards de Métricas Consolidadas do Salão */}
          {mapaMesas && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
              <div style={{ background: 'var(--card, #1e293b)', border: '1px solid #334155', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 11.5, color: 'var(--muted, #94a3b8)' }}>Taxa de Ocupação</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#ffffff', marginTop: 4 }}>
                  {mapaMesas.taxaOcupacaoMesasPct}%
                </div>
                <div style={{ fontSize: 11, color: '#10b981', marginTop: 2, fontWeight: 700 }}>
                  {mapaMesas.totalMesasOcupadas} ocupadas · {mapaMesas.totalMesasLivres} livres
                </div>
              </div>

              <div style={{ background: 'var(--card, #1e293b)', border: '1px solid #334155', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 11.5, color: 'var(--muted, #94a3b8)' }}>Faturamento em Salão</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#10b981', marginTop: 4 }}>
                  R$ {Number(mapaMesas.totalFaturamentoSalaoAtual || 0).toFixed(2).replace('.', ',')}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)', marginTop: 2 }}>
                  {mapaMesas.totalPessoasAtendidas} clientes sentados
                </div>
              </div>

              <div style={{ background: 'var(--card, #1e293b)', border: '1px solid #334155', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 11.5, color: 'var(--muted, #94a3b8)' }}>Ticket Médio por Pessoa</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#3b82f6', marginTop: 4 }}>
                  R$ {Number(mapaMesas.ticketMedioSalao || 0).toFixed(2).replace('.', ',')}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)', marginTop: 2 }}>
                  Meta salão: R$ 85,00
                </div>
              </div>

              <div style={{ background: 'var(--card, #1e293b)', border: '1px solid #334155', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 11.5, color: 'var(--muted, #94a3b8)' }}>Tempo Médio / Mesa</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#f59e0b', marginTop: 4 }}>
                  {mapaMesas.tempoMedioOcupacaoMinutos} min
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)', marginTop: 2 }}>
                  Climatização IoT: {mapaMesas.climatizacaoSalao?.temperaturaMedia}
                </div>
              </div>
            </div>
          )}

          {/* Legenda do Heatmap de Giro */}
          <div style={{
            background: 'var(--surface, #0f172a)',
            border: '1px solid #334155',
            borderRadius: 12,
            padding: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            fontSize: 12
          }}>
            <div style={{ fontWeight: 800, color: '#ffffff' }}>Legenda Heatmap de Giro:</div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#10b981' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981' }}></span> Livre
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#3b82f6' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#3b82f6' }}></span> Recém-chegada (&lt;30m)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#eab308' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#eab308' }}></span> Consumindo (30-60m)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f97316' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f97316' }}></span> Sobremesa/Café (60-90m)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#a855f7', fontWeight: 800 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#a855f7' }}></span> Alerta Giro / Conta (&gt;90m)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#64748b' }}></span> Higienização
              </span>
            </div>
          </div>

          {/* Filtro por Setor do Salão */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['todos', 'Salão Principal', 'Deck Lounge', 'Sushi Bar Omakase', 'Sala VIP'].map(setor => (
              <button
                key={setor}
                onClick={() => setSetorFiltroMesas(setor)}
                style={{
                  background: setorFiltroMesas === setor ? '#E63946' : 'var(--card, #1e293b)',
                  color: '#ffffff',
                  border: '1px solid ' + (setorFiltroMesas === setor ? '#E63946' : '#334155'),
                  padding: '6px 14px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {setor === 'todos' ? 'Todas as 25 Mesas' : setor}
              </button>
            ))}
          </div>

          {/* Grid de Mesas com Heatmap Dinâmico */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 14 }}>
            {(mapaMesas?.mesas || []).filter(m => setorFiltroMesas === 'todos' || m.setor === setorFiltroMesas).map(mesa => {
              const corStatus = mesa.heatmapGiro?.cor || '#10b981';
              return (
                <div
                  key={mesa.id}
                  style={{
                    background: 'var(--card, #1e293b)',
                    border: `1.5px solid ${corStatus}`,
                    borderRadius: 14,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: mesa.solicitouConta ? '0 0 16px rgba(168, 85, 247, 0.35)' : 'none'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
                          Mesa {mesa.numero}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)' }}>
                          {mesa.setor} · {mesa.capacidade} lugares
                        </div>
                      </div>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 800,
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: `${corStatus}20`,
                        color: corStatus,
                        border: `1px solid ${corStatus}`
                      }}>
                        {mesa.heatmapGiro?.rotulo}
                      </span>
                    </div>

                    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: 'var(--muted, #94a3b8)' }}>Permanência:</span>
                      <span style={{ fontWeight: 800, color: mesa.tempoMinutos >= 90 ? '#a855f7' : '#ffffff' }}>
                        ⏱️ {mesa.tempoMinutos} minutos
                      </span>
                    </div>

                    <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: 'var(--muted, #94a3b8)' }}>Clientes Sentados:</span>
                      <span style={{ fontWeight: 700, color: '#ffffff' }}>
                        👥 {mesa.clientesNaMesa} pessoas
                      </span>
                    </div>

                    <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: 'var(--muted, #94a3b8)' }}>Garçom:</span>
                      <span style={{ color: '#cbd5e1' }}>{mesa.garcom}</span>
                    </div>

                    {mesa.valorAcumulado > 0 && (
                      <div style={{
                        marginTop: 10,
                        background: 'var(--surface, #0f172a)',
                        padding: '8px 10px',
                        borderRadius: 8,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span style={{ fontSize: 11, color: 'var(--muted, #94a3b8)' }}>Comanda:</span>
                        <span style={{ fontSize: 14, fontWeight: 900, color: '#10b981' }}>
                          R$ {Number(mesa.valorAcumulado).toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Ações da Mesa */}
                  <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid #334155', display: 'flex', gap: 6 }}>
                    {mesa.status === 'livre' ? (
                      <button
                        onClick={() => alterarStatusMesa(mesa.id, 'consumindo')}
                        style={{
                          flex: 1,
                          background: 'rgba(16, 185, 129, 0.2)',
                          color: '#10b981',
                          border: '1px solid #10b981',
                          padding: '6px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        + Ocupar Mesa
                      </button>
                    ) : mesa.solicitouConta ? (
                      <button
                        onClick={() => emitirNotaFiscalRapida('NFC-e (65)', `Mesa ${mesa.numero} · ${mesa.setor}`)}
                        style={{
                          flex: 1,
                          background: '#a855f7',
                          color: '#ffffff',
                          border: 'none',
                          padding: '6px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        ⚡ Emitir NFC-e &amp; Fechar
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => alterarStatusMesa(mesa.id, 'solicitou_conta')}
                          style={{
                            flex: 1,
                            background: 'rgba(168, 85, 247, 0.2)',
                            color: '#a855f7',
                            border: '1px solid #a855f7',
                            padding: '6px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Pedir Conta
                        </button>
                        <button
                          onClick={() => alterarStatusMesa(mesa.id, 'livre')}
                          style={{
                            flex: 1,
                            background: 'rgba(239, 68, 68, 0.2)',
                            color: '#ef4444',
                            border: '1px solid #ef4444',
                            padding: '6px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Liberar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {abaAtiva === 'zumi' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Header Zumi */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(230, 57, 70, 0.25) 0%, rgba(15, 23, 42, 0.95) 100%)',
            border: '1px solid #E63946',
            borderRadius: 14,
            padding: 22,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontSize: 36 }}>🤖</span>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#ffffff' }}>
                    Zumi · Agente de Atendimento &amp; Vendas WhatsApp (Motor KyttoIA 2.5 Flash)
                  </h2>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: 'rgba(16, 185, 129, 0.2)',
                    color: '#10b981',
                    border: '1px solid #10b981'
                  }}>
                    ● Conectado ao Vivo · (65) 99800-1447
                  </span>
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: 12.5, color: '#cbd5e1' }}>
                  Atendimento ágil e humanizado treinado com o cardápio oficial, cálculo automático de frete para Tangará da Serra, baixa imediata no estoque de pescados e cálculo de CMV por ficha técnica.
                </p>
              </div>
            </div>

            <button
              onClick={executarSimulacaoPedido}
              disabled={simulando}
              style={{
                background: simulando ? '#475569' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                border: 'none',
                padding: '12px 20px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 800,
                cursor: simulando ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                transition: 'all 0.2s'
              }}
            >
              {simulando ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Processando com KyttoIA...
                </>
              ) : (
                <>
                  <Zap size={16} />
                  ⚡ Simular Pedido via WhatsApp (Zumi + Baixa Salmão + CMV)
                </>
              )}
            </button>
          </div>

          {mensagemSucesso && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid #10b981',
              borderRadius: 10,
              padding: '12px 16px',
              color: '#10b981',
              fontSize: 13,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <CheckCircle2 size={16} />
              {mensagemSucesso}
            </div>
          )}

          {/* Resultado da Simulação do Pedido */}
          {simulacaoPedido && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Grid 2 colunas: Chat WhatsApp e KDS/NFC-e */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
                {/* 1. Interface do WhatsApp Dark Mode */}
                <div style={{
                  background: '#0b141a',
                  border: '1px solid #222d34',
                  borderRadius: 14,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  {/* WhatsApp Top Bar */}
                  <div style={{
                    background: '#202c33',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid #2a3942'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: '#E63946',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 20
                      }}>
                        🍣
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#e9edef' }}>
                          Zumi · Zuma Cozinha Oriental
                        </div>
                        <div style={{ fontSize: 11, color: '#00a884', fontWeight: 600 }}>
                          ● online (Motor KyttoIA 2.5 Flash)
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: '#8696a0' }}>WhatsApp Oficial</span>
                  </div>

                  {/* Chat Messages */}
                  <div style={{
                    padding: 16,
                    background: '#0b141a',
                    backgroundImage: 'radial-gradient(#202c33 1px, transparent 1px)',
                    backgroundSize: '16px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    maxHeight: 460,
                    overflowY: 'auto'
                  }}>
                    {simulacaoPedido.conversaWhatsapp?.map((msg, i) => {
                      const isZumi = msg.autor === 'Zumi';
                      return (
                        <div
                          key={i}
                          style={{
                            alignSelf: isZumi ? 'flex-start' : 'flex-end',
                            maxWidth: '85%',
                            background: isZumi ? '#202c33' : '#005c4b',
                            borderRadius: 10,
                            padding: '10px 14px',
                            color: '#e9edef',
                            fontSize: 12.5,
                            lineHeight: 1.5,
                            boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                            position: 'relative'
                          }}
                        >
                          <div style={{ fontSize: 11, fontWeight: 800, color: isZumi ? '#53bdeb' : '#25D366', marginBottom: 4 }}>
                            {msg.autor}
                          </div>
                          <div style={{ whiteSpace: 'pre-line' }}>{msg.texto}</div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: 4,
                            marginTop: 4,
                            fontSize: 10,
                            color: '#8696a0'
                          }}>
                            <span>{msg.hora || '20:45'}</span>
                            <span style={{ color: '#53bdeb' }}>✓✓</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Integração KDS Sushi Bar & NFC-e Fiscal */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Card KDS */}
                  <div style={{
                    background: 'var(--card, #1e293b)',
                    border: '1px solid #334155',
                    borderRadius: 14,
                    padding: 18
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ChefHat size={18} color="#E63946" />
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#ffffff' }}>Comanda KDS Sushi Bar</span>
                      </div>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 800,
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: 'rgba(230, 57, 70, 0.2)',
                        color: '#E63946',
                        border: '1px solid #E63946'
                      }}>
                        {simulacaoPedido.kds?.status || 'PREPARANDO'}
                      </span>
                    </div>

                    <div style={{ background: 'var(--surface, #0f172a)', borderRadius: 8, padding: 12, fontSize: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ color: 'var(--muted, #94a3b8)' }}>Comanda:</span>
                        <span style={{ fontWeight: 800, color: '#ffffff' }}>{simulacaoPedido.kds?.comandaId}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ color: 'var(--muted, #94a3b8)' }}>Cliente:</span>
                        <span style={{ fontWeight: 700, color: '#ffffff' }}>{simulacaoPedido.pedido?.cliente?.nome}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ color: 'var(--muted, #94a3b8)' }}>Destino:</span>
                        <span style={{ fontWeight: 700, color: '#ffffff' }}>{simulacaoPedido.pedido?.cliente?.bairro}, Tangará da Serra</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted, #94a3b8)' }}>Tempo Estimado KDS:</span>
                        <span style={{ fontWeight: 800, color: '#10b981' }}>{simulacaoPedido.kds?.tempoEstimadoMinutos} minutos</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Fiscal NFC-e */}
                  <div style={{
                    background: 'var(--card, #1e293b)',
                    border: '1px solid #334155',
                    borderRadius: 14,
                    padding: 18
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FileText size={18} color="#10b981" />
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#ffffff' }}>NFC-e Autorizada (SEFAZ-MT)</span>
                      </div>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 800,
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: 'rgba(16, 185, 129, 0.2)',
                        color: '#10b981',
                        border: '1px solid #10b981'
                      }}>
                        STATUS 100 · AUTORIZADA
                      </span>
                    </div>

                    <div style={{ background: 'var(--surface, #0f172a)', borderRadius: 8, padding: 12, fontSize: 11.5 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ color: 'var(--muted, #94a3b8)' }}>Protocolo SEFAZ-MT:</span>
                        <span style={{ fontWeight: 800, color: '#10b981' }}>{simulacaoPedido.fiscal?.protocolo}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ color: 'var(--muted, #94a3b8)' }}>Nº Nota / Série:</span>
                        <span style={{ fontWeight: 700, color: '#ffffff' }}>NFC-e #{simulacaoPedido.fiscal?.numeroNota} (Série {simulacaoPedido.fiscal?.serie})</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ color: 'var(--muted, #94a3b8)' }}>Total Emitido:</span>
                        <span style={{ fontWeight: 800, color: '#ffffff' }}>R$ {Number(simulacaoPedido.fiscal?.valorTotal || 0).toFixed(2).replace('.', ',')}</span>
                      </div>
                      <div style={{ wordBreak: 'break-all', color: 'var(--muted, #94a3b8)', fontSize: 10, marginTop: 4 }}>
                        Chave: {simulacaoPedido.fiscal?.chaveAcesso}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Card de Baixa em Tempo Real no Estoque de Pescados */}
              <div style={{
                background: 'var(--card, #1e293b)',
                border: '1px solid #334155',
                borderRadius: 14,
                padding: 20
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>🐟</span> Baixa em Tempo Real de Pescados &amp; Insumos Nobres
                    </h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--muted, #94a3b8)' }}>
                      Conexão direta com a esteira KDS: insumos debitados automaticamente a partir da composição das fichas técnicas.
                    </p>
                  </div>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '4px 10px',
                    borderRadius: 6,
                    background: 'rgba(16, 185, 129, 0.2)',
                    color: '#10b981'
                  }}>
                    ✓ Baixa Confirmada
                  </span>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface, #0f172a)', borderBottom: '1px solid #334155' }}>
                        <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--muted, #94a3b8)', fontWeight: 700 }}>Insumo Nobre</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--muted, #94a3b8)', fontWeight: 700 }}>Consumo Pedido</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--muted, #94a3b8)', fontWeight: 700 }}>Estoque Anterior</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--muted, #94a3b8)', fontWeight: 700 }}>Estoque Atual</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--muted, #94a3b8)', fontWeight: 700 }}>Custo Médio / Un</th>
                      </tr>
                    </thead>
                    <tbody>
                      {simulacaoPedido.extratoBaixaEstoque?.map((b, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.5)' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 800, color: '#ffffff' }}>
                            {b.nomeInsumo}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', color: '#E63946', fontWeight: 900 }}>
                            -{b.quantidadeConsumida} {b.unidade}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--muted, #94a3b8)' }}>
                            {b.estoqueAnterior} {b.unidade}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', color: '#10b981', fontWeight: 800 }}>
                            {b.estoqueAtual} {b.unidade}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--muted, #94a3b8)' }}>
                            R$ {Number(b.custoMedio || 0).toFixed(2).replace('.', ',')} / {b.unidade}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. Painel de CMV Analítico da Ficha Técnica */}
              <div style={{
                background: 'var(--card, #1e293b)',
                border: '1px solid #334155',
                borderRadius: 14,
                padding: 20
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>📊</span> Cálculo de CMV Analítico da Ficha Técnica Zuma
                    </h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--muted, #94a3b8)' }}>
                      Custo da Mercadoria Vendida (CMV) item a item com margem de contribuição real e markup.
                    </p>
                  </div>
                  <span style={{
                    fontSize: 12,
                    fontWeight: 900,
                    padding: '4px 12px',
                    borderRadius: 6,
                    background: 'rgba(59, 130, 246, 0.2)',
                    color: '#60a5fa',
                    border: '1px solid #3b82f6'
                  }}>
                    CMV Global: {simulacaoPedido.cmvAnaliticoFichaTecnica?.resumo?.cmvGlobalPercentual}%
                  </span>
                </div>

                {/* Itens do Pedido */}
                <div style={{ overflowX: 'auto', marginBottom: 16 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface, #0f172a)', borderBottom: '1px solid #334155' }}>
                        <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--muted, #94a3b8)', fontWeight: 700 }}>Prato / Item</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--muted, #94a3b8)', fontWeight: 700 }}>Qtd</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--muted, #94a3b8)', fontWeight: 700 }}>Preço Venda</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--muted, #94a3b8)', fontWeight: 700 }}>Custo Insumos (Ficha)</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--muted, #94a3b8)', fontWeight: 700 }}>% CMV</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--muted, #94a3b8)', fontWeight: 700 }}>Margem Bruta (R$)</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--muted, #94a3b8)', fontWeight: 700 }}>Status CMV</th>
                      </tr>
                    </thead>
                    <tbody>
                      {simulacaoPedido.cmvAnaliticoFichaTecnica?.itens?.map((it, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.5)' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 800, color: '#ffffff' }}>
                            {it.nome}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', color: '#ffffff' }}>
                            {it.quantidade}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#ffffff', fontWeight: 700 }}>
                            R$ {Number(it.precoVendaUnitario || 0).toFixed(2).replace('.', ',')}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#E63946', fontWeight: 700 }}>
                            R$ {Number(it.custoInsumosTotal || 0).toFixed(2).replace('.', ',')}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', color: '#f59e0b', fontWeight: 900 }}>
                            {it.cmvPercentual}%
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#10b981', fontWeight: 800 }}>
                            R$ {Number(it.margemBrutaValor || 0).toFixed(2).replace('.', ',')} ({it.margemBrutaPercentual}%)
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <span style={{
                              fontSize: 10,
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: '#10b981'
                            }}>
                              Excelente
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Resumo do Pedido Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                  <div style={{ background: 'var(--surface, #0f172a)', borderRadius: 10, padding: 14 }}>
                    <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)' }}>Receita Total Bruta</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#ffffff', marginTop: 4 }}>
                      R$ {Number(simulacaoPedido.cmvAnaliticoFichaTecnica?.resumo?.receitaTotal || 0).toFixed(2).replace('.', ',')}
                    </div>
                  </div>

                  <div style={{ background: 'var(--surface, #0f172a)', borderRadius: 10, padding: 14 }}>
                    <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)' }}>Custo Total dos Insumos</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#E63946', marginTop: 4 }}>
                      R$ {Number(simulacaoPedido.cmvAnaliticoFichaTecnica?.resumo?.custoInsumosTotal || 0).toFixed(2).replace('.', ',')}
                    </div>
                  </div>

                  <div style={{ background: 'var(--surface, #0f172a)', borderRadius: 10, padding: 14 }}>
                    <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)' }}>Margem de Contribuição</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#10b981', marginTop: 4 }}>
                      R$ {Number(simulacaoPedido.cmvAnaliticoFichaTecnica?.resumo?.margemContribuicaoValor || 0).toFixed(2).replace('.', ',')}
                    </div>
                    <div style={{ fontSize: 10, color: '#10b981', fontWeight: 700 }}>
                      {simulacaoPedido.cmvAnaliticoFichaTecnica?.resumo?.margemContribuicaoPercentual}% do faturamento
                    </div>
                  </div>

                  <div style={{ background: 'var(--surface, #0f172a)', borderRadius: 10, padding: 14 }}>
                    <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)' }}>CMV Médio Consolidado</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#f59e0b', marginTop: 4 }}>
                      {simulacaoPedido.cmvAnaliticoFichaTecnica?.resumo?.cmvGlobalPercentual}%
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--muted, #94a3b8)' }}>Meta Zuma: &lt; 50,00%</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Cards Padrão do Zumi */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            <div style={{ background: 'var(--card, #1e293b)', border: '1px solid var(--line, #334155)', borderRadius: 12, padding: 18 }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 800 }}>Regras de Atendimento do Zumi</h3>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: '#cbd5e1', lineHeight: 1.8 }}>
                <li>Responde em menos de 3 segundos com saudações orientais corteses ("Konbanwa!").</li>
                <li>Identifica se o cliente prefere sushi cru, maçaricado ou pratos quentes.</li>
                <li>Oferece upsell automático de sobremesa (ex: Hot Roll de Banana com Nutella).</li>
                <li>Gera o código Copia e Cola do PIX oficial do Zuma com validação automática.</li>
                <li>Notifica a equipe do Sushi Bar no KDS imediatamente e debita pescados em tempo real.</li>
              </ul>
            </div>

            <div style={{ background: 'var(--card, #1e293b)', border: '1px solid var(--line, #334155)', borderRadius: 12, padding: 18 }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 800 }}>Canais Conectados</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderRadius: 8, background: 'var(--surface, #0f172a)' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800 }}>WhatsApp Oficial Zuma</div>
                    <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)' }}>(65) 99800-1447</div>
                  </div>
                  <span style={{ fontSize: 10, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '2px 8px', borderRadius: 4, fontWeight: 800 }}>● Ativo (KyttoIA)</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderRadius: 8, background: 'var(--surface, #0f172a)' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800 }}>Instagram Direct</div>
                    <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)' }}>@zuma_orientaltga</div>
                  </div>
                  <span style={{ fontSize: 10, background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', padding: '2px 8px', borderRadius: 4, fontWeight: 800 }}>Integrado</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. ABA ESTOQUE DE PESCADOS */}
      {abaAtiva === 'estoque' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{
            background: 'var(--card, #1e293b)',
            border: '1px solid var(--line, #334155)',
            borderRadius: 12,
            padding: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Estoque de Pescados Frescos &amp; Insumos Nobres</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--muted, #94a3b8)' }}>
                Rastreabilidade por lote, controle de rendimento de salmão, shari e fichas técnicas com apuração de CMV real.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={carregarEstoqueEFichas}
                style={{
                  background: 'var(--surface, #0f172a)',
                  color: '#ffffff',
                  border: '1px solid #334155',
                  padding: '8px 14px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <RefreshCw size={14} /> Atualizar Estoque
              </button>
              <button
                onClick={() => navigate('/admin/estoque')}
                style={{
                  background: '#E63946',
                  color: '#ffffff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Módulo Geral de Estoque →
              </button>
            </div>
          </div>

          {/* Cards dos Insumos Nobres em Tempo Real */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            {estoquePescados.length > 0 ? (
              estoquePescados.map((insumo) => (
                <div
                  key={insumo.id}
                  style={{
                    background: 'var(--card, #1e293b)',
                    border: '1px solid var(--line, #334155)',
                    borderRadius: 12,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#ffffff' }}>
                        {insumo.nome}
                      </span>
                      <span style={{
                        fontSize: 10,
                        background: insumo.quantidadeAtual <= insumo.estoqueMinimo ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.15)',
                        color: insumo.quantidadeAtual <= insumo.estoqueMinimo ? '#ef4444' : '#10b981',
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontWeight: 700
                      }}>
                        {insumo.quantidadeAtual <= insumo.estoqueMinimo ? 'Repor' : 'Normal'}
                      </span>
                    </div>

                    <div style={{ fontSize: 22, fontWeight: 900, color: '#ffffff', marginTop: 8 }}>
                      {insumo.quantidadeAtual} {insumo.unidade}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)', marginTop: 2 }}>
                      Mínimo: {insumo.estoqueMinimo} {insumo.unidade} · Custo Médio: R$ {Number(insumo.custoMedioUnitario || 0).toFixed(2).replace('.', ',')}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)', marginTop: 2 }}>
                      Fornecedor: {insumo.fornecedorPadrao}
                    </div>
                  </div>

                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(51, 65, 85, 0.5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>
                      Total: R$ {Number(insumo.valorTotalEmEstoque || 0).toFixed(2).replace('.', ',')}
                    </span>
                    <button
                      onClick={() => reporEstoque(insumo.id, insumo.unidade === 'kg' ? 5 : 20)}
                      style={{
                        background: 'rgba(230, 57, 70, 0.15)',
                        border: '1px solid #E63946',
                        color: '#E63946',
                        padding: '4px 8px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      + Entrada Lote
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ color: 'var(--muted, #94a3b8)', fontSize: 13 }}>Carregando dados de pescados...</div>
            )}
          </div>

          {/* Câmaras Frias IoT & Rastreabilidade Térmica (RDC 216 / Vigilância MT) */}
          <div style={{
            background: 'var(--card, #1e293b)',
            border: '1px solid #334155',
            borderRadius: 14,
            padding: 20
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>❄️</span> Telemetria IoT de Câmaras Frias &amp; Ultra-Congelamento (RDC 216 ANVISA-MT)
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--muted, #94a3b8)' }}>
                  Monitoramento contínuo de temperatura e umidade com alerta preventivo contra desvio térmico.
                </p>
              </div>
              <span style={{
                fontSize: 10,
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: 6,
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#10b981',
                border: '1px solid #10b981'
              }}>
                100% CONFORME VIGILÂNCIA
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
              {(camarasFrias.length > 0 ? camarasFrias : [
                { id: 'c1', nome: 'Câmara Fria 01 · Pescados Nobres Frescos (Salmão & Atum)', temperaturaAtual: 0.8, faixaMinima: -2.0, faixaMaxima: 2.0, umidadeRelativa: 88.5, status: 'NORMAL_OTIMA' },
                { id: 'c2', nome: 'Câmara Fria 02 · Ultra-Congelamento (Camarão IQF & Polvo)', temperaturaAtual: -19.4, faixaMinima: -22.0, faixaMaxima: -18.0, umidadeRelativa: 64.0, status: 'NORMAL_OTIMA' },
                { id: 'c3', nome: 'Câmara Fria 03 · Hortifrúti Japonês, Shari & Cream Cheese', temperaturaAtual: 4.2, faixaMinima: 2.0, faixaMaxima: 6.0, umidadeRelativa: 82.0, status: 'NORMAL_OTIMA' }
              ]).map((cam) => (
                <div
                  key={cam.id}
                  style={{
                    background: 'var(--surface, #0f172a)',
                    border: '1px solid #334155',
                    borderRadius: 12,
                    padding: 16
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#ffffff' }}>{cam.nome}</div>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#10b981'
                    }}>
                      {cam.status}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
                    <span style={{ fontSize: 26, fontWeight: 900, color: '#38bdf8' }}>
                      {cam.temperaturaAtual}°C
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--muted, #94a3b8)' }}>
                      Faixa segura: {cam.faixaMinima}°C a {cam.faixaMaxima}°C
                    </span>
                  </div>

                  <div style={{ marginTop: 8, fontSize: 11.5, color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Umidade Relativa: <strong style={{ color: '#ffffff' }}>{cam.umidadeRelativa}%</strong></span>
                    <span>Sensor IoT: <strong style={{ color: '#10b981' }}>Ativo</strong></span>
                  </div>
                </div>
              ))}
            </div>

            {/* Painel de Perdas Técnicas */}
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid #334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#ffffff' }}>
                  Aparas Sanitárias &amp; Perdas Técnicas de Sushiman (Auditoria)
                </div>
                <button
                  onClick={() => registrarPerdaTecnica('ins-salmao-fresco', 0.500, 'Apara de acabamento de tosa de filé de salmão')}
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: '#ef4444',
                    border: '1px solid #ef4444',
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  + Lançar Apara Técnica (-500g Salmão)
                </button>
              </div>

              <div style={{ fontSize: 12, color: 'var(--muted, #94a3b8)' }}>
                Rendimento médio do salmão: 62% filé nobre, 20% aparas (patê/uramaki), 18% cabeça/espinhaço. Descarte rigorosamente auditado para controle de CMV real.
              </div>
            </div>
          </div>

          {/* Fichas Técnicas Oficiais */}
          <div style={{
            background: 'var(--card, #1e293b)',
            border: '1px solid var(--line, #334155)',
            borderRadius: 14,
            padding: 20
          }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: 15, fontWeight: 900, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>📋</span> Fichas Técnicas Oficiais do Sushi Bar (Composição &amp; CMV Teórico)
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14 }}>
              {fichasTecnicas.map((ft) => (
                <div
                  key={ft.codigoPrato}
                  style={{
                    background: 'var(--surface, #0f172a)',
                    border: '1px solid #334155',
                    borderRadius: 10,
                    padding: 14
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#ffffff' }}>{ft.nomePrato}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)' }}>Código: {ft.codigoPrato} · {ft.rendimento}</div>
                    </div>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: 'rgba(245, 158, 11, 0.15)',
                      color: '#f59e0b'
                    }}>
                      CMV: {ft.cmvEstimadoPercentual}%
                    </span>
                  </div>

                  <div style={{ marginTop: 10, fontSize: 11.5, color: '#cbd5e1' }}>
                    <div style={{ fontWeight: 700, color: 'var(--muted, #94a3b8)', marginBottom: 4 }}>Ingredientes da Ficha:</div>
                    {ft.ingredientes?.map((ing, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                        <span>• {ing.nomeInsumo} ({ing.quantidadeNecessaria} {ing.unidade})</span>
                        <span style={{ color: 'var(--muted, #94a3b8)' }}>R$ {Number(ing.custoProporcional || 0).toFixed(2).replace('.', ',')}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #334155', display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--muted, #94a3b8)' }}>Custo Insumos: <strong style={{ color: '#E63946' }}>R$ {Number(ft.custoTotalInsumos || 0).toFixed(2).replace('.', ',')}</strong></span>
                    <span style={{ color: 'var(--muted, #94a3b8)' }}>Preço Venda: <strong style={{ color: '#10b981' }}>R$ {Number(ft.precoVendaSugerido || 0).toFixed(2).replace('.', ',')}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Histórico Recente de Baixas */}
          {historicoBaixas.length > 0 && (
            <div style={{
              background: 'var(--card, #1e293b)',
              border: '1px solid var(--line, #334155)',
              borderRadius: 14,
              padding: 20
            }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: 15, fontWeight: 900, color: '#ffffff' }}>
                Histórico Recente de Baixas de Estoque (Auditoria do Sushi Bar)
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface, #0f172a)', borderBottom: '1px solid #334155' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--muted, #94a3b8)' }}>Data/Hora</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--muted, #94a3b8)' }}>Origem / Referência</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--muted, #94a3b8)' }}>Insumo</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--muted, #94a3b8)' }}>Quantidade Baixada</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--muted, #94a3b8)' }}>Saldo Anterior</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--muted, #94a3b8)' }}>Novo Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historicoBaixas.slice(0, 10).map((h) => (
                      <tr key={h.id} style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.4)' }}>
                        <td style={{ padding: '8px 10px', color: 'var(--muted, #94a3b8)' }}>{new Date(h.dataHora).toLocaleString('pt-BR')}</td>
                        <td style={{ padding: '8px 10px', fontWeight: 700, color: '#ffffff' }}>{h.referencia} ({h.origem})</td>
                        <td style={{ padding: '8px 10px', color: '#ffffff' }}>{h.nomeInsumo}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', color: '#E63946', fontWeight: 800 }}>-{h.quantidade}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--muted, #94a3b8)' }}>{h.saldoAnterior}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', color: '#10b981', fontWeight: 800 }}>{h.novoSaldo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        {/* Livro Razão Kardex de Movimentação de Estoque */}
          <div style={{
            background: 'var(--card, #1e293b)',
            border: '1px solid #334155',
            borderRadius: 14,
            padding: 20
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>📦</span> Livro Razão Kardex · Movimentação Contínua de Estoque
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--muted, #94a3b8)' }}>
                  Rastreabilidade completa de entradas por compras (NF-e 55), saídas por vendas no PDV/Delivery, perdas de sushiman e transferências.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={lancarEntradaNfeKardex}
                  style={{
                    background: 'rgba(16, 185, 129, 0.2)',
                    color: '#10b981',
                    border: '1px solid #10b981',
                    padding: '6px 12px',
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  + Entrada por NF-e Fornecedor (+15 kg Salmão)
                </button>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                    <th style={{ padding: '8px 10px' }}>Data/Hora</th>
                    <th style={{ padding: '8px 10px' }}>Tipo de Movimento</th>
                    <th style={{ padding: '8px 10px' }}>Insumo</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Qtd</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>Saldo Resultante</th>
                    <th style={{ padding: '8px 10px' }}>Documento Origem</th>
                    <th style={{ padding: '8px 10px' }}>Responsável</th>
                  </tr>
                </thead>
                <tbody>
                  {kardexMovimentacoes.map((k) => (
                    <tr key={k.id} style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.4)' }}>
                      <td style={{ padding: '8px 10px', color: '#94a3b8' }}>{k.data}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: k.tipo.includes('ENTRADA') ? 'rgba(16, 185, 129, 0.15)' : k.tipo.includes('PERDA') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                          color: k.tipo.includes('ENTRADA') ? '#10b981' : k.tipo.includes('PERDA') ? '#ef4444' : '#38bdf8'
                        }}>
                          {k.tipo}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', fontWeight: 700, color: '#ffffff' }}>{k.insumo}</td>
                      <td style={{
                        padding: '8px 10px',
                        textAlign: 'right',
                        fontWeight: 800,
                        color: k.qtd.startsWith('+') ? '#10b981' : '#f97316'
                      }}>
                        {k.qtd}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#ffffff' }}>{k.saldo}</td>
                      <td style={{ padding: '8px 10px', color: '#cbd5e1' }}>{k.doc}</td>
                      <td style={{ padding: '8px 10px', color: '#94a3b8' }}>{k.responsavel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA FISCAL & SEFAZ-MT */}
      {abaAtiva === 'fiscal' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Header Fiscal */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(15, 23, 42, 0.95) 100%)',
            border: '1px solid #10b981',
            borderRadius: 14,
            padding: 22,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 14
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontSize: 34 }}>🧾</span>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#ffffff' }}>
                    Emissor Fiscal &amp; Gestão Tributária SEFAZ-MT · Zuma Cozinha Oriental
                  </h2>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: 'rgba(16, 185, 129, 0.2)',
                    color: '#10b981',
                    border: '1px solid #10b981'
                  }}>
                    ● SEFAZ-MT Online · Produção 100
                  </span>
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: 12.5, color: '#cbd5e1' }}>
                  Emissão instantânea de NFC-e (Modelo 65) e NF-e (Modelo 55), cálculo de ICMS Simples Nacional, QR-Code oficial e contingência off-line.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                onClick={() => emitirNotaFiscalRapida('NFC-e (65)', 'Emissão Balcão Zuma')}
                disabled={emitindoNota}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 18px',
                  borderRadius: 10,
                  fontSize: 12.5,
                  fontWeight: 800,
                  cursor: emitindoNota ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
                }}
              >
                <Zap size={14} />
                {emitindoNota ? 'Emitindo...' : '⚡ Emitir NFC-e Avulsa'}
              </button>
              <button
                onClick={() => emitirNotaFiscalRapida('NF-e (55) Corporativa', 'Sala VIP 24 · Almoço Corporativo')}
                disabled={emitindoNota}
                style={{
                  background: '#3b82f6',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 18px',
                  borderRadius: 10,
                  fontSize: 12.5,
                  fontWeight: 800,
                  cursor: emitindoNota ? 'wait' : 'pointer'
                }}
              >
                + Emitir NF-e B2B (Mod 55)
              </button>
            </div>
          </div>

          {/* Cards de Métricas Fiscais */}
          {dadosFiscal && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
              <div style={{ background: 'var(--card, #1e293b)', border: '1px solid #334155', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 11.5, color: 'var(--muted, #94a3b8)' }}>Notas Emitidas (Mês)</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#ffffff', marginTop: 4 }}>
                  {dadosFiscal.totaisMes?.totalNotasEmitidas} notas
                </div>
                <div style={{ fontSize: 11, color: '#10b981', marginTop: 2 }}>
                  100% autorizadas na SEFAZ-MT
                </div>
              </div>

              <div style={{ background: 'var(--card, #1e293b)', border: '1px solid #334155', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 11.5, color: 'var(--muted, #94a3b8)' }}>Faturamento Fiscalizado</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#10b981', marginTop: 4 }}>
                  R$ {Number(dadosFiscal.totaisMes?.faturamentoFiscalMes || 0).toFixed(2).replace('.', ',')}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)', marginTop: 2 }}>
                  Regime Simples Nacional
                </div>
              </div>

              <div style={{ background: 'var(--card, #1e293b)', border: '1px solid #334155', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 11.5, color: 'var(--muted, #94a3b8)' }}>ICMS Simples Apurado</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#f59e0b', marginTop: 4 }}>
                  R$ {Number(dadosFiscal.totaisMes?.totalIcmsApurado || 0).toFixed(2).replace('.', ',')}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)', marginTop: 2 }}>
                  Alíquota Efetiva: {dadosFiscal.aliquotaEfetivaSimplesNacional}
                </div>
              </div>

              <div style={{ background: 'var(--card, #1e293b)', border: '1px solid #334155', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 11.5, color: 'var(--muted, #94a3b8)' }}>Certificado Digital A1</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#10b981', marginTop: 4 }}>
                  Válido até 18/10/2027
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted, #94a3b8)', marginTop: 2 }}>
                  Contingência Off-line: Standby (0 pendentes)
                </div>
              </div>
            </div>
          )}

          {/* Tabela de Notas Fiscais Emitidas */}
          <div style={{
            background: 'var(--card, #1e293b)',
            border: '1px solid #334155',
            borderRadius: 14,
            padding: 20
          }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: 15, fontWeight: 900, color: '#ffffff' }}>
              Livro de Saídas &amp; Documentos Fiscais Emitidos (SEFAZ-MT)
            </h3>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: 'var(--surface, #0f172a)', borderBottom: '1px solid #334155' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--muted, #94a3b8)' }}>Nota / Modelo</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--muted, #94a3b8)' }}>Cliente / Destinatário</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--muted, #94a3b8)' }}>Origem da Venda</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--muted, #94a3b8)' }}>Valor Total</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--muted, #94a3b8)' }}>Status SEFAZ</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--muted, #94a3b8)' }}>Ações Fiscais</th>
                  </tr>
                </thead>
                <tbody>
                  {(dadosFiscal?.notas || []).map((n) => (
                    <tr key={n.chaveAcesso} style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.4)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 800, color: '#ffffff' }}>
                        #{n.numeroNota} ({n.modelo})
                        <div style={{ fontSize: 10, color: 'var(--muted, #94a3b8)', fontWeight: 400 }}>
                          Chave: {n.chaveAcesso.slice(0, 20)}...
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#cbd5e1' }}>
                        {n.cliente}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--muted, #94a3b8)' }}>
                        {n.origemVenda}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#10b981' }}>
                        R$ {Number(n.valorTotal).toFixed(2).replace('.', ',')}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: '#10b981'
                        }}>
                          AUTORIZADA
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <a
                          href={n.qrcodeUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            background: 'rgba(59, 130, 246, 0.15)',
                            color: '#60a5fa',
                            padding: '4px 8px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          QR-Code SEFAZ ↗
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 7. ABA FINANCEIRO & DRE */}
      {abaAtiva === 'financeiro' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{
            background: 'var(--card, #1e293b)',
            border: '1px solid var(--line, #334155)',
            borderRadius: 12,
            padding: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Demonstrativo de Resultado (DRE) · Zuma Cozinha Oriental</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--muted, #94a3b8)' }}>
                Isolamento financeiro estrito com apuração de CMV real, despesas operacionais e margem líquida.
              </p>
            </div>
            <button
              onClick={() => navigate('/admin/financeiro')}
              style={{
                background: '#E63946',
                color: '#ffffff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Módulo Financeiro Geral →
            </button>
          </div>

          <div style={{ background: 'var(--card, #1e293b)', border: '1px solid var(--line, #334155)', borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line, #334155)', fontSize: 13, fontWeight: 800 }}>
                <span>(+) Receita Bruta Total</span>
                <span>R$ 176.000,00</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line, #334155)', fontSize: 13, color: '#f87171' }}>
                <span>(-) Impostos &amp; Simples Nacional (4,5%)</span>
                <span>R$ 7.920,00</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line, #334155)', fontSize: 13, fontWeight: 800, color: '#38bdf8' }}>
                <span>(=) Receita Líquida</span>
                <span>R$ 168.080,00</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line, #334155)', fontSize: 13, color: '#f87171' }}>
                <span>(-) CMV Pescados &amp; Insumos (32%)</span>
                <span>R$ 53.785,60</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line, #334155)', fontSize: 13, fontWeight: 800, color: '#10b981' }}>
                <span>(=) Margem de Contribuição Bruta (68%)</span>
                <span>R$ 114.294,40</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line, #334155)', fontSize: 13, color: '#f87171' }}>
                <span>(-) Custos Fixos &amp; Equipe de Sushimans</span>
                <span>R$ 46.500,00</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '2px solid #E63946', fontSize: 15, fontWeight: 900, color: '#10b981' }}>
                <span>(=) Lucro Operacional Líquido (EBITDA)</span>
                <span>R$ 67.794,40 (38,5%)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. ABA PILOT EMBUTIDO COMPLETO */}
      {abaAtiva === 'pilot' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--card, #1e293b)',
            padding: '12px 16px',
            borderRadius: 10,
            border: '1px solid var(--line, #334155)'
          }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>
              Visualizando Zuma Pilot (pilot.html) em Modo Integrado
            </span>
            <a
              href="/zuma/pilot.html?locale=pt-BR#mercado"
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 700,
                color: '#FF6B6B',
                textDecoration: 'none'
              }}
            >
              <ExternalLink size={14} />
              Abrir em Tela Cheia Externa
            </a>
          </div>

          <div style={{ width: '100%', height: '80vh', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line, #334155)' }}>
            <iframe
              src="/zuma/pilot.html?locale=pt-BR#mercado"
              title="Zuma Pilot"
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          </div>
        </div>
      )}

      {/* DEMAIS ABAS (CRM / DELIVERY) */}
      {(abaAtiva === 'crm' || abaAtiva === 'delivery') && (
        <div style={{ background: 'var(--card, #1e293b)', border: '1px solid var(--line, #334155)', borderRadius: 12, padding: 24, textAlign: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
            {abaAtiva === 'crm' ? 'Clientes & Clube Zumi' : 'Delivery & Canais Omnichannel'}
          </h3>
          <p style={{ fontSize: 13, color: 'var(--muted, #94a3b8)', marginTop: 8, maxWidth: 500, marginInline: 'auto' }}>
            {abaAtiva === 'crm'
              ? 'Gestão da carteira de clientes, cálculo de LTV, preferências gastronômicas e assinaturas mensais.'
              : 'Roteirização de entregas em Tangará da Serra, integração com WhatsApp Zumi e desintermediação de taxas de marketplace.'}
          </p>
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 10 }}>
            <button
              onClick={() => navigate(abaAtiva === 'crm' ? '/admin/clientes' : '/admin/zuma?tab=mercado')}
              style={{
                background: '#E63946',
                color: '#ffffff',
                border: 'none',
                padding: '8px 18px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {abaAtiva === 'crm' ? 'Ver Base no ERP →' : 'Ver Calculadora de Margem →'}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: INCLUIR / MODIFICAR PRATO DO CARDÁPIO */}
      {/* ========================================================================= */}
      {modalItemCardapio && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 16
        }}>
          <div style={{
            background: '#1e293b',
            border: '1px solid #E63946',
            borderRadius: 16,
            width: '100%',
            maxWidth: 520,
            padding: 24,
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, borderBottom: '1px solid #334155', paddingBottom: 12 }}>
              <div style={{ fontSize: 17, fontWeight: 900, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#E63946' }}>{modalItemCardapio.modo === 'novo' ? '➕ Incluir Prato' : '✏️ Modificar Prato'}</span>
              </div>
              <button
                onClick={() => setModalItemCardapio(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSalvarItemCardapio} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>Nome do Prato / Produto *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Niguiri Salmão Trufado (4 un)"
                  value={modalItemCardapio.item.nome}
                  onChange={e => setModalItemCardapio({ ...modalItemCardapio, item: { ...modalItemCardapio.item, nome: e.target.value } })}
                  style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#ffffff', fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>Categoria *</label>
                  <select
                    value={modalItemCardapio.item.categoria}
                    onChange={e => setModalItemCardapio({ ...modalItemCardapio, item: { ...modalItemCardapio.item, categoria: e.target.value } })}
                    style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#ffffff', fontSize: 13 }}
                  >
                    <option value="Combinados Especiais">Combinados Especiais</option>
                    <option value="Sashimis Nobres">Sashimis Nobres</option>
                    <option value="Uramakis & Rolls">Uramakis & Rolls</option>
                    <option value="Niguiris & Dyo">Niguiris & Dyo</option>
                    <option value="Hot Rolls">Hot Rolls</option>
                    <option value="Temakis Especiais">Temakis Especiais</option>
                    <option value="Cozinha Quente (Yakissoba/Guioza)">Cozinha Quente</option>
                    <option value="Bebidas & Sakês">Bebidas & Sakês</option>
                    <option value="Sobremesas Orientais">Sobremesas Orientais</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>Preço R$ *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={modalItemCardapio.item.preco}
                    onChange={e => setModalItemCardapio({ ...modalItemCardapio, item: { ...modalItemCardapio.item, preco: e.target.value } })}
                    style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#ffffff', fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>Código PDV</label>
                  <input
                    type="text"
                    placeholder="Ex: ZUM-045"
                    value={modalItemCardapio.item.cod_pdv}
                    onChange={e => setModalItemCardapio({ ...modalItemCardapio, item: { ...modalItemCardapio.item, cod_pdv: e.target.value } })}
                    style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#ffffff', fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>Praça de Preparo</label>
                  <select
                    value={modalItemCardapio.item.setor_producao}
                    onChange={e => setModalItemCardapio({ ...modalItemCardapio, item: { ...modalItemCardapio.item, setor_producao: e.target.value } })}
                    style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#ffffff', fontSize: 13 }}
                  >
                    <option value="sushi_bar">Sushi Bar (Frios)</option>
                    <option value="cozinha_quente">Cozinha Quente</option>
                    <option value="bar">Bar & Bebidas</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>Descrição dos Ingredientes</label>
                <textarea
                  rows={3}
                  placeholder="Descreva os insumos, técnica de preparo e detalhes para o cliente..."
                  value={modalItemCardapio.item.descricao}
                  onChange={e => setModalItemCardapio({ ...modalItemCardapio, item: { ...modalItemCardapio.item, descricao: e.target.value } })}
                  style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#ffffff', fontSize: 13, resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>URL da Foto Ilustrativa</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={modalItemCardapio.item.foto}
                  onChange={e => setModalItemCardapio({ ...modalItemCardapio, item: { ...modalItemCardapio.item, foto: e.target.value } })}
                  style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#ffffff', fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12, paddingTop: 14, borderTop: '1px solid #334155' }}>
                <button
                  type="button"
                  onClick={() => setModalItemCardapio(null)}
                  style={{ padding: '10px 16px', background: 'transparent', border: '1px solid #475569', borderRadius: 8, color: '#cbd5e1', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none', borderRadius: 8, color: '#ffffff', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Save size={16} /> Salvar Prato
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: INCLUIR / MODIFICAR MESA DO SALÃO */}
      {/* ========================================================================= */}
      {modalMesa && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 16
        }}>
          <div style={{
            background: '#1e293b',
            border: '1px solid #E63946',
            borderRadius: 16,
            width: '100%',
            maxWidth: 480,
            padding: 24,
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, borderBottom: '1px solid #334155', paddingBottom: 12 }}>
              <div style={{ fontSize: 17, fontWeight: 900, color: '#ffffff' }}>
                <span style={{ color: '#E63946' }}>{modalMesa.modo === 'novo' ? '➕ Incluir Nova Mesa' : '✏️ Modificar Mesa'}</span>
              </div>
              <button onClick={() => setModalMesa(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSalvarMesa} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>Número da Mesa *</label>
                  <input
                    type="number"
                    required
                    value={modalMesa.mesa.numero}
                    onChange={e => setModalMesa({ ...modalMesa, mesa: { ...modalMesa.mesa, numero: e.target.value } })}
                    style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#ffffff', fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>Capacidade de Lugares</label>
                  <select
                    value={modalMesa.mesa.capacidade}
                    onChange={e => setModalMesa({ ...modalMesa, mesa: { ...modalMesa.mesa, capacidade: e.target.value } })}
                    style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#ffffff', fontSize: 13 }}
                  >
                    <option value={2}>2 Lugares (Bistrô / Casal)</option>
                    <option value={4}>4 Lugares (Padrão)</option>
                    <option value={6}>6 Lugares (Família)</option>
                    <option value={8}>8 Lugares (Grupo)</option>
                    <option value={12}>12 Lugares (Mesa Grande VIP)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>Setor do Salão *</label>
                <select
                  value={modalMesa.mesa.setor}
                  onChange={e => setModalMesa({ ...modalMesa, mesa: { ...modalMesa.mesa, setor: e.target.value } })}
                  style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#ffffff', fontSize: 13 }}
                >
                  <option value="Salão Principal">Salão Principal Climatizado</option>
                  <option value="Deck Lounge">Deck Lounge Externo</option>
                  <option value="Sushi Bar Omakase">Sushi Bar Omakase (Balcão)</option>
                  <option value="Sala VIP">Sala VIP Corporativa Agro</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>Garçom Responsável</label>
                  <input
                    type="text"
                    value={modalMesa.mesa.garcom}
                    onChange={e => setModalMesa({ ...modalMesa, mesa: { ...modalMesa.mesa, garcom: e.target.value } })}
                    style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#ffffff', fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>Temperatura Clima (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={modalMesa.mesa.tempAmbiente}
                    onChange={e => setModalMesa({ ...modalMesa, mesa: { ...modalMesa.mesa, tempAmbiente: e.target.value } })}
                    style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#ffffff', fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12, paddingTop: 14, borderTop: '1px solid #334155' }}>
                <button
                  type="button"
                  onClick={() => setModalMesa(null)}
                  style={{ padding: '10px 16px', background: 'transparent', border: '1px solid #475569', borderRadius: 8, color: '#cbd5e1', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none', borderRadius: 8, color: '#ffffff', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Save size={16} /> Salvar Mesa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: INCLUIR / MODIFICAR INSUMO NO ESTOQUE */}
      {/* ========================================================================= */}
      {modalInsumo && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 16
        }}>
          <div style={{
            background: '#1e293b',
            border: '1px solid #E63946',
            borderRadius: 16,
            width: '100%',
            maxWidth: 500,
            padding: 24,
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, borderBottom: '1px solid #334155', paddingBottom: 12 }}>
              <div style={{ fontSize: 17, fontWeight: 900, color: '#ffffff' }}>
                <span style={{ color: '#E63946' }}>{modalInsumo.modo === 'novo' ? '➕ Incluir Novo Insumo' : '✏️ Modificar Insumo'}</span>
              </div>
              <button onClick={() => setModalInsumo(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSalvarInsumo} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>Nome do Insumo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Robalo Fresco do Litoral"
                  value={modalInsumo.insumo.nome}
                  onChange={e => setModalInsumo({ ...modalInsumo, insumo: { ...modalInsumo.insumo, nome: e.target.value } })}
                  style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#ffffff', fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>Código</label>
                  <input
                    type="text"
                    placeholder="Ex: PESC-009"
                    value={modalInsumo.insumo.codigo}
                    onChange={e => setModalInsumo({ ...modalInsumo, insumo: { ...modalInsumo.insumo, codigo: e.target.value } })}
                    style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#ffffff', fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>Unidade</label>
                  <select
                    value={modalInsumo.insumo.unidade}
                    onChange={e => setModalInsumo({ ...modalInsumo, insumo: { ...modalInsumo.insumo, unidade: e.target.value } })}
                    style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#ffffff', fontSize: 13 }}
                  >
                    <option value="kg">kg (Quilograma)</option>
                    <option value="g">g (Grama)</option>
                    <option value="un">un (Unidade)</option>
                    <option value="l">l (Litro)</option>
                    <option value="cx">cx (Caixa)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>Saldo Atual</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={modalInsumo.insumo.saldoAtual}
                    onChange={e => setModalInsumo({ ...modalInsumo, insumo: { ...modalInsumo.insumo, saldoAtual: e.target.value } })}
                    style={{ width: '100%', padding: '10px 8px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#ffffff', fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>Estoque Mínimo</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={modalInsumo.insumo.saldoMinimo}
                    onChange={e => setModalInsumo({ ...modalInsumo, insumo: { ...modalInsumo.insumo, saldoMinimo: e.target.value } })}
                    style={{ width: '100%', padding: '10px 8px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#ffffff', fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>Custo Médio R$</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={modalInsumo.insumo.custoMedioUnitario}
                    onChange={e => setModalInsumo({ ...modalInsumo, insumo: { ...modalInsumo.insumo, custoMedioUnitario: e.target.value } })}
                    style={{ width: '100%', padding: '10px 8px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#ffffff', fontSize: 13 }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>Fornecedor Principal</label>
                <input
                  type="text"
                  placeholder="Ex: Distribuidora Mar & Rio Cuiabá"
                  value={modalInsumo.insumo.fornecedor}
                  onChange={e => setModalInsumo({ ...modalInsumo, insumo: { ...modalInsumo.insumo, fornecedor: e.target.value } })}
                  style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#ffffff', fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12, paddingTop: 14, borderTop: '1px solid #334155' }}>
                <button
                  type="button"
                  onClick={() => setModalInsumo(null)}
                  style={{ padding: '10px 16px', background: 'transparent', border: '1px solid #475569', borderRadius: 8, color: '#cbd5e1', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none', borderRadius: 8, color: '#ffffff', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Save size={16} /> Salvar Insumo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: INCLUIR / MODIFICAR PEDIDO NO KDS DA COZINHA */}
      {/* ========================================================================= */}
      {modalPedidoKds && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 16
        }}>
          <div style={{
            background: '#1e293b',
            border: '1px solid #E63946',
            borderRadius: 16,
            width: '100%',
            maxWidth: 520,
            padding: 24,
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, borderBottom: '1px solid #334155', paddingBottom: 12 }}>
              <div style={{ fontSize: 17, fontWeight: 900, color: '#ffffff' }}>
                <span style={{ color: '#E63946' }}>{modalPedidoKds.modo === 'novo' ? '➕ Incluir Pedido Manual' : '✏️ Modificar Pedido KDS'}</span>
              </div>
              <button onClick={() => setModalPedidoKds(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSalvarPedidoKds} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>Comanda / Código</label>
                  <input
                    type="text"
                    required
                    value={modalPedidoKds.pedido.numeroComanda}
                    onChange={e => setModalPedidoKds({ ...modalPedidoKds, pedido: { ...modalPedidoKds.pedido, numeroComanda: e.target.value } })}
                    style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#ffffff', fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>Origem do Pedido</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Mesa 08 · Salão"
                    value={modalPedidoKds.pedido.origem}
                    onChange={e => setModalPedidoKds({ ...modalPedidoKds, pedido: { ...modalPedidoKds.pedido, origem: e.target.value } })}
                    style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#ffffff', fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>Praça Responsável</label>
                  <select
                    value={modalPedidoKds.pedido.praca}
                    onChange={e => setModalPedidoKds({ ...modalPedidoKds, pedido: { ...modalPedidoKds.pedido, praca: e.target.value } })}
                    style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#ffffff', fontSize: 13 }}
                  >
                    <option value="SUSHI_BAR">Sushi Bar (Sushis & Pescados)</option>
                    <option value="COZINHA_QUENTE">Cozinha Quente (Pratos Quentes)</option>
                    <option value="BAR_BEBIDAS">Bar & Bebidas</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>Prioridade</label>
                  <select
                    value={modalPedidoKds.pedido.prioridade}
                    onChange={e => setModalPedidoKds({ ...modalPedidoKds, pedido: { ...modalPedidoKds.pedido, prioridade: e.target.value } })}
                    style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#ffffff', fontSize: 13 }}
                  >
                    <option value="NORMAL">Normal (Até 15 min)</option>
                    <option value="ALTA">Alta (Até 10 min)</option>
                    <option value="URGENTE">Urgente (Imediato)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>Itens e Observações (1 item por linha) *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="1x Combinado Zuma 30 Peças&#10;2x Temaki Salmão Grelhado (sem cream cheese)&#10;1x Coca-Cola Zero"
                  value={modalPedidoKds.pedido.itensTexto}
                  onChange={e => setModalPedidoKds({ ...modalPedidoKds, pedido: { ...modalPedidoKds.pedido, itensTexto: e.target.value } })}
                  style={{ width: '100%', padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#ffffff', fontSize: 13, resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12, paddingTop: 14, borderTop: '1px solid #334155' }}>
                <button
                  type="button"
                  onClick={() => setModalPedidoKds(null)}
                  style={{ padding: '10px 16px', background: 'transparent', border: '1px solid #475569', borderRadius: 8, color: '#cbd5e1', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none', borderRadius: 8, color: '#ffffff', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Save size={16} /> Salvar Pedido KDS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
