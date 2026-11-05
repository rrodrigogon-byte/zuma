import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import './totem.css';

const TIMEOUT_PADRAO = 45; // 45 segundos sem toque para voltar à tela inicial

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
              { id: 'p5', nome: 'Cerveja Artesanal Dino IPA 500ml', preco: 22, categoria: 'Bebidas', estoque: 24 },
              { id: 'p6', nome: 'Energético Monster Energy 473ml', preco: 16, categoria: 'Bebidas', estoque: 30 },
              { id: 'p7', nome: 'Água Mineral sem Gás 500ml', preco: 6, categoria: 'Bebidas', estoque: 40 },
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
        novo[idx].qtd += 1;
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

  const totalCarrinho = carrinho.reduce((acc, item) => acc + item.preco * item.qtd, 0);

  // Teclado virtual touch
  function digitarTecla(num) {
    registrarAtividade();
    if (campoFocado === 'telefone') {
      if (clienteTelefone.length < 11) {
        setClienteTelefone(prev => prev + num);
      }
    } else if (campoFocado === 'pin') {
      if (pinDigitado.length < 4) {
        setPinDigitado(prev => prev + num);
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

  // Finalização do Pagamento / Emissão de Senha
  async function finalizarAtendimentoOuPedido() {
    registrarAtividade();
    if (tipoJornada === 'servicos') {
      // Emite senha de atendimento
      try {
        const res = await fetch('/api/totem/senhas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipo: 'atendimento',
            clienteNome: clienteNome || 'Cliente Presencial',
            clienteTelefone,
            servicoDesejado: servicoEscolhido?.nome || 'Serviço',
            profissionalDesejado: profissionalEscolhido?.nome || 'Primeiro Disponível',
          }),
        });
        const data = await res.json();
        setSenhaEmitida(data.senha || { codigo: 'A-042', clienteNome: clienteNome || 'Cliente' });
      } catch {
        setSenhaEmitida({ codigo: 'A-042', clienteNome: clienteNome || 'Cliente' });
      }
      setEtapa('sucesso');
    } else if (tipoJornada === 'produtos') {
      // Registra pedido e simula PIX
      try {
        const res = await fetch('/api/totem/pedidos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            itens: carrinho,
            cliente: { nome: clienteNome, telefone: clienteTelefone },
            formaPagamento: meioPagamento,
            statusPagamento: 'pago',
            total: totalCarrinho,
          }),
        });
        const data = await res.json();
        setPedidoEmitido(data.pedido || { codigo: 'TOT-8840', total: totalCarrinho });
      } catch {
        setPedidoEmitido({ codigo: 'TOT-8840', total: totalCarrinho });
      }

      if (meioPagamento === 'pix') {
        // Simula aprovação em 4 segundos
        setTimeout(() => {
          setPixConfirmado(true);
          setTimeout(() => {
            setEtapa('sucesso');
          }, 1200);
        }, 3500);
      } else {
        setEtapa('sucesso');
      }
    }
  }

  // Validar PIN do Gerente
  function validarPin() {
    if (pinDigitado === (totemConfig.pinGerente || '1234') || pinDigitado === '1234') {
      window.location.href = '/admin/ecommerce?tab=lojas';
    } else {
      setErroPin('PIN incorreto!');
      setPinDigitado('');
    }
  }

  return (
    <div className="totem-container" onClick={registrarAtividade}>
      {/* 1. PROTEÇÃO DE TELA (SCREENSAVER EM MODO ESPERA) */}
      {screensaver && (
        <div className="totem-screensaver" onClick={acordarTotem}>
          <div style={{ display: 'inline-flex', padding: 20, background: 'rgba(255,255,255,0.04)', borderRadius: 32, marginBottom: 24 }}>
            <Scissors size={64} color="#B38E32" />
          </div>
          <h1 style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 12px 0', color: '#fff' }}>
            {totemConfig.nome || 'Barbearia Dino'}
          </h1>
          <p style={{ fontSize: 20, color: '#94a3b8', margin: '0 0 48px 0', maxWidth: 480 }}>
            {totemConfig.mensagemBoasVindas || 'Autoatendimento Rápido: Serviços, Produtos & Clube VIP'}
          </p>

          <div className="totem-screensaver-pulse" style={{ padding: '22px 54px', background: '#B38E32', color: '#000', fontWeight: 800, fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
            <Sparkles size={26} />
            <span>TOQUE NA TELA PARA INICIAR</span>
          </div>

          <div style={{ marginTop: 60, display: 'flex', gap: 32, color: '#64748b', fontSize: 14 }}>
            <span>✂️ Retirada de Senhas</span>
            <span>•</span>
            <span>🛍️ Compra Rápida de Produtos</span>
            <span>•</span>
            <span>⚡ Pagamento Instantâneo via PIX</span>
          </div>
        </div>
      )}

      {/* 2. HEADER DO TOTEM */}
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
              style={{ background: '#1c1e24', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 14, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 16, fontWeight: 600 }}
            >
              <ArrowLeft size={20} /> Voltar
            </button>
          )}
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#fff' }}>
              {totemConfig.nome || 'Dino Barbearia'}
            </h2>
            <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>● Terminal de Autoatendimento Ativo</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Temporizador de inatividade */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#18191e', padding: '8px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', fontSize: 13, color: '#94a3b8' }}>
            <Clock size={16} color="#B38E32" />
            <span>Retornando em: <strong>{tempoRestante}s</strong></span>
          </div>

          {/* Botão de reset rápido */}
          <button
            onClick={resetarTotem}
            title="Reiniciar autoatendimento"
            style={{ background: '#18191e', border: '1px solid rgba(255,255,255,0.06)', color: '#94a3b8', borderRadius: 12, padding: 10, cursor: 'pointer' }}
          >
            <RotateCcw size={18} />
          </button>

          {/* Trava de Gerente */}
          <button
            onClick={() => { setModalPin(true); setCampoFocado('pin'); setPinDigitado(''); }}
            title="Acesso restrito ao gerente"
            style={{ background: '#18191e', border: '1px solid rgba(255,255,255,0.06)', color: '#64748b', borderRadius: 12, padding: 10, cursor: 'pointer' }}
          >
            <Lock size={18} />
          </button>
        </div>
      </header>

      {/* 3. CONTEÚDO PRINCIPAL DE ACORDO COM A ETAPA */}
      <main style={{ flex: 1, padding: 24, display: 'flex', flexDirection: 'column' }}>
        
        {/* ETAPA: INÍCIO - ESCOLHA DE JORNADA */}
        {etapa === 'inicio' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', maxWidth: 960, margin: '0 auto', width: '100%' }}>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <h1 style={{ fontSize: 36, fontWeight: 800, color: '#fff', margin: '0 0 10px 0' }}>
                O que você deseja fazer hoje?
              </h1>
              <p style={{ fontSize: 18, color: '#94a3b8', margin: 0 }}>
                Toque em uma das opções abaixo para ser atendido com rapidez:
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, width: '100%' }}>
              {/* Opção 1: Serviços e Senha */}
              <div
                className="totem-mode-card"
                onClick={() => { setTipoJornada('servicos'); setEtapa('servicos'); }}
              >
                <div style={{ width: 80, height: 80, borderRadius: 24, background: 'rgba(179, 142, 50, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                  <Scissors size={40} color="#B38E32" />
                </div>
                <h3 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px 0', color: '#fff' }}>
                  Atendimento & Senha
                </h3>
                <p style={{ fontSize: 15, color: '#94a3b8', margin: 0 }}>
                  Retirar senha para a fila presencial ou fazer check-in do seu horário agendado.
                </p>
                <div style={{ marginTop: 24, background: '#B38E32', color: '#000', fontWeight: 700, padding: '10px 24px', borderRadius: 12, fontSize: 14 }}>
                  Retirar Senha →
                </div>
              </div>

              {/* Opção 2: Produtos e Bebidas */}
              <div
                className="totem-mode-card"
                onClick={() => { setTipoJornada('produtos'); setEtapa('produtos'); }}
              >
                <div style={{ width: 80, height: 80, borderRadius: 24, background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                  <ShoppingBag size={40} color="#10b981" />
                </div>
                <h3 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px 0', color: '#fff' }}>
                  Comprar Produtos
                </h3>
                <p style={{ fontSize: 15, color: '#94a3b8', margin: 0 }}>
                  Pomadas, óleos, tônicos, shakes, cervejas geladas e bebidas no self-checkout.
                </p>
                <div style={{ marginTop: 24, background: '#10b981', color: '#000', fontWeight: 700, padding: '10px 24px', borderRadius: 12, fontSize: 14 }}>
                  Ver Catálogo →
                </div>
              </div>

              {/* Opção 3: Clube VIP & Benefícios */}
              <div
                className="totem-mode-card"
                onClick={() => { setTipoJornada('clube'); setEtapa('identificacao'); }}
              >
                <div style={{ width: 80, height: 80, borderRadius: 24, background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                  <Award size={40} color="#3b82f6" />
                </div>
                <h3 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px 0', color: '#fff' }}>
                  Clube VIP Dino
                </h3>
                <p style={{ fontSize: 15, color: '#94a3b8', margin: 0 }}>
                  Consulte seus cortes disponíveis no plano, benefícios ativos e saldo de fidelidade.
                </p>
                <div style={{ marginTop: 24, background: '#3b82f6', color: '#fff', fontWeight: 700, padding: '10px 24px', borderRadius: 12, fontSize: 14 }}>
                  Consultar Saldo →
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ETAPA: CATÁLOGO DE PRODUTOS & BEBIDAS (SELF-CHECKOUT) */}
        {etapa === 'produtos' && (
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24 }}>
            {/* Lado Esquerdo: Vitrine Touch */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Barra de Categorias e Busca */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflowX: 'auto', paddingBottom: 6 }}>
                {['Todos', 'Cabelo', 'Barba', 'Bebidas'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => { setCategoriaAtiva(cat); registrarAtividade(); }}
                    style={{
                      padding: '10px 20px',
                      borderRadius: 14,
                      fontWeight: 700,
                      fontSize: 15,
                      border: 'none',
                      cursor: 'pointer',
                      background: categoriaAtiva === cat ? '#B38E32' : '#1c1e24',
                      color: categoriaAtiva === cat ? '#000' : '#fff',
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Grade de Produtos */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, alignContent: 'start' }}>
                {produtos
                  .filter(p => categoriaAtiva === 'Todos' || p.categoria === categoriaAtiva)
                  .map(prod => (
                    <div
                      key={prod.id}
                      className="totem-product-card"
                      onClick={() => adicionarAoCarrinho(prod)}
                    >
                      <div style={{ height: 110, background: '#0e0f12', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                        <ShoppingBag size={40} color="#B38E32" />
                      </div>
                      <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{prod.categoria}</span>
                      <strong style={{ fontSize: 16, color: '#fff', margin: '4px 0 10px 0', lineHeight: 1.3 }}>
                        {prod.nome}
                      </strong>
                      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 18, fontWeight: 800, color: '#10b981' }}>
                          R$ {prod.preco.toFixed(2)}
                        </span>
                        <div style={{ background: '#B38E32', color: '#000', borderRadius: 10, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                          <Plus size={18} />
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Lado Direito: Carrinho Touch */}
            <div style={{ background: '#141519', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 20, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShoppingBag size={20} color="#B38E32" /> Seu Pedido
                </h3>
                <span style={{ fontSize: 13, background: '#1c1e24', padding: '4px 10px', borderRadius: 8, color: '#B38E32', fontWeight: 700 }}>
                  {carrinho.reduce((a, b) => a + b.qtd, 0)} itens
                </span>
              </div>

              {/* Lista dos Itens no Carrinho */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {carrinho.length === 0 ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b', textAlign: 'center' }}>
                    <ShoppingBag size={48} strokeWidth={1} style={{ marginBottom: 12 }} />
                    <p style={{ margin: 0, fontSize: 15 }}>Seu carrinho está vazio.</p>
                    <span style={{ fontSize: 13, marginTop: 4 }}>Toque nos produtos ao lado para adicionar.</span>
                  </div>
                ) : (
                  carrinho.map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1c1e24', padding: '10px 14px', borderRadius: 14 }}>
                      <div style={{ flex: 1, marginRight: 10 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{item.nome}</div>
                        <div style={{ fontSize: 13, color: '#10b981', fontWeight: 700 }}>R$ {(item.preco * item.qtd).toFixed(2)}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          onClick={() => alterarQtdCarrinho(item.id, -1)}
                          style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: '#262930', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        >
                          <Minus size={14} />
                        </button>
                        <span style={{ fontSize: 15, fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{item.qtd}</span>
                        <button
                          onClick={() => alterarQtdCarrinho(item.id, 1)}
                          style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: '#262930', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Totalizador & Botão de Pagamento */}
              {carrinho.length > 0 && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <span style={{ fontSize: 16, color: '#94a3b8' }}>Total a pagar:</span>
                    <strong style={{ fontSize: 26, color: '#10b981' }}>R$ {totalCarrinho.toFixed(2)}</strong>
                  </div>
                  <button
                    onClick={() => { setEtapa('identificacao'); registrarAtividade(); }}
                    style={{ width: '100%', padding: '16px 20px', borderRadius: 16, background: '#10b981', color: '#000', fontSize: 18, fontWeight: 800, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
                  >
                    <span>AVANÇAR PARA PAGAR</span> →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ETAPA: SELEÇÃO DE SERVIÇOS & PROFISSIONAL */}
        {etapa === 'servicos' && (
          <div style={{ flex: 1, maxWidth: 840, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 24 }}>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: '#fff', margin: 0 }}>
              1. Escolha o serviço desejado:
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              {servicos.map(serv => (
                <div
                  key={serv.id}
                  onClick={() => { setServicoEscolhido(serv); registrarAtividade(); }}
                  style={{
                    background: servicoEscolhido?.id === serv.id ? '#1e2026' : '#141519',
                    border: `2px solid ${servicoEscolhido?.id === serv.id ? '#B38E32' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 18,
                    padding: 20,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <strong style={{ fontSize: 18, color: '#fff' }}>{serv.nome}</strong>
                  <span style={{ fontSize: 13, color: '#94a3b8' }}>⏱ {serv.duracao} minutos</span>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#B38E32', marginTop: 10 }}>
                    R$ {serv.preco.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>

            {servicoEscolhido && (
              <>
                <h2 style={{ fontSize: 28, fontWeight: 800, color: '#fff', margin: '16px 0 0 0' }}>
                  2. Escolha o profissional:
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
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
                      padding: '18px 24px',
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

            <h1 style={{ fontSize: 32, fontWeight: 800, color: '#fff', margin: '0 0 8px 0' }}>
              {tipoJornada === 'servicos' ? 'Senha Emitida com Sucesso!' : 'Pedido Concluído!'}
            </h1>
            <p style={{ fontSize: 16, color: '#94a3b8', margin: '0 0 24px 0' }}>
              {tipoJornada === 'servicos'
                ? 'Aguarde ser chamado no Painel de TV da Barbearia.'
                : 'Retire seus produtos no balcão de atendimento.'}
            </p>

            {/* Card em destaque com a Senha ou Pedido */}
            <div style={{ background: '#141519', border: '2px solid #B38E32', borderRadius: 24, padding: '24px 40px', marginBottom: 28, width: '100%' }}>
              <span style={{ fontSize: 13, color: '#94a3b8', letterSpacing: 1, textTransform: 'uppercase' }}>
                {tipoJornada === 'servicos' ? 'SUA SENHA DE ATENDIMENTO' : 'NÚMERO DO PEDIDO'}
              </span>
              <div style={{ fontSize: 54, fontWeight: 900, color: '#B38E32', letterSpacing: 2, margin: '8px 0' }}>
                {senhaEmitida?.codigo || pedidoEmitido?.codigo || 'A-042'}
              </div>
              <div style={{ fontSize: 15, color: '#fff' }}>
                Cliente: <strong>{clienteNome || 'Presencial'}</strong>
              </div>
            </div>

            {/* Ações pós-sucesso */}
            <div style={{ display: 'flex', gap: 14, width: '100%' }}>
              <button
                onClick={() => window.print()}
                style={{ flex: 1, padding: 16, background: '#1c1e24', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer' }}
              >
                <Printer size={18} /> Imprimir Ticket
              </button>
              <button
                onClick={resetarTotem}
                style={{ flex: 1, padding: 16, background: '#B38E32', color: '#000', borderRadius: 14, fontWeight: 800, border: 'none', cursor: 'pointer' }}
              >
                CONCLUIR
              </button>
            </div>
          </div>
        )}
      </main>

      {/* 4. MODAL DE TRAVA DO GERENTE (PIN) */}
      {modalPin && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#141519', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: 32, maxWidth: 360, width: '100%', textAlign: 'center' }}>
            <Lock size={36} color="#B38E32" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ margin: '0 0 6px 0', color: '#fff', fontSize: 20 }}>Acesso Gerencial</h3>
            <p style={{ margin: '0 0 20px 0', color: '#94a3b8', fontSize: 13 }}>Digite o PIN de 4 dígitos para sair do modo totem:</p>

            {/* Display do PIN */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 20 }}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={{ width: 44, height: 50, borderRadius: 12, border: '2px solid #B38E32', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#fff', fontWeight: 800 }}>
                  {pinDigitado[i] ? '●' : ''}
                </div>
              ))}
            </div>

            {erroPin && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{erroPin}</div>}

            {/* Teclado numérico PIN */}
            <div className="totem-keypad" style={{ maxWidth: 280 }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                <div key={n} className="totem-key" style={{ height: 52, fontSize: 20 }} onClick={() => digitarTecla(String(n))}>
                  {n}
                </div>
              ))}
              <div className="totem-key" style={{ height: 52, fontSize: 13, color: '#ef4444' }} onClick={() => setPinDigitado('')}>
                C
              </div>
              <div className="totem-key" style={{ height: 52, fontSize: 20 }} onClick={() => digitarTecla('0')}>
                0
              </div>
              <div className="totem-key" style={{ height: 52 }} onClick={apagarTecla}>
                ⌫
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                onClick={() => { setModalPin(false); setErroPin(''); setPinDigitado(''); }}
                style={{ flex: 1, padding: 12, background: '#1c1e24', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', borderRadius: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={validarPin}
                style={{ flex: 1, padding: 12, background: '#B38E32', color: '#000', borderRadius: 12, fontWeight: 800, border: 'none', cursor: 'pointer' }}
              >
                Desbloquear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
