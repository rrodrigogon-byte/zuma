import React, { useState } from 'react';
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
  X
} from 'lucide-react';
import { api } from '../../../lib/api';

export default function PizzariaIntegracoesAvancadas({ pedidoSelecionado, onClose, onPedidoAtualizado }) {
  const [abaModal, setAbaModal] = useState('impressao'); // impressao | nfce | motoboy | eventos
  const [tipoImpressao, setTipoImpressao] = useState('cozinha'); // cozinha | motoboy
  const [dadosImpressao, setDadosImpressao] = useState(null);
  const [carregandoImpressao, setCarregandoImpressao] = useState(false);
  const [dadosNfce, setDadosNfce] = useState(null);
  const [carregandoNfce, setCarregandoNfce] = useState(false);
  const [motoboySelecionado, setMotoboySelecionado] = useState('mb-01');
  const [sucessoAlocacao, setSucessoAlocacao] = useState(false);
  const [copiado, setCopiado] = useState(false);

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

  // Alocar Motoboy
  const alocarMotoboy = async () => {
    if (!pedidoSelecionado) return;
    try {
      await api.post('/api/admin/palatare/delivery/alocar-motoboy', {
        pedidoId: pedidoSelecionado.id,
        motoboyId: motoboySelecionado
      });
      setSucessoAlocacao(true);
      setTimeout(() => setSucessoAlocacao(false), 3000);
      if (onPedidoAtualizado) onPedidoAtualizado();
    } catch (err) {
      console.error('Erro ao alocar motoboy:', err);
    }
  };

  const copiarTexto = (txt) => {
    navigator.clipboard?.writeText(txt);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  if (!pedidoSelecionado) return null;

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
        maxWidth: 780,
        maxHeight: '90vh',
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
                Integrações & Expedição · {pedidoSelecionado.comanda || 'CMD'}
              </h3>
              <span style={{
                fontSize: 11,
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#10B981',
                padding: '3px 8px',
                borderRadius: 6,
                fontWeight: 800
              }}>
                {pedidoSelecionado.origem || 'Delivery'}
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

        {/* Barra de Abas do Modal */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(0,0,0,0.2)'
        }}>
          <button
            type="button"
            onClick={() => { setAbaModal('impressao'); if (!dadosImpressao) carregarImpressao('cozinha'); }}
            style={{
              flex: 1,
              padding: '14px 16px',
              background: abaModal === 'impressao' ? 'rgba(255, 107, 44, 0.15)' : 'transparent',
              border: 'none',
              borderBottom: abaModal === 'impressao' ? '3px solid #FF6B2C' : '3px solid transparent',
              color: abaModal === 'impressao' ? '#FF6B2C' : '#94A3B8',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8
            }}
          >
            <Printer size={16} /> Spooler Térmico (80mm)
          </button>
          <button
            type="button"
            onClick={() => setAbaModal('nfce')}
            style={{
              flex: 1,
              padding: '14px 16px',
              background: abaModal === 'nfce' ? 'rgba(255, 107, 44, 0.15)' : 'transparent',
              border: 'none',
              borderBottom: abaModal === 'nfce' ? '3px solid #FF6B2C' : '3px solid transparent',
              color: abaModal === 'nfce' ? '#FF6B2C' : '#94A3B8',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8
            }}
          >
            <FileText size={16} /> NFC-e Fiscal (SEFAZ-MT)
          </button>
          <button
            type="button"
            onClick={() => setAbaModal('motoboy')}
            style={{
              flex: 1,
              padding: '14px 16px',
              background: abaModal === 'motoboy' ? 'rgba(255, 107, 44, 0.15)' : 'transparent',
              border: 'none',
              borderBottom: abaModal === 'motoboy' ? '3px solid #FF6B2C' : '3px solid transparent',
              color: abaModal === 'motoboy' ? '#FF6B2C' : '#94A3B8',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8
            }}
          >
            <Truck size={16} /> Despacho & Motoboy
          </button>
        </div>

        {/* Conteúdo da Aba */}
        <div style={{ padding: 24 }}>
          {/* 1. Spooler Térmico */}
          {abaModal === 'impressao' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  type="button"
                  onClick={() => carregarImpressao('cozinha')}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: tipoImpressao === 'cozinha' ? '2px solid #FF6B2C' : '1px solid rgba(255,255,255,0.1)',
                    background: tipoImpressao === 'cozinha' ? 'rgba(255, 107, 44, 0.2)' : 'rgba(255,255,255,0.04)',
                    color: '#FFF',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: 13
                  }}
                >
                  🍳 Comanda Cozinha & Forno
                </button>
                <button
                  type="button"
                  onClick={() => carregarImpressao('motoboy')}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: tipoImpressao === 'motoboy' ? '2px solid #10B981' : '1px solid rgba(255,255,255,0.1)',
                    background: tipoImpressao === 'motoboy' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.04)',
                    color: '#FFF',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: 13
                  }}
                >
                  🛵 Cupom de Entrega (Motoboy)
                </button>
              </div>

              {carregandoImpressao ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#FF6B2C' }}>
                  Gerando layout de impressão térmica ESC/POS 80mm...
                </div>
              ) : dadosImpressao ? (
                <div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8
                  }}>
                    <span style={{ fontSize: 12, color: '#C8B6A6' }}>
                      Prévia de Impressão ESC/POS (80mm - 48 Colunas Monospaçadas):
                    </span>
                    <button
                      type="button"
                      onClick={() => copiarTexto(dadosImpressao.rawText)}
                      style={{
                        background: 'rgba(255,255,255,0.08)',
                        border: 'none',
                        borderRadius: 6,
                        padding: '4px 10px',
                        color: '#FFF',
                        fontSize: 11,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <Copy size={12} /> {copiado ? 'Copiado!' : 'Copiar Texto'}
                    </button>
                  </div>
                  <pre style={{
                    background: '#0D0805',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 10,
                    padding: 16,
                    color: '#FCD34D',
                    fontFamily: 'Courier New, monospace',
                    fontSize: 12,
                    lineHeight: 1.4,
                    whiteSpace: 'pre-wrap',
                    maxHeight: 320,
                    overflowY: 'auto'
                  }}>
                    {dadosImpressao.rawText}
                  </pre>
                  <div style={{
                    marginTop: 12,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{ fontSize: 11, color: '#10B981', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CheckCircle2 size={14} /> Bytes ESC/POS prontos para envio ao Spooler USB/Rede
                    </span>
                    <button
                      type="button"
                      onClick={() => window.print?.()}
                      style={{
                        background: '#FF6B2C',
                        border: 'none',
                        borderRadius: 8,
                        padding: '10px 18px',
                        color: '#FFF',
                        fontWeight: 800,
                        cursor: 'pointer',
                        fontSize: 13,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                      }}
                    >
                      <Printer size={16} /> Imprimir na Térmica (80mm)
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 30 }}>
                  <button
                    type="button"
                    onClick={() => carregarImpressao('cozinha')}
                    style={{
                      background: '#FF6B2C',
                      color: '#FFF',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: 8,
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

          {/* 2. NFC-e Fiscal */}
          {abaModal === 'nfce' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {dadosNfce ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: 12,
                    padding: 16
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#10B981', fontWeight: 800 }}>
                      <ShieldCheck size={20} /> NFC-e Modelo 65 Autorizada na SEFAZ-MT
                    </div>
                    <div style={{ marginTop: 8, fontSize: 12, color: '#FFF' }}>
                      Protocolo de Autorização: <strong>{dadosNfce.protocolo}</strong>
                    </div>
                    <div style={{ fontSize: 11, color: '#C8B6A6', marginTop: 4 }}>
                      Chave de Acesso (44 Dígitos):
                    </div>
                    <div style={{
                      fontFamily: 'monospace',
                      fontSize: 12,
                      color: '#FCD34D',
                      background: 'rgba(0,0,0,0.3)',
                      padding: '6px 10px',
                      borderRadius: 6,
                      marginTop: 4,
                      wordBreak: 'break-all'
                    }}>
                      {dadosNfce.chaveAcesso}
                    </div>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 12
                  }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8 }}>
                      <span style={{ fontSize: 11, color: '#C8B6A6' }}>Emitente:</span>
                      <strong style={{ display: 'block', fontSize: 12, color: '#FFF' }}>{dadosNfce.emitente?.razaoSocial}</strong>
                      <span style={{ fontSize: 11, color: '#94A3B8' }}>CNPJ: {dadosNfce.emitente?.cnpj}</span>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8 }}>
                      <span style={{ fontSize: 11, color: '#C8B6A6' }}>Destinatário:</span>
                      <strong style={{ display: 'block', fontSize: 12, color: '#FFF' }}>{dadosNfce.destinatario?.nome}</strong>
                      <span style={{ fontSize: 11, color: '#94A3B8' }}>Valor: R$ {dadosNfce.totais?.valorTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <a
                      href={dadosNfce.qrCodeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        flex: 1,
                        background: '#10B981',
                        color: '#FFF',
                        textDecoration: 'none',
                        padding: '12px 16px',
                        borderRadius: 8,
                        fontWeight: 800,
                        fontSize: 13,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8
                      }}
                    >
                      <ExternalLink size={16} /> Consultar QR Code SEFAZ-MT
                    </a>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '30px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: 12 }}>
                  <ShieldCheck size={48} color="#FF6B2C" style={{ margin: '0 auto 12px' }} />
                  <h4 style={{ margin: '0 0 6px', fontSize: 16, color: '#FFF' }}>Emissão de Nota Fiscal de Consumidor (NFC-e)</h4>
                  <p style={{ margin: '0 0 16px', fontSize: 13, color: '#C8B6A6' }}>
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
                      borderRadius: 8,
                      padding: '12px 24px',
                      fontSize: 14,
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    {carregandoNfce ? 'Transmitindo para SEFAZ-MT...' : 'Emitir NFC-e Agora'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 3. Despacho & Motoboy */}
          {abaModal === 'motoboy' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#C8B6A6', marginBottom: 6 }}>
                  Selecione o Entregador da Frota Palatare:
                </label>
                <select
                  value={motoboySelecionado}
                  onChange={(e) => setMotoboySelecionado(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 8,
                    background: '#0D0805',
                    color: '#FFF',
                    border: '1px solid rgba(255,255,255,0.2)',
                    fontSize: 14,
                    fontWeight: 700
                  }}
                >
                  <option value="mb-01">Alisson Mendes (Moto 01 - QBC-4412) · Disponível</option>
                  <option value="mb-02">Carlos Henrique (Moto 02 - RRA-8891) · Em Rota (CMD-8491)</option>
                  <option value="mb-03">Marcos Vinicius (Moto 03 - NPE-2026) · Disponível</option>
                  <option value="mb-04">Diego Fernandes (Moto 04 - OBF-7743) · Em Rota (CMD-3012)</option>
                </select>
              </div>

              <div style={{
                background: 'rgba(255,255,255,0.03)',
                padding: 14,
                borderRadius: 10,
                fontSize: 12,
                color: '#E2E8F0',
                display: 'flex',
                flexDirection: 'column',
                gap: 6
              }}>
                <div><strong>Destino:</strong> {pedidoSelecionado.endereco || 'Rua 14, Centro'} ({pedidoSelecionado.bairro || 'Centro'})</div>
                <div><strong>Taxa de Entrega:</strong> R$ {(pedidoSelecionado.taxaEntrega || 6).toFixed(2)}</div>
                <div><strong>Pagamento:</strong> {pedidoSelecionado.formaPagamento || 'Pix'} ({pedidoSelecionado.pago ? 'Pago' : 'Receber na Entrega'})</div>
              </div>

              {sucessoAlocacao && (
                <div style={{
                  padding: 12,
                  background: 'rgba(16, 185, 129, 0.2)',
                  color: '#10B981',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <CheckCircle2 size={18} /> Pedido despachado e motoboy notificado via WhatsApp!
                </div>
              )}

              <button
                type="button"
                onClick={alocarMotoboy}
                style={{
                  background: '#FF6B2C',
                  color: '#FFF',
                  border: 'none',
                  borderRadius: 8,
                  padding: '12px 20px',
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8
                }}
              >
                <Send size={16} /> Confirmar Despacho & Notificar Cliente no WhatsApp
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
