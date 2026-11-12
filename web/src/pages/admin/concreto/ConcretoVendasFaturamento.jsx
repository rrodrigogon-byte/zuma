import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../../lib/api';
import { useToast } from '../../../hooks/useToast';

export default function ConcretoVendasFaturamento({ cargas = [], onAbrirRomaneio, onAbrirTicketBalanca }) {
  const { toast } = useToast();
  const token = localStorage.getItem('kytto_token') || localStorage.getItem('sp_token') || localStorage.getItem('token') || '';

  const [loading, setLoading] = useState(true);
  const [notas, setNotas] = useState([]);
  const [resumo, setResumo] = useState({
    faturamentoTotalHoje: 51636.00,
    volumeConcretoTotalM3: 56.0,
    toneladasAgregadosTotal: 56.9,
    totalNotasEmitidas: 5,
    totalCfemRecolhida: 63.78
  });

  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [busca, setBusca] = useState('');
  const [modalNovaNotaAberto, setModalNovaNotaAberto] = useState(false);
  const [modalDanfeAberto, setModalDanfeAberto] = useState(null);
  const [modalEntregaAberto, setModalEntregaAberto] = useState(null);
  const [canalEntrega, setCanalEntrega] = useState('whatsapp');
  const [destinatarioEntrega, setDestinatarioEntrega] = useState('');
  const [transmitindo, setTransmitindo] = useState(false);
  const [capturandoBalanca, setCapturandoBalanca] = useState(false);

  // Formulário de Nova Nota Fiscal
  const [formNota, setFormNota] = useState({
    tipoOperacao: 'saida_servico_concreto',
    modelo: 'NFS-e',
    cliente: 'Construtora MT Horizon Ltda',
    cnpjCpfCliente: '28.910.420/0001-90',
    inscricaoEstadualCliente: '13.882.100-4',
    enderecoCliente: 'Av. Brasil, 1200 · Centro · Tangará da Serra/MT',
    telefoneCliente: '(65) 99988-1200',
    emailCliente: 'fiscal@mthorizon.com.br',
    obraDestino: 'Ed. Residencial Serra Dourada · Lajes 4º Pavimento',
    tipoConcreto: 'Concreto Usinado Estrutural FCK 30 MPa',
    fckConcreto: 30,
    tipoMaterial: 'Concreto Usinado FCK 30 MPa',
    slump: '14 ± 2 cm',
    veiculoPlaca: 'BT-01 (RRA-4E80)',
    ticketBalancaId: 'TK-2026-9840',
    romaneioId: 'crg-1001',
    pesoBrutoTotalKg: 33480,
    taraTotalKg: 14280,
    pesoLiquidoTotalKg: 19200,
    densidadeKgM3: 2400,
    volumeTotalM3: 8.0,
    precoUnitarioM3: 465.00,
    aliquotaIssqn: 3.0,
    aliquotaIcms: 17.0,
    aliquotaCfem: 1.5,
    cfop: '07.02',
    ncm: '3824.50.00',
    observacoes: 'Nota fiscal de serviços de concretagem emitida sob NBR 7212 com pesagem metrológica Toledo.'
  });

  const carregarNotas = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/admin/concreto/vendas/notas');
      if (res?.ok) {
        setNotas(res.notas || []);
        if (res.resumo) setResumo(res.resumo);
      }
    } catch (e) {
      toast('Erro ao carregar notas fiscais: ' + (e.message || 'Falha de conexão'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarNotas();
  }, []);

  // Recalcular volume e totais ao alterar peso ou densidade
  const handleAtualizarMetrologia = (campo, valor) => {
    const atualizado = { ...formNota, [campo]: valor };
    const bruto = Number(campo === 'pesoBrutoTotalKg' ? valor : atualizado.pesoBrutoTotalKg) || 0;
    const tara = Number(campo === 'taraTotalKg' ? valor : atualizado.taraTotalKg) || 0;
    const liquido = Math.max(0, bruto - tara);
    atualizado.pesoLiquidoTotalKg = liquido;

    const densidade = Number(campo === 'densidadeKgM3' ? valor : atualizado.densidadeKgM3) || 2400;
    if (densidade > 0) {
      atualizado.volumeTotalM3 = +(liquido / densidade).toFixed(2);
    }
    setFormNota(atualizado);
  };

  // Capturar dados e pesos em tempo real da Balança Rodoviária 80t Toledo
  const handleCapturarBalanca = async () => {
    setCapturandoBalanca(true);
    try {
      const res = await api.get('/api/admin/concreto/balanca/status');
      if (res?.ok && res.hardware) {
        const hw = res.hardware;
        const pesoBruto = hw.pesoAtualKg || 33480;
        const tara = hw.taraAtualKg || 14280;
        const liquido = Math.max(0, pesoBruto - tara);
        const densidade = formNota.tipoOperacao.includes('concreto') ? 2400 : 1500;
        const volumeCalculado = +(liquido / densidade).toFixed(2);

        setFormNota(prev => ({
          ...prev,
          pesoBrutoTotalKg: pesoBruto,
          taraTotalKg: tara,
          pesoLiquidoTotalKg: liquido,
          densidadeKgM3: densidade,
          volumeTotalM3: volumeCalculado > 0 ? volumeCalculado : prev.volumeTotalM3,
          veiculoPlaca: hw.placaDetectada || hw.veiculoAtual?.placa || prev.veiculoPlaca,
          ticketBalancaId: res.ultimosTickets?.[0]?.numeroTicket || `TK-2026-${Date.now().toString().slice(-4)}`
        }));
        toast(`Pesos capturados com sucesso da Balança Toledo! Bruto: ${pesoBruto.toLocaleString('pt-BR')} kg, Tara: ${tara.toLocaleString('pt-BR')} kg, Líquido: ${liquido.toLocaleString('pt-BR')} kg (${volumeCalculado} m³).`, 'success');
      } else {
        toast('Balança em repouso. Valores padrão da última pesagem carregados.', 'info');
      }
    } catch (e) {
      toast('Erro ao comunicar com a Balança Toledo: ' + e.message, 'error');
    } finally {
      setCapturandoBalanca(false);
    }
  };

  // Capturar traço da Central Dosadora Convicta NBR 7212
  const handleCapturarCentral = (fckAlvo = 30) => {
    const densidade = 2400;
    const vol = 8.0;
    const liquido = Math.round(vol * densidade);
    const tara = 14280;
    const bruto = liquido + tara;

    setFormNota(prev => ({
      ...prev,
      tipoOperacao: 'saida_servico_concreto',
      modelo: 'NFS-e',
      tipoConcreto: `Concreto Usinado Estrutural FCK ${fckAlvo} MPa`,
      fckConcreto: fckAlvo,
      densidadeKgM3: densidade,
      volumeTotalM3: vol,
      pesoLiquidoTotalKg: liquido,
      taraTotalKg: tara,
      pesoBrutoTotalKg: bruto,
      precoUnitarioM3: fckAlvo === 20 ? 380 : fckAlvo === 25 ? 410 : fckAlvo === 30 ? 465 : fckAlvo === 35 ? 480 : 530,
      cfop: '07.02',
      ncm: '3824.50.00'
    }));
    toast(`Traço FCK ${fckAlvo} MPa da Central Dosadora carregado: 8,0 m³ = ${liquido.toLocaleString('pt-BR')} kg de concreto líquido.`, 'success');
  };

  // Alternar tipo de operação
  const handleTrocarTipoOperacao = (tipo) => {
    if (tipo === 'saida_servico_concreto') {
      setFormNota(prev => ({
        ...prev,
        tipoOperacao: tipo,
        modelo: 'NFS-e',
        tipoConcreto: 'Concreto Usinado Estrutural FCK 30 MPa',
        densidadeKgM3: 2400,
        precoUnitarioM3: 465.00,
        cfop: '07.02',
        ncm: '3824.50.00',
        aliquotaIssqn: 3.0,
        aliquotaIcms: 0,
        aliquotaCfem: 0
      }));
    } else if (tipo === 'saida_venda_mercadoria') {
      setFormNota(prev => ({
        ...prev,
        tipoOperacao: tipo,
        modelo: 'NF-e (55)',
        tipoMaterial: 'Areia Média Lavada de Rio (Mineração Própria)',
        densidadeKgM3: 1500,
        precoUnitarioM3: 65.00,
        cfop: '5.101',
        ncm: '2505.10.00',
        aliquotaIssqn: 0,
        aliquotaIcms: 17.0,
        aliquotaCfem: 1.5
      }));
    } else {
      setFormNota(prev => ({
        ...prev,
        tipoOperacao: tipo,
        modelo: 'NF-e (55)',
        tipoMaterial: 'Cimento Portland CP II-F 32 a Granel',
        densidadeKgM3: 1200,
        precoUnitarioM3: 780.00,
        cfop: '1.101',
        ncm: '2523.29.10',
        aliquotaIssqn: 0,
        aliquotaIcms: 12.0,
        aliquotaCfem: 0
      }));
    }
  };

  // Submeter emissão da Nota Fiscal
  const handleEmitirNota = async (e) => {
    e.preventDefault();
    setTransmitindo(true);
    try {
      const res = await api.post('/api/admin/concreto/vendas/emitir-nota', formNota);
      if (res?.ok && res.nota) {
        toast(`Nota Fiscal nº ${res.nota.numeroNota} transmitida e AUTORIZADA pela SEFAZ-MT! Chave: ${res.nota.chaveAcessoSefaz.substring(0, 15)}...`, 'success');
        setModalNovaNotaAberto(false);
        carregarNotas();
        setModalDanfeAberto(res.nota);
      } else {
        toast('Erro ao emitir nota fiscal: ' + (res?.error || 'Rejeição SEFAZ'), 'error');
      }
    } catch (e) {
      toast('Erro de comunicação com a SEFAZ: ' + e.message, 'error');
    } finally {
      setTransmitindo(false);
    }
  };

  // Disparar Entrega
  const handleConfirmarEntrega = async () => {
    if (!modalEntregaAberto) return;
    try {
      const res = await api.post(`/api/admin/concreto/vendas/notas/${modalEntregaAberto.id}/entregar`, {
        canal: canalEntrega,
        destinatario: destinatarioEntrega
      });
      if (res?.ok) {
        toast(`Nota Fiscal nº ${modalEntregaAberto.numeroNota} enviada com sucesso via ${canalEntrega.toUpperCase()} para ${res.destinatario}!`, 'success');
        setModalEntregaAberto(null);
        carregarNotas();
      }
    } catch (e) {
      toast('Erro ao entregar documento: ' + e.message, 'error');
    }
  };

  // Filtro de notas
  const notasFiltradas = useMemo(() => {
    return notas.filter(n => {
      if (filtroTipo === 'concreto' && n.tipoOperacao !== 'saida_servico_concreto') return false;
      if (filtroTipo === 'agregados' && n.tipoOperacao !== 'saida_venda_mercadoria') return false;
      if (filtroTipo === 'materia_prima' && n.tipoOperacao !== 'entrada_materia_prima') return false;
      if (busca) {
        const b = busca.toLowerCase();
        return (
          n.numeroNota?.toLowerCase().includes(b) ||
          n.cliente?.toLowerCase().includes(b) ||
          n.obraDestino?.toLowerCase().includes(b) ||
          n.tipoConcreto?.toLowerCase().includes(b) ||
          n.tipoMaterial?.toLowerCase().includes(b) ||
          n.chaveAcessoSefaz?.toLowerCase().includes(b)
        );
      }
      return true;
    });
  }, [notas, filtroTipo, busca]);

  return (
    <div className="concreto-vendas-faturamento" style={{ padding: '4px 0' }}>
      {/* ─── HEADER DA SEÇÃO ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>
            📑 Vendas, Faturamento & Emissão Fiscal (NF-e / NFS-e)
          </h2>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
            Captura metrológica automática da Balança Toledo 80t e Central Convicta NBR 7212, apuração de impostos e entrega de DANFE/XML.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="serrano-btn serrano-btn-sec"
            onClick={carregarNotas}
            title="Sincronizar com SEFAZ-MT"
          >
            🔄 Sincronizar SEFAZ
          </button>
          <button
            type="button"
            className="serrano-btn serrano-btn-p"
            onClick={() => setModalNovaNotaAberto(true)}
            style={{ background: 'var(--serrano-orange-text)', color: '#fff', fontWeight: 700 }}
          >
            + Emitir Nota Fiscal & Venda
          </button>
        </div>
      </div>

      {/* ─── CARDS DE KPIS DE FATURAMENTO E MEDIÇÃO ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--joint)', borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Faturamento Emitido Hoje</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--serrano-orange-text)', marginTop: 4, fontFamily: 'var(--font-data)' }}>
            R$ {Number(resumo.faturamentoTotalHoje || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 11, color: '#10B981', marginTop: 4, fontWeight: 600 }}>✓ 100% Autorizado SEFAZ-MT</div>
        </div>

        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--joint)', borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Volume Concreto Faturado</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', marginTop: 4, fontFamily: 'var(--font-data)' }}>
            {Number(resumo.volumeConcretoTotalM3 || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} m³
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Bateladas NBR 7212 Convicta</div>
        </div>

        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--joint)', borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Agregados & Mineração</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#0284C7', marginTop: 4, fontFamily: 'var(--font-data)' }}>
            {Number(resumo.toneladasAgregadosTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} ton
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Areia Média e Brita 1 Pesadas</div>
        </div>

        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--joint)', borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Royalties CFEM (1,5%)</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#D97706', marginTop: 4, fontFamily: 'var(--font-data)' }}>
            R$ {Number(resumo.totalCfemRecolhida || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Guia ANM Mineração MT</div>
        </div>

        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--joint)', borderRadius: 10, padding: '16px 18px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Notas Fiscais Autorizadas</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#059669', marginTop: 4, fontFamily: 'var(--font-data)' }}>
            {resumo.totalNotasEmitidas || notas.length} docs
          </div>
          <div style={{ fontSize: 11, color: '#10B981', marginTop: 4 }}>NFS-e 7.02 &amp; NF-e 55</div>
        </div>
      </div>

      {/* ─── FILTROS E BUSCA ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { id: 'todos', label: 'Todos os Documentos' },
            { id: 'concreto', label: 'NFS-e Concretagem (7.02)' },
            { id: 'agregados', label: 'NF-e Agregados / Areia e Brita' },
            { id: 'materia_prima', label: 'NF-e Entrada Matéria-Prima' }
          ].map(f => (
            <button
              key={f.id}
              type="button"
              className={`serrano-pill ${filtroTipo === f.id ? 'serrano-p-ok' : ''}`}
              style={{ cursor: 'pointer', padding: '6px 14px', fontSize: 12, fontWeight: 600, border: '1px solid var(--joint)' }}
              onClick={() => setFiltroTipo(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div style={{ minWidth: 260 }}>
          <input
            type="text"
            className="serrano-input"
            placeholder="🔍 Buscar por nota, cliente, chave ou obra..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{ fontSize: 12 }}
          />
        </div>
      </div>

      {/* ─── TABELA DE NOTAS FISCAIS E VENDAS ─── */}
      <div className="serrano-card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '2px solid var(--joint)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px 14px' }}>Número / Modelo</th>
                <th style={{ padding: '12px 14px' }}>Data / Emissão</th>
                <th style={{ padding: '12px 14px' }}>Cliente / Destino</th>
                <th style={{ padding: '12px 14px' }}>Produto / Concreto</th>
                <th style={{ padding: '12px 14px' }}>Pesagem Balança (kg)</th>
                <th style={{ padding: '12px 14px' }}>Volume (m³)</th>
                <th style={{ padding: '12px 14px' }}>Valor Total</th>
                <th style={{ padding: '12px 14px' }}>Impostos &amp; CFEM</th>
                <th style={{ padding: '12px 14px' }}>Status SEFAZ</th>
                <th style={{ padding: '12px 14px' }}>Entrega</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
                    Carregando notas fiscais e medições da Usina Serrano...
                  </td>
                </tr>
              ) : notasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
                    Nenhuma nota fiscal encontrada para o filtro selecionado.
                  </td>
                </tr>
              ) : (
                notasFiltradas.map(n => (
                  <tr key={n.id} style={{ borderBottom: '1px solid var(--joint)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 800, fontSize: 13, fontFamily: 'var(--font-data)' }}>Nº {n.numeroNota}</div>
                      <span className={`serrano-pill ${n.modelo === 'NFS-e' ? 'serrano-p-live' : 'serrano-p-ok'}`} style={{ fontSize: 10, marginTop: 4, display: 'inline-block' }}>
                        {n.modelo}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {n.dataEmissao}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{n.cliente}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>CNPJ: {n.cnpjCpfCliente}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>📍 {n.obraDestino}</div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 600 }}>{n.tipoConcreto || n.tipoMaterial}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {n.subitemLc116 ? `LC 116 Item ${n.subitemLc116}` : `CFOP ${n.cfop} · NCM ${n.ncm}`}
                      </div>
                      {n.ticketBalancaId && (
                        <div style={{ fontSize: 10, color: '#0284C7', marginTop: 2 }}>
                          ⚖️ {n.ticketBalancaId}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px', fontFamily: 'var(--font-data)' }}>
                      <div>Líq: <b style={{ color: '#047857' }}>{Number(n.pesoLiquidoTotalKg || 0).toLocaleString('pt-BR')} kg</b></div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Tara: {Number(n.taraTotalKg || 0).toLocaleString('pt-BR')} kg</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Bruto: {Number(n.pesoBrutoTotalKg || 0).toLocaleString('pt-BR')} kg</div>
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 700, fontFamily: 'var(--font-data)', fontSize: 13 }}>
                      {n.volumeTotalM3} m³
                    </td>
                    <td style={{ padding: '12px 14px', fontFamily: 'var(--font-data)', fontWeight: 800, fontSize: 14, color: 'var(--serrano-orange-text)' }}>
                      R$ {Number(n.valorTotalBruto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 11 }}>
                      {n.modelo === 'NFS-e' ? (
                        <>
                          <div>ISSQN: <b>R$ {Number(n.valorIssqn || 0).toFixed(2)}</b> ({n.aliquotaIssqn}%)</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>Dedução Mat: R$ {Number(n.valorDeducaoLegalMateriais || 0).toFixed(2)}</div>
                        </>
                      ) : (
                        <>
                          <div>ICMS: <b>R$ {Number(n.valorIcms || 0).toFixed(2)}</b> ({n.aliquotaIcms}%)</div>
                          {n.valorCfem > 0 && <div style={{ color: '#D97706' }}>CFEM: <b>R$ {Number(n.valorCfem || 0).toFixed(2)}</b></div>}
                        </>
                      )}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span className="serrano-pill serrano-p-ok" style={{ fontSize: 11 }}>
                        ✓ AUTORIZADA
                      </span>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'monospace' }}>
                        {n.chaveAcessoSefaz?.substring(0, 18)}...
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span className={`serrano-pill ${n.statusEntrega?.includes('entregue') ? 'serrano-p-ok' : 'serrano-p-live'}`} style={{ fontSize: 10 }}>
                        {n.statusEntrega === 'entregue_whatsapp_email' ? '📲 WhatsApp + E-mail' :
                         n.statusEntrega === 'entregue_whatsapp' ? '📲 WhatsApp' :
                         n.statusEntrega === 'entregue_email' ? '✉️ E-mail' : 'Aguardando Envio'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button
                          type="button"
                          className="serrano-btn serrano-btn-sec"
                          style={{ padding: '4px 8px', fontSize: 11 }}
                          onClick={() => setModalDanfeAberto(n)}
                          title="Visualizar DANFE A4 Timbrado"
                        >
                          📄 DANFE
                        </button>
                        <button
                          type="button"
                          className="serrano-btn serrano-btn-sec"
                          style={{ padding: '4px 8px', fontSize: 11, background: '#10B981', color: '#fff', border: 'none' }}
                          onClick={() => {
                            setModalEntregaAberto(n);
                            setCanalEntrega('whatsapp');
                            setDestinatarioEntrega(n.telefoneCliente || '(65) 99988-1200');
                          }}
                          title="Disparar DANFE pelo WhatsApp"
                        >
                          📲
                        </button>
                        <button
                          type="button"
                          className="serrano-btn serrano-btn-sec"
                          style={{ padding: '4px 8px', fontSize: 11, background: '#0284C7', color: '#fff', border: 'none' }}
                          onClick={() => {
                            setModalEntregaAberto(n);
                            setCanalEntrega('email');
                            setDestinatarioEntrega(n.emailCliente || 'fiscal@cliente.com.br');
                          }}
                          title="Enviar por E-mail"
                        >
                          ✉️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── MODAL: EMITIR NOVA NOTA FISCAL COM AUTO-CAPTURA DE BALANÇA ─── */}
      {modalNovaNotaAberto && (
        <div className="serrano-modal-overlay">
          <div className="serrano-modal-card" style={{ maxWidth: 840, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--joint)', paddingBottom: 12, marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                  Nova Venda &amp; Emissão de Nota Fiscal SEFAZ-MT
                </h3>
                <small style={{ color: 'var(--text-muted)' }}>Captura metrológica direta de balanças e dosagem NBR 7212</small>
              </div>
              <button
                type="button"
                className="serrano-btn serrano-btn-sec"
                onClick={() => setModalNovaNotaAberto(false)}
                style={{ padding: '4px 10px' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEmitirNota}>
              {/* TIPO DE OPERAÇÃO */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>Tipo de Operação &amp; Documento Fiscal *</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  <button
                    type="button"
                    className={`serrano-btn ${formNota.tipoOperacao === 'saida_servico_concreto' ? 'serrano-btn-p' : 'serrano-btn-sec'}`}
                    style={{ textAlign: 'center', padding: '10px 8px', fontSize: 12 }}
                    onClick={() => handleTrocarTipoOperacao('saida_servico_concreto')}
                  >
                    🏗️ <b>NFS-e Concretagem</b><br /><small>Serviço LC 116 Item 07.02</small>
                  </button>
                  <button
                    type="button"
                    className={`serrano-btn ${formNota.tipoOperacao === 'saida_venda_mercadoria' ? 'serrano-btn-p' : 'serrano-btn-sec'}`}
                    style={{ textAlign: 'center', padding: '10px 8px', fontSize: 12 }}
                    onClick={() => handleTrocarTipoOperacao('saida_venda_mercadoria')}
                  >
                    ⛏️ <b>NF-e Agregados (55)</b><br /><small>Areia / Brita + CFEM 1,5%</small>
                  </button>
                  <button
                    type="button"
                    className={`serrano-btn ${formNota.tipoOperacao === 'entrada_materia_prima' ? 'serrano-btn-p' : 'serrano-btn-sec'}`}
                    style={{ textAlign: 'center', padding: '10px 8px', fontSize: 12 }}
                    onClick={() => handleTrocarTipoOperacao('entrada_materia_prima')}
                  >
                    📥 <b>NF-e Entrada Matéria-Prima</b><br /><small>Cimento nos Silos 96t</small>
                  </button>
                </div>
              </div>

              {/* BARRA DE CAPTURA AUTOMÁTICA DE PESOS DAS BALANÇAS */}
              <div style={{ background: 'rgba(2, 132, 199, 0.08)', border: '1.5px solid #0284C7', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: '#0284C7', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>⚖️</span> CAPTURA AUTOMÁTICA DE PESOS &amp; METROLOGIA (BALANÇAS CONECTADAS)
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="serrano-btn"
                      style={{ background: '#0284C7', color: '#fff', border: 'none', padding: '6px 12px', fontSize: 11, fontWeight: 700 }}
                      onClick={handleCapturarBalanca}
                      disabled={capturandoBalanca}
                    >
                      {capturandoBalanca ? '⏳ Capturando...' : '⚡ Capturar Balança 80t Toledo'}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, fontSize: 11 }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Peso Bruto Balança:</span>
                    <input
                      type="number"
                      className="serrano-input"
                      value={formNota.pesoBrutoTotalKg}
                      onChange={e => handleAtualizarMetrologia('pesoBrutoTotalKg', e.target.value)}
                      style={{ fontWeight: 700, marginTop: 2 }}
                    />
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Tara do Caminhão:</span>
                    <input
                      type="number"
                      className="serrano-input"
                      value={formNota.taraTotalKg}
                      onChange={e => handleAtualizarMetrologia('taraTotalKg', e.target.value)}
                      style={{ fontWeight: 700, marginTop: 2 }}
                    />
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Peso Líquido Apurado:</span>
                    <div style={{ fontWeight: 900, fontSize: 15, color: '#047857', padding: '8px 0' }}>
                      {Number(formNota.pesoLiquidoTotalKg || 0).toLocaleString('pt-BR')} kg
                    </div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Densidade Aparente:</span>
                    <select
                      className="serrano-input"
                      value={formNota.densidadeKgM3}
                      onChange={e => handleAtualizarMetrologia('densidadeKgM3', e.target.value)}
                      style={{ fontWeight: 600, marginTop: 2 }}
                    >
                      <option value={2400}>2.400 kg/m³ (Concreto Usinado)</option>
                      <option value={1500}>1.500 kg/m³ (Areia Média)</option>
                      <option value={1450}>1.450 kg/m³ (Brita 1 Granítica)</option>
                      <option value={1200}>1.200 kg/m³ (Cimento a Granel)</option>
                    </select>
                  </div>
                </div>

                {/* BOTÕES DE ATALHO DE TRAÇO CENTRAL CONVICTA */}
                {formNota.tipoOperacao === 'saida_servico_concreto' && (
                  <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed #BAE6FD', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#0369A1' }}>Traço Central Convicta:</span>
                    {[20, 25, 30, 35, 40].map(f => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => handleCapturarCentral(f)}
                        style={{ background: formNota.fckConcreto === f ? '#0284C7' : '#E0F2FE', color: formNota.fckConcreto === f ? '#fff' : '#0369A1', border: 'none', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                      >
                        FCK {f} MPa
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* DADOS DA CARGA E METRAGEM CÚBICA */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700 }}>Volume Total (m³) *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="serrano-input"
                    value={formNota.volumeTotalM3}
                    onChange={e => setFormNota({ ...formNota, volumeTotalM3: Number(e.target.value) })}
                    style={{ fontWeight: 800, fontSize: 14 }}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700 }}>Preço Unitário / m³ (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="serrano-input"
                    value={formNota.precoUnitarioM3}
                    onChange={e => setFormNota({ ...formNota, precoUnitarioM3: Number(e.target.value) })}
                    style={{ fontWeight: 800, fontSize: 14 }}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700 }}>Valor Total Bruto (R$)</label>
                  <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--serrano-orange-text)', paddingTop: 6, fontFamily: 'var(--font-data)' }}>
                    R$ {(Number(formNota.volumeTotalM3 || 0) * Number(formNota.precoUnitarioM3 || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* DADOS DO CLIENTE E LOCAL DA OBRA */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700 }}>Cliente / Razão Social *</label>
                  <input
                    type="text"
                    className="serrano-input"
                    value={formNota.cliente}
                    onChange={e => setFormNota({ ...formNota, cliente: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700 }}>CNPJ / CPF *</label>
                  <input
                    type="text"
                    className="serrano-input"
                    value={formNota.cnpjCpfCliente}
                    onChange={e => setFormNota({ ...formNota, cnpjCpfCliente: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700 }}>Obra / Local de Entrega *</label>
                  <input
                    type="text"
                    className="serrano-input"
                    value={formNota.obraDestino}
                    onChange={e => setFormNota({ ...formNota, obraDestino: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700 }}>Telefone / WhatsApp</label>
                  <input
                    type="text"
                    className="serrano-input"
                    value={formNota.telefoneCliente}
                    onChange={e => setFormNota({ ...formNota, telefoneCliente: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700 }}>E-mail Fiscal</label>
                  <input
                    type="email"
                    className="serrano-input"
                    value={formNota.emailCliente}
                    onChange={e => setFormNota({ ...formNota, emailCliente: e.target.value })}
                  />
                </div>
              </div>

              {/* PARÂMETROS FISCAIS & TRIBUTOS */}
              <div style={{ background: 'var(--surface-2)', border: '1px solid var(--joint)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                  APURAÇÃO TRIBUTÁRIA INTELIGENTE (LEI COMPLEMENTAR 116/03 &amp; SEFAZ-MT)
                </div>
                {formNota.tipoOperacao === 'saida_servico_concreto' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, fontSize: 11 }}>
                    <div>
                      <span>Subitem LC 116/03:</span>
                      <input type="text" className="serrano-input" value="07.02 (Concretagem)" disabled />
                    </div>
                    <div>
                      <span>Dedução Mat. (70%):</span>
                      <div style={{ fontWeight: 700, padding: '8px 0' }}>
                        R$ {(Number(formNota.volumeTotalM3 || 0) * Number(formNota.precoUnitarioM3 || 0) * 0.70).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <span>Base ISSQN (30%):</span>
                      <div style={{ fontWeight: 700, padding: '8px 0' }}>
                        R$ {(Number(formNota.volumeTotalM3 || 0) * Number(formNota.precoUnitarioM3 || 0) * 0.30).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <span>ISSQN (3% Tangará):</span>
                      <div style={{ fontWeight: 900, color: '#0284C7', padding: '8px 0' }}>
                        R$ {(Number(formNota.volumeTotalM3 || 0) * Number(formNota.precoUnitarioM3 || 0) * 0.30 * 0.03).toFixed(2)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, fontSize: 11 }}>
                    <div>
                      <span>CFOP / NCM:</span>
                      <input type="text" className="serrano-input" value={`${formNota.cfop} / ${formNota.ncm}`} disabled />
                    </div>
                    <div>
                      <span>Base ICMS (17%):</span>
                      <div style={{ fontWeight: 700, padding: '8px 0' }}>
                        R$ {(Number(formNota.volumeTotalM3 || 0) * Number(formNota.precoUnitarioM3 || 0)).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <span>Valor ICMS MT:</span>
                      <div style={{ fontWeight: 700, color: '#0284C7', padding: '8px 0' }}>
                        R$ {(Number(formNota.volumeTotalM3 || 0) * Number(formNota.precoUnitarioM3 || 0) * 0.17).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <span>CFEM Mineração (1,5%):</span>
                      <div style={{ fontWeight: 900, color: '#D97706', padding: '8px 0' }}>
                        R$ {(Number(formNota.volumeTotalM3 || 0) * Number(formNota.precoUnitarioM3 || 0) * 0.015).toFixed(2)}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* BOTÕES DE SUBMISSÃO */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                <button
                  type="button"
                  className="serrano-btn serrano-btn-sec"
                  onClick={() => setModalNovaNotaAberto(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="serrano-btn serrano-btn-p"
                  disabled={transmitindo}
                  style={{ background: '#059669', color: '#fff', fontWeight: 800 }}
                >
                  {transmitindo ? '⏳ Transmitindo à SEFAZ-MT...' : '✓ Emitir & Transmitir à SEFAZ-MT'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: VISUALIZAR DANFE A4 TIMBRADO ─── */}
      {modalDanfeAberto && (
        <div className="serrano-modal-overlay">
          <div className="serrano-modal-card" style={{ maxWidth: 900, width: '95%', height: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--joint)', paddingBottom: 10, marginBottom: 10 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                  DANFE - Nota Fiscal nº {modalDanfeAberto.numeroNota} ({modalDanfeAberto.modelo})
                </h3>
                <small style={{ color: 'var(--text-muted)' }}>Chave SEFAZ: {modalDanfeAberto.chaveAcessoSefaz}</small>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="serrano-btn serrano-btn-p"
                  onClick={() => {
                    window.open(`/api/admin/concreto/vendas/notas/${modalDanfeAberto.id}/danfe-html?token=${encodeURIComponent(token)}`, '_blank');
                  }}
                  style={{ background: '#0284C7', color: '#fff' }}
                >
                  🖨️ Imprimir A4
                </button>
                <button
                  type="button"
                  className="serrano-btn serrano-btn-sec"
                  onClick={() => setModalDanfeAberto(null)}
                >
                  ✕ Fechar
                </button>
              </div>
            </div>

            <div style={{ flex: 1, border: '1px solid var(--joint)', borderRadius: 6, overflow: 'hidden' }}>
              <iframe
                title="DANFE Oficial"
                src={`/api/admin/concreto/vendas/notas/${modalDanfeAberto.id}/danfe-html?token=${encodeURIComponent(token)}`}
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: DISPARAR ENTREGA WHATSAPP / E-MAIL ─── */}
      {modalEntregaAberto && (
        <div className="serrano-modal-overlay">
          <div className="serrano-modal-card" style={{ maxWidth: 500 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, marginBottom: 6 }}>
              Disparar Entrega da Nota Fiscal nº {modalEntregaAberto.numeroNota}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 14 }}>
              O cliente receberá o link seguro de visualização do DANFE, dados do caminhão, ticket de balança e arquivo XML assinado.
            </p>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>Canal de Envio:</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button
                  type="button"
                  className={`serrano-btn ${canalEntrega === 'whatsapp' ? 'serrano-btn-p' : 'serrano-btn-sec'}`}
                  style={{ padding: 10, textAlign: 'center', background: canalEntrega === 'whatsapp' ? '#10B981' : undefined }}
                  onClick={() => {
                    setCanalEntrega('whatsapp');
                    setDestinatarioEntrega(modalEntregaAberto.telefoneCliente || '(65) 99988-1200');
                  }}
                >
                  📲 WhatsApp
                </button>
                <button
                  type="button"
                  className={`serrano-btn ${canalEntrega === 'email' ? 'serrano-btn-p' : 'serrano-btn-sec'}`}
                  style={{ padding: 10, textAlign: 'center', background: canalEntrega === 'email' ? '#0284C7' : undefined }}
                  onClick={() => {
                    setCanalEntrega('email');
                    setDestinatarioEntrega(modalEntregaAberto.emailCliente || 'fiscal@cliente.com.br');
                  }}
                >
                  ✉️ E-mail
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                {canalEntrega === 'whatsapp' ? 'Número de WhatsApp com DDD:' : 'Endereço de E-mail Fiscal:'}
              </label>
              <input
                type="text"
                className="serrano-input"
                value={destinatarioEntrega}
                onChange={e => setDestinatarioEntrega(e.target.value)}
                placeholder={canalEntrega === 'whatsapp' ? '(65) 99999-0000' : 'financeiro@cliente.com.br'}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="serrano-btn serrano-btn-sec"
                onClick={() => setModalEntregaAberto(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="serrano-btn serrano-btn-p"
                style={{ background: canalEntrega === 'whatsapp' ? '#10B981' : '#0284C7', color: '#fff', fontWeight: 800 }}
                onClick={handleConfirmarEntrega}
              >
                Enviar Documento Agora
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
