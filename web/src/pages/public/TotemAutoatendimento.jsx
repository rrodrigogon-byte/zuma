import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ShoppingBag,
  Scissors,
  Award,
  ArrowLeft,
  CheckCircle2,
  QrCode,
  CreditCard,
  Banknote,
  Printer,
  RotateCcw,
  Volume2,
  Lock,
  Maximize2,
  Search,
  Plus,
  Minus,
  Trash2,
  Clock,
  Sparkles,
  X,
  Keyboard,
  Beer,
  Coffee,
  Wine,
  Filter,
  Tag,
} from 'lucide-react';
import './totem.css';

const TIMEOUT_PADRAO = 45; // 45 segundos sem toque para voltar à tela inicial

// Metadados visuais de categorias e produtos
function getCategoriaMeta(catNome, prodNome) {
  const t = ((catNome || '') + ' ' + (prodNome || '')).toLowerCase();
  if (t.includes('cerveja') || t.includes('heineken') || t.includes('stella') || t.includes('budweiser') || t.includes('corona') || t.includes('ipa') || t.includes('chopp')) {
    return { Icon: Beer, cor: '#f59e0b', bg: 'rgba(245, 158, 11, 0.16)', tag: 'Cervejas' };
  }
  if (t.includes('refrigerante') || t.includes('coca') || t.includes('guaraná') || t.includes('red bull') || t.includes('redbull') || t.includes('energético') || t.includes('água') || t.includes('suco') || t.includes('monster')) {
    return { Icon: Wine, cor: '#06b6d4', bg: 'rgba(6, 182, 212, 0.16)', tag: 'Bebidas' };
  }
  if (t.includes('café') || t.includes('expresso')) {
    return { Icon: Coffee, cor: '#d97706', bg: 'rgba(217, 119, 6, 0.16)', tag: 'Cafeteria' };
  }
  if (t.includes('pomada') || t.includes('matte') || t.includes('shampoo') || t.includes('cabelo') || t.includes('spray') || t.includes('start') || t.includes('fixador')) {
    return { Icon: Sparkles, cor: '#b38e32', bg: 'rgba(179, 142, 50, 0.18)', tag: 'Cabelo' };
  }
  if (t.includes('barba') || t.includes('óleo') || t.includes('balm') || t.includes('pós barba') || t.includes('talco')) {
    return { Icon: Scissors, cor: '#10b981', bg: 'rgba(16, 185, 129, 0.16)', tag: 'Barba' };
  }
  return { Icon: ShoppingBag, cor: '#a855f7', bg: 'rgba(168, 85, 247, 0.16)', tag: catNome || 'Revenda' };
}

// Teclas do Teclado Virtual QWERTY Touch para Kiosks
const TECLAS_VIRTUAIS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫'],
];

const CHIPS_RAPIDOS = [
  { label: 'Todos', cat: 'Todos', termo: '' },
  { label: '🍺 Cervejas', cat: 'Todos', termo: 'cerveja' },
  { label: '🥤 Refrigerantes & Água', cat: 'Todos', termo: 'refrigerante' },
  { label: '⚡ Red Bull', cat: 'Todos', termo: 'red bull' },
  { label: '✨ Pomadas & Cabelo', cat: 'Todos', termo: 'pomada' },
  { label: '💈 Barba', cat: 'Todos', termo: 'barba' },
];

export default function TotemAutoatendimento() {
  const [screensaver, setScreensaver] = useState(true);
  const [etapa, setEtapa] = useState('inicio'); // 'inicio', 'produtos', 'servicos', 'clube', 'identificacao', 'pagamento', 'sucesso'
  const [tipoJornada, setTipoJornada] = useState(null); // 'produtos', 'servicos', 'clube'
  const [tempoRestante, setTempoRestante] = useState(TIMEOUT_PADRAO);
  
  // Dados do Totem carregados da API
  const [totemConfig, setTotemConfig] = useState({
    nome: 'Totem Barbearia Dino',
    mensagemBoasVindas: 'Toque para iniciar seu autoatendimento',
    timeoutSegundos: 45,
    pinGerente: '1234',
  });
  
  const [produtos, setProdutos] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [profissionais, setProfissionais] = useState([]);
  const [categoriaAtiva, setCategoriaAtiva] = useState('Todos');
  const [busca, setBusca] = useState('');
  const [tecladoAberto, setTecladoAberto] = useState(false);

  // Extrai categorias dinâmicas dos produtos disponíveis
  const categoriasDisponiveis = useMemo(() => {
    const cats = new Set(['Todos']);
    produtos.forEach(p => { if (p.categoria) cats.add(p.categoria); });
    return Array.from(cats);
  }, [produtos]);

  // Contagem de produtos por categoria
  const contagemPorCategoria = useMemo(() => {
    const mapa = { Todos: produtos.length };
    produtos.forEach(p => {
      if (p.categoria) {
        mapa[p.categoria] = (mapa[p.categoria] || 0) + 1;
      }
    });
    return mapa;
  }, [produtos]);

  // Filtro inteligente de produtos (Categoria + Termo de Busca)
  const produtosFiltrados = useMemo(() => {
    return produtos.filter(p => {
      const matchCat = categoriaAtiva === 'Todos' || p.categoria === categoriaAtiva;
      if (!matchCat) return false;
      if (!busca.trim()) return true;
      const termo = busca.toLowerCase().trim();
      const nome = (p.nome || '').toLowerCase();
      const cat = (p.categoria || '').toLowerCase();
      return nome.includes(termo) || cat.includes(termo);
    });
  }, [produtos, categoriaAtiva, busca]);

  // Estado do Carrinho (Produtos)
  const [carrinho, setCarrinho] = useState([]);
  
  // Estado de Serviços & Senha
  const [servicoEscolhido, setServicoEscolhido] = useState(null);
  const [profissionalEscolhido, setProfissionalEscolhido] = useState(null);
  
  // Identificação do Cliente
  const [clienteNome, setClienteNome] = useState('');
  const [clienteTelefone, setClienteTelefone] = useState('');
  const [campoFocado, setCampoFocado] = useState('telefone');
  
  // Pagamento & Senha Emitida
  const [meioPagamento, setMeioPagamento] = useState('pix');
  const [senhaEmitida, setSenhaEmitida] = useState(null);
  const [pedidoEmitido, setPedidoEmitido] = useState(null);
  const [pixConfirmado, setPixConfirmado] = useState(false);
  
  // Trava de Gerente
  const [modalPin, setModalPin] = useState(false);
  const [pinDigitado, setPinDigitado] = useState('');
  const [erroPin, setErroPin] = useState('');

  // Carrega configurações do totem e catálogo da loja
  useEffect(() => {
    async function carregar() {
      try {
        const res = await fetch('/api/totem/config');
        const data = await res.json();
        if (data.ok) {
          if (data.totem) setTotemConfig(data.totem);
          if (Array.isArray(data.produtos) && data.produtos.length > 0) {
            setProdutos(data.produtos);
          } else {
            // Mock de fallback enriquecido
            setProdutos([
              { id: 'p1', nome: 'Pomada Efeito Matte 80g', preco: 65, categoria: 'Cabelo', estoque: 12 },
              { id: 'p2', nome: 'Óleo Hidratante para Barba 30ml', preco: 49, categoria: 'Barba', estoque: 18 },
              { id: 'p3', nome: 'Balm Modelador de Barba 100g', preco: 55, categoria: 'Barba', estoque: 8 },
              { id: 'p4', nome: 'Shampoo Antiqueda & Fortalecedor', preco: 60, categoria: 'Cabelo', estoque: 15 },
              { id: 'p5', nome: 'Cerveja Artesanal Dino IPA 500ml', preco: 22, categoria: 'Bebidas & Bar', estoque: 24 },
              { id: 'p6', nome: 'Energético Monster Energy 473ml', preco: 16, categoria: 'Bebidas & Bar', estoque: 30 },
              { id: 'p7', nome: 'Água Mineral sem Gás 500ml', preco: 6, categoria: 'Bebidas & Bar', estoque: 40 },
            ]);
          }
          if (Array.isArray(data.servicos) && data.servicos.length > 0) {
            setServicos(data.servicos);
          } else {
            setServicos([
              { id: 's1', nome: 'Corte Cabelo Dino', preco: 80, duracao: 35 },
              { id: 's2', nome: 'Barba Terapia com Toalha Quente', preco: 60, duracao: 30 },
              { id: 's3', nome: 'Combo Completo (Cabelo + Barba)', preco: 130, duracao: 60 },
              { id: 's4', nome: 'Design de Sobrancelha Masculina', preco: 30, duracao: 15 },
            ]);
          }
          if (Array.isArray(data.profissionais) && data.profissionais.length > 0) {
            setProfissionais(data.profissionais);
          } else {
            setProfissionais([
              { id: 'pro_qualquer', nome: 'Primeiro Disponível (Mais Rápido)' },
              { id: 'pro_dino', nome: 'Dino Master Barbeiro' },
              { id: 'pro_bruno', nome: 'Bruno Barber' },
              { id: 'pro_david', nome: 'David Barber' },
            ]);
          }
        }
      } catch {
        // Fallback offline seguro
      }
    }
    carregar();
  }, []);

  // Timer de inatividade (reseta se o cliente não tocar na tela)
  useEffect(() => {
    if (screensaver) return;
    const interval = setInterval(() => {
      setTempoRestante(prev => {
        if (prev <= 1) {
          resetarTotem();
          return TIMEOUT_PADRAO;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [screensaver]);

  // Reseta o temporizador a qualquer toque do usuário
  function registrarAtividade() {
    setTempoRestante(totemConfig.timeoutSegundos || TIMEOUT_PADRAO);
  }

  function resetarTotem() {
    setScreensaver(true);
    setEtapa('inicio');
    setTipoJornada(null);
    setCarrinho([]);
    setServicoEscolhido(null);
    setProfissionalEscolhido(null);
    setClienteNome('');
    setClienteTelefone('');
    setSenhaEmitida(null);
    setPedidoEmitido(null);
    setPixConfirmado(false);
    setBusca('');
    setTecladoAberto(false);
    setTempoRestante(totemConfig.timeoutSegundos || TIMEOUT_PADRAO);
  }

  // Tocar para sair do Screensaver
  function acordarTotem() {
    setScreensaver(false);
    setTempoRestante(totemConfig.timeoutSegundos || TIMEOUT_PADRAO);
  }

  // Funções do Carrinho de Produtos
  function adicionarAoCarrinho(produto) {
    registrarAtividade();
    setCarrinho(prev => {
      const idx = prev.findIndex(item => item.id === produto.id);
      if (idx >= 0) {
        const novo = [...prev];
        novo[idx] = { ...novo[idx], qtd: novo[idx].qtd + 1 };
        return novo;
      }
      return [...prev, { ...produto, qtd: 1 }];
    });
  }

  function alterarQtdCarrinho(id, delta) {
    registrarAtividade();
    setCarrinho(prev => {
      return prev
        .map(item => {
          if (item.id === id) {
            const novaQtd = item.qtd + delta;
            return novaQtd > 0 ? { ...item, qtd: novaQtd } : null;
          }
          return item;
        })
        .filter(Boolean);
    });
  }

  function removerDoCarrinho(id) {
    registrarAtividade();
    setCarrinho(prev => prev.filter(item => item.id !== id));
  }

  function limparCarrinho() {
    registrarAtividade();
    setCarrinho([]);
  }

  const totalCarrinho = useMemo(() => {
    return carrinho.reduce((acc, item) => acc + (item.preco * item.qtd), 0);
  }, [carrinho]);

  const totalItensCarrinho = useMemo(() => {
    return carrinho.reduce((acc, item) => acc + item.qtd, 0);
  }, [carrinho]);

  // Teclado touch virtual
  function digitarTecla(char) {
    registrarAtividade();
    if (campoFocado === 'telefone') {
      if (clienteTelefone.length < 11) {
        setClienteTelefone(prev => prev + char);
      }
    } else if (campoFocado === 'pin') {
      if (pinDigitado.length < 4) {
        setPinDigitado(prev => prev + char);
      }
    }
  }

  function apagarTecla() {
    registrarAtividade();
    if (campoFocado === 'telefone') {
      setClienteTelefone(prev => prev.slice(0, -1));
    } else if (campoFocado === 'pin') {
      setPinDigitado(prev => prev.slice(0, -1));
    }
  }

  // Digitação no Teclado Virtual de Busca
  function digitarTeclaVirtual(char) {
    registrarAtividade();
    if (char === '⌫') {
      setBusca(prev => prev.slice(0, -1));
    } else if (char === 'CLEAR') {
      setBusca('');
    } else if (char === 'SPACE') {
      setBusca(prev => prev + ' ');
    } else {
      setBusca(prev => prev + char);
    }
  }

  // Finalizar Emissão de Senha ou Pedido
  async function finalizarAtendimentoOuPedido() {
    registrarAtividade();
    try {
      if (tipoJornada === 'servicos') {
        const payload = {
          servicoId: servicoEscolhido?.id,
          profissionalId: profissionalEscolhido?.id,
          clienteNome: clienteNome || 'Cliente Totem',
          clienteTelefone,
          prioritario: false,
        };
        const res = await fetch('/api/totem/senhas/emitir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.ok) {
          setSenhaEmitida(data.senha);
          setEtapa('sucesso');
        }
      } else if (tipoJornada === 'produtos') {
        const payload = {
          clienteNome: clienteNome || 'Cliente Balcão',
          clienteTelefone,
          itens: carrinho.map(item => ({
            id: item.id,
            nome: item.nome,
            preco: item.preco,
            qtd: item.qtd,
          })),
          meioPagamento,
        };
        const res = await fetch('/api/totem/pedidos/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.ok) {
          setPedidoEmitido(data.pedido);
          setEtapa('sucesso');
        }
      }
    } catch {
      // Fallback para demonstração autônoma
      setSenhaEmitida({
        codigo: 'A-046',
        posicao: 4,
        tempoEstimadoMinutos: 15,
        clienteNome: clienteNome || 'Cliente Totem',
      });
      setEtapa('sucesso');
    }
  }

  // Simular confirmação instantânea de Pix
  useEffect(() => {
    if (etapa === 'pagamento' && meioPagamento === 'pix') {
      const timer = setTimeout(() => {
        setPixConfirmado(true);
        setTimeout(() => {
          finalizarAtendimentoOuPedido();
        }, 1200);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [etapa, meioPagamento]);

  return (
    <div className="totem-container" onClick={registrarAtividade}>
      
      {/* 1. MODO DE DESCANSO / SCREENSAVER INTELIGENTE */}
      {screensaver && (
        <div className="totem-screensaver" onClick={acordarTotem}>
          <div className="totem-screensaver-pulse" style={{ padding: 24, background: '#1c1e24', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
            <Scissors size={64} color="#B38E32" />
          </div>
          <h1 style={{ fontSize: 44, fontWeight: 800, color: '#fff', margin: '0 0 12px 0', letterSpacing: -0.5 }}>
            {totemConfig.nome || 'Barbearia Dino'}
          </h1>
          <p style={{ fontSize: 20, color: '#94a3b8', margin: '0 0 36px 0', maxWidth: 480 }}>
            {totemConfig.mensagemBoasVindas || 'Toque na tela para iniciar seu atendimento'}
          </p>
          <div style={{ padding: '18px 48px', background: '#B38E32', color: '#000', fontSize: 22, fontWeight: 800, borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 12, boxShadow: '0 10px 30px rgba(179,142,50,0.3)' }}>
            <Sparkles size={24} /> TOQUE NA TELA PARA INICIAR
          </div>
          <div style={{ marginTop: 60, display: 'flex', gap: 24, color: '#64748b', fontSize: 14 }}>
            <span>✂️ Retirada de Senhas</span>
            <span>•</span>
            <span>🛍️ Compra Rápida de Produtos</span>
            <span>•</span>
            <span>⚡ Pagamento Instantâneo via PIX</span>
          </div>
        </div>
      )}

      {/* 2. HEADER SUPERIOR DO TOTEM (PERMANENTEMENTE FIXO) */}
      <header className="totem-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {etapa !== 'inicio' && (
            <button
              onClick={() => {
                if (etapa === 'produtos' || etapa === 'servicos' || etapa === 'clube') setEtapa('inicio');
                else if (etapa === 'identificacao') setEtapa(tipoJornada);
                else if (etapa === 'pagamento') setEtapa('identificacao');
                else resetarTotem();
              }}
              style={{ background: '#1c1e24', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: 14, padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 15, fontWeight: 700 }}
            >
              <ArrowLeft size={18} /> Voltar ao Início
            </button>
          )}
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: -0.3 }}>
              {totemConfig.nome || 'Barbearia Dino'}
            </h2>
            <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>● Terminal de Autoatendimento Ativo</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Temporizador de inatividade */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#15161b', padding: '8px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', fontSize: 13, color: '#94a3b8' }}>
            <Clock size={16} color="#B38E32" />
            <span>Retornando em: <strong style={{ color: '#fff' }}>{tempoRestante}s</strong></span>
          </div>

          {/* Botão de descanso rápido */}
          <button
            onClick={() => setScreensaver(true)}
            title="Entrar em modo de descanso"
            style={{ background: '#15161b', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', borderRadius: 12, padding: 9, cursor: 'pointer' }}
          >
            <RotateCcw size={16} />
          </button>

          {/* Trava de Gerente */}
          <button
            onClick={() => { setModalPin(true); setCampoFocado('pin'); setPinDigitado(''); }}
            title="Acesso restrito ao gerente"
            style={{ background: '#15161b', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b', borderRadius: 12, padding: 9, cursor: 'pointer' }}
          >
            <Lock size={16} />
          </button>
        </div>
      </header>

      {/* 3. CONTEÚDO PRINCIPAL (100% RESPONSIVO, SEM SCROLL EXTERNO) */}
      <main style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        {/* ETAPA: INÍCIO - ESCOLHA DE JORNADA */}
        {etapa === 'inicio' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', maxWidth: 960, margin: '0 auto', width: '100%' }}>
            <div style={{ textAlign: 'center', marginBottom: 36 }}>
              <h1 style={{ fontSize: 34, fontWeight: 800, color: '#fff', margin: '0 0 10px 0' }}>
                O que você deseja fazer hoje?
              </h1>
              <p style={{ fontSize: 17, color: '#94a3b8', margin: 0 }}>
                Toque em uma das opções abaixo para ser atendido com rapidez:
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, width: '100%' }}>
              
              {/* Jornada 1: Senha de Atendimento */}
              <div
                className="totem-mode-card"
                onClick={() => {
                  setTipoJornada('servicos');
                  setEtapa('servicos');
                  registrarAtividade();
                }}
              >
                <div style={{ width: 80, height: 80, borderRadius: 20, background: 'rgba(179, 142, 50, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                  <Scissors size={40} color="#B38E32" />
                </div>
                <h3 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: '0 0 8px 0' }}>
                  Atendimento & Senha
                </h3>
                <p style={{ fontSize: 14, color: '#94a3b8', margin: '0 0 20px 0', lineHeight: 1.4 }}>
                  Retirar senha para a fila presencial ou fazer check-in do seu horário agendado.
                </p>
                <button style={{ marginTop: 'auto', width: '100%', padding: '12px 18px', background: '#B38E32', color: '#000', borderRadius: 12, fontWeight: 800, border: 'none', cursor: 'pointer' }}>
                  Retirar Senha →
                </button>
              </div>

              {/* Jornada 2: Self-checkout de Produtos & Bebidas */}
              <div
                className="totem-mode-card"
                onClick={() => {
                  setTipoJornada('produtos');
                  setEtapa('produtos');
                  registrarAtividade();
                }}
              >
                <div style={{ width: 80, height: 80, borderRadius: 20, background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                  <ShoppingBag size={40} color="#10b981" />
                </div>
                <h3 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: '0 0 8px 0' }}>
                  Comprar Produtos
                </h3>
                <p style={{ fontSize: 14, color: '#94a3b8', margin: '0 0 20px 0', lineHeight: 1.4 }}>
                  Pomadas, óleos, tônicos, shakes, cervejas geladas e bebidas no self-checkout.
                </p>
                <button style={{ marginTop: 'auto', width: '100%', padding: '12px 18px', background: '#10b981', color: '#000', borderRadius: 12, fontWeight: 800, border: 'none', cursor: 'pointer' }}>
                  Ver Catálogo →
                </button>
              </div>

              {/* Jornada 3: Clube & Assinaturas */}
              <div
                className="totem-mode-card"
                onClick={() => {
                  setTipoJornada('clube');
                  setEtapa('identificacao');
                  registrarAtividade();
                }}
              >
                <div style={{ width: 80, height: 80, borderRadius: 20, background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                  <Award size={40} color="#3b82f6" />
                </div>
                <h3 style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: '0 0 8px 0' }}>
                  Clube VIP Dino
                </h3>
                <p style={{ fontSize: 14, color: '#94a3b8', margin: '0 0 20px 0', lineHeight: 1.4 }}>
                  Consulte seus cortes disponíveis no plano, benefícios ativos e saldo de fidelidade.
                </p>
                <button style={{ marginTop: 'auto', width: '100%', padding: '12px 18px', background: '#3b82f6', color: '#fff', borderRadius: 12, fontWeight: 800, border: 'none', cursor: 'pointer' }}>
                  Consultar Saldo →
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ETAPA: CATÁLOGO DE PRODUTOS & BEBIDAS (COM BUSCA, CATEGORIAS E CARRINHO FIXOS) */}
        {etapa === 'produtos' && (
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, height: '100%', overflow: 'hidden' }}>
            
            {/* LADO ESQUERDO: VITRINE TOUCH COM BUSCA E CATEGORIAS FIXAS */}
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', gap: 12 }}>
              
              {/* Barra de Busca Touch com Teclado Virtual Integrado */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
                <div className="totem-search-box" style={{ flex: 1 }}>
                  <Search size={20} color="#B38E32" />
                  <input
                    type="text"
                    value={busca}
                    onChange={(e) => { setBusca(e.target.value); registrarAtividade(); }}
                    onFocus={() => { setTecladoAberto(true); registrarAtividade(); }}
                    placeholder="Buscar produto, cerveja, pomada, água, refrigerante..."
                    className="totem-search-input"
                  />
                  {busca && (
                    <button
                      onClick={() => { setBusca(''); registrarAtividade(); }}
                      style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>

                {/* Botão de alternar teclado virtual touch */}
                <button
                  onClick={() => { setTecladoAberto(prev => !prev); registrarAtividade(); }}
                  style={{
                    height: 52,
                    padding: '0 16px',
                    borderRadius: 16,
                    background: tecladoAberto ? '#B38E32' : '#1c1e24',
                    color: tecladoAberto ? '#000' : '#fff',
                    border: '1.5px solid rgba(255,255,255,0.12)',
                    fontWeight: 700,
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                  title="Abrir teclado na tela para digitação touch"
                >
                  <Keyboard size={18} />
                  <span>{tecladoAberto ? 'Fechar Teclado' : 'Teclado Touch'}</span>
                </button>
              </div>

              {/* Sugestões Rápidas de 1 Toque */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', flexShrink: 0, paddingBottom: 2 }}>
                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 700, whiteSpace: 'nowrap' }}>Atalhos:</span>
                {CHIPS_RAPIDOS.map(chip => (
                  <button
                    key={chip.label}
                    onClick={() => {
                      setBusca(chip.termo);
                      setCategoriaAtiva(chip.cat);
                      registrarAtividade();
                    }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: 700,
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: busca.toLowerCase() === chip.termo.toLowerCase() && chip.termo !== '' ? '#B38E32' : '#15161b',
                      color: busca.toLowerCase() === chip.termo.toLowerCase() && chip.termo !== '' ? '#000' : '#cbd5e1',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {/* Barra de Categorias */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', flexShrink: 0, paddingBottom: 4 }}>
                {categoriasDisponiveis.map(cat => {
                  const qtd = contagemPorCategoria[cat] || 0;
                  const ativa = categoriaAtiva === cat;
                  return (
                    <button
                      key={cat}
                      className="totem-cat-pill"
                      onClick={() => { setCategoriaAtiva(cat); registrarAtividade(); }}
                      style={{
                        background: ativa ? '#B38E32' : '#18191e',
                        color: ativa ? '#000' : '#fff',
                        border: ativa ? 'none' : '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <span>{cat}</span>
                      <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 6, background: ativa ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.1)', color: ativa ? '#000' : '#94a3b8' }}>
                        {qtd}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Grade de Produtos Scrollável */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14, alignContent: 'start', paddingRight: 6 }}>
                {produtosFiltrados.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', color: '#64748b' }}>
                    <Search size={48} strokeWidth={1} style={{ marginBottom: 12, opacity: 0.5 }} />
                    <h3 style={{ color: '#fff', fontSize: 18, margin: '0 0 6px 0' }}>Nenhum produto encontrado</h3>
                    <p style={{ margin: 0, fontSize: 14 }}>Tente pesquisar outro termo ou selecione a categoria "Todos".</p>
                    <button
                      onClick={() => { setBusca(''); setCategoriaAtiva('Todos'); registrarAtividade(); }}
                      style={{ marginTop: 16, padding: '10px 20px', borderRadius: 12, background: '#B38E32', color: '#000', fontWeight: 800, border: 'none', cursor: 'pointer' }}
                    >
                      Limpar Filtros
                    </button>
                  </div>
                ) : (
                  produtosFiltrados.map(prod => {
                    const noCarrinho = carrinho.find(c => c.id === prod.id)?.qtd || 0;
                    const meta = getCategoriaMeta(prod.categoria, prod.nome);
                    const Icone = meta.Icon;

                    return (
                      <div
                        key={prod.id}
                        className={`totem-product-card ${noCarrinho > 0 ? 'no-carrinho' : ''}`}
                        onClick={() => adicionarAoCarrinho(prod)}
                      >
                        {/* Topo do Card: Categoria com cor e ícone temático */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: meta.cor, background: meta.bg, padding: '3px 8px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Icone size={12} /> {meta.tag}
                          </span>
                          {noCarrinho > 0 && (
                            <span style={{ fontSize: 11, fontWeight: 800, color: '#000', background: '#B38E32', padding: '2px 8px', borderRadius: 6 }}>
                              {noCarrinho} no pedido
                            </span>
                          )}
                        </div>

                        {/* Imagem / Ícone em destaque */}
                        <div style={{ height: 95, background: meta.bg, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                          <Icone size={44} color={meta.cor} />
                        </div>

                        {/* Nome do Produto */}
                        <strong style={{ fontSize: 15, color: '#fff', margin: '0 0 10px 0', lineHeight: 1.3, height: 40, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {prod.nome}
                        </strong>

                        {/* Preço e Botão de Adição Rápida */}
                        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>Preço unitário</span>
                            <span style={{ fontSize: 18, fontWeight: 800, color: '#10b981' }}>
                              R$ {prod.preco.toFixed(2)}
                            </span>
                          </div>

                          {/* Se já está no carrinho, exibe botões touch + e - direto no card */}
                          {noCarrinho > 0 ? (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1c1e24', border: '1px solid #B38E32', borderRadius: 10, padding: 3 }}
                            >
                              <button
                                onClick={() => alterarQtdCarrinho(prod.id, -1)}
                                style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: '#262930', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                              >
                                <Minus size={14} />
                              </button>
                              <span style={{ fontSize: 13, fontWeight: 800, color: '#B38E32', minWidth: 16, textAlign: 'center' }}>
                                {noCarrinho}
                              </span>
                              <button
                                onClick={() => alterarQtdCarrinho(prod.id, 1)}
                                style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: '#B38E32', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); adicionarAoCarrinho(prod); }}
                              style={{
                                background: '#1c1e24',
                                border: '1px solid rgba(255,255,255,0.12)',
                                color: '#fff',
                                borderRadius: 10,
                                padding: '8px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                fontSize: 13,
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              <Plus size={15} color="#10b981" /> Adicionar
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Teclado Virtual QWERTY Touch na Tela (Para Quiosques Físicos) */}
              {tecladoAberto && (
                <div className="totem-virtual-keyboard">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Teclado Touch do Quiosque</span>
                    <button
                      onClick={() => setTecladoAberto(false)}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Fechar ✕
                    </button>
                  </div>
                  {TECLAS_VIRTUAIS.map((linha, idx) => (
                    <div key={idx} className="totem-vk-row">
                      {linha.map(tecla => (
                        <div
                          key={tecla}
                          className="totem-vk-key"
                          onClick={() => digitarTeclaVirtual(tecla)}
                        >
                          {tecla}
                        </div>
                      ))}
                    </div>
                  ))}
                  <div className="totem-vk-row">
                    <div className="totem-vk-key special" style={{ flex: 1 }} onClick={() => digitarTeclaVirtual('CLEAR')}>
                      Limpar
                    </div>
                    <div className="totem-vk-key special" style={{ flex: 3 }} onClick={() => digitarTeclaVirtual('SPACE')}>
                      ESPAÇO
                    </div>
                    <div className="totem-vk-key special" style={{ flex: 1, background: '#B38E32', color: '#000' }} onClick={() => setTecladoAberto(false)}>
                      Buscar ✓
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* LADO DIREITO: CARRINHO TOUCH ("SEU PEDIDO") 100% VISÍVEL E ESTRUTURADO */}
            <div style={{ background: '#141519', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 18, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              
              {/* Cabeçalho do Carrinho */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 12, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShoppingBag size={20} color="#B38E32" />
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#fff' }}>
                    Seu Pedido
                  </h3>
                  <span style={{ fontSize: 12, background: '#1c1e24', padding: '2px 8px', borderRadius: 6, color: '#B38E32', fontWeight: 800 }}>
                    {totalItensCarrinho} {totalItensCarrinho === 1 ? 'item' : 'itens'}
                  </span>
                </div>

                {carrinho.length > 0 && (
                  <button
                    onClick={limparCarrinho}
                    title="Esvaziar carrinho"
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                  >
                    <Trash2 size={14} /> Limpar
                  </button>
                )}
              </div>

              {/* Lista Scrollável dos Itens no Carrinho */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {carrinho.length === 0 ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b', textAlign: 'center', padding: '20px 10px' }}>
                    <div style={{ width: 64, height: 64, borderRadius: 999, background: '#1a1c22', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                      <ShoppingBag size={32} color="#475569" />
                    </div>
                    <strong style={{ fontSize: 16, color: '#fff', marginBottom: 6 }}>Seu carrinho está vazio</strong>
                    <span style={{ fontSize: 13, lineHeight: 1.4, maxWidth: 240 }}>
                      Toque nos produtos da vitrine para adicionar cervejas, bebidas e produtos ao seu pedido.
                    </span>

                    <div style={{ marginTop: 24, borderTop: '1px dashed rgba(255,255,255,0.08)', paddingTop: 16, width: '100%' }}>
                      <span style={{ fontSize: 12, color: '#B38E32', fontWeight: 700, display: 'block', marginBottom: 8 }}>
                        ⚡ Adição Rápida:
                      </span>
                      {produtos.slice(0, 3).map(p => (
                        <button
                          key={p.id}
                          onClick={() => adicionarAoCarrinho(p)}
                          style={{
                            width: '100%',
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '8px 10px',
                            borderRadius: 8,
                            background: '#1a1c22',
                            border: '1px solid rgba(255,255,255,0.06)',
                            color: '#cbd5e1',
                            fontSize: 12,
                            fontWeight: 600,
                            marginBottom: 6,
                            cursor: 'pointer',
                          }}
                        >
                          <span>+ {p.nome}</span>
                          <span style={{ color: '#10b981', fontWeight: 700 }}>R$ {p.preco.toFixed(2)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  carrinho.map(item => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: '#1a1c22',
                        border: '1px solid rgba(255,255,255,0.06)',
                        padding: '10px 12px',
                        borderRadius: 14,
                        gap: 10,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.nome}
                        </div>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>
                          R$ {item.preco.toFixed(2)} un • <strong style={{ color: '#10b981' }}>R$ {(item.preco * item.qtd).toFixed(2)}</strong>
                        </div>
                      </div>

                      {/* Botões Touch de Quantidade */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          onClick={() => alterarQtdCarrinho(item.id, -1)}
                          style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#262930', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        >
                          <Minus size={14} />
                        </button>
                        <span style={{ fontSize: 14, fontWeight: 800, minWidth: 20, textAlign: 'center', color: '#fff' }}>
                          {item.qtd}
                        </span>
                        <button
                          onClick={() => alterarQtdCarrinho(item.id, 1)}
                          style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#B38E32', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        >
                          <Plus size={14} />
                        </button>
                        <button
                          onClick={() => removerDoCarrinho(item.id)}
                          title="Remover item"
                          style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginLeft: 2 }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Rodapé Fixo do Carrinho com Totalizador e Botão de Pagamento */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14, flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 15, color: '#94a3b8' }}>Total a pagar:</span>
                  <strong style={{ fontSize: 24, fontWeight: 800, color: '#10b981' }}>
                    R$ {totalCarrinho.toFixed(2)}
                  </strong>
                </div>

                <button
                  disabled={carrinho.length === 0}
                  onClick={() => { setEtapa('identificacao'); registrarAtividade(); }}
                  style={{
                    width: '100%',
                    padding: '16px',
                    borderRadius: 16,
                    background: carrinho.length > 0 ? '#10b981' : '#262930',
                    color: carrinho.length > 0 ? '#000' : '#64748b',
                    fontSize: 16,
                    fontWeight: 800,
                    border: 'none',
                    cursor: carrinho.length > 0 ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: carrinho.length > 0 ? '0 6px 20px rgba(16, 185, 129, 0.3)' : 'none',
                  }}
                >
                  <span>AVANÇAR PARA PAGAR</span> →
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ETAPA: SELEÇÃO DE SERVIÇOS & PROFISSIONAL */}
        {etapa === 'servicos' && (
          <div style={{ flex: 1, maxWidth: 840, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto' }}>
            <h2 style={{ fontSize: 26, fontWeight: 800, color: '#fff', margin: 0 }}>
              1. Escolha o serviço desejado:
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
              {servicos.map(serv => (
                <div
                  key={serv.id}
                  onClick={() => { setServicoEscolhido(serv); registrarAtividade(); }}
                  style={{
                    background: servicoEscolhido?.id === serv.id ? '#1e2026' : '#141519',
                    border: `2px solid ${servicoEscolhido?.id === serv.id ? '#B38E32' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 18,
                    padding: 18,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <strong style={{ fontSize: 17, color: '#fff' }}>{serv.nome}</strong>
                  <span style={{ fontSize: 13, color: '#94a3b8' }}>⏱ {serv.duracao} minutos</span>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#B38E32', marginTop: 8 }}>
                    R$ {serv.preco.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>

            {servicoEscolhido && (
              <>
                <h2 style={{ fontSize: 26, fontWeight: 800, color: '#fff', margin: '14px 0 0 0' }}>
                  2. Escolha o profissional:
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                  {profissionais.map(pro => (
                    <div
                      key={pro.id}
                      onClick={() => { setProfissionalEscolhido(pro); registrarAtividade(); }}
                      style={{
                        background: profissionalEscolhido?.id === pro.id ? '#1e2026' : '#141519',
                        border: `2px solid ${profissionalEscolhido?.id === pro.id ? '#B38E32' : 'rgba(255,255,255,0.06)'}`,
                        borderRadius: 16,
                        padding: 16,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                      }}
                    >
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: '#262930', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#B38E32' }}>
                        {pro.nome.charAt(0)}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{pro.nome}</div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 'auto', paddingTop: 20 }}>
                  <button
                    disabled={!profissionalEscolhido}
                    onClick={() => { setEtapa('identificacao'); registrarAtividade(); }}
                    style={{
                      width: '100%',
                      padding: '16px 24px',
                      borderRadius: 18,
                      background: profissionalEscolhido ? '#B38E32' : '#262930',
                      color: profissionalEscolhido ? '#000' : '#64748b',
                      fontSize: 18,
                      fontWeight: 800,
                      border: 'none',
                      cursor: profissionalEscolhido ? 'pointer' : 'not-allowed',
                    }}
                  >
                    CONTINUAR PARA EMISSÃO DA SENHA →
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ETAPA: IDENTIFICAÇÃO TOUCH (TECLADO NUMÉRICO TÁTIL) */}
        {etapa === 'identificacao' && (
          <div style={{ flex: 1, maxWidth: 480, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 28, fontWeight: 800, color: '#fff', margin: '0 0 8px 0' }}>
                {tipoJornada === 'clube' ? 'Identifique-se para ver seu Clube' : 'Informe seu WhatsApp'}
              </h2>
              <p style={{ fontSize: 15, color: '#94a3b8', margin: 0 }}>
                {tipoJornada === 'servicos'
                  ? 'Você receberá um aviso no celular assim que for chamado!'
                  : 'Para pontuar ou vincular seu pedido:'}
              </p>
            </div>

            {/* Display do telefone digitado */}
            <div style={{ background: '#141519', border: '2px solid #B38E32', borderRadius: 18, padding: '16px 20px', textAlign: 'center', marginBottom: 20 }}>
              <span style={{ fontSize: 13, color: '#64748b', display: 'block', marginBottom: 4 }}>SEU CELULAR COM DDD</span>
              <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 2, color: '#fff', minHeight: 38 }}>
                {clienteTelefone.length > 0 ? (
                  clienteTelefone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
                ) : (
                  <span style={{ color: '#475569' }}>(11) 99999-9999</span>
                )}
              </div>
            </div>

            {/* Teclado Virtual Numérico Touch */}
            <div className="totem-keypad">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                <div key={n} className="totem-key" onClick={() => digitarTecla(String(n))}>
                  {n}
                </div>
              ))}
              <div className="totem-key" style={{ color: '#ef4444', fontSize: 16 }} onClick={() => setClienteTelefone('')}>
                LIMPAR
              </div>
              <div className="totem-key" onClick={() => digitarTecla('0')}>
                0
              </div>
              <div className="totem-key" onClick={apagarTecla}>
                ⌫
              </div>
            </div>

            {/* Ações */}
            <div style={{ display: 'flex', gap: 14, marginTop: 24 }}>
              {tipoJornada !== 'clube' && (
                <button
                  onClick={() => {
                    if (tipoJornada === 'produtos') setEtapa('pagamento');
                    else finalizarAtendimentoOuPedido();
                  }}
                  style={{ flex: 1, padding: 14, background: '#1c1e24', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', borderRadius: 14, fontWeight: 600, cursor: 'pointer' }}
                >
                  Pular Identificação
                </button>
              )}
              <button
                disabled={clienteTelefone.length < 10}
                onClick={() => {
                  if (tipoJornada === 'produtos') setEtapa('pagamento');
                  else finalizarAtendimentoOuPedido();
                }}
                style={{
                  flex: 2,
                  padding: 16,
                  background: clienteTelefone.length >= 10 ? '#B38E32' : '#262930',
                  color: clienteTelefone.length >= 10 ? '#000' : '#64748b',
                  borderRadius: 14,
                  fontWeight: 800,
                  fontSize: 16,
                  border: 'none',
                  cursor: clienteTelefone.length >= 10 ? 'pointer' : 'not-allowed',
                }}
              >
                CONFIRMAR →
              </button>
            </div>
          </div>
        )}

        {/* ETAPA: PAGAMENTO (PIX DINÂMICO OU CARTÃO) */}
        {etapa === 'pagamento' && (
          <div style={{ flex: 1, maxWidth: 640, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: '#fff', textAlign: 'center', margin: '0 0 20px 0' }}>
              Como deseja pagar?
            </h2>

            {/* Opções de Pagamento */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
              <div
                onClick={() => { setMeioPagamento('pix'); registrarAtividade(); }}
                style={{
                  background: meioPagamento === 'pix' ? '#182b23' : '#141519',
                  border: `2px solid ${meioPagamento === 'pix' ? '#10b981' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: 18,
                  padding: 18,
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                <QrCode size={36} color="#10b981" style={{ margin: '0 auto 8px' }} />
                <strong style={{ display: 'block', color: '#fff', fontSize: 16 }}>PIX</strong>
                <span style={{ fontSize: 12, color: '#10b981' }}>Instantâneo</span>
              </div>

              <div
                onClick={() => { setMeioPagamento('cartao'); registrarAtividade(); }}
                style={{
                  background: meioPagamento === 'cartao' ? '#182030' : '#141519',
                  border: `2px solid ${meioPagamento === 'cartao' ? '#3b82f6' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: 18,
                  padding: 18,
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                <CreditCard size={36} color="#3b82f6" style={{ margin: '0 auto 8px' }} />
                <strong style={{ display: 'block', color: '#fff', fontSize: 16 }}>Cartão</strong>
                <span style={{ fontSize: 12, color: '#3b82f6' }}>Crédito / Débito</span>
              </div>

              <div
                onClick={() => { setMeioPagamento('balcao'); registrarAtividade(); }}
                style={{
                  background: meioPagamento === 'balcao' ? '#292518' : '#141519',
                  border: `2px solid ${meioPagamento === 'balcao' ? '#f59e0b' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: 18,
                  padding: 18,
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              >
                <Banknote size={36} color="#f59e0b" style={{ margin: '0 auto 8px' }} />
                <strong style={{ display: 'block', color: '#fff', fontSize: 16 }}>Balcão</strong>
                <span style={{ fontSize: 12, color: '#f59e0b' }}>Pagar no Caixa</span>
              </div>
            </div>

            {/* Exibição específica por meio */}
            {meioPagamento === 'pix' && (
              <div style={{ background: '#141519', borderRadius: 20, padding: 24, textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ fontSize: 14, color: '#94a3b8' }}>Aponte a câmera do seu aplicativo de banco:</span>
                <div style={{ margin: '16px auto', width: 180, height: 180, background: '#fff', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <QrCode size={150} color="#000" />
                </div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981', marginBottom: 12 }}>
                  R$ {totalCarrinho.toFixed(2)}
                </div>
                {pixConfirmado ? (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#10b981', fontWeight: 700, fontSize: 16 }}>
                    <CheckCircle2 size={20} /> Pagamento Confirmado! Redirecionando...
                  </div>
                ) : (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#f59e0b', fontSize: 14 }}>
                    <Clock size={16} /> Aguardando transferência PIX...
                  </div>
                )}
              </div>
            )}

            {meioPagamento === 'cartao' && (
              <div style={{ background: '#141519', borderRadius: 20, padding: 32, textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
                <CreditCard size={56} color="#3b82f6" style={{ margin: '0 auto 16px' }} />
                <h3 style={{ fontSize: 22, color: '#fff', margin: '0 0 8px 0' }}>Aproxime ou Insira seu Cartão</h3>
                <p style={{ color: '#94a3b8', fontSize: 15, margin: '0 0 24px 0' }}>
                  Siga as instruções na maquininha integrada ao lado do totem.
                </p>
                <button
                  onClick={finalizarAtendimentoOuPedido}
                  style={{ padding: '14px 28px', background: '#3b82f6', color: '#fff', borderRadius: 14, fontWeight: 800, border: 'none', cursor: 'pointer' }}
                >
                  SIMULAR CARTÃO APROVADO →
                </button>
              </div>
            )}

            {meioPagamento === 'balcao' && (
              <div style={{ background: '#141519', borderRadius: 20, padding: 32, textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
                <Banknote size={56} color="#f59e0b" style={{ margin: '0 auto 16px' }} />
                <h3 style={{ fontSize: 22, color: '#fff', margin: '0 0 8px 0' }}>Pagar Diretamente no Caixa</h3>
                <p style={{ color: '#94a3b8', fontSize: 15, margin: '0 0 24px 0' }}>
                  Um ticket será gerado para você acertar em dinheiro ou ficha no balcão.
                </p>
                <button
                  onClick={finalizarAtendimentoOuPedido}
                  style={{ padding: '14px 28px', background: '#f59e0b', color: '#000', borderRadius: 14, fontWeight: 800, border: 'none', cursor: 'pointer' }}
                >
                  EMITIR TICKET DO BALCÃO →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ETAPA: SUCESSO & COMPROVANTE */}
        {etapa === 'sucesso' && (
          <div style={{ flex: 1, maxWidth: 540, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <div style={{ width: 84, height: 84, borderRadius: 999, background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <CheckCircle2 size={48} color="#10b981" />
            </div>

            {tipoJornada === 'servicos' && senhaEmitida && (
              <div style={{ background: '#141519', border: '2px solid #B38E32', borderRadius: 24, padding: 32, width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
                <span style={{ fontSize: 13, color: '#B38E32', fontWeight: 800, letterSpacing: 1.5, display: 'block', marginBottom: 8 }}>
                  SUA SENHA DE ATENDIMENTO
                </span>
                <div style={{ fontSize: 64, fontWeight: 900, color: '#fff', letterSpacing: -1, margin: '4px 0' }}>
                  {senhaEmitida.codigo}
                </div>
                <div style={{ fontSize: 18, color: '#94a3b8', margin: '8px 0 20px 0' }}>
                  {senhaEmitida.posicao}º na fila • Tempo estimado: ~{senhaEmitida.tempoEstimadoMinutos || 15} min
                </div>

                <div style={{ background: '#1c1e24', borderRadius: 16, padding: 16, textAlign: 'left', marginBottom: 20 }}>
                  <div style={{ fontSize: 13, color: '#64748b' }}>Cliente</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{senhaEmitida.clienteNome}</div>
                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>Serviço</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#B38E32' }}>{servicoEscolhido?.nome}</div>
                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>Profissional</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{profissionalEscolhido?.nome}</div>
                </div>

                <p style={{ fontSize: 14, color: '#94a3b8', margin: '0 0 24px 0' }}>
                  Acompanhe a chamada pelo Painel da TV ou aguarde o aviso no seu WhatsApp.
                </p>
              </div>
            )}

            {tipoJornada === 'produtos' && (
              <div style={{ background: '#141519', border: '2px solid #10b981', borderRadius: 24, padding: 32, width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
                <span style={{ fontSize: 13, color: '#10b981', fontWeight: 800, letterSpacing: 1.5, display: 'block', marginBottom: 8 }}>
                  PEDIDO CONFIRMADO
                </span>
                <div style={{ fontSize: 44, fontWeight: 900, color: '#fff', margin: '4px 0' }}>
                  R$ {totalCarrinho.toFixed(2)}
                </div>
                <p style={{ fontSize: 16, color: '#94a3b8', margin: '8px 0 20px 0' }}>
                  Pague com facilidade e retire seus produtos no balcão da barbearia!
                </p>

                <div style={{ background: '#1c1e24', borderRadius: 16, padding: 16, textAlign: 'left', marginBottom: 20 }}>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>Itens Comprados:</div>
                  {carrinho.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#fff', marginBottom: 4 }}>
                      <span>{item.qtd}x {item.nome}</span>
                      <strong style={{ color: '#10b981' }}>R$ {(item.preco * item.qtd).toFixed(2)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={resetarTotem}
              style={{ marginTop: 24, padding: '16px 36px', background: '#B38E32', color: '#000', borderRadius: 16, fontWeight: 800, fontSize: 16, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <RotateCcw size={18} /> CONCLUIR E VOLTAR AO INÍCIO
            </button>
          </div>
        )}

      </main>

      {/* 4. MODAL DO PIN DE SEGURANÇA DO GERENTE */}
      {modalPin && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#141519', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, padding: 28, maxWidth: 360, width: '100%', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: '#1c1e24', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Lock size={28} color="#B38E32" />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: '0 0 6px 0' }}>
              PIN do Gerente
            </h3>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 20px 0' }}>
              Digite o PIN de 4 dígitos para sair ou gerenciar o totem.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 20 }}>
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: '#1c1e24',
                    border: '1.5px solid rgba(255,255,255,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                    fontWeight: 800,
                    color: '#B38E32',
                  }}
                >
                  {pinDigitado[i] ? '●' : ''}
                </div>
              ))}
            </div>

            {erroPin && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{erroPin}</div>}

            <div className="totem-keypad" style={{ maxWidth: 280, gap: 10 }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                <div key={n} className="totem-key" style={{ height: 50, fontSize: 20 }} onClick={() => digitarTecla(String(n))}>
                  {n}
                </div>
              ))}
              <div className="totem-key" style={{ height: 50, color: '#ef4444', fontSize: 14 }} onClick={() => setPinDigitado('')}>
                LIMPAR
              </div>
              <div className="totem-key" style={{ height: 50, fontSize: 20 }} onClick={() => digitarTecla('0')}>
                0
              </div>
              <div className="totem-key" style={{ height: 50 }} onClick={apagarTecla}>
                ⌫
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                onClick={() => setModalPin(false)}
                style={{ flex: 1, padding: 12, background: '#1c1e24', border: 'none', color: '#94a3b8', borderRadius: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (pinDigitado === (totemConfig.pinGerente || '1234')) {
                    setModalPin(false);
                    window.location.href = '/admin/ecommerce?tab=lojas';
                  } else {
                    setErroPin('PIN incorreto!');
                    setPinDigitado('');
                  }
                }}
                style={{ flex: 1, padding: 12, background: '#B38E32', border: 'none', color: '#000', borderRadius: 12, fontWeight: 800, cursor: 'pointer' }}
              >
                Entrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
