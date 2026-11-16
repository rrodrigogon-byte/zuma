import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Search,
  Plus,
  ShoppingCart,
  Package,
  Layers,
  MapPin,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  FileText,
  Truck,
  Car,
  Filter,
  RefreshCw,
  SlidersHorizontal
} from 'lucide-react';

export default function AutoPecasHubPage() {
  const [pecas, setPecas] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [montadoras, setMontadoras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [termoBusca, setTermoBusca] = useState('');
  const [filtroGrupo, setFiltroGrupo] = useState('');
  const [filtroMontadora, setFiltroMontadora] = useState('');
  const [filtroModelo, setFiltroModelo] = useState('');
  const [filtroPlaca, setFiltroPlaca] = useState('');
  const [modalRequisicao, setModalRequisicao] = useState(null);
  const [qtdRequisicao, setQtdRequisicao] = useState(1);
  const [osDestino, setOsDestino] = useState('OS-2026-01042');
  const [mensagemSucesso, setMensagemSucesso] = useState('');

  const token = localStorage.getItem('token') || localStorage.getItem('sp_token');

  useEffect(() => {
    carregarDadosIniciais();
  }, []);

  async function carregarDadosIniciais() {
    setLoading(true);
    try {
      const [resPecas, resGrupos, resMont] = await Promise.all([
        fetch('/api/admin/autopecas/pecas', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/admin/autopecas/grupos', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/admin/autopecas/montadoras', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      const dataPecas = await resPecas.json();
      const dataGrupos = await resGrupos.json();
      const dataMont = await resMont.json();

      if (dataPecas.ok) setPecas(dataPecas.pecas || []);
      if (dataGrupos.ok) setGrupos(dataGrupos.grupos || []);
      if (dataMont.ok) setMontadoras(dataMont.montadoras || []);
    } catch (e) {
      console.error('Erro ao carregar dados de autopeças:', e);
    } finally {
      setLoading(false);
    }
  }

  async function executarFiltro() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (termoBusca) params.append('termo', termoBusca);
      if (filtroGrupo) params.append('grupo', filtroGrupo);
      if (filtroMontadora) params.append('montadora', filtroMontadora);
      if (filtroModelo) params.append('modelo', filtroModelo);
      if (filtroPlaca) params.append('placa', filtroPlaca);

      const res = await fetch(`/api/admin/autopecas/pecas?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.ok) setPecas(data.pecas || []);
    } catch (e) {
      console.error('Erro ao filtrar:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleRequisitarOS() {
    if (!modalRequisicao) return;
    try {
      const res = await fetch('/api/admin/autopecas/requisicao-oficina', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          pecaId: modalRequisicao.id,
          quantidade: qtdRequisicao,
          numeroOs: osDestino
        })
      });
      const data = await res.json();
      if (data.ok) {
        setMensagemSucesso(data.mensagem);
        setModalRequisicao(null);
        executarFiltro();
        setTimeout(() => setMensagemSucesso(''), 6000);
      } else {
        alert(data.error || 'Erro na requisição');
      }
    } catch (e) {
      alert('Erro ao processar requisição');
    }
  }

  // Métricas
  const totalItens = pecas.length;
  const totalEstoquePcs = pecas.reduce((acc, p) => acc + (p.estoqueAtual || 0), 0);
  const valorTotalEstoque = pecas.reduce((acc, p) => acc + ((p.estoqueAtual || 0) * (p.custoMedio || 0)), 0);
  const pecasEcommerce = pecas.filter(p => p.publicadoEcommerce).length;

  return (
    <div style={{ padding: '24px', maxWidth: '1600px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Topo Executivo */}
      <div style={{ background: '#0F172A', color: '#F8FAFC', padding: '26px 30px', borderRadius: '14px', marginBottom: '24px', borderLeft: '6px solid #F59E0B' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.75rem' }}>🚗</span>
              <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>
                Kytto Auto Peças · Gestão Completa de Autopeças, Motopeças & E-commerce
              </h1>
            </div>
            <p style={{ margin: '6px 0 0 0', color: '#94A3B8', fontSize: '0.92rem' }}>
              Catálogo OEM, Códigos Cruzados (Cross-Reference), Compatibilidade Veicular, Endereçamento Físico (Corredor/Gaveta) & Integração com Oficina e E-commerce.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <a
              href="/loja-autopecas"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: '#FF6B2C',
                color: '#FFFFFF',
                textDecoration: 'none',
                padding: '10px 18px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 6px rgba(255, 107, 44, 0.3)'
              }}
            >
              <ShoppingCart size={16} /> Abrir Loja Virtual (E-commerce)
            </a>
            <button
              type="button"
              onClick={() => alert('Para cadastrar uma nova autopeça com OEM e tabela de aplicação veicular, utilize o botão "+ Nova Autopeça" ou importe o catálogo em XML/Excel.')}
              style={{
                background: '#1E293B',
                color: '#F8FAFC',
                border: '1px solid #334155',
                padding: '10px 18px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Plus size={16} /> Nova Autopeça
            </button>
          </div>
        </div>
      </div>

      {mensagemSucesso && (
        <div style={{ background: '#ECFDF5', border: '1px solid #10B981', color: '#065F46', padding: '14px 20px', borderRadius: '10px', marginBottom: '20px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CheckCircle2 size={20} color="#10B981" /> {mensagemSucesso}
        </div>
      )}

      {/* Grid de Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        
        <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Itens no Catálogo</span>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0F172A', margin: '6px 0 2px 0' }}>{totalItens} SKUs</div>
          <span style={{ fontSize: '0.8rem', color: '#10B981', fontWeight: 600 }}>Tabela OEM & Aplicações</span>
        </div>

        <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Peças em Estoque Físico</span>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#0F172A', margin: '6px 0 2px 0' }}>{totalEstoquePcs} peças</div>
          <span style={{ fontSize: '0.8rem', color: '#64748B' }}>Localizadas por Corredor/Gaveta</span>
        </div>

        <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Valor Total do Estoque</span>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#16A34A', margin: '6px 0 2px 0' }}>
            R$ {valorTotalEstoque.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: '0.8rem', color: '#64748B' }}>Custo Médio Ponderado</span>
        </div>

        <div style={{ background: '#FFFFFF', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>No E-commerce (Loja Virtual)</span>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#FF6B2C', margin: '6px 0 2px 0' }}>{pecasEcommerce} ativas</div>
          <span style={{ fontSize: '0.8rem', color: '#FF6B2C', fontWeight: 600 }}>Sincronização em Tempo Real</span>
        </div>

      </div>

      {/* FILTROS AVANÇADOS & BUSCA VEICULAR */}
      <div style={{ background: '#FFFFFF', padding: '20px 24px', borderRadius: '12px', border: '1px solid #CBD5E1', marginBottom: '24px', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <SlidersHorizontal size={18} color="#0F172A" />
          <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0F172A' }}>
            Busca Inteligente por Placa, Código OEM ou Veículo
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
          
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Busca (Nome, SKU, OEM, Cross-Code)
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Ex: Pastilha, 2H0698151A, Bosch..."
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && executarFiltro()}
                style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem' }}
              />
              <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: '12px', top: '12px' }} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Placa do Veículo (Busca Automática)
            </label>
            <input
              type="text"
              placeholder="Ex: RNI-4E29 ou QBQ-8J12"
              value={filtroPlaca}
              onChange={(e) => setFiltroPlaca(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && executarFiltro()}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem', fontWeight: 700, letterSpacing: '1px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Montadora
            </label>
            <select
              value={filtroMontadora}
              onChange={(e) => { setFiltroMontadora(e.target.value); setFiltroModelo(''); }}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem', background: '#FFFFFF' }}
            >
              <option value="">Todas as Montadoras</option>
              {montadoras.map((m, idx) => (
                <option key={idx} value={m.montadora}>{m.montadora}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Grupo / Sistema
            </label>
            <select
              value={filtroGrupo}
              onChange={(e) => setFiltroGrupo(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem', background: '#FFFFFF' }}
            >
              <option value="">Todos os Sistemas</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>{g.icone} {g.nome}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              onClick={executarFiltro}
              style={{
                flex: 1,
                background: '#0F172A',
                color: '#FFFFFF',
                border: 'none',
                padding: '11px 16px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <Search size={16} /> Filtrar Peças
            </button>
            <button
              type="button"
              onClick={() => { setTermoBusca(''); setFiltroGrupo(''); setFiltroMontadora(''); setFiltroModelo(''); setFiltroPlaca(''); carregarDadosIniciais(); }}
              style={{
                background: '#F1F5F9',
                color: '#475569',
                border: '1px solid #CBD5E1',
                padding: '11px',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
              title="Limpar Filtros"
            >
              <RefreshCw size={16} />
            </button>
          </div>

        </div>
      </div>

      {/* TABELA DE PEÇAS & ESTOQUE */}
      <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #CBD5E1', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>
            Catálogo de Autopeças ({pecas.length} itens listados)
          </h3>
          <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
            Endereçamento físico e tributação ST (ICMS-ST / CEST)
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Foto & Peça</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Códigos OEM & Fabricante</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Compatibilidade / Aplicação</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Local Físico</th>
                <th style={{ padding: '12px 16px', fontWeight: 700 }}>Fiscal & ST</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'center' }}>Estoque</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>Preço Venda</th>
                <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {pecas.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #F1F5F9', verticalAlign: 'middle' }}>
                  
                  {/* Foto & Nome */}
                  <td style={{ padding: '14px 16px', minWidth: '220px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <img
                        src={p.fotoUrl}
                        alt={p.nome}
                        style={{ width: '50px', height: '50px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #CBD5E1' }}
                      />
                      <div>
                        <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.9rem' }}>{p.nome}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748B' }}>SKU: <strong>{p.sku}</strong> · {p.posicao}</div>
                        {p.publicadoEcommerce && (
                          <span style={{ background: '#FFF7ED', color: '#FF6B2C', fontSize: '0.7rem', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', border: '1px solid #FDBA74', marginTop: '2px', display: 'inline-block' }}>
                            🛒 Na Loja Online
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Códigos */}
                  <td style={{ padding: '14px 16px', minWidth: '180px' }}>
                    <div style={{ fontWeight: 700, color: '#1E293B' }}>{p.fabricante} ({p.codigoFabricante})</div>
                    <div style={{ fontSize: '0.75rem', color: '#0369A1', fontWeight: 600 }}>OEM: {p.codigoOem}</div>
                    <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>
                      Cruzados: {(p.codigosCruzados || []).slice(0, 2).join(', ')}
                    </div>
                  </td>

                  {/* Aplicação */}
                  <td style={{ padding: '14px 16px', minWidth: '180px' }}>
                    {(p.aplicacoes || []).map((ap, idx) => (
                      <div key={idx} style={{ background: '#F8FAFC', padding: '3px 8px', borderRadius: '4px', border: '1px solid #E2E8F0', marginBottom: '3px', fontSize: '0.75rem' }}>
                        <strong>{ap.montadora} {ap.modelo}</strong> ({ap.anos})
                        <div style={{ color: '#64748B', fontSize: '0.7rem' }}>{ap.motor}</div>
                      </div>
                    ))}
                  </td>

                  {/* Localização Física */}
                  <td style={{ padding: '14px 16px', minWidth: '120px' }}>
                    <div style={{ background: '#EFF6FF', color: '#1E40AF', padding: '6px 10px', borderRadius: '6px', border: '1px solid #BFDBFE', fontSize: '0.75rem', fontWeight: 700 }}>
                      <MapPin size={12} style={{ display: 'inline', marginRight: '4px' }} />
                      Corr. {p.localizacao?.corredor || 'A'} · Prat. {p.localizacao?.prateleira || '01'}
                      <div style={{ fontSize: '0.7rem', color: '#3B82F6', fontWeight: 600 }}>Gaveta: {p.localizacao?.gaveta || '01'}</div>
                    </div>
                  </td>

                  {/* Fiscal & ST */}
                  <td style={{ padding: '14px 16px', minWidth: '130px', fontSize: '0.75rem' }}>
                    <div>NCM: <strong>{p.ncm}</strong></div>
                    <div>CEST: <strong>{p.cest}</strong></div>
                    <div style={{ color: '#16A34A', fontWeight: 600 }}>ICMS-ST CST {p.cstIcms}</div>
                  </td>

                  {/* Estoque */}
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <span style={{
                      background: p.estoqueAtual <= p.estoqueMinimo ? '#FEF2F2' : '#F0FDF4',
                      color: p.estoqueAtual <= p.estoqueMinimo ? '#DC2626' : '#166534',
                      fontWeight: 800,
                      fontSize: '0.95rem',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      border: `1px solid ${p.estoqueAtual <= p.estoqueMinimo ? '#FECDD3' : '#BBF7D0'}`
                    }}>
                      {p.estoqueAtual} un
                    </span>
                    <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '4px' }}>Mín: {p.estoqueMinimo}</div>
                  </td>

                  {/* Preço */}
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0F172A' }}>
                      R$ {Number(p.precoVenda).toFixed(2)}
                    </div>
                    {p.precoPromocionalEcommerce && (
                      <div style={{ fontSize: '0.75rem', color: '#FF6B2C', fontWeight: 600 }}>
                        E-com: R$ {Number(p.precoPromocionalEcommerce).toFixed(2)}
                      </div>
                    )}
                  </td>

                  {/* Ações */}
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => { setModalRequisicao(p); setQtdRequisicao(1); }}
                      style={{
                        background: '#0F172A',
                        color: '#FFFFFF',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        margin: '0 auto'
                      }}
                    >
                      <Wrench size={13} /> Requisitar OS
                    </button>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE REQUISIÇÃO PARA OFICINA (KYTTO AUTO) */}
      {modalRequisicao && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '14px', width: '100%', maxWidth: '480px', padding: '26px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0F172A' }}>
                Requisitar Peça para a Oficina Mecânica
              </h3>
              <button onClick={() => setModalRequisicao(null)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748B' }}>✕</button>
            </div>

            <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '16px' }}>
              <div style={{ fontWeight: 700, color: '#0F172A' }}>{modalRequisicao.nome}</div>
              <div style={{ fontSize: '0.8rem', color: '#64748B' }}>SKU: {modalRequisicao.sku} · Estoque: {modalRequisicao.estoqueAtual} un</div>
              <div style={{ fontSize: '0.8rem', color: '#0369A1', fontWeight: 600 }}>Local: Corredor {modalRequisicao.localizacao?.corredor} / Prateleira {modalRequisicao.localizacao?.prateleira}</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Ordem de Serviço (OS) de Destino:
                </label>
                <select
                  value={osDestino}
                  onChange={(e) => setOsDestino(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem', background: '#FFFFFF' }}
                >
                  <option value="OS-2026-01042">OS-2026-01042 · Volkswagen Amarok (Placa RNI-4E29)</option>
                  <option value="OS-2026-01043">OS-2026-01043 · Toyota Hilux (Placa QBQ-8J12)</option>
                  <option value="OS-2026-01044">OS-2026-01044 · Chevrolet S10 (Placa RRA-9B10)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Quantidade a Transferir:
                </label>
                <input
                  type="number"
                  min="1"
                  max={modalRequisicao.estoqueAtual}
                  value={qtdRequisicao}
                  onChange={(e) => setQtdRequisicao(Number(e.target.value))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '1rem', fontWeight: 700 }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setModalRequisicao(null)}
                style={{ flex: 1, padding: '11px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRequisitarOS}
                style={{ flex: 1.5, padding: '11px', borderRadius: '8px', border: 'none', background: '#F59E0B', color: '#000000', fontWeight: 800, cursor: 'pointer' }}
              >
                Confirmar Transferência
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
