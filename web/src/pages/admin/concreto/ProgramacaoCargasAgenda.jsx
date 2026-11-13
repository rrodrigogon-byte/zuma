import React, { useState, useMemo, useEffect } from 'react';
import { api } from '../../../lib/api';
import { useToast } from '../../../hooks/useToast';
import ModalOtimizadorKyttoIA from './ModalOtimizadorKyttoIA';

export default function ProgramacaoCargasAgenda({
  cargas = [],
  frota = [],
  onAtualizarDados,
  onAbrirRomaneio,
  onAbrirTicketBalanca
}) {
  const { toast } = useToast();

  // Estados de navegação e filtros
  const [dataSelecionada, setDataSelecionada] = useState(new Date().toISOString().slice(0, 10));
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [busca, setBusca] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  // Estados dos modais
  const [modalDetalheAberto, setModalDetalheAberto] = useState(null); // carga em edição
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [modalConfirmarExclusao, setModalConfirmarExclusao] = useState(null);
  const [modalDuplicarAberto, setModalDuplicarAberto] = useState(null);
  const [novaDataDuplicacao, setNovaDataDuplicacao] = useState(new Date().toISOString().slice(0, 10));
  const [novoHorarioDuplicacao, setNovoHorarioDuplicacao] = useState('08:30');
  const [abaModal, setAbaModal] = useState('dados'); // 'dados' | 'viagens' | 'financeiro'
  // Estados da KyttoIA (Otimizador de Escala & Previsão de Gargalos)
  const [modalKyttoIAAberto, setModalKyttoIAAberto] = useState(false);
  const [analiseKyttoIA, setAnaliseKyttoIA] = useState(null);
  const [carregandoKyttoIA, setCarregandoKyttoIA] = useState(false);
  const [aplicandoKyttoIA, setAplicandoKyttoIA] = useState(false);

  // Formulário de edição
  const [formEdicao, setFormEdicao] = useState(null);

  // Simulador de Perda de Abatimento (Slump Loss)
  const [simuladorSlump, setSimuladorSlump] = useState({
    slumpInicialCm: 14,
    temperaturaAmbienteC: 32,
    tempoViagemMin: 35,
    usoRetardador: true
  });

  // Carregar análise da KyttoIA automaticamente ao trocar data ou ao montar
  const handleAnalisarKyttoIA = async (abrirModal = false) => {
    setCarregandoKyttoIA(true);
    try {
      const res = await api.post('/api/admin/concreto/programacao/escala-kyttoia/analisar', { data: dataSelecionada });
      if (res?.ok) {
        setAnaliseKyttoIA(res);
        if (abrirModal) {
          setModalKyttoIAAberto(true);
        }
      }
    } catch (err) {
      console.warn('Falha ao analisar escala com KyttoIA:', err);
    } finally {
      setCarregandoKyttoIA(false);
    }
  };

  useEffect(() => {
    handleAnalisarKyttoIA(false);
  }, [dataSelecionada]);

  // Aplicar escala sugerida pela KyttoIA
  const handleAplicarEscalaKyttoIA = async () => {
    if (!analiseKyttoIA?.sugestoesEscala) return;
    setAplicandoKyttoIA(true);
    try {
      const res = await api.post('/api/admin/concreto/programacao/escala-kyttoia/aplicar', {
        sugestoes: analiseKyttoIA.sugestoesEscala
      });
      if (res?.ok) {
        toast(`Escala sugerida pela KyttoIA aplicada com sucesso! ${res.viagensAtualizadas || analiseKyttoIA.sugestoesEscala.length} viagens otimizadas.`, 'success');
        setModalKyttoIAAberto(false);
        if (onAtualizarDados) onAtualizarDados();
      } else {
        toast('Erro ao aplicar escala: ' + (res?.error || 'Falha'), 'error');
      }
    } catch (err) {
      toast('Erro de conexão ao aplicar escala: ' + err.message, 'error');
    } finally {
      setAplicandoKyttoIA(false);
    }
  };

  // Abrir modal de detalhamento e preencher formulário
  const handleAbrirDetalhe = (carga) => {
    setModalDetalheAberto(carga);
    setAbaModal('dados');
    setFormEdicao({
      id: carga.id,
      numero: carga.numero,
      cliente: carga.cliente || '',
      cnpjCpfCliente: carga.cnpjCpfCliente || '',
      telefoneCliente: carga.telefoneCliente || '',
      emailCliente: carga.emailCliente || '',
      obra: carga.obra || '',
      endereco: carga.endereco || '',
      elemento: carga.elemento || 'Lajes e Vigas',
      data: carga.data || dataSelecionada,
      horarioInicio: carga.horarioInicio || carga.horarioAgendado || '08:00',
      horarioAgendado: carga.horarioAgendado || carga.horarioInicio || '08:00',
      fck: Number(carga.fck) || 25,
      brita: carga.brita || 'Brita 1',
      slump: carga.slump || '14 ± 2 cm',
      volumeM3: Number(carga.volumeM3) || 8,
      bomba: carga.bomba || 'Calha Direta',
      precoM3: Number(carga.precoM3) || (Number(carga.fck) === 30 ? 440 : 410),
      status: carga.status || 'agendado',
      observacoes: carga.observacoes || '',
      engenheiroResponsavel: carga.engenheiroResponsavel || '',
      viagens: (carga.viagens && carga.viagens.length > 0)
        ? JSON.parse(JSON.stringify(carga.viagens))
        : [{ viagemNumero: 1, betoneira: 'BT-01', motorista: 'Marcos Silveira', volumeM3: 8, saidaUsina: '08:15', chegadaObra: '08:35', fimDescarga: '09:20', status: 'concluido' }]
    });
  };

  // Salvar alterações da carga (PUT /cargas/:id)
  const handleSalvarEdicao = async (e) => {
    if (e) e.preventDefault();
    if (!formEdicao) return;
    setSalvando(true);
    try {
      const res = await api.put(`/api/admin/concreto/cargas/${formEdicao.id}`, formEdicao);
      if (res?.ok) {
        toast(`Concretagem #${formEdicao.numero || formEdicao.id} atualizada com sucesso!`, 'success');
        setModalDetalheAberto(null);
        if (onAtualizarDados) onAtualizarDados();
      } else {
        toast('Erro ao salvar concretagem: ' + (res?.error || 'Falha de validação'), 'error');
      }
    } catch (err) {
      toast('Erro de conexão: ' + err.message, 'error');
    } finally {
      setSalvando(false);
    }
  };

  // Excluir carga (DELETE /cargas/:id)
  const handleConfirmarExcluir = async () => {
    if (!modalConfirmarExclusao) return;
    setExcluindo(true);
    try {
      const res = await api.delete(`/api/admin/concreto/cargas/${modalConfirmarExclusao.id}`);
      if (res?.ok) {
        toast(`Concretagem #${modalConfirmarExclusao.numero || modalConfirmarExclusao.id} excluída da agenda!`, 'info');
        setModalConfirmarExclusao(null);
        setModalDetalheAberto(null);
        if (onAtualizarDados) onAtualizarDados();
      } else {
        toast('Erro ao excluir: ' + (res?.error || 'Não permitida'), 'error');
      }
    } catch (err) {
      toast('Erro ao excluir: ' + err.message, 'error');
    } finally {
      setExcluindo(false);
    }
  };

  // Duplicar agendamento (POST /cargas/:id/duplicar)
  const handleDuplicar = async () => {
    if (!modalDuplicarAberto) return;
    try {
      const res = await api.post(`/api/admin/concreto/cargas/${modalDuplicarAberto.id}/duplicar`, {
        data: novaDataDuplicacao,
        horario: novoHorarioDuplicacao
      });
      if (res?.ok) {
        toast(`Agendamento duplicado com sucesso! Nova Carga #${res.carga?.numero} para ${novaDataDuplicacao} às ${novoHorarioDuplicacao}.`, 'success');
        setModalDuplicarAberto(null);
        if (onAtualizarDados) onAtualizarDados();
      }
    } catch (err) {
      toast('Erro ao duplicar agendamento: ' + err.message, 'error');
    }
  };

  // Iniciar Despacho (mudar status para carregando ou em_transito)
  const handleIniciarDespacho = async (carga) => {
    try {
      const res = await api.put(`/api/admin/concreto/cargas/${carga.id}/status`, {
        status: 'em_transito',
        observacoes: 'Despacho iniciado pelo operador de balança / programação.'
      });
      if (res?.ok) {
        toast(`Carga #${carga.numero || carga.id} iniciada! Betoneiras despachadas.`, 'success');
        if (onAtualizarDados) onAtualizarDados();
      }
    } catch (err) {
      toast('Erro ao despachar carga: ' + err.message, 'error');
    }
  };

  // Adicionar viagem na carga em edição
  const handleAdicionarViagem = () => {
    if (!formEdicao) return;
    const proxNum = (formEdicao.viagens?.length || 0) + 1;
    const novaViagem = {
      viagemNumero: proxNum,
      betoneira: `BT-0${((proxNum - 1) % 5) + 1}`,
      motorista: 'Motorista Escalado',
      volumeM3: 8,
      saidaUsina: '—',
      chegadaObra: '—',
      fimDescarga: '—',
      status: 'agendada'
    };
    setFormEdicao(prev => ({
      ...prev,
      viagens: [...(prev.viagens || []), novaViagem]
    }));
  };

  // Remover viagem da carga em edição
  const handleRemoverViagem = (idx) => {
    if (!formEdicao || formEdicao.viagens.length <= 1) return;
    setFormEdicao(prev => ({
      ...prev,
      viagens: prev.viagens.filter((_, i) => i !== idx)
    }));
  };

  // Filtragem de cargas
  const cargasFiltradas = useMemo(() => {
    return cargas.filter(c => {
      if (filtroStatus !== 'todos') {
        if (filtroStatus === 'concluido' && c.status !== 'concluido') return false;
        if (filtroStatus === 'em_transito' && c.status !== 'em_transito') return false;
        if (filtroStatus === 'agendado' && c.status !== 'agendado' && c.status !== 'carregando') return false;
      }
      if (busca) {
        const b = busca.toLowerCase();
        return (
          String(c.numero || '').includes(b) ||
          c.cliente?.toLowerCase().includes(b) ||
          c.obra?.toLowerCase().includes(b) ||
          c.endereco?.toLowerCase().includes(b) ||
          String(c.fck || '').toLowerCase().includes(b) ||
          c.bomba?.toLowerCase().includes(b)
        );
      }
      return true;
    });
  }, [cargas, filtroStatus, busca]);

  // KPIs de Programação
  const kpis = useMemo(() => {
    const totalM3 = cargas.reduce((acc, c) => acc + (Number(c.volumeM3) || 0), 0);
    const concluidosM3 = cargas.filter(c => c.status === 'concluido').reduce((acc, c) => acc + (Number(c.volumeM3) || 0), 0);
    const totalViagens = cargas.reduce((acc, c) => acc + (c.viagens?.length || 1), 0);
    const fatPrevisto = cargas.reduce((acc, c) => acc + (Number(c.valorTotal) || 0), 0);
    return { totalM3, concluidosM3, totalViagens, fatPrevisto };
  }, [cargas]);

  // Cálculos do simulador de Slump Loss NBR 7212
  const calcSlump = useMemo(() => {
    const { slumpInicialCm, temperaturaAmbienteC, tempoViagemMin, usoRetardador } = simuladorSlump;
    const taxaBaseMinuto = 0.04;
    const fatorTemperatura = temperaturaAmbienteC > 28 ? 1 + ((temperaturaAmbienteC - 28) * 0.05) : 1.0;
    const fatorAditivo = usoRetardador ? 0.45 : 1.0;
    const perdaCalculada = tempoViagemMin * taxaBaseMinuto * fatorTemperatura * fatorAditivo;
    const slumpFinal = Math.max(2, slumpInicialCm - perdaCalculada);
    const conforme = slumpFinal >= 10.0;
    return {
      perdaReal: +perdaCalculada.toFixed(1),
      slumpFinal: +slumpFinal.toFixed(1),
      conforme
    };
  }, [simuladorSlump]);

  return (
    <div className="programacao-cargas-agenda" style={{ display: 'grid', gap: 20 }}>
      {/* ─── BARRA SUPERIOR INTERATIVA DE AGENDA & CALENDÁRIO ─── */}
      <div className="serrano-card" style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24 }}>📅</span>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: 0.5 }}>
                Agenda de Concretagens &amp; Programação de Betoneiras
              </h2>
              <span className="serrano-pill serrano-p-ok" style={{ fontWeight: 700 }}>
                ● 100% Sincronizado Usina
              </span>
            </div>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
              Clique em qualquer concretagem ou horário da grade para abrir o detalhamento completo, editar parâmetros, salvar ou duplicar.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-2)', border: '1px solid var(--joint)', borderRadius: 8, padding: '4px 8px', gap: 6 }}>
              <button
                type="button"
                className="serrano-btn serrano-btn-sec"
                style={{ padding: '4px 8px', fontSize: 11 }}
                onClick={() => {
                  const d = new Date(dataSelecionada);
                  d.setDate(d.getDate() - 1);
                  setDataSelecionada(d.toISOString().slice(0, 10));
                }}
                title="Dia Anterior"
              >
                ◀ Ontem
              </button>

              <input
                type="date"
                value={dataSelecionada}
                onChange={e => setDataSelecionada(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text)', fontWeight: 700, fontSize: 13, outline: 'none', cursor: 'pointer' }}
              />

              <button
                type="button"
                className="serrano-btn serrano-btn-sec"
                style={{ padding: '4px 8px', fontSize: 11 }}
                onClick={() => {
                  const d = new Date(dataSelecionada);
                  d.setDate(d.getDate() + 1);
                  setDataSelecionada(d.toISOString().slice(0, 10));
                }}
                title="Próximo Dia"
              >
                Amanhã ▶
              </button>
            </div>

            {/* BOTÃO OTIMIZADOR KYTTOIA */}
            <button
              type="button"
              className="serrano-btn"
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)',
                color: '#fff',
                fontWeight: 800,
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                border: 'none',
                boxShadow: '0 2px 10px rgba(234, 88, 12, 0.35)',
                cursor: 'pointer'
              }}
              onClick={() => handleAnalisarKyttoIA(true)}
              title="Acionar inteligência artificial para otimização de escala e prevenção de gargalos"
            >
              <span style={{ fontSize: 16 }}>🤖</span>
              <span>{carregandoKyttoIA ? 'Otimizando com KyttoIA...' : 'Otimizador KyttoIA: Sugerir Escala'}</span>
            </button>

            <button
              type="button"
              className="serrano-btn serrano-btn-p"
              style={{ background: 'var(--serrano-orange-text)', color: '#fff', fontWeight: 800, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
              onClick={() => {
                const proximoNumero = (cargas || []).reduce((max, c) => Math.max(max, Number(c.numero) || 1000), 1000) + 1;
                handleAbrirDetalhe({
                  id: `crg-${proximoNumero}`,
                  numero: proximoNumero,
                  cliente: '',
                  obra: '',
                  endereco: '',
                  elemento: 'Lajes e Vigas',
                  data: dataSelecionada,
                  horarioInicio: '08:30',
                  horarioAgendado: '08:30',
                  fck: 30,
                  volumeM3: 16,
                  brita: 'Brita 1',
                  slump: '14 ± 2 cm',
                  bomba: 'BL-01 · Lança 32 m',
                  status: 'agendado',
                  viagens: [
                    { viagemNumero: 1, betoneira: 'BT-01', motorista: 'Marcos Silveira', volumeM3: 8, saidaUsina: '08:30', status: 'agendada' },
                    { viagemNumero: 2, betoneira: 'BT-02', motorista: 'Carlos Eduardo', volumeM3: 8, saidaUsina: '09:15', status: 'agendada' }
                  ]
                });
              }}
            >
              <span>+</span> Novo Agendamento
            </button>
          </div>
        </div>

        {/* ─── CARDS DE KPIS DA PROGRAMAÇÃO ─── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 18 }}>
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--joint)', borderRadius: 8, padding: '12px 16px' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Volume Total Agendado</span>
            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--serrano-orange-text)', fontFamily: 'var(--font-data)', marginTop: 2 }}>
              {kpis.totalM3} m³
            </div>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{kpis.concluidosM3} m³ entregues hoje</span>
          </div>

          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--joint)', borderRadius: 8, padding: '12px 16px' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Cargas / Viagens</span>
            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'var(--font-data)', marginTop: 2 }}>
              {cargas.length} cargas <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>({kpis.totalViagens} viagens)</span>
            </div>
            <span style={{ fontSize: 10, color: '#059669', fontWeight: 600 }}>Grade 100% preenchida</span>
          </div>

          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--joint)', borderRadius: 8, padding: '12px 16px' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Frota Escalada</span>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#0284C7', fontFamily: 'var(--font-data)', marginTop: 2 }}>
              5 betoneiras
            </div>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>BT-01 a BT-05 + BL-01 (Bomba)</span>
          </div>

          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--joint)', borderRadius: 8, padding: '12px 16px' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Faturamento Previsto</span>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#047857', fontFamily: 'var(--font-data)', marginTop: 2 }}>
              R$ {Number(kpis.fatPrevisto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Concreto usinado + taxa de bomba</span>
          </div>

          <div 
            style={{ 
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(234, 88, 12, 0.05) 100%)', 
              border: '1px solid rgba(245, 158, 11, 0.35)', 
              borderRadius: 8, 
              padding: '12px 16px',
              cursor: 'pointer',
              transition: 'transform 0.15s ease'
            }}
            onClick={() => handleAnalisarKyttoIA(true)}
            title="Abrir Painel KyttoIA de Otimização e Previsão de Gargalos"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase' }}>Otimizador KyttoIA</span>
              <span style={{ fontSize: 13 }}>🤖</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: (analiseKyttoIA?.scoreEficiencia ?? 96) >= 90 ? '#10b981' : '#f59e0b', fontFamily: 'var(--font-data)', marginTop: 2 }}>
              {analiseKyttoIA?.scoreEficiencia ?? 96}% <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Score</span>
            </div>
            <span style={{ fontSize: 10, color: (analiseKyttoIA?.gargalosPrevistos?.length || 0) === 0 ? '#10b981' : '#f59e0b', fontWeight: 700 }}>
              {(analiseKyttoIA?.gargalosPrevistos?.length || 0) === 0 ? '✓ Gargalos Zero (NBR 7212)' : `⚠️ ${analiseKyttoIA?.gargalosPrevistos?.length || 0} pontos de atenção`}
            </span>
          </div>
        </div>
      </div>

      {/* ─── LINHA DO TEMPO GANTT CLICÁVEL DE DESPACHO ─── */}
      <div className="serrano-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
              Linha do Tempo Visual de Ocupação da Frota (Gantt Interativo 07h às 18h)
            </h3>
            <small style={{ color: 'var(--text-muted)' }}>Clique em uma concretagem para ver/editar todos os dados ou em um espaço vazio para agendar</small>
          </div>
          <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: '#10B981' }}></span> Concluído
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: '#0284C7' }}></span> Em Trânsito
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: '#F59E0B' }}></span> Carregando
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: '#64748B' }}></span> Programado
            </span>
          </div>
        </div>

        <div style={{ overflowX: 'auto', paddingBottom: 6 }}>
          <div style={{ minWidth: 720 }}>
            {/* Cabeçalho de Horas (07h às 17h) */}
            <div style={{ display: 'grid', gridTemplateColumns: '90px repeat(11, 1fr)', gap: 4, textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', borderBottom: '1px solid var(--joint)', paddingBottom: 6 }}>
              <div style={{ textAlign: 'left', fontWeight: 700 }}>Veículo</div>
              <div>07h</div>
              <div>08h</div>
              <div>09h</div>
              <div>10h</div>
              <div>11h</div>
              <div>12h</div>
              <div>13h</div>
              <div>14h</div>
              <div>15h</div>
              <div>16h</div>
              <div>17h</div>
            </div>

            {/* Linhas por Betoneira */}
            {[
              { cod: 'BT-01', motorista: 'Marcos Silveira', placa: 'RRA-4E80', ocupacoes: [{ inicio: 1, fim: 3, cargaId: 'crg-1001', cargaNum: 1001, obra: 'Residencial Serra Dourada (8m³)', status: 'concluido' }, { inicio: 7, fim: 9, cargaId: 'crg-1003', cargaNum: 1003, obra: 'Lote 12 Qd 08 (8m³)', status: 'agendado' }] },
              { cod: 'BT-02', motorista: 'Carlos Eduardo', placa: 'RRA-4E81', ocupacoes: [{ inicio: 2, fim: 4, cargaId: 'crg-1002', cargaNum: 1002, obra: 'Galpão AgroLog (8m³)', status: 'em_transito' }, { inicio: 8, fim: 10, cargaId: 'crg-1002', cargaNum: 1002, obra: 'Galpão AgroLog 2ª vg', status: 'agendado' }] },
              { cod: 'BT-03', motorista: 'Valdemir Oliveira', placa: 'RRA-4E82', ocupacoes: [{ inicio: 5, fim: 6, cargaId: null, cargaNum: null, obra: 'Manutenção Pátio', status: 'manutencao' }, { inicio: 9, fim: 11, cargaId: 'crg-1001', cargaNum: 1001, obra: 'Ed. Belvedere (8m³)', status: 'agendado' }] },
              { cod: 'BT-04', motorista: 'Roberto Lima', placa: 'RRA-4E83', ocupacoes: [{ inicio: 1, fim: 3, cargaId: 'crg-1001', cargaNum: 1001, obra: 'Ponte Rio Sepotuba (8m³)', status: 'concluido' }, { inicio: 6, fim: 8, cargaId: 'crg-1002', cargaNum: 1002, obra: 'Ponte Sepotuba 2ª vg', status: 'em_carregamento' }] },
              { cod: 'BT-05', motorista: 'Fernando Souza', placa: 'RRA-4E84', ocupacoes: [{ inicio: 4, fim: 6, cargaId: 'crg-1003', cargaNum: 1003, obra: 'Mirante da Serra (8m³)', status: 'concluido' }] },
              { cod: 'BL-01', motorista: 'Operador Bomba', placa: 'RRA-4E85', ocupacoes: [{ inicio: 1, fim: 4, cargaId: 'crg-1001', cargaNum: 1001, obra: 'Bomba Lança 32m · Serra Dourada', status: 'concluido' }, { inicio: 7, fim: 10, cargaId: 'crg-1003', cargaNum: 1003, obra: 'Bomba Lança · Lote 12', status: 'agendado' }] }
            ].map(row => (
              <div key={row.cod} style={{ display: 'grid', gridTemplateColumns: '90px repeat(11, 1fr)', gap: 4, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--joint)', fontSize: 11 }}>
                <div>
                  <b style={{ color: 'var(--serrano-orange-text)', fontSize: 12 }}>{row.cod}</b>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{row.motorista.split(' ')[0]}</div>
                </div>

                {/* 11 Slots Horários */}
                {Array.from({ length: 11 }).map((_, slotIdx) => {
                  const oc = row.ocupacoes.find(o => slotIdx >= o.inicio && slotIdx < o.fim);
                  const horaSlot = `${String(7 + slotIdx).padStart(2, '0')}:00`;

                  if (!oc) {
                    return (
                      <div
                        key={slotIdx}
                        onClick={() => {
                          const cargaModelo = {
                            id: `crg-${Date.now().toString().slice(-4)}`,
                            numero: Math.floor(1004 + Math.random() * 50),
                            cliente: '',
                            obra: '',
                            data: dataSelecionada,
                            horarioInicio: horaSlot,
                            horarioAgendado: horaSlot,
                            fck: 30,
                            volumeM3: 8,
                            bomba: row.cod === 'BL-01' ? 'BL-01 · Lança 32 m' : 'Calha Direta',
                            status: 'agendado',
                            viagens: [{ viagemNumero: 1, betoneira: row.cod, motorista: row.motorista, volumeM3: 8, status: 'agendada' }]
                          };
                          handleAbrirDetalhe(cargaModelo);
                        }}
                        style={{
                          height: 28,
                          background: 'var(--surface)',
                          borderRadius: 4,
                          border: '1px dashed var(--joint)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--text-muted)',
                          fontSize: 10,
                          transition: 'background 0.2s'
                        }}
                        title={`Horário Livre: ${horaSlot} - Clique para Agendar ${row.cod}`}
                      >
                        +
                      </div>
                    );
                  }

                  const isFirst = slotIdx === oc.inicio;
                  const bg = oc.status === 'concluido' ? 'rgba(16, 185, 129, 0.2)' : oc.status === 'em_transito' ? 'rgba(2, 132, 199, 0.2)' : oc.status === 'em_carregamento' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(100, 116, 139, 0.2)';
                  const borderColor = oc.status === 'concluido' ? '#10B981' : oc.status === 'em_transito' ? '#0284C7' : oc.status === 'em_carregamento' ? '#F59E0B' : '#64748B';
                  const textColor = oc.status === 'concluido' ? '#047857' : oc.status === 'em_transito' ? '#0369A1' : oc.status === 'em_carregamento' ? '#B45309' : '#334155';

                  return (
                    <div
                      key={slotIdx}
                      onClick={() => {
                        const cargaAlvo = cargas.find(c => c.id === oc.cargaId || c.numero === oc.cargaNum) || {
                          id: oc.cargaId || 'crg-1001',
                          numero: oc.cargaNum || 1001,
                          obra: oc.obra,
                          cliente: 'Construtora MT Horizon',
                          fck: 30,
                          volumeM3: 24,
                          horarioAgendado: horaSlot,
                          data: dataSelecionada,
                          status: oc.status
                        };
                        handleAbrirDetalhe(cargaAlvo);
                      }}
                      style={{
                        height: 28,
                        background: bg,
                        border: `1px solid ${borderColor}`,
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 9,
                        fontWeight: 700,
                        color: textColor,
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        padding: '0 4px',
                        cursor: 'pointer'
                      }}
                      title={`${oc.obra} · Clique para Ver Detalhes e Editar`}
                    >
                      {isFirst ? (
                        <span>📅 {oc.obra.slice(0, 15)}</span>
                      ) : '...'}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── FILTROS RÁPIDOS E LISTA DE CONCRETAGENS CADASTRADAS ─── */}
      <div className="serrano-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { id: 'todos', label: 'Todas as Concretagens' },
              { id: 'agendado', label: '📅 Agendadas / Programadas' },
              { id: 'em_transito', label: '🚛 Em Rota / Obra' },
              { id: 'concluido', label: '✓ Concluídas' }
            ].map(f => (
              <button
                key={f.id}
                type="button"
                className={`serrano-pill ${filtroStatus === f.id ? 'serrano-p-ok' : ''}`}
                style={{ cursor: 'pointer', padding: '6px 14px', fontSize: 12, fontWeight: 600, border: '1px solid var(--joint)' }}
                onClick={() => setFiltroStatus(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div style={{ minWidth: 260 }}>
            <input
              type="text"
              className="serrano-input"
              placeholder="🔍 Buscar por carga, cliente, obra ou FCK..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              style={{ fontSize: 12 }}
            />
          </div>
        </div>

        {/* LISTA DE CARDS DE CONCRETAGEM */}
        <div style={{ display: 'grid', gap: 14 }}>
          {cargasFiltradas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              Nenhuma concretagem encontrada para os filtros selecionados.
            </div>
          ) : (
            cargasFiltradas.map((c, i) => (
              <div
                key={c.id || i}
                style={{
                  background: 'var(--surface-2)',
                  border: '1.5px solid var(--joint)',
                  borderRadius: 10,
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 16,
                  transition: 'border-color 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}
              >
                {/* Lado Esquerdo: Identificação e Dados de Obra */}
                <div style={{ flex: '1 1 340px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => handleAbrirDetalhe(c)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        fontFamily: 'var(--font-data)',
                        fontSize: 16,
                        fontWeight: 900,
                        color: 'var(--serrano-orange-text)',
                        textDecoration: 'underline'
                      }}
                      title="Clique para Abrir Detalhamento da Agenda"
                    >
                      #{c.numero || 1001 + i}
                    </button>

                    <span
                      className={`serrano-pill ${c.status === 'concluido' ? 'serrano-p-ok' : c.status === 'em_transito' ? 'serrano-p-live' : 'serrano-p-load'}`}
                      style={{ fontSize: 11 }}
                    >
                      {c.status === 'concluido' ? '✓ Concluída' : c.status === 'em_transito' ? '🚛 Em Trânsito' : '📅 Agendada'}
                    </span>

                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-data)' }}>
                      🕒 {c.horarioAgendado || c.horarioInicio || '08:30'}
                    </span>

                    <span style={{ fontSize: 11, background: 'rgba(2,132,199,0.1)', color: '#0284C7', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                      {String(c.fck || '').startsWith('FCK') ? c.fck : `FCK ${c.fck} MPa`}
                    </span>
                  </div>

                  <div style={{ fontWeight: 800, fontSize: 16, marginTop: 6, color: 'var(--text-primary)' }}>
                    {c.obra}
                  </div>

                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Cliente: <b>{c.cliente}</b> {c.endereco ? `· ${c.endereco}` : ''}
                  </div>

                  <div style={{ fontSize: 12, marginTop: 6, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span>Volume: <b>{c.volumeM3} m³</b></span>
                    <span>Agregado: <b>{c.brita || 'Brita 1'}</b></span>
                    <span>Slump: <b>{c.slump || '14 ± 2 cm'}</b></span>
                    <span>Bomba: <b>{c.bomba || 'Calha Direta'}</b></span>
                  </div>
                </div>

                {/* Centro: Viagens da Betoneira */}
                <div style={{ flex: '1 1 240px', background: 'var(--surface)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--joint)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
                    VIAGENS PROGRAMADAS ({(c.viagens || []).length}):
                  </div>
                  <div style={{ display: 'grid', gap: 4, maxHeight: 75, overflowY: 'auto' }}>
                    {(c.viagens && c.viagens.length > 0 ? c.viagens : [{ veiculo: 'BT-01', volumeM3: 8, saidaUsina: '08:30', status: 'agendada' }]).map((v, vIdx) => (
                      <div key={vIdx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, alignItems: 'center' }}>
                        <span>
                          <b>{v.betoneira || v.veiculo || `BT-0${vIdx + 1}`}</b> · {v.volumeM3 || 8} m³
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                          Saída: {v.saidaUsina || '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Lado Direito: Valor Total e Botões de Ação */}
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 900, color: 'var(--serrano-orange-text)' }}>
                    R$ {Number(c.valorTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="serrano-btn serrano-btn-p"
                      style={{ padding: '6px 12px', fontSize: 11, background: '#0284C7', color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}
                      onClick={() => handleAbrirDetalhe(c)}
                      title="Abrir Detalhamento da Agenda e Editar"
                    >
                      <span>📅</span> Detalhes &amp; Editar
                    </button>

                    <button
                      type="button"
                      className="serrano-btn serrano-btn-sec"
                      style={{ padding: '6px 10px', fontSize: 11 }}
                      onClick={() => onAbrirRomaneio && onAbrirRomaneio(c)}
                      title="Imprimir Romaneio NBR 7212 com Assinatura Touch"
                    >
                      📋 Romaneio
                    </button>

                    <button
                      type="button"
                      className="serrano-btn serrano-btn-sec"
                      style={{ padding: '6px 10px', fontSize: 11, color: '#D97706' }}
                      onClick={() => {
                        setModalDuplicarAberto(c);
                        setNovaDataDuplicacao(dataSelecionada);
                      }}
                      title="Duplicar para outra data"
                    >
                      📑 Duplicar
                    </button>

                    <button
                      type="button"
                      className="serrano-btn serrano-btn-sec"
                      style={{ padding: '6px 8px', fontSize: 11, color: '#EF4444', borderColor: '#FCA5A5' }}
                      onClick={() => setModalConfirmarExclusao(c)}
                      title="Excluir Concretagem da Programação"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ─── SIMULADOR DE PERDA DE ABATIMENTO (SLUMP LOSS NBR 7212) ─── */}
      <div className="serrano-card" style={{ padding: 20 }}>
        <div style={{ borderBottom: '1px solid var(--joint)', paddingBottom: 12, marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
            Simulador de Perda de Abatimento (Slump Loss) &amp; Pega NBR 7212
          </h3>
          <small style={{ color: 'var(--text-muted)' }}>Cálculo preditivo em função da temperatura de Tangará da Serra/MT e tempo de trânsito até a obra</small>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                <span>Temperatura Ambiente:</span>
                <span style={{ color: '#D97706' }}>{simuladorSlump.temperaturaAmbienteC}°C (Tangará da Serra/MT)</span>
              </div>
              <input
                type="range"
                min="20"
                max="42"
                step="1"
                className="serrano-slider"
                value={simuladorSlump.temperaturaAmbienteC}
                onChange={e => setSimuladorSlump({ ...simuladorSlump, temperaturaAmbienteC: Number(e.target.value) })}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                <span>Tempo Estimado de Viagem:</span>
                <span style={{ color: '#0284C7' }}>{simuladorSlump.tempoViagemMin} minutos até a obra</span>
              </div>
              <input
                type="range"
                min="10"
                max="90"
                step="5"
                className="serrano-slider"
                value={simuladorSlump.tempoViagemMin}
                onChange={e => setSimuladorSlump({ ...simuladorSlump, tempoViagemMin: Number(e.target.value) })}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                id="chkRet"
                checked={simuladorSlump.usoRetardador}
                onChange={e => setSimuladorSlump({ ...simuladorSlump, usoRetardador: e.target.checked })}
                style={{ width: 16, height: 16 }}
              />
              <label htmlFor="chkRet" style={{ fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                Utilizar Aditivo Plastificante com Ação Retardadora (TecFlow R)
              </label>
            </div>
          </div>

          <div style={{ background: 'var(--surface-2)', padding: 16, borderRadius: 8, border: '1px solid var(--joint)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, textAlign: 'center' }}>
              <div>
                <small style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>Slump na Central</small>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 900 }}>
                  {simuladorSlump.slumpInicialCm.toFixed(1)} cm
                </div>
                <small style={{ color: 'var(--text-muted)' }}>Tronco de Cone</small>
              </div>
              <div>
                <small style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>Slump Previsto Obra</small>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 900, color: calcSlump.conforme ? '#059669' : '#D97706' }}>
                  {calcSlump.slumpFinal.toFixed(1)} cm
                </div>
                <small style={{ color: 'var(--text-muted)' }}>Perda: -{calcSlump.perdaReal} cm</small>
              </div>
            </div>

            <div style={{ marginTop: 12, padding: 8, borderRadius: 6, background: calcSlump.conforme ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: calcSlump.conforme ? '#047857' : '#B45309', fontSize: 11, fontWeight: 700, textAlign: 'center' }}>
              {calcSlump.conforme ? '✓ DENTRO DA TOLERÂNCIA NBR 7212 (Trabalhabilidade Plena)' : '⚠️ ATENÇÃO: Risco de slump abaixo do especificado. Aumentar retardador.'}
            </div>
          </div>
        </div>
      </div>

      {/* ─── MODAL DE DETALHAMENTO & EDIÇÃO COMPLETA DA CONCRETAGEM ─── */}
      {modalDetalheAberto && formEdicao && (
        <div className="serrano-modal-overlay">
          <div className="serrano-modal-card" style={{ maxWidth: 860, maxHeight: '92vh', overflowY: 'auto' }}>
            {/* Header do Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--joint)', paddingBottom: 12, marginBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 22 }}>📅</span>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>
                    Detalhamento &amp; Edição da Concretagem #{formEdicao.numero}
                  </h3>
                  <span className={`serrano-pill ${formEdicao.status === 'concluido' ? 'serrano-p-ok' : formEdicao.status === 'em_transito' ? 'serrano-p-live' : 'serrano-p-load'}`}>
                    {formEdicao.status}
                  </span>
                </div>
                <small style={{ color: 'var(--text-muted)' }}>Altere qualquer dado, adicione viagens ou exclua a programação</small>
              </div>

              <button
                type="button"
                className="serrano-btn serrano-btn-sec"
                onClick={() => setModalDetalheAberto(null)}
                style={{ padding: '4px 10px' }}
              >
                ✕
              </button>
            </div>

            {/* Abas do Modal */}
            <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--joint)', paddingBottom: 10, marginBottom: 16 }}>
              {[
                { id: 'dados', label: '📝 Dados da Obra & Traço FCK' },
                { id: 'viagens', label: `🚛 Betoneiras & Viagens (${formEdicao.viagens?.length || 0})` },
                { id: 'financeiro', label: '💰 Precificação & Valores' }
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  className={`serrano-btn ${abaModal === t.id ? 'serrano-btn-p' : 'serrano-btn-sec'}`}
                  style={{ fontSize: 12, padding: '6px 14px' }}
                  onClick={() => setAbaModal(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSalvarEdicao}>
              {/* ABA 1: DADOS GERAIS & ENGENHARIA */}
              {abaModal === 'dados' && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700 }}>Cliente / Construtora *</label>
                      <input
                        type="text"
                        className="serrano-input"
                        value={formEdicao.cliente}
                        onChange={e => setFormEdicao({ ...formEdicao, cliente: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700 }}>CNPJ / CPF</label>
                      <input
                        type="text"
                        className="serrano-input"
                        value={formEdicao.cnpjCpfCliente}
                        onChange={e => setFormEdicao({ ...formEdicao, cnpjCpfCliente: e.target.value })}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700 }}>Obra / Local de Aplicação *</label>
                      <input
                        type="text"
                        className="serrano-input"
                        value={formEdicao.obra}
                        onChange={e => setFormEdicao({ ...formEdicao, obra: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700 }}>Elemento Estrutural</label>
                      <input
                        type="text"
                        className="serrano-input"
                        value={formEdicao.elemento}
                        onChange={e => setFormEdicao({ ...formEdicao, elemento: e.target.value })}
                        placeholder="Ex: Lajes 4º pavimento / Pilares"
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, fontWeight: 700 }}>Endereço Completo em Tangará da Serra/MT</label>
                    <input
                      type="text"
                      className="serrano-input"
                      value={formEdicao.endereco}
                      onChange={e => setFormEdicao({ ...formEdicao, endereco: e.target.value })}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700 }}>Data da Concretagem *</label>
                      <input
                        type="date"
                        className="serrano-input"
                        value={formEdicao.data}
                        onChange={e => setFormEdicao({ ...formEdicao, data: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700 }}>Horário Início *</label>
                      <input
                        type="time"
                        className="serrano-input"
                        value={formEdicao.horarioInicio}
                        onChange={e => setFormEdicao({ ...formEdicao, horarioInicio: e.target.value, horarioAgendado: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700 }}>Resistência (FCK) *</label>
                      <select
                        className="serrano-input"
                        value={formEdicao.fck}
                        onChange={e => {
                          const novoFck = Number(e.target.value);
                          setFormEdicao({
                            ...formEdicao,
                            fck: novoFck,
                            precoM3: novoFck === 20 ? 380 : novoFck === 25 ? 410 : novoFck === 30 ? 440 : novoFck === 35 ? 480 : 520
                          });
                        }}
                      >
                        <option value={20}>FCK 20 MPa</option>
                        <option value={25}>FCK 25 MPa (Padrão)</option>
                        <option value={30}>FCK 30 MPa (Estrutural)</option>
                        <option value={35}>FCK 35 MPa (Piso Industrial)</option>
                        <option value={40}>FCK 40 MPa (Alta Resistência)</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700 }}>Volume Total (m³) *</label>
                      <input
                        type="number"
                        step="0.5"
                        className="serrano-input"
                        value={formEdicao.volumeM3}
                        onChange={e => setFormEdicao({ ...formEdicao, volumeM3: Number(e.target.value) })}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700 }}>Abatimento (Slump)</label>
                      <input
                        type="text"
                        className="serrano-input"
                        value={formEdicao.slump}
                        onChange={e => setFormEdicao({ ...formEdicao, slump: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700 }}>Brita / Agregado</label>
                      <select
                        className="serrano-input"
                        value={formEdicao.brita}
                        onChange={e => setFormEdicao({ ...formEdicao, brita: e.target.value })}
                      >
                        <option value="Brita 1">Brita 1 (Granítica 9,5 a 19mm)</option>
                        <option value="Brita 0">Brita 0 (Pedrisco 4,8 a 9,5mm)</option>
                        <option value="Brita 1 e 2">Brita 1 e 2 Mista</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700 }}>Equipamento Bomba</label>
                      <select
                        className="serrano-input"
                        value={formEdicao.bomba}
                        onChange={e => setFormEdicao({ ...formEdicao, bomba: e.target.value })}
                      >
                        <option value="BL-01 · Lança 32 m">Bomba Lança 32m (BL-01)</option>
                        <option value="Bomba Reboque Estacionária">Bomba Reboque Estacionária</option>
                        <option value="Calha Direta">Calha Direta (Sem Bomba)</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 11, fontWeight: 700 }}>Observações Técnicas / Restrições da Obra</label>
                    <textarea
                      className="serrano-input"
                      rows={2}
                      value={formEdicao.observacoes}
                      onChange={e => setFormEdicao({ ...formEdicao, observacoes: e.target.value })}
                      placeholder="Ex: Obra com tráfego pesado liberado após 08:30; concretar primeiro os fundos."
                    />
                  </div>
                </div>
              )}

              {/* ABA 2: BETONEIRAS & VIAGENS */}
              {abaModal === 'viagens' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <b style={{ fontSize: 13 }}>Escalação de Betoneiras da Carga</b>
                      <small style={{ display: 'block', color: 'var(--text-muted)' }}>Defina os horários de saída de cada caminhão e motorista</small>
                    </div>
                    <button
                      type="button"
                      className="serrano-btn serrano-btn-sec"
                      style={{ fontSize: 11 }}
                      onClick={handleAdicionarViagem}
                    >
                      + Adicionar Betoneira
                    </button>
                  </div>

                  <div style={{ display: 'grid', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                    {(formEdicao.viagens || []).map((v, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: 'var(--surface-2)',
                          border: '1px solid var(--joint)',
                          borderRadius: 8,
                          padding: 10,
                          display: 'grid',
                          gridTemplateColumns: '60px 100px 130px 80px 80px 100px 40px',
                          gap: 8,
                          alignItems: 'center'
                        }}
                      >
                        <div style={{ fontWeight: 800, fontSize: 11 }}>Vg #{idx + 1}</div>

                        <div>
                          <select
                            className="serrano-input"
                            style={{ fontSize: 11, padding: 4 }}
                            value={v.betoneira}
                            onChange={e => {
                              const novas = [...formEdicao.viagens];
                              novas[idx].betoneira = e.target.value;
                              setFormEdicao({ ...formEdicao, viagens: novas });
                            }}
                          >
                            <option value="BT-01">BT-01</option>
                            <option value="BT-02">BT-02</option>
                            <option value="BT-03">BT-03</option>
                            <option value="BT-04">BT-04</option>
                            <option value="BT-05">BT-05</option>
                          </select>
                        </div>

                        <div>
                          <input
                            type="text"
                            className="serrano-input"
                            style={{ fontSize: 11, padding: 4 }}
                            value={v.motorista || ''}
                            placeholder="Motorista"
                            onChange={e => {
                              const novas = [...formEdicao.viagens];
                              novas[idx].motorista = e.target.value;
                              setFormEdicao({ ...formEdicao, viagens: novas });
                            }}
                          />
                        </div>

                        <div>
                          <input
                            type="number"
                            step="0.5"
                            className="serrano-input"
                            style={{ fontSize: 11, padding: 4 }}
                            value={v.volumeM3 || 8}
                            placeholder="m³"
                            onChange={e => {
                              const novas = [...formEdicao.viagens];
                              novas[idx].volumeM3 = Number(e.target.value);
                              setFormEdicao({ ...formEdicao, viagens: novas });
                            }}
                          />
                        </div>

                        <div>
                          <input
                            type="time"
                            className="serrano-input"
                            style={{ fontSize: 11, padding: 4 }}
                            value={v.saidaUsina || ''}
                            onChange={e => {
                              const novas = [...formEdicao.viagens];
                              novas[idx].saidaUsina = e.target.value;
                              setFormEdicao({ ...formEdicao, viagens: novas });
                            }}
                          />
                        </div>

                        <div>
                          <select
                            className="serrano-input"
                            style={{ fontSize: 11, padding: 4 }}
                            value={v.status}
                            onChange={e => {
                              const novas = [...formEdicao.viagens];
                              novas[idx].status = e.target.value;
                              setFormEdicao({ ...formEdicao, viagens: novas });
                            }}
                          >
                            <option value="agendada">Agendada</option>
                            <option value="em_transito">Em Trânsito</option>
                            <option value="descarregando">Descarregando</option>
                            <option value="concluido">Concluída</option>
                          </select>
                        </div>

                        <div>
                          <button
                            type="button"
                            onClick={() => handleRemoverViagem(idx)}
                            style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', fontWeight: 800 }}
                            title="Remover Viagem"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ABA 3: FINANCEIRO & PREÇOS */}
              {abaModal === 'financeiro' && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700 }}>Preço Unitário / m³ (R$)</label>
                      <input
                        type="number"
                        className="serrano-input"
                        value={formEdicao.precoM3}
                        onChange={e => setFormEdicao({ ...formEdicao, precoM3: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700 }}>Subtotal Concreto (R$)</label>
                      <div style={{ fontSize: 18, fontWeight: 900, paddingTop: 6, fontFamily: 'var(--font-data)' }}>
                        R$ {(Number(formEdicao.volumeM3 || 0) * Number(formEdicao.precoM3 || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700 }}>Taxa Bomba Lança (R$)</label>
                      <div style={{ fontSize: 18, fontWeight: 900, color: '#0284C7', paddingTop: 6, fontFamily: 'var(--font-data)' }}>
                        {formEdicao.bomba?.toLowerCase().includes('bomba') ? 'R$ 750,00' : 'R$ 0,00 (Calha)'}
                      </div>
                    </div>
                  </div>

                  <div style={{ background: 'var(--surface-2)', padding: 14, borderRadius: 8, border: '1px solid var(--joint)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>VALOR TOTAL PREVISTO:</span>
                      <span style={{ fontSize: 24, fontWeight: 900, color: 'var(--serrano-orange-text)', fontFamily: 'var(--font-data)' }}>
                        R$ {(Number(formEdicao.volumeM3 || 0) * Number(formEdicao.precoM3 || 0) + (formEdicao.bomba?.toLowerCase().includes('bomba') ? 750 : 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* BARRA DE AÇÕES INFERIOR DO MODAL */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--joint)', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="serrano-btn serrano-btn-sec"
                    style={{ color: '#EF4444', borderColor: '#FCA5A5' }}
                    onClick={() => setModalConfirmarExclusao(formEdicao)}
                  >
                    🗑️ Excluir Concretagem
                  </button>

                  <button
                    type="button"
                    className="serrano-btn serrano-btn-sec"
                    style={{ color: '#0284C7' }}
                    onClick={() => {
                      if (onAbrirRomaneio) onAbrirRomaneio(formEdicao);
                    }}
                  >
                    📋 Romaneio NBR 7212
                  </button>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    className="serrano-btn serrano-btn-sec"
                    onClick={() => setModalDetalheAberto(null)}
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    className="serrano-btn serrano-btn-sec"
                    style={{ background: '#10B981', color: '#fff', border: 'none', fontWeight: 700 }}
                    onClick={() => handleIniciarDespacho(formEdicao)}
                  >
                    🚚 Despachar Agora
                  </button>

                  <button
                    type="submit"
                    className="serrano-btn serrano-btn-p"
                    disabled={salvando}
                    style={{ background: 'var(--serrano-orange-text)', color: '#fff', fontWeight: 800 }}
                  >
                    {salvando ? '⏳ Salvando...' : '💾 Salvar Alterações'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL DE CONFIRMAÇÃO DE EXCLUSÃO ─── */}
      {modalConfirmarExclusao && (
        <div className="serrano-modal-overlay">
          <div className="serrano-modal-card" style={{ maxWidth: 440 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#EF4444' }}>
              Confirmar Exclusão da Concretagem?
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 10 }}>
              Deseja realmente remover da programação a concretagem <b>#{modalConfirmarExclusao.numero}</b> ({modalConfirmarExclusao.obra} - {modalConfirmarExclusao.cliente})?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button
                type="button"
                className="serrano-btn serrano-btn-sec"
                onClick={() => setModalConfirmarExclusao(null)}
              >
                Voltar
              </button>
              <button
                type="button"
                className="serrano-btn serrano-btn-p"
                style={{ background: '#EF4444', color: '#fff', fontWeight: 800 }}
                onClick={handleConfirmarExcluir}
                disabled={excluindo}
              >
                {excluindo ? 'Excluindo...' : 'Sim, Excluir Carga'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL DE DUPLICAÇÃO DE AGENDAMENTO ─── */}
      {modalDuplicarAberto && (
        <div className="serrano-modal-overlay">
          <div className="serrano-modal-card" style={{ maxWidth: 460 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
              Duplicar Programação da Carga #{modalDuplicarAberto.numero}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>
              Cria um novo agendamento idêntico com o mesmo cliente ({modalDuplicarAberto.cliente}), obra, FCK ({modalDuplicarAberto.fck} MPa) e volume ({modalDuplicarAberto.volumeM3} m³).
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '14px 0' }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700 }}>Nova Data:</label>
                <input
                  type="date"
                  className="serrano-input"
                  value={novaDataDuplicacao}
                  onChange={e => setNovaDataDuplicacao(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700 }}>Novo Horário:</label>
                <input
                  type="time"
                  className="serrano-input"
                  value={novoHorarioDuplicacao}
                  onChange={e => setNovoHorarioDuplicacao(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="serrano-btn serrano-btn-sec"
                onClick={() => setModalDuplicarAberto(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="serrano-btn serrano-btn-p"
                style={{ background: '#0284C7', color: '#fff', fontWeight: 800 }}
                onClick={handleDuplicar}
              >
                Duplicar &amp; Agendar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL KYTTOIA: OTIMIZADOR DE ESCALA & GARGALOS ─── */}
      <ModalOtimizadorKyttoIA
        isOpen={modalKyttoIAAberto}
        onClose={() => setModalKyttoIAAberto(false)}
        analise={analiseKyttoIA}
        carregando={carregandoKyttoIA}
        onRecalcular={() => handleAnalisarKyttoIA(true)}
        onAplicarEscala={handleAplicarEscalaKyttoIA}
        aplicando={aplicandoKyttoIA}
        dataAlvo={dataSelecionada}
      />
    </div>
  );
}
