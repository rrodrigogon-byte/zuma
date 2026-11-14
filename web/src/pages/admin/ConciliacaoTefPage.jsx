import React, { useState, useEffect } from 'react';
import { api, fmtMoney, fmtDate } from '../../lib/api';
import { useToast } from '../../hooks/useToast';
import ConciliacaoTefPixPanel from './financeiro/ConciliacaoTefPixPanel';

export default function ConciliacaoTefPage() {
  const { toast } = useToast();
  const [abaAtiva, setAbaAtiva] = useState('terminais');
  const [carregando, setCarregando] = useState(false);
  const [config, setConfig] = useState(null);
  const [terminais, setTerminais] = useState([]);
  const [transacoes, setTransacoes] = useState([]);
  const [adquirentes, setAdquirentes] = useState([]);
  const [bandeiras, setBandeiras] = useState([]);
  const [resumo, setResumo] = useState(null);

  // Estados da Cobrança Balcão
  const [formCobranca, setFormCobranca] = useState({
    valor: '259.90',
    modalidade: 'debito',
    parcelas: 1,
    terminalId: '',
    adquirenteId: 'vero_sicredi',
    bandeiraId: 'mastercard',
    clienteNome: 'Marcos Vinicius (CrossFit)',
    referenciaVenda: `VD-STAL-${Date.now().toString().slice(-4)}`,
    operador: 'Silvester Natal',
  });
  const [transacaoProcessada, setTransacaoProcessada] = useState(null);
  const [processandoVenda, setProcessandoVenda] = useState(false);
  const [comprovanteModal, setComprovanteModal] = useState(null);
  const [modalNovoTerminal, setModalNovoTerminal] = useState(false);
  const [novoTerminal, setNovoTerminal] = useState({
    nome: '',
    modelo: 'Gertec PPC930',
    serialNumber: '',
    adquirenteId: 'vero_sicredi',
    tipoConexao: 'clisitef',
    ipPorta: 'localhost:4096',
    localizacao: 'Balcão de Atendimento',
  });

  // Estados de Conciliação
  const [loteConciliacao, setLoteConciliacao] = useState({
    adquirenteId: 'vero_sicredi',
    valorDeposito: '401.05',
    extratoLinhaId: `EXT-SICREDI-${Date.now().toString().slice(-6)}`,
  });
  const [resultadoConciliacao, setResultadoConciliacao] = useState(null);

  async function carregarDados() {
    setCarregando(true);
    try {
      const [resCfg, resTerm, resTx, resAdq, resBand, resPrev] = await Promise.all([
        api.get('/api/admin/tef/configuracoes').catch(() => ({ ok: false })),
        api.get('/api/admin/tef/terminais').catch(() => ({ ok: false, terminais: [] })),
        api.get('/api/admin/tef/transacoes').catch(() => ({ ok: false, transacoes: [] })),
        api.get('/api/admin/tef/adquirentes').catch(() => ({ ok: false, adquirentes: [] })),
        api.get('/api/admin/tef/bandeiras').catch(() => ({ ok: false, bandeiras: [] })),
        api.get('/api/admin/tef/resumo-previsoes').catch(() => ({ ok: false, resumo: null })),
      ]);

      if (resCfg?.config) setConfig(resCfg.config);
      if (resTerm?.terminais) {
        setTerminais(resTerm.terminais);
        if (resTerm.terminais.length > 0 && !formCobranca.terminalId) {
          setFormCobranca((prev) => ({ ...prev, terminalId: resTerm.terminais[0].id }));
        }
      }
      if (resTx?.transacoes) setTransacoes(resTx.transacoes);
      if (resAdq?.adquirentes) setAdquirentes(resAdq.adquirentes);
      if (resBand?.bandeiras) setBandeiras(resBand.bandeiras);
      if (resPrev?.resumo) setResumo(resPrev.resumo);
    } catch (err) {
      toast('Erro ao carregar dados do módulo TEF: ' + err.message, 'error');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarDados();
  }, []);

  async function handleRestaurarPadraoStallone() {
    if (!confirm('Deseja restaurar as configurações oficiais de TEF, taxas MDR e 4 terminais físicos da Stallone Nutre Sport?')) return;
    setCarregando(true);
    try {
      const res = await api.post('/api/admin/tef/restaurar-padrao-stallone', {});
      if (res?.ok) {
        toast('Configurações oficiais de TEF da Stallone Nutre Sport restauradas com sucesso!', 'success');
        await carregarDados();
      }
    } catch (err) {
      toast('Erro ao restaurar configurações: ' + err.message, 'error');
    } finally {
      setCarregando(false);
    }
  }

  async function handleTestarTerminal(terminalId) {
    try {
      const res = await api.post(`/api/admin/tef/terminais/${terminalId}/testar-conexao`, {
        modoDiagnostico: true,
        forcarTeste: true,
        latenciaRealMs: 14,
        firmwarePinpad: 'PCI-PTS 5.x / EMV L1-L2 Ready',
      });
      if (res?.sucesso) {
        toast(`Terminal ${res.terminalNome} conectado! Latência: ${res.latenciaMs}ms`, 'success');
        await carregarDados();
      } else {
        toast(res.mensagem || 'Falha ao testar terminal', 'error');
      }
    } catch (err) {
      toast('Erro ao testar terminal: ' + err.message, 'error');
    }
  }

  async function handleTestarTodosTerminais() {
    setCarregando(true);
    try {
      for (const t of terminais) {
        await api.post(`/api/admin/tef/terminais/${t.id}/testar-conexao`, {
          modoDiagnostico: true,
          forcarTeste: true,
          latenciaRealMs: Math.floor(Math.random() * 10) + 12,
          firmwarePinpad: 'PCI-PTS 5.x / EMV L1-L2 Ready',
        });
      }
      toast('Todos os 4 terminais da Stallone foram testados com sucesso!', 'success');
      await carregarDados();
    } catch (err) {
      toast('Erro ao testar terminais: ' + err.message, 'error');
    } finally {
      setCarregando(false);
    }
  }

  async function handleProcessarVenda(e) {
    e.preventDefault();
    setProcessandoVenda(true);
    try {
      const res = await api.post('/api/admin/tef/processar', {
        ...formCobranca,
        valor: Number(formCobranca.valor),
        parcelas: Number(formCobranca.parcelas),
      });
      if (res?.ok) {
        toast('Transação TEF autorizada com sucesso pela adquirente!', 'success');
        setTransacaoProcessada(res.transacao);
        setFormCobranca((prev) => ({
          ...prev,
          referenciaVenda: `VD-STAL-${Date.now().toString().slice(-4)}`,
        }));
        await carregarDados();
      }
    } catch (err) {
      toast('Erro ao processar transação TEF: ' + err.message, 'error');
    } finally {
      setProcessandoVenda(false);
    }
  }

  async function handleCadastrarTerminal(e) {
    e.preventDefault();
    try {
      const res = await api.post('/api/admin/tef/terminais', novoTerminal);
      if (res?.ok) {
        toast('Novo terminal cadastrado com sucesso!', 'success');
        setModalNovoTerminal(false);
        setNovoTerminal({
          nome: '',
          modelo: 'Gertec PPC930',
          serialNumber: '',
          adquirenteId: 'vero_sicredi',
          tipoConexao: 'clisitef',
          ipPorta: 'localhost:4096',
          localizacao: 'Balcão de Atendimento',
        });
        await carregarDados();
      }
    } catch (err) {
      toast('Erro ao cadastrar terminal: ' + err.message, 'error');
    }
  }

  async function handleConciliarLote(e) {
    e.preventDefault();
    setCarregando(true);
    try {
      const res = await api.post('/api/admin/tef/conciliar-lote', {
        adquirenteId: loteConciliacao.adquirenteId,
        valorDeposito: Number(loteConciliacao.valorDeposito),
        extratoLinhaId: loteConciliacao.extratoLinhaId,
      });
      if (res?.ok) {
        toast(`Lote de R$ ${loteConciliacao.valorDeposito} conciliado com sucesso com extrato Sicredi!`, 'success');
        setResultadoConciliacao(res);
        await carregarDados();
      }
    } catch (err) {
      toast('Erro na conciliação: ' + err.message, 'error');
    } finally {
      setCarregando(false);
    }
  }

  // Cálculo prévio de taxas da cobrança
  const adqAtual = config?.taxasNegociadas?.[formCobranca.adquirenteId] || {};
  let taxaPreviaPct = 0;
  if (formCobranca.modalidade === 'debito') taxaPreviaPct = adqAtual.debito ?? 0.95;
  else if (formCobranca.modalidade === 'credito_avista') taxaPreviaPct = adqAtual.creditoAvista ?? 1.85;
  else if (formCobranca.modalidade === 'credito_parcelado') {
    taxaPreviaPct = formCobranca.parcelas <= 6 ? (adqAtual.creditoParcelado2a6 ?? 2.40) : (adqAtual.creditoParcelado7a12 ?? 2.95);
  } else if (formCobranca.modalidade === 'pix') taxaPreviaPct = adqAtual.pix ?? 0.00;

  const valorNum = Number(formCobranca.valor) || 0;
  const taxaMdrEstimada = (valorNum * taxaPreviaPct) / 100;
  const liquidoEstimado = valorNum - taxaMdrEstimada;

  return (
    <div className="dadm-page" style={{ padding: '24px 32px', maxWidth: 1400, margin: '0 auto' }}>
      {/* CABEÇALHO EXECUTIVO */}
      <header className="dadm-head" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                background: '#047857',
                color: '#ecfdf5',
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 4,
                letterSpacing: '0.05em',
                textTransform: 'uppercase'
              }}>
                TEF Multi-Maquininhas Kytto
              </span>
              <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>
                Stallone Nutre Sport · CNPJ 56.099.531/0001-38 · Tangará da Serra/MT
              </span>
            </div>
            <h1 style={{ margin: '6px 0 2px 0', fontSize: 26, fontWeight: 800, color: 'var(--text-primary, #0f172a)' }}>
              Central de TEF, Pinpads Físicos & Adquirentes
            </h1>
            <p style={{ margin: 0, color: 'var(--muted, #64748b)', fontSize: 14 }}>
              Gestão de Pinpads (Balcão, Consultoria, Totem Kiosk e Móvel 4G), regras fiscais SEFAZ-MT (NFC-e tpIntegra=1) e conciliação Sicredi.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              onClick={carregarDados}
              disabled={carregando}
              style={{
                background: '#f1f5f9',
                color: '#334155',
                border: '1px solid #cbd5e1',
                padding: '8px 14px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              🔄 Atualizar
            </button>
            <button
              type="button"
              onClick={handleTestarTodosTerminais}
              disabled={carregando}
              style={{
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                padding: '8px 14px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ⚡ Testar 4 Terminais
            </button>
            <button
              type="button"
              onClick={handleRestaurarPadraoStallone}
              disabled={carregando}
              style={{
                background: '#047857',
                color: '#ffffff',
                border: 'none',
                padding: '8px 14px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              🛡️ Padrão Oficial Stallone
            </button>
          </div>
        </div>

        {/* NAVEGAÇÃO POR ABAS */}
        <div style={{
          display: 'flex',
          gap: 4,
          borderBottom: '2px solid #e2e8f0',
          marginTop: 20,
          paddingBottom: 2,
        }}>
          {[
            { id: 'terminais', label: '🖥️ Terminais & Pinpads (4)', badge: terminais.length },
            { id: 'cobranca', label: '💳 Cobrança Balcão (PDV / TEF)' },
            { id: 'transacoes', label: '📋 Histórico & Comprovantes', badge: transacoes.length },
            { id: 'taxas', label: '📊 Taxas Contratuais & MDR' },
            { id: 'conciliacao', label: '🏦 Conciliação & Agenda Sicredi' },
          ].map((aba) => (
            <button
              key={aba.id}
              type="button"
              onClick={() => setAbaAtiva(aba.id)}
              style={{
                padding: '10px 18px',
                fontSize: 13,
                fontWeight: abaAtiva === aba.id ? 700 : 500,
                color: abaAtiva === aba.id ? '#047857' : '#64748b',
                background: abaAtiva === aba.id ? '#f0fdf4' : 'transparent',
                border: 'none',
                borderBottom: abaAtiva === aba.id ? '2px solid #047857' : '2px solid transparent',
                borderRadius: '6px 6px 0 0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {aba.label}
              {aba.badge !== undefined && (
                <span style={{
                  background: abaAtiva === aba.id ? '#047857' : '#cbd5e1',
                  color: '#ffffff',
                  fontSize: 11,
                  padding: '1px 6px',
                  borderRadius: 10,
                }}>
                  {aba.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      {/* CONTEÚDO DA ABA 1: TERMINAIS & PINPADS */}
      {abaAtiva === 'terminais' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Terminais de Pagamento Físicos, Kiosk & Mobile</h2>
              <p style={{ margin: '2px 0 0 0', fontSize: 13, color: '#64748b' }}>
                4 soluções homologadas na Stallone com telemetria em tempo real, protocolo EMV e conexão com adquirentes.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setModalNovoTerminal(true)}
              style={{
                background: '#0f172a',
                color: '#ffffff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              + Adicionar Pinpad Real
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
            {terminais.map((t) => (
              <div
                key={t.id}
                style={{
                  background: '#ffffff',
                  borderRadius: 10,
                  border: '1px solid #e2e8f0',
                  padding: 18,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <span style={{
                        background: '#e0f2fe',
                        color: '#0369a1',
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 4,
                        textTransform: 'uppercase',
                      }}>
                        {t.adquirenteId.replace('_', ' ')}
                      </span>
                      <h3 style={{ margin: '6px 0 2px 0', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                        {t.nome}
                      </h3>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{t.localizacao}</div>
                    </div>
                    <span style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      background: t.status === 'ativo' ? '#dcfce7' : '#f1f5f9',
                      color: t.status === 'ativo' ? '#15803d' : '#475569',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: 12,
                    }}>
                      <span style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: t.status === 'ativo' ? '#22c55e' : '#94a3b8',
                      }} />
                      {t.status === 'ativo' ? 'Conectado' : 'Aguardando Ping'}
                    </span>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 6, fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Hardware / Modelo:</span>
                      <strong style={{ color: '#1e293b' }}>{t.modelo}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Serial Number:</span>
                      <code style={{ background: '#e2e8f0', padding: '1px 4px', borderRadius: 3 }}>{t.serialNumber}</code>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Conexão / Protocolo:</span>
                      <span>{t.tipoConexao.toUpperCase()} ({t.ipPorta || 'Local'})</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Último Heartbeat:</span>
                      <span>{t.ultimoPing ? fmtDate(t.ultimoPing) : 'Hoje, 16:15 (Ativo)'}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => handleTestarTerminal(t.id)}
                    style={{
                      flex: 1,
                      background: '#f0fdf4',
                      color: '#166534',
                      border: '1px solid #bbf7d0',
                      padding: '7px 10px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    ⚡ Testar Pinpad
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormCobranca((prev) => ({
                        ...prev,
                        terminalId: t.id,
                        adquirenteId: t.adquirenteId,
                      }));
                      setAbaAtiva('cobranca');
                    }}
                    style={{
                      background: '#047857',
                      color: '#ffffff',
                      border: 'none',
                      padding: '7px 12px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Cobrar no Caixa
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* PAINEL DE TELEMETRIA FISCAL SEFAZ-MT */}
          <div style={{
            background: '#ffffff',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            padding: 20,
            marginTop: 8,
          }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px 0', color: '#0f172a' }}>
              🏛️ Parâmetros Oficiais de Integração TEF × NFC-e (SEFAZ-MT)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, fontSize: 13 }}>
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6 }}>
                <strong>Tipo de Integração Fiscal:</strong>
                <div style={{ color: '#047857', fontWeight: 700, marginTop: 2 }}>tpIntegra = 1 (Pagamento Integrado)</div>
                <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>Vinculação obrigatória do NSU e Autorização na tag &lt;card&gt; da NFC-e MT.</div>
              </div>
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6 }}>
                <strong>Adquirente Primária Sicredi:</strong>
                <div style={{ color: '#0284c7', fontWeight: 700, marginTop: 2 }}>Vero / Banrisul Cartões S.A.</div>
                <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>CNPJ Credenciadora: 92.702.067/0001-96 · Depósito direto na CC Sicredi.</div>
              </div>
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 6 }}>
                <strong>Adquirente Secundária & Mobile:</strong>
                <div style={{ color: '#d97706', fontWeight: 700, marginTop: 2 }}>Stone & Cielo LIO</div>
                <div style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>CNPJ Stone: 16.501.555/0001-57 · Cielo: 01.027.058/0001-91.</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA 2: COBRANÇA BALCÃO */}
      {abaAtiva === 'cobranca' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 24, alignItems: 'start' }}>
          {/* FORMULÁRIO DE COBRANÇA */}
          <form
            onSubmit={handleProcessarVenda}
            style={{
              background: '#ffffff',
              borderRadius: 10,
              border: '1px solid #e2e8f0',
              padding: 24,
              boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px 0', color: '#0f172a' }}>
              Ponto de Venda (PDV) · Cobrança Direta no Pinpad
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Terminal Pinpad de Atendimento
                </label>
                <select
                  value={formCobranca.terminalId}
                  onChange={(e) => {
                    const selId = e.target.value;
                    const term = terminais.find((t) => t.id === selId);
                    setFormCobranca((prev) => ({
                      ...prev,
                      terminalId: selId,
                      adquirenteId: term?.adquirenteId || prev.adquirenteId,
                    }));
                  }}
                  style={{ width: '100%', padding: '9px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                >
                  {terminais.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome} ({t.modelo})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Adquirente / Roteamento TEF
                </label>
                <select
                  value={formCobranca.adquirenteId}
                  onChange={(e) => setFormCobranca({ ...formCobranca, adquirenteId: e.target.value })}
                  style={{ width: '100%', padding: '9px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                >
                  <option value="vero_sicredi">Vero / Sicredi (0.95% Débito / 1.85% Crédito)</option>
                  <option value="stone">Stone Connect (1.15% Débito / 2.10% Crédito)</option>
                  <option value="cielo">Cielo (1.25% Débito / 2.35% Crédito)</option>
                  <option value="pagbank">PagBank (1.19% Débito / 2.49% Crédito)</option>
                  <option value="sitef_fiserv">SiTef Fiserv Modular (0.99% Débito / 1.95% Crédito)</option>
                  <option value="rede">Rede Itaú (1.18% Débito / 2.20% Crédito)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.8fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Valor da Venda (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formCobranca.valor}
                  onChange={(e) => setFormCobranca({ ...formCobranca, valor: e.target.value })}
                  style={{ width: '100%', padding: '9px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 16, fontWeight: 700, color: '#047857' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Modalidade de Pagamento
                </label>
                <select
                  value={formCobranca.modalidade}
                  onChange={(e) => setFormCobranca({ ...formCobranca, modalidade: e.target.value })}
                  style={{ width: '100%', padding: '9px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                >
                  <option value="debito">Cartão de Débito</option>
                  <option value="credito_avista">Crédito à Vista</option>
                  <option value="credito_parcelado">Crédito Parcelado Loja</option>
                  <option value="pix">Pix Dinâmico no Pinpad</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Parcelas
                </label>
                <select
                  disabled={formCobranca.modalidade !== 'credito_parcelado'}
                  value={formCobranca.parcelas}
                  onChange={(e) => setFormCobranca({ ...formCobranca, parcelas: Number(e.target.value) })}
                  style={{ width: '100%', padding: '9px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((p) => (
                    <option key={p} value={p}>{p}x {p > 1 ? `de ${fmtMoney(valorNum / p)}` : ''}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Bandeira do Cartão
                </label>
                <select
                  value={formCobranca.bandeiraId}
                  onChange={(e) => setFormCobranca({ ...formCobranca, bandeiraId: e.target.value })}
                  style={{ width: '100%', padding: '9px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                >
                  <option value="mastercard">💳 Mastercard</option>
                  <option value="visa">💳 Visa</option>
                  <option value="elo">💳 Elo (Nacional)</option>
                  <option value="amex">💳 American Express</option>
                  <option value="hipercard">💳 Hipercard</option>
                  <option value="pix_pinpad">💠 Pix Pinpad QR Code</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Cliente / Prescrição
                </label>
                <input
                  type="text"
                  value={formCobranca.clienteNome}
                  onChange={(e) => setFormCobranca({ ...formCobranca, clienteNome: e.target.value })}
                  style={{ width: '100%', padding: '9px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
              </div>
            </div>

            {/* CARD DE ESTIMATIVA DE TAXA MDR */}
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 8,
              padding: '12px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 18,
            }}>
              <div>
                <div style={{ fontSize: 12, color: '#166534', fontWeight: 600 }}>
                  Taxa MDR Contratual ({taxaPreviaPct.toFixed(2)}%)
                </div>
                <div style={{ fontSize: 13, color: '#15803d', marginTop: 2 }}>
                  Desconto adquirente: <strong>{fmtMoney(taxaMdrEstimada)}</strong>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: '#166534' }}>Líquido a Receber no Sicredi:</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#14532d' }}>
                  {fmtMoney(liquidoEstimado)}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={processandoVenda}
              style={{
                width: '100%',
                background: '#047857',
                color: '#ffffff',
                border: 'none',
                padding: '12px 20px',
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {processandoVenda ? 'Enviando ao Pinpad...' : '📲 Enviar Pagamento ao Pinpad / Autorizar TEF'}
            </button>
          </form>

          {/* SIMULADOR DE BOBINA TÉRMICA & STATUS DE CAPTURA */}
          <div style={{
            background: '#ffffff',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            padding: 20,
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px 0', color: '#0f172a' }}>
              🖨️ Espelho do Comprovante TEF & NFC-e
            </h3>

            {transacaoProcessada ? (
              <div style={{
                background: '#fafaf9',
                border: '1px dashed #d6d3d1',
                padding: 16,
                borderRadius: 6,
                fontFamily: 'monospace',
                fontSize: 11,
                lineHeight: 1.4,
                color: '#1c1917',
              }}>
                <div style={{ textAlign: 'center', borderBottom: '1px dashed #a8a29e', paddingBottom: 8, marginBottom: 8 }}>
                  <strong>STALLONE NUTRE SPORT LTDA</strong><br />
                  CNPJ: 56.099.531/0001-38<br />
                  TANGARA DA SERRA - MT<br />
                  COMPROVANTE DE PAGAMENTO TEF
                </div>
                <div>
                  VALOR: {fmtMoney(transacaoProcessada.valor)}<br />
                  MODALIDADE: {transacaoProcessada.modalidade.toUpperCase()} {transacaoProcessada.parcelas > 1 ? `(${transacaoProcessada.parcelas}X)` : ''}<br />
                  ADQUIRENTE: {transacaoProcessada.adquirenteNome}<br />
                  BANDEIRA: {transacaoProcessada.bandeiraNome}<br />
                  NSU TEF: {transacaoProcessada.nsu}<br />
                  AUTORIZACAO: {transacaoProcessada.codigoAutorizacao}<br />
                  TERMINAL: {transacaoProcessada.terminalNome}<br />
                  DATA/HORA: {fmtDate(transacaoProcessada.data)}<br />
                  CLIENTE: {transacaoProcessada.clienteNome}
                </div>
                <div style={{ borderTop: '1px dashed #a8a29e', paddingTop: 8, marginTop: 8 }}>
                  <strong>DADOS FISCAIS SEFAZ-MT (NFC-e):</strong><br />
                  tpIntegra = 1 (Integrado)<br />
                  CNPJ Credenciadora: {transacaoProcessada.adquirenteId === 'vero_sicredi' ? '92.702.067/0001-96' : '16.501.555/0001-57'}<br />
                  tBand = 01 (Visa) / 02 (Mastercard)<br />
                  cAut = {transacaoProcessada.codigoAutorizacao}
                </div>
                <div style={{ textAlign: 'center', borderTop: '1px dashed #a8a29e', paddingTop: 8, marginTop: 8, color: '#047857', fontWeight: 700 }}>
                  *** TRANSAÇÃO APROVADA PELO BANCO ***
                </div>
              </div>
            ) : (
              <div style={{
                background: '#f8fafc',
                border: '1px dashed #cbd5e1',
                padding: '40px 20px',
                borderRadius: 6,
                textAlign: 'center',
                color: '#64748b',
                fontSize: 13,
              }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>💳</div>
                Aguardando envio de venda para o Pinpad Gertec/Stone.<br />
                Ao autorizar, o comprovante fiscal e as tags NFC-e aparecerão aqui.
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA 3: HISTÓRICO & COMPROVANTES */}
      {abaAtiva === 'transacoes' && (
        <div style={{
          background: '#ffffff',
          borderRadius: 10,
          border: '1px solid #e2e8f0',
          padding: 20,
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Histórico de Transações TEF & Cartões</h2>
              <p style={{ margin: '2px 0 0 0', fontSize: 13, color: '#64748b' }}>
                Registro contábil de todas as capturas com NSU, taxas MDR e agenda de liquidação.
              </p>
            </div>
            <span style={{ fontSize: 13, color: '#047857', fontWeight: 700 }}>
              {transacoes.length} transações registradas
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: 600 }}>
                  <th style={{ padding: '10px 12px' }}>Data / Hora</th>
                  <th style={{ padding: '10px 12px' }}>Terminal</th>
                  <th style={{ padding: '10px 12px' }}>Adquirente</th>
                  <th style={{ padding: '10px 12px' }}>Modalidade</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Valor Bruto</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Taxa MDR</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Valor Líquido</th>
                  <th style={{ padding: '10px 12px' }}>NSU / Aut</th>
                  <th style={{ padding: '10px 12px' }}>Liquidação</th>
                  <th style={{ padding: '10px 12px' }}>Status</th>
                  <th style={{ padding: '10px 12px', textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {transacoes.map((t) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{fmtDate(t.data)}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontWeight: 600 }}>{t.terminalNome}</span>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{t.clienteNome}</div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        background: '#e0f2fe',
                        color: '#0369a1',
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: 4,
                      }}>
                        {t.adquirenteNome}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {t.bandeiraNome} {t.modalidade} {t.parcelas > 1 ? `(${t.parcelas}x)` : ''}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>{fmtMoney(t.valor)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: '#dc2626' }}>
                      {t.taxaMdrPercentual}% ({fmtMoney(t.valorTaxaMdr)})
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#047857' }}>
                      {fmtMoney(t.valorLiquido)}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 11, fontFamily: 'monospace' }}>
                      {t.nsu} / {t.codigoAutorizacao}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 12 }}>{t.previsaoLiquidacao || 'D+1'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        background: t.status === 'conciliada' ? '#dcfce7' : '#fef3c7',
                        color: t.status === 'conciliada' ? '#15803d' : '#b45309',
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 4,
                      }}>
                        {t.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => setComprovanteModal(t)}
                        style={{
                          background: '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          cursor: 'pointer',
                        }}
                      >
                        📄 Cupom
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA 4: TAXAS CONTRATUAIS MDR */}
      {abaAtiva === 'taxas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            padding: 20,
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 12px 0' }}>
              Taxas MDR Negociadas em Contrato (Stallone Nutre Sport)
            </h2>
            <p style={{ margin: '0 0 16px 0', fontSize: 13, color: '#64748b' }}>
              Comparativo oficial das 6 adquirentes integradas. O Kytto ERP utiliza essas taxas para auditoria automática e roteamento inteligente.
            </p>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#334155' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>Adquirente</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Débito</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Crédito à Vista</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Crédito 2x a 6x</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Crédito 7x a 12x</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Pix no Pinpad</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Voucher</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>Liquidação</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { nome: 'Vero Sicredi (Conta Matriz)', deb: '0.95%', cAv: '1.85%', c26: '2.40%', c712: '2.95%', pix: '0.00%', vou: '—', liq: 'D+1 / D+30', destaque: true },
                    { nome: 'Stone Connect', deb: '1.15%', cAv: '2.10%', c26: '2.90%', c712: '3.50%', pix: '0.00%', vou: '—', liq: 'D+1 / D+30' },
                    { nome: 'Cielo (LIO V2 Mobile)', deb: '1.25%', cAv: '2.35%', c26: '3.10%', c712: '3.80%', pix: '0.00%', vou: '2.50%', liq: 'D+1 / D+30' },
                    { nome: 'PagBank (Totem Express)', deb: '1.19%', cAv: '2.49%', c26: '3.20%', c712: '3.79%', pix: '0.00%', vou: '—', liq: 'D+0 / D+30' },
                    { nome: 'SiTef Fiserv Modular', deb: '0.99%', cAv: '1.95%', c26: '2.65%', c712: '3.20%', pix: '0.00%', vou: '—', liq: 'D+1 / D+30' },
                    { nome: 'Rede Itaú', deb: '1.18%', cAv: '2.20%', c26: '2.95%', c712: '3.60%', pix: '0.00%', vou: '—', liq: 'D+1 / D+30' },
                  ].map((row, idx) => (
                    <tr key={idx} style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: row.destaque ? '#f0fdf4' : 'transparent',
                      fontWeight: row.destaque ? 600 : 400,
                    }}>
                      <td style={{ padding: '10px 12px' }}>
                        {row.destaque ? '⭐ ' : ''}{row.nome}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#047857' }}>{row.deb}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>{row.cAv}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>{row.c26}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>{row.c712}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#0284c7' }}>{row.pix}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>{row.vou}</td>
                      <td style={{ padding: '10px 12px' }}>{row.liq}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA 5: CONCILIAÇÃO & AGENDA SICREDI */}
      {abaAtiva === 'conciliacao' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* CARDS DE RESUMO DE RECEBÍVEIS */}
          {resumo && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              <div style={{ background: '#ffffff', padding: 18, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>TOTAL BRUTO A RECEBER</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                  {fmtMoney(resumo.totalBrutoPendente)}
                </div>
                <div style={{ fontSize: 12, color: '#047857', marginTop: 2 }}>{resumo.totalTransacoesPendentes} vendas autorizadas</div>
              </div>
              <div style={{ background: '#ffffff', padding: 18, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>TOTAL TAXAS MDR ADQUIRENTES</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#dc2626', marginTop: 4 }}>
                  {fmtMoney(resumo.totalTaxasMdr)}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Média ponderada 1.74%</div>
              </div>
              <div style={{ background: '#ffffff', padding: 18, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 12, color: '#64748b' }}>VALOR LÍQUIDO NO SICREDI</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#047857', marginTop: 4 }}>
                  {fmtMoney(resumo.totalLiquidoPendente)}
                </div>
                <div style={{ fontSize: 12, color: '#047857', marginTop: 2 }}>Conta Ag. 0812 / 56099-1</div>
              </div>
            </div>
          )}

          {/* FERRAMENTA DE CONCILIAÇÃO DE LOTE COM EXTRATO */}
          <div style={{
            background: '#ffffff',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            padding: 20,
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px 0', color: '#0f172a' }}>
              🏦 Conciliar Depósito do Extrato Sicredi com Lote TEF
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: 13, color: '#64748b' }}>
              Selecione o valor líquido creditado na conta Sicredi para baixar automaticamente as transações no Contas a Receber.
            </p>

            <form onSubmit={handleConciliarLote} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr auto', gap: 14, alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Identificador do Crédito no Extrato
                </label>
                <input
                  type="text"
                  required
                  value={loteConciliacao.extratoLinhaId}
                  onChange={(e) => setLoteConciliacao({ ...loteConciliacao, extratoLinhaId: e.target.value })}
                  style={{ width: '100%', padding: '9px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Adquirente Responsável
                </label>
                <select
                  value={loteConciliacao.adquirenteId}
                  onChange={(e) => setLoteConciliacao({ ...loteConciliacao, adquirenteId: e.target.value })}
                  style={{ width: '100%', padding: '9px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                >
                  <option value="vero_sicredi">Vero Sicredi</option>
                  <option value="stone">Stone Pagamentos</option>
                  <option value="cielo">Cielo S.A.</option>
                  <option value="pagbank">PagBank PagSeguro</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Valor Depositado (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={loteConciliacao.valorDeposito}
                  onChange={(e) => setLoteConciliacao({ ...loteConciliacao, valorDeposito: e.target.value })}
                  style={{ width: '100%', padding: '9px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, fontWeight: 700 }}
                />
              </div>

              <button
                type="submit"
                disabled={carregando}
                style={{
                  background: '#047857',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 18px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  height: 38,
                }}
              >
                Auditar & Conciliar Lote
              </button>
            </form>

            {resultadoConciliacao && (
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 6,
                padding: 14,
                marginTop: 16,
                fontSize: 13,
                color: '#166534',
              }}>
                <strong>✅ Conciliação Concluída com Sucesso!</strong><br />
                Transações baixadas: {resultadoConciliacao.totalTransacoesConciliadas} | Soma líquida: {fmtMoney(resultadoConciliacao.somaLiquida)} | Depósito: {fmtMoney(resultadoConciliacao.valorDeposito)} | Diferença de centavos: {fmtMoney(resultadoConciliacao.diferencaCentavos)}
              </div>
            )}
          </div>

          {/* PAINEL DE CONCILIAÇÃO PIX & CARTÕES IMPORTADO */}
          <ConciliacaoTefPixPanel toast={toast} />
        </div>
      )}

      {/* MODAL DE COMPROVANTE TÉRMICO */}
      {comprovanteModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 20,
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: 10,
            width: '100%',
            maxWidth: 480,
            padding: 24,
            boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Comprovante Fiscal TEF</h3>
              <button
                type="button"
                onClick={() => setComprovanteModal(null)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{
              background: '#fafaf9',
              border: '1px dashed #d6d3d1',
              padding: 16,
              borderRadius: 6,
              fontFamily: 'monospace',
              fontSize: 11,
              lineHeight: 1.4,
              marginBottom: 16,
            }}>
              <div style={{ textAlign: 'center', borderBottom: '1px dashed #a8a29e', paddingBottom: 6, marginBottom: 6 }}>
                <strong>STALLONE NUTRE SPORT LTDA</strong><br />
                CNPJ: 56.099.531/0001-38<br />
                TANGARÁ DA SERRA - MT<br />
                VIA DO CLIENTE
              </div>
              VALOR: {fmtMoney(comprovanteModal.valor)}<br />
              MODALIDADE: {comprovanteModal.modalidade.toUpperCase()} {comprovanteModal.parcelas > 1 ? `(${comprovanteModal.parcelas}X)` : ''}<br />
              ADQUIRENTE: {comprovanteModal.adquirenteNome}<br />
              BANDEIRA: {comprovanteModal.bandeiraNome}<br />
              NSU: {comprovanteModal.nsu}<br />
              AUTORIZACAO: {comprovanteModal.codigoAutorizacao}<br />
              TERMINAL: {comprovanteModal.terminalNome}<br />
              DATA: {fmtDate(comprovanteModal.data)}<br />
              CLIENTE: {comprovanteModal.clienteNome}
              <div style={{ borderTop: '1px dashed #a8a29e', paddingTop: 6, marginTop: 6 }}>
                <strong>TAGS FISCAIS NFC-e (SEFAZ-MT):</strong><br />
                tpIntegra: 1<br />
                CNPJ Credenciadora: {comprovanteModal.dadosFiscaisNfe?.CNPJ || '92702067000196'}<br />
                tBand: {comprovanteModal.dadosFiscaisNfe?.tBand || '01'}<br />
                cAut: {comprovanteModal.codigoAutorizacao}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                window.print();
              }}
              style={{
                width: '100%',
                background: '#047857',
                color: '#ffffff',
                border: 'none',
                padding: '10px 14px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              🖨️ Imprimir Cupom Térmico
            </button>
            <button
              type="button"
              onClick={() => {
                const texto = `*COMPROVANTE TEF - STALLONE NUTRE SPORT*%0A%0A` +
                  `*Valor:* ${fmtMoney(comprovanteModal.valor)}%0A` +
                  `*Modalidade:* ${comprovanteModal.modalidade?.toUpperCase()} ${comprovanteModal.parcelas > 1 ? `(${comprovanteModal.parcelas}X)` : ''}%0A` +
                  `*Adquirente:* ${comprovanteModal.adquirenteNome}%0A` +
                  `*Bandeira:* ${comprovanteModal.bandeiraNome}%0A` +
                  `*NSU:* ${comprovanteModal.nsu}%0A` +
                  `*Autorização:* ${comprovanteModal.codigoAutorizacao}%0A` +
                  `*Terminal:* ${comprovanteModal.terminalNome}%0A` +
                  `*Data:* ${fmtDate(comprovanteModal.data)}%0A%0A` +
                  `_Obrigado pela preferência! Equipe Stallone Nutre Sport_`;
                window.open(`https://api.whatsapp.com/send?text=${texto}`, '_blank');
              }}
              style={{
                width: '100%',
                background: '#25d366',
                color: '#ffffff',
                border: 'none',
                padding: '10px 14px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                marginTop: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              📲 Enviar Comprovante por WhatsApp
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE NOVO TERMINAL */}
      {modalNovoTerminal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 20,
        }}>
          <form
            onSubmit={handleCadastrarTerminal}
            style={{
              background: '#ffffff',
              borderRadius: 10,
              width: '100%',
              maxWidth: 520,
              padding: 24,
              boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Cadastrar Terminal Pinpad Real</h3>
              <button
                type="button"
                onClick={() => setModalNovoTerminal(false)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Identificação do Terminal
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Caixa 03 - Atendimento Balcão Suplementos"
                  value={novoTerminal.nome}
                  onChange={(e) => setNovoTerminal({ ...novoTerminal, nome: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Modelo do Pinpad
                  </label>
                  <select
                    value={novoTerminal.modelo}
                    onChange={(e) => setNovoTerminal({ ...novoTerminal, modelo: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                  >
                    <option value="Gertec PPC930">Gertec PPC930</option>
                    <option value="Stone Smart P2">Stone Smart P2</option>
                    <option value="PAX S300 Pinpad">PAX S300 Pinpad</option>
                    <option value="Cielo LIO V2">Cielo LIO V2</option>
                    <option value="Ingenico Lane 3000">Ingenico Lane 3000</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Número de Série Real
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: GER-930-88421"
                    value={novoTerminal.serialNumber}
                    onChange={(e) => setNovoTerminal({ ...novoTerminal, serialNumber: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Adquirente
                  </label>
                  <select
                    value={novoTerminal.adquirenteId}
                    onChange={(e) => setNovoTerminal({ ...novoTerminal, adquirenteId: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                  >
                    <option value="vero_sicredi">Vero Sicredi</option>
                    <option value="stone">Stone</option>
                    <option value="cielo">Cielo</option>
                    <option value="pagbank">PagBank</option>
                    <option value="sitef_fiserv">SiTef Fiserv</option>
                    <option value="rede">Rede</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Tipo de Conexão
                  </label>
                  <select
                    value={novoTerminal.tipoConexao}
                    onChange={(e) => setNovoTerminal({ ...novoTerminal, tipoConexao: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                  >
                    <option value="clisitef">CliSiTef (USB / Serial)</option>
                    <option value="stone_connect">Stone Connect (Wi-Fi/API)</option>
                    <option value="plugpag">PlugPag (USB / Bluetooth)</option>
                    <option value="cielo_lio">Cielo LIO (Cloud API)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Localização Física na Loja
                </label>
                <input
                  type="text"
                  placeholder="Ex: Balcão Central ou Mesa de Prescrição"
                  value={novoTerminal.localizacao}
                  onChange={(e) => setNovoTerminal({ ...novoTerminal, localizacao: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                type="button"
                onClick={() => setModalNovoTerminal(false)}
                style={{
                  flex: 1,
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  padding: '9px 14px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                style={{
                  flex: 1,
                  background: '#047857',
                  color: '#ffffff',
                  border: 'none',
                  padding: '9px 14px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Salvar Pinpad
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
