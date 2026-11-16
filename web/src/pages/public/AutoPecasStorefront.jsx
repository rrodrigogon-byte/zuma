import React, { useState, useEffect } from 'react';
import {
  Search,
  ShoppingCart,
  CheckCircle2,
  ShieldCheck,
  Truck,
  Wrench,
  Car,
  ChevronRight,
  Filter,
  Phone,
  ArrowRight,
  MapPin,
  Sparkles,
  Layers,
  X
} from 'lucide-react';

export default function AutoPecasStorefront() {
  const [pecas, setPecas] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [montadoras, setMontadoras] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Garagem Virtual
  const [placaBusca, setPlacaBusca] = useState('');
  const [carroAtivo, setCarroAtivo] = useState(null);
  const [montadoraSel, setMontadoraSel] = useState('');
  const [modeloSel, setModeloSel] = useState('');
  const [grupoSel, setGrupoSel] = useState('');
  const [termoBusca, setTermoBusca] = useState('');

  // Carrinho
  const [carrinho, setCarrinho] = useState([]);
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);
  const [sucessoPedido, setSucessoPedido] = useState(false);

  useEffect(() => {
    carregarCatalogo();
  }, []);

  async function carregarCatalogo(paramsObj = {}) {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (paramsObj.placa) p.append('placa', paramsObj.placa);
      if (paramsObj.montadora) p.append('montadora', paramsObj.montadora);
      if (paramsObj.modelo) p.append('modelo', paramsObj.modelo);
      if (paramsObj.grupo) p.append('grupo', paramsObj.grupo);
      if (paramsObj.termo) p.append('termo', paramsObj.termo);

      const res = await fetch(`/api/publico/autopecas/catalogo?${p.toString()}`);
      const data = await res.json();
      if (data.ok) {
        setPecas(data.pecas || []);
        if (data.grupos) setGrupos(data.grupos);
        if (data.montadoras) setMontadoras(data.montadoras);
      }
    } catch (e) {
      console.error('Erro ao carregar catálogo da autopeça:', e);
    } finally {
      setLoading(false);
    }
  }

  function handleBuscarPlaca(e) {
    e.preventDefault();
    const pLimpa = placaBusca.toUpperCase().trim();
    if (!pLimpa) return;

    let veic = 'Veículo Selecionado';
    if (pLimpa.includes('RNI') || pLimpa.includes('4E29')) {
      veic = 'Volkswagen Amarok Highline 2.0 4x4 (2024)';
    } else if (pLimpa.includes('QBQ') || pLimpa.includes('8J12')) {
      veic = 'Toyota Hilux SRV 2.8 Turbo Diesel (2023)';
    } else {
      veic = `Carro Placa ${pLimpa}`;
    }

    setCarroAtivo({ placa: pLimpa, nome: veic });
    carregarCatalogo({ placa: pLimpa, grupo: grupoSel, termo: termoBusca });
  }

  function limparGaragem() {
    setCarroAtivo(null);
    setPlacaBusca('');
    setMontadoraSel('');
    setModeloSel('');
    carregarCatalogo({ grupo: grupoSel, termo: termoBusca });
  }

  function adicionarAoCarrinho(peca) {
    setCarrinho((prev) => {
      const existe = prev.find(item => item.id === peca.id);
      if (existe) {
        return prev.map(item => item.id === peca.id ? { ...item, qtd: item.qtd + 1 } : item);
      }
      return [...prev, { ...peca, qtd: 1 }];
    });
    setCarrinhoAberto(true);
  }

  const totalCarrinho = carrinho.reduce((acc, item) => acc + ((item.precoPromocionalEcommerce || item.precoVenda) * item.qtd), 0);

  return (
    <div style={{ minHeight: '100vh', background: '#0B1120', color: '#F8FAFC', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Topo Oficial da Loja */}
      <header style={{ background: '#111827', borderBottom: '1px solid #1F2937', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: '#FF6B2C', color: '#FFFFFF', padding: '8px', borderRadius: '10px' }}>
              <Wrench size={24} />
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Kytto Auto Peças · Tangará da Serra / MT
              </span>
              <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#FFFFFF' }}>
                Loja Oficial de Autopeças & Acessórios
              </h1>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <a
              href="https://wa.me/556599352260?text=Olá! Gostaria de consultar uma autopeça na loja."
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#25D366', textDecoration: 'none', fontWeight: 700, fontSize: '0.9rem' }}
            >
              <Phone size={18} /> WhatsApp: (65) 99352-2260
            </a>

            <button
              type="button"
              onClick={() => setCarrinhoAberto(true)}
              style={{
                background: '#FF6B2C',
                color: '#FFFFFF',
                border: 'none',
                padding: '10px 18px',
                borderRadius: '8px',
                fontWeight: 800,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(255, 107, 44, 0.35)'
              }}
            >
              <ShoppingCart size={18} />
              <span>Carrinho ({carrinho.reduce((a, b) => a + b.qtd, 0)})</span>
            </button>
          </div>

        </div>

        {/* Faixa de Benefícios */}
        <div style={{ background: '#1F2937', borderTop: '1px solid #374151', padding: '8px 24px', fontSize: '0.8rem', color: '#9CA3AF' }}>
          <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', justifyContent: 'space-around', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Truck size={14} color="#10B981" /> Entrega em até 2h em Tangará da Serra</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><ShieldCheck size={14} color="#3B82F6" /> Peças 100% Genuínas com Nota Fiscal</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={14} color="#F59E0B" /> Garantia de Encaixe ou Troca Imediata</span>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1440px', margin: '24px auto', padding: '0 24px' }}>
        
        {/* BANNER GARAGEM VIRTUAL / BUSCA POR PLACA */}
        <div style={{ background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)', borderRadius: '16px', padding: '26px 32px', border: '1px solid #334155', marginBottom: '28px', boxShadow: '0 8px 16px rgba(0,0,0,0.3)' }}>
          <div style={{ maxWidth: '880px' }}>
            <span style={{ background: '#F59E0B', color: '#000000', padding: '3px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase' }}>
              🚗 Garagem Virtual Kytto
            </span>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#FFFFFF', margin: '10px 0 6px 0' }}>
              Encontre a Peça Exata para o Seu Carro sem Erro de Compatibilidade
            </h2>
            <p style={{ margin: '0 0 18px 0', color: '#94A3B8', fontSize: '0.95rem' }}>
              Digite a placa do seu veículo. Nosso catálogo inteligente filtra apenas as peças homologadas pelo fabricante.
            </p>

            <form onSubmit={handleBuscarPlaca} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="DIGITE A PLACA (Ex: RNI-4E29)"
                value={placaBusca}
                onChange={(e) => setPlacaBusca(e.target.value.toUpperCase())}
                style={{
                  background: '#FFFFFF',
                  color: '#000000',
                  padding: '12px 18px',
                  borderRadius: '8px',
                  border: '2px solid #003399',
                  fontSize: '1.1rem',
                  fontWeight: 900,
                  letterSpacing: '1px',
                  minWidth: '260px'
                }}
              />
              <button
                type="submit"
                style={{
                  background: '#10B981',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontWeight: 800,
                  fontSize: '1rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 10px rgba(16, 185, 129, 0.4)'
                }}
              >
                <Search size={18} /> Filtrar Peças do Meu Carro
              </button>
            </form>

            {carroAtivo && (
              <div style={{ marginTop: '16px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10B981', padding: '10px 16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '1.2rem' }}>🚘</span>
                  <span style={{ color: '#E2E8F0', fontSize: '0.9rem' }}>
                    Filtrando para: <strong style={{ color: '#10B981' }}>{carroAtivo.nome}</strong> (Placa {carroAtivo.placa})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={limparGaragem}
                  style={{ background: 'transparent', border: '1px solid #64748B', color: '#CBD5E1', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer' }}
                >
                  ✕ Ver Todas as Peças
                </button>
              </div>
            )}

          </div>
        </div>

        {/* BARRA DE CATEGORIAS / SISTEMAS */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '24px' }}>
          <button
            type="button"
            onClick={() => { setGrupoSel(''); carregarCatalogo({ placa: carroAtivo?.placa, termo: termoBusca }); }}
            style={{
              background: grupoSel === '' ? '#FF6B2C' : '#1E293B',
              color: '#FFFFFF',
              border: '1px solid #334155',
              padding: '8px 16px',
              borderRadius: '20px',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            Todos os Sistemas
          </button>
          {grupos.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => { setGrupoSel(g.id); carregarCatalogo({ grupo: g.id, placa: carroAtivo?.placa, termo: termoBusca }); }}
              style={{
                background: grupoSel === g.id ? '#FF6B2C' : '#1E293B',
                color: '#FFFFFF',
                border: '1px solid #334155',
                padding: '8px 16px',
                borderRadius: '20px',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>{g.icone}</span> {g.nome}
            </button>
          ))}
        </div>

        {/* GRID DE PRODUTOS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
          {pecas.map((p) => {
            const preco = p.precoPromocionalEcommerce || p.precoVenda;
            return (
              <div
                key={p.id}
                style={{
                  background: '#1E293B',
                  borderRadius: '14px',
                  border: '1px solid #334155',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.2)',
                  transition: 'transform 0.2s ease'
                }}
              >
                <div>
                  <div style={{ position: 'relative', height: '190px', background: '#0F172A' }}>
                    <img
                      src={p.fotoUrl}
                      alt={p.nome}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <span style={{ position: 'absolute', top: '10px', left: '10px', background: '#0F172A', color: '#F59E0B', fontSize: '0.75rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px' }}>
                      {p.fabricante}
                    </span>
                    <span style={{ position: 'absolute', top: '10px', right: '10px', background: '#10B981', color: '#FFFFFF', fontSize: '0.7rem', fontWeight: 800, padding: '3px 8px', borderRadius: '6px' }}>
                      Em Estoque
                    </span>
                  </div>

                  <div style={{ padding: '16px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 600 }}>OEM: {p.codigoOem}</div>
                    <h3 style={{ margin: '4px 0 8px 0', fontSize: '1rem', fontWeight: 800, color: '#FFFFFF', lineHeight: 1.4 }}>
                      {p.nome}
                    </h3>
                    <p style={{ margin: '0 0 10px 0', fontSize: '0.8rem', color: '#94A3B8', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {p.descricao}
                    </p>

                    <div style={{ background: '#0F172A', padding: '8px 10px', borderRadius: '6px', fontSize: '0.75rem', color: '#CBD5E1', marginBottom: '12px' }}>
                      <span style={{ color: '#F59E0B', fontWeight: 700 }}>Compatível com: </span>
                      {(p.aplicacoes || []).map(a => `${a.montadora} ${a.modelo}`).join(', ')}
                    </div>
                  </div>
                </div>

                <div style={{ padding: '0 16px 16px 16px', borderTop: '1px solid #334155', paddingTop: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
                    <div>
                      <span style={{ fontSize: '0.7rem', color: '#94A3B8', textTransform: 'uppercase' }}>À vista no Pix</span>
                      <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#FFFFFF' }}>
                        R$ {Number(preco).toFixed(2)}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>ou até 6x no cartão</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => adicionarAoCarrinho(p)}
                    style={{
                      width: '100%',
                      background: '#FF6B2C',
                      color: '#FFFFFF',
                      border: 'none',
                      padding: '12px',
                      borderRadius: '8px',
                      fontWeight: 800,
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 2px 8px rgba(255, 107, 44, 0.4)'
                    }}
                  >
                    <ShoppingCart size={16} /> Comprar Peça
                  </button>
                </div>

              </div>
            );
          })}
        </div>

      </main>

      {/* DRAWER / MODAL DE CARRINHO */}
      {carrinhoAberto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'flex-end', zIndex: 9999 }}>
          <div style={{ background: '#111827', width: '100%', maxWidth: '420px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '24px', boxShadow: '-10px 0 25px rgba(0,0,0,0.5)' }}>
            
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1F2937', paddingBottom: '14px', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#FFFFFF' }}>
                  Seu Carrinho de Autopeças
                </h3>
                <button onClick={() => setCarrinhoAberto(false)} style={{ background: 'none', border: 'none', color: '#9CA3AF', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
              </div>

              {carrinho.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF' }}>
                  <ShoppingCart size={40} style={{ margin: '0 auto 10px auto', opacity: 0.5 }} />
                  <p>Seu carrinho está vazio.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '55vh', overflowY: 'auto' }}>
                  {carrinho.map((item) => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1F2937', padding: '12px', borderRadius: '8px' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#FFFFFF' }}>{item.nome}</div>
                        <div style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Qtd: {item.qtd}x · OEM: {item.codigoOem}</div>
                      </div>
                      <div style={{ fontWeight: 800, color: '#F59E0B' }}>
                        R$ {(Number(item.precoPromocionalEcommerce || item.precoVenda) * item.qtd).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {carrinho.length > 0 && (
              <div style={{ borderTop: '1px solid #1F2937', paddingTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 900, marginBottom: '16px' }}>
                  <span>Total:</span>
                  <span style={{ color: '#10B981' }}>R$ {totalCarrinho.toFixed(2)}</span>
                </div>

                <a
                  href={`https://wa.me/556599352260?text=${encodeURIComponent(`Olá! Gostaria de finalizar o pedido de autopeças:\n${carrinho.map(i => `- ${i.qtd}x ${i.nome} (OEM: ${i.codigoOem})`).join('\n')}\nTotal: R$ ${totalCarrinho.toFixed(2)}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block',
                    background: '#10B981',
                    color: '#FFFFFF',
                    textAlign: 'center',
                    padding: '14px',
                    borderRadius: '8px',
                    fontWeight: 800,
                    textDecoration: 'none',
                    fontSize: '1rem',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)'
                  }}
                >
                  Finalizar Pedido pelo WhatsApp
                </a>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
