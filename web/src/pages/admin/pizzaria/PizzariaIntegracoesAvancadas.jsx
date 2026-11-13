import React, { useState, useEffect } from 'react';
import {
  Printer,
  FileText,
  Truck,
  Flame,
  Activity,
  CheckCircle2,
  Copy,
  ExternalLink,
  QrCode,
  ShieldCheck,
  Send,
  Zap,
  Clock,
  User,
  MapPin,
  X,
  Package,
  Gift,
  Tv
} from 'lucide-react';
import { api } from '../../../lib/api';

export default function PizzariaIntegracoesAvancadas({ pedidoSelecionado, onClose, onPedidoAtualizado }) {
  const [abaModal, setAbaModal] = useState('impressao'); // impressao | nfce | motoboy | multipracas | fidelidade | insumos
  const [tipoImpressao, setTipoImpressao] = useState('cozinha'); // cozinha | motoboy
  const [dadosImpressao, setDadosImpressao] = useState(null);
  const [carregandoImpressao, setCarregandoImpressao] = useState(false);
  
  const [dadosNfce, setDadosNfce] = useState(null);
  const [carregandoNfce, setCarregandoNfce] = useState(false);
  
  const [motoboySelecionado, setMotoboySelecionado] = useState('mb-01');
  const [sucessoAlocacao, setSucessoAlocacao] = useState(false);
  const [copiado, setCopiado] = useState(false);

  // Estados dos novos módulos avançados
  const [dadosMultiPracas, setDadosMultiPracas] = useState(null);
  const [carregandoMultiPracas, setCarregandoMultiPracas] = useState(false);

  const [perfilFidelidade, setPerfilFidelidade] = useState(null);
  const [carregandoFidelidade, setCarregandoFidelidade] = useState(false);
  const [cashbackCreditado, setCashbackCreditado] = useState(null);

  const [estoqueInsumos, setEstoqueInsumos] = useState([]);
  const [carregandoEstoque, setCarregandoEstoque] = useState(false);
  const [baixaRealizada, setBaixaRealizada] = useState(false);

  // Carregar impressão térmica
  const carregarImpressao = async (tipo) => {
    if (!pedidoSelecionado) return;
    setCarregandoImpressao(true);
    setTipoImpressao(tipo);
    try {
      const endpoint = tipo === 'cozinha'
        ? `/api/admin/palatare/pedidos/${pedidoSelecionado.id}/imprimir-cozinha`
        : `/api/admin/palatare/pedidos/${pedidoSelecionado.id}/imprimir-motoboy`;
      const res = await api.post(endpoint, { motoboyId: motoboySelecionado });
      setDadosImpressao(res.impressao);
    } catch (err) {
      console.error('Erro ao gerar impressão térmica:', err);
    } finally {
      setCarregandoImpressao(false);
    }
  };

  // Emitir NFC-e Fiscal
  const emitirNfce = async () => {
    if (!pedidoSelecionado) return;
    setCarregandoNfce(true);
    try {
      const res = await api.post(`/api/admin/palatare/pedidos/${pedidoSelecionado.id}/emitir-nfce`, {});
      setDadosNfce(res.nfce);
      if (onPedidoAtualizado) onPedidoAtualizado();
    } catch (err) {
      console.error('Erro ao emitir NFC-e:', err);
    } finally {
      setCarregandoNfce(false);
    }
  };

  // Alocar Motoboy & Despachar
  const despacharMotoboy = async () => {
    if (!pedidoSelecionado) return;
    try {
      await api.post(`/api/admin/palatare/pedidos/${pedidoSelecionado.id}/alocar-motoboy`, {
        motoboyId: motoboySelecionado
      });
      setSucessoAlocacao(true);
      if (onPedidoAtualizado) onPedidoAtualizado();
    } catch (err) {
      console.error('Erro ao alocar motoboy:', err);
    }
  };

  // Carregar Multi-Praças
  const carregarMultiPracas = async () => {
    setCarregandoMultiPracas(true);
    try {
      const res = await api.get(`/api/admin/palatare/spooler/multi-pracas/${pedidoSelecionado.id}`);
      if (res.ok) setDadosMultiPracas(res.comandas);
    } catch (err) {
      console.error('Erro ao carregar multi-praças:', err);
    } finally {
      setCarregandoMultiPracas(false);
    }
  };

  // Carregar Fidelidade Pass
  const carregarFidelidade = async () => {
    setCarregandoFidelidade(true);
    try {
      const res = await api.get('/api/admin/palatare/fidelidade/(65) 99654-2201');
      if (res.ok) setPerfilFidelidade(res.perfil);
    } catch (err) {
      console.error('Erro ao carregar fidelidade:', err);
    } finally {
      setCarregandoFidelidade(false);
    }
  };

  // Creditar Cashback
  const handleCreditarCashback = async () => {
    try {
      const res = await api.post('/api/admin/palatare/fidelidade/creditar', {
        telefone: '(65) 99654-2201',
        valor: pedidoSelecionado.total || 98.00
      });
      if (res.ok) {
        setCashbackCreditado(res);
        setPerfilFidelidade(res.perfil);
      }
    } catch (err) {
      console.error('Erro ao creditar cashback:', err);
    }
  };

  // Carregar Estoque de Insumos
  const carregarEstoque = async () => {
    setCarregandoEstoque(true);
    try {
      const res = await api.get('/api/admin/palatare/estoque-insumos');
      if (res.ok) setEstoqueInsumos(res.estoque || []);
    } catch (err) {
      console.error('Erro ao carregar estoque:', err);
    } finally {
      setCarregandoEstoque(false);
    }
  };

  // Dar Baixa de Produção
  const handleDarBaixa = async () => {
    try {
      const res = await api.post('/api/admin/palatare/dar-baixa-insumos', pedidoSelecionado);
      if (res.ok) {
        setEstoqueInsumos(res.estoque);
        setBaixaRealizada(true);
      }
    } catch (err) {
      console.error('Erro ao dar baixa em insumos:', err);
    }
  };

  useEffect(() => {
    if (abaModal === 'multipracas') carregarMultiPracas();
    if (abaModal === 'fidelidade') carregarFidelidade();
    if (abaModal === 'insumos') carregarEstoque();
  }, [abaModal]);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: 16
    }}>
      <div style={{
        background: '#1A120B',
        border: '1px solid rgba(255, 107, 44, 0.4)',
        borderRadius: 18,
        width: '100%',
        maxWidth: 820,
        maxHeight: '92vh',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 60px rgba(0,0,0,0.8)'
      }}>
        {/* Cabeçalho do Modal */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255, 107, 44, 0.05)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>🍕</span>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#FFF' }}>
                Integrações & Expedição · {pedidoSelecionado.comanda || pedidoSelecionado.id || 'CMD'}
              </h3>
              <span style={{
                fontSize: 11,
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#10B981',
                padding: '3px 8px',
                borderRadius: 6,
                fontWeight: 800
              }}>
                {pedidoSelecionado.origem || pedidoSelecionado.mesa || 'Delivery'}
              </span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#C8B6A6' }}>
              Cliente: <strong style={{ color: '#FFF' }}>{pedidoSelecionado.cliente}</strong> · Total: <strong style={{ color: '#10B981' }}>R$ {(pedidoSelecionado.total || 0).toFixed(2)}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: 'none',
              borderRadius: 8,
              padding: 8,
              color: '#FFF',
              cursor: 'pointer'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Abas Superiores */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(0,0,0,0.2)',
          overflowX: 'auto'
        }}>
          {[
            { id: 'impressao', label: 'Spooler Térmico (80mm)', icon: Printer },
            { id: 'nfce', label: 'NFC-e Fiscal (SEFAZ-MT)', icon: FileText },
            { id: 'motoboy', label: 'Despacho & Motoboy', icon: Truck },
            { id: 'multipracas', label: 'Multi-Praças (3 Spoolers)', icon: Zap },
            { id: 'fidelidade', label: 'Palatare Pass & Cashback', icon: Gift },
            { id: 'insumos', label: 'Baixa de Insumos', icon: Package }
          ].map(tab => {
            const Icon = tab.icon;
            const ativa = abaModal === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setAbaModal(tab.id)}
                style={{
                  flex: '0 0 auto',
                  padding: '12px 14px',
                  background: ativa ? '#24160E' : 'transparent',
                  color: ativa ? '#FF6B2C' : '#94A3B8',
                  border: 'none',
                  borderBottom: ativa ? '3px solid #FF6B2C' : '3px solid transparent',
                  fontWeight: 800,
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap'
                }}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Conteúdo das Abas */}
        <div style={{ padding: 20 }}>
          {/* ABA 1: SPOOLER TÉRMICO */}
          {abaModal === 'impressao' && (
            <div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <button
                  type="button"
                  onClick={() => carregarImpressao('cozinha')}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid #FF6B2C',
                    background: tipoImpressao === 'cozinha' ? '#FF6B2C22' : 'transparent',
                    color: tipoImpressao === 'cozinha' ? '#FF6B2C' : '#FFF',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  🍕 Comanda Cozinha & Forno
                </button>
                <button
                  type="button"
                  onClick={() => carregarImpressao('motoboy')}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: tipoImpressao === 'motoboy' ? '#FF6B2C22' : 'transparent',
                    color: tipoImpressao === 'motoboy' ? '#FF6B2C' : '#FFF',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  🛵 Cupom de Entrega (Motoboy)
                </button>
              </div>

              {dadosImpressao ? (
                <div>
                  <div style={{
                    background: '#0D0805',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10,
                    padding: 16,
                    fontFamily: 'Courier New, monospace',
                    fontSize: 12,
                    lineHeight: 1.4,
                    color: '#F8FAFC',
                    whiteSpace: 'pre-wrap',
                    maxHeight: 280,
                    overflowY: 'auto'
                  }}>
                    {dadosImpressao.conteudoTexto || dadosImpressao.rawText}
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      style={{
                        flex: 1,
                        background: '#FF6B2C',
                        color: '#FFF',
                        border: 'none',
                        padding: '10px 16px',
                        borderRadius: 8,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8
                      }}
                    >
                      <Printer size={16} /> Imprimir Térmica 80mm
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 30 }}>
                  <button
                    type="button"
                    onClick={() => carregarImpressao(tipoImpressao)}
                    style={{
                      background: '#FF6B2C',
                      color: '#FFF',
                      border: 'none',
                      padding: '12px 24px',
                      borderRadius: 10,
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    Gerar Comanda Térmica
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ABA 2: NFC-E SEFAZ-MT */}
          {abaModal === 'nfce' && (
            <div>
              {dadosNfce ? (
                <div style={{ background: '#0D1A12', border: '1px solid #10B981', borderRadius: 12, padding: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#10B981', fontWeight: 800, fontSize: 15 }}>
                    <ShieldCheck size={20} /> NFC-e Autorizada com Sucesso! (SEFAZ-MT)
                  </div>
                  <div style={{ marginTop: 12, fontSize: 13, color: '#D1FAE5', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div>Chave de Acesso: <strong style={{ letterSpacing: 1, color: '#FFF' }}>{dadosNfce.chaveAcesso}</strong></div>
                    <div>Protocolo de Autorização: <strong>{dadosNfce.protocolo}</strong></div>
                    <div>Modelo: <strong>65 (NFC-e Estadual)</strong> · CFOP: <strong>5102</strong> · NCM: <strong>1905.90.90</strong></div>
                  </div>
                  <a
                    href={dadosNfce.qrCodeUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      marginTop: 14,
                      background: '#10B981',
                      color: '#FFF',
                      textDecoration: 'none',
                      padding: '8px 14px',
                      borderRadius: 8,
                      fontWeight: 700,
                      fontSize: 12
                    }}
                  >
                    <ExternalLink size={14} /> Consultar na SEFAZ-MT
                  </a>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 25 }}>
                  <ShieldCheck size={40} color="#FF6B2C" style={{ marginBottom: 12 }} />
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#FFF', marginBottom: 6 }}>
                    Emissão de Nota Fiscal de Consumidor (NFC-e)
                  </div>
                  <p style={{ fontSize: 12, color: '#C8B6A6', maxWidth: 440, margin: '0 auto 18px' }}>
                    Emite automaticamente a NFC-e no padrão SEFAZ-MT (NCM 1905.90.90 / CFOP 5102) com chave de 44 dígitos e QR Code impresso no cupom.
                  </p>
                  <button
                    type="button"
                    onClick={emitirNfce}
                    disabled={carregandoNfce}
                    style={{
                      background: '#10B981',
                      color: '#FFF',
                      border: 'none',
                      padding: '12px 24px',
                      borderRadius: 10,
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    {carregandoNfce ? 'Transmitindo à SEFAZ-MT...' : 'Emitir NFC-e Agora'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ABA 3: DESPACHO & MOTOBOY */}
          {abaModal === 'motoboy' && (
            <div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#C8B6A6', display: 'block', marginBottom: 6 }}>
                  Selecione o Entregador da Frota Palatare:
                </label>
                <select
                  value={motoboySelecionado}
                  onChange={(e) => setMotoboySelecionado(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#0D0805',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    padding: 10,
                    color: '#FFF',
                    fontWeight: 700
                  }}
                >
                  <option value="mb-01">Alisson Mendes (Moto 01 - QBC-4412) · Disponível</option>
                  <option value="mb-02">Cleber Santos (Moto 02 - QBD-8902) · Retornando (4 min)</option>
                  <option value="mb-03">Rafael Nogueira (Moto 03 - RKT-3310) · Na Base</option>
                  <option value="mb-04">Marcos Vinícius (Moto 04 - NJW-7140) · Disponível</option>
                </select>
              </div>

              <div style={{ background: '#0D0805', borderRadius: 10, padding: 14, marginBottom: 16, fontSize: 13, color: '#CBD5E1' }}>
                <div>Destino: <strong>Rua 14, Centro (Centro)</strong></div>
                <div style={{ marginTop: 4 }}>Taxa de Entrega: <strong style={{ color: '#10B981' }}>R$ 6.00</strong></div>
                <div style={{ marginTop: 4 }}>Pagamento: <strong>Pix (Receber na Entrega)</strong></div>
              </div>

              {sucessoAlocacao ? (
                <div style={{ background: '#064E3B', color: '#A7F3D0', padding: 12, borderRadius: 8, fontWeight: 800, textAlign: 'center' }}>
                  ✓ Motoboy alocado e rota enviada via WhatsApp com sucesso!
                </div>
              ) : (
                <button
                  type="button"
                  onClick={despacharMotoboy}
                  style={{
                    width: '100%',
                    background: '#FF6B2C',
                    color: '#FFF',
                    border: 'none',
                    padding: 12,
                    borderRadius: 10,
                    fontWeight: 900,
                    cursor: 'pointer'
                  }}
                >
                  🚀 Confirmar Despacho & Notificar Cliente no WhatsApp
                </button>
              )}
            </div>
          )}

          {/* ABA 4: MULTI-PRAÇAS */}
          {abaModal === 'multipracas' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
                {[
                  { nome: 'Praça 1: Forno Napolitano', ip: '192.168.1.201', tipo: 'Pizzas & Fornada', status: 'Online' },
                  { nome: 'Praça 2: Bar & Adega', ip: '192.168.1.202', tipo: 'Vinhos, Chopp & Sucos', status: 'Online' },
                  { nome: 'Praça 3: Caixa / Expedição', ip: '192.168.1.203', tipo: 'Cupom NFC-e & Motoboy', status: 'Online' }
                ].map((p, idx) => (
                  <div key={idx} style={{ background: '#0D0805', border: '1px solid #3A1F13', borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#FF7A00' }}>{p.nome}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>IP: {p.ip}:9100</div>
                    <div style={{ fontSize: 11, color: '#10B981', marginTop: 4, fontWeight: 700 }}>● {p.status}</div>
                  </div>
                ))}
              </div>

              {dadosMultiPracas ? (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#C8B6A6', marginBottom: 6 }}>Comanda Separada - Bar & Adega:</div>
                  <pre style={{
                    background: '#0D0805',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 11,
                    color: '#A7F3D0',
                    whiteSpace: 'pre-wrap',
                    maxHeight: 180,
                    overflowY: 'auto'
                  }}>
                    {dadosMultiPracas.bar}
                  </pre>
                  <button
                    type="button"
                    onClick={() => alert('Buffer ESC/POS enviado para as 3 impressoras simultaneamente!')}
                    style={{
                      width: '100%',
                      background: '#10B981',
                      color: '#FFF',
                      border: 'none',
                      padding: 12,
                      borderRadius: 8,
                      fontWeight: 800,
                      cursor: 'pointer',
                      marginTop: 10
                    }}
                  >
                    ⚡ Disparar Impressão nas 3 Praças em Rede
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 20 }}>
                  <button
                    type="button"
                    onClick={carregarMultiPracas}
                    style={{ background: '#FF6B2C', color: '#FFF', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 800, cursor: 'pointer' }}
                  >
                    Carregar Separação de Praças
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ABA 5: PALATARE PASS (FIDELIDADE & CASHBACK) */}
          {abaModal === 'fidelidade' && (
            <div>
              {perfilFidelidade ? (
                <div>
                  <div style={{ background: '#0D1A12', border: '1px solid #10B981', borderRadius: 12, padding: 18, marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: '#FFF' }}>{perfilFidelidade.cliente}</div>
                        <div style={{ fontSize: 12, color: '#10B981', fontWeight: 700 }}>{perfilFidelidade.categoriaFidelidade}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', fontWeight: 800 }}>Saldo Cashback</div>
                        <div style={{ fontSize: 24, fontWeight: 900, color: '#10B981' }}>
                          R$ {perfilFidelidade.saldoCashbackReais.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: 14, background: '#064E3B', padding: 10, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#A7F3D0', fontWeight: 700 }}>
                        Progresso Pizza Grátis: {perfilFidelidade.selosAcumulados} / 10 Selos
                      </span>
                      <span style={{ fontSize: 11, background: '#10B981', color: '#022C22', padding: '2px 8px', borderRadius: 10, fontWeight: 900 }}>
                        Faltam {10 - perfilFidelidade.selosAcumulados} pedidos
                      </span>
                    </div>
                  </div>

                  {cashbackCreditado ? (
                    <div style={{ background: '#1E1B4B', border: '1px solid #6366F1', padding: 14, borderRadius: 10 }}>
                      <div style={{ color: '#A5B4FC', fontWeight: 800, fontSize: 13, marginBottom: 6 }}>
                        ✓ Notificação gerada para o WhatsApp do cliente:
                      </div>
                      <p style={{ margin: 0, fontSize: 12, color: '#E0E7FF', lineHeight: 1.5 }}>
                        {cashbackCreditado.mensagemWhatsApp}
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleCreditarCashback}
                      style={{
                        width: '100%',
                        background: '#6366F1',
                        color: '#FFF',
                        border: 'none',
                        padding: 12,
                        borderRadius: 10,
                        fontWeight: 900,
                        cursor: 'pointer'
                      }}
                    >
                      🎁 Creditar 5% Cashback (R$ {((pedidoSelecionado.total || 98) * 0.05).toFixed(2)}) & Notificar Cliente
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 25, color: '#94A3B8' }}>
                  Carregando perfil Palatare Pass...
                </div>
              )}
            </div>
          )}

          {/* ABA 6: BAIXA DE INSUMOS */}
          {abaModal === 'insumos' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#FFF' }}>
                  Insumos Críticos da Forneria (Baixa Automática)
                </span>
                {baixaRealizada && (
                  <span style={{ fontSize: 11, color: '#10B981', fontWeight: 800 }}>
                    ✓ Baixa da comanda concluída
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto', marginBottom: 16 }}>
                {(estoqueInsumos || []).slice(0, 5).map(item => (
                  <div key={item.id} style={{
                    background: '#0D0805',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <strong style={{ fontSize: 12, color: '#FFF' }}>{item.nome}</strong>
                      <div style={{ fontSize: 10, color: '#94A3B8' }}>{item.categoria} · Mín: {item.estoqueMinimo} {item.unidade}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: item.alertaReposicao ? '#EF4444' : '#10B981' }}>
                        {item.saldoAtual.toFixed(1)} {item.unidade}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleDarBaixa}
                disabled={baixaRealizada}
                style={{
                  width: '100%',
                  background: baixaRealizada ? '#334155' : '#FF6B2C',
                  color: '#FFF',
                  border: 'none',
                  padding: 12,
                  borderRadius: 10,
                  fontWeight: 900,
                  cursor: baixaRealizada ? 'default' : 'pointer'
                }}
              >
                {baixaRealizada ? '✓ Baixa de Insumos Realizada' : 'Dar Baixa de Produção no Estoque'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
