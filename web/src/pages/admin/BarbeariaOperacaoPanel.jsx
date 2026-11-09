import { useState, useMemo } from 'react';
import { fmtDateOnly, fmtR } from '../../lib/api';
import BarbeariaCaixaDetalhado from './BarbeariaCaixaDetalhado';
import { Eye } from 'lucide-react';

const moeda = (value) => fmtR(Number(value || 0));

function Kpi({ label, value, note, color = 'var(--accent)' }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, padding: 16 }}>
      <div style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      <strong style={{ display: 'block', marginTop: 8, color, fontSize: 24 }}>{value}</strong>
      {note && <small style={{ display: 'block', marginTop: 6, color: 'var(--muted)' }}>{note}</small>}
    </div>
  );
}

function statusLabel(status) {
  return {
    aberto: 'Aberto',
    fechado: 'Fechado',
    recebimento: 'Recebimento',
    estorno_recebimento: 'Estorno de recebimento',
    sangria: 'Sangria',
    suprimento: 'Suprimento',
  }[status] || status || '—';
}

const MOTIVOS_CANCELAMENTO = [
  'Erro de digitação / valor incorreto',
  'Meio de pagamento incorreto (necessário refazer)',
  'Cliente desistiu do atendimento / produto',
  'Atendimento não realizado / cancelado após faturamento',
  'Cobrança em duplicidade',
  'Outro motivo (especificar abaixo)',
];

export default function BarbeariaOperacaoPanel({
  data,
  operacao = {},
  comandas: comandasProps = [],
  profissionais = [],
  onOpenComanda,
  onCancelarComandaFinalizada,
  onOpenCaixa,
  onMove,
  onClose,
  onCloseDay,
  onViewDay,
  onRefresh,
  toast,
  salvando = false,
}) {
  const [formCaixa, setFormCaixa] = useState({ numeroCaixa: 1, nomeCaixa: '', valorAbertura: '', observacao: '', dataAbertura: '' });
  const [formMovimento, setFormMovimento] = useState({ tipo: 'suprimento', valor: '', descricao: '', dataMovimento: '' });
  const [formFechamento, setFormFechamento] = useState({ valorInformado: '', observacao: '', dataFechamento: '' });

  // Filtros e busca de comandas fechadas
  const [filtroCaixaId, setFiltroCaixaId] = useState('');
  const [filtroMeio, setFiltroMeio] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todas_fechadas');
  const [busca, setBusca] = useState('');
  const [comandaExpandida, setComandaExpandida] = useState({});

  // Modal de Abertura de Novo Caixa (para múltiplos caixas abertos simultâneos)
  const [modalAbrirCaixa, setModalAbrirCaixa] = useState(false);
  const [caixaAtivoId, setCaixaAtivoId] = useState('');

  // Modal do Procedimento de Cancelamento de Comanda Finalizada
  const [modalCancelamento, setModalCancelamento] = useState(null);
  const [motivoPredefinido, setMotivoPredefinido] = useState(MOTIVOS_CANCELAMENTO[0]);
  const [motivoDetalhado, setMotivoDetalhado] = useState('');
  const [reabrirAgendamento, setReabrirAgendamento] = useState(false);
  const [processandoCancelamento, setProcessandoCancelamento] = useState(false);
  const [cancelarSenhaGerente, setCancelarSenhaGerente] = useState('');

  const caixas = operacao.caixas || [];
  const caixasAbertos = useMemo(() => caixas.filter((c) => c.status === 'aberto'), [caixas]);
  const caixaAtivo = useMemo(() => {
    if (caixaAtivoId) {
      const c = caixasAbertos.find((item) => item.id === caixaAtivoId);
      if (c) return c;
    }
    return caixasAbertos[0] || operacao.caixaAberto || null;
  }, [caixasAbertos, caixaAtivoId, operacao.caixaAberto]);
  const caixaExibidoId = caixaAtivo?.id || caixas[0]?.id || null;

  const movimentos = operacao.movimentos || [];
  const resumo = operacao;

  // Unifica comandas disponíveis (vindas de props ou do resumo da operação)
  const todasComandas = useMemo(() => {
    const lista = (operacao.comandas && operacao.comandas.length ? operacao.comandas : comandasProps) || [];
    return lista;
  }, [operacao.comandas, comandasProps]);

  // Filtra comandas do caixa para exibição
  const comandasDoCaixa = useMemo(() => {
    return todasComandas.filter((comanda) => {
      // Por padrão foca nas que foram finalizadas ou canceladas
      const ehFechadaOuCancelada = ['paga', 'em_conta', 'cancelada'].includes(comanda.status) || comanda.estornada || (comanda.pagamentos && comanda.pagamentos.length > 0);
      if (filtroStatus === 'todas_fechadas' && !ehFechadaOuCancelada) return false;
      if (filtroStatus === 'paga' && comanda.status !== 'paga') return false;
      if (filtroStatus === 'em_conta' && comanda.status !== 'em_conta') return false;
      if (filtroStatus === 'cancelada' && comanda.status !== 'cancelada' && !comanda.estornada) return false;

      // Filtro por caixa específico
      if (filtroCaixaId) {
        const vinculadoAoCaixa = String(comanda.caixaId) === String(filtroCaixaId) ||
          (comanda.pagamentos || []).some((p) => String(p.caixaId) === String(filtroCaixaId));
        if (!vinculadoAoCaixa) return false;
      }

      // Filtro por meio de pagamento
      if (filtroMeio) {
        const temMeio = (comanda.pagamentos || []).some((p) => String(p.meio || '').toLowerCase() === filtroMeio.toLowerCase());
        if (!temMeio) return false;
      }

      // Busca textual por cliente, telefone, barbeiro ou ID
      if (busca.trim()) {
        const termo = busca.toLowerCase().trim();
        const matchCliente = String(comanda.clienteNome || '').toLowerCase().includes(termo);
        const matchTelefone = String(comanda.clienteTelefone || '').includes(termo);
        const matchProf = String(comanda.profissionalNome || '').toLowerCase().includes(termo);
        const matchId = String(comanda.id || '').toLowerCase().includes(termo);
        const matchItens = (comanda.itens || []).some((i) => String(i.nome || '').toLowerCase().includes(termo));
        if (!matchCliente && !matchTelefone && !matchProf && !matchId && !matchItens) return false;
      }

      return true;
    });
  }, [todasComandas, filtroStatus, filtroCaixaId, filtroMeio, busca]);

  // Totais das comandas filtradas
  const totaisFiltrados = useMemo(() => {
    let totalFaturado = 0;
    let totalDinheiro = 0;
    let totalPix = 0;
    let totalCartao = 0;
    let totalConta = 0;
    let pagasCount = 0;
    let canceladasCount = 0;

    for (const c of comandasDoCaixa) {
      if (c.status === 'cancelada' || c.estornada) {
        canceladasCount++;
        continue;
      }
      pagasCount++;
      const valor = Number(c.totalFaturado ?? c.total ?? 0);
      totalFaturado += valor;

      for (const p of c.pagamentos || []) {
        const v = Number(p.valor || 0);
        const m = String(p.meio || '').toLowerCase();
        if (m === 'dinheiro') totalDinheiro += v;
        else if (m === 'pix') totalPix += v;
        else if (m.includes('cartao') || m === 'credito' || m === 'debito') totalCartao += v;
        else if (m === 'conta') totalConta += v;
      }
    }

    return { totalFaturado, totalDinheiro, totalPix, totalCartao, totalConta, pagasCount, canceladasCount };
  }, [comandasDoCaixa]);

  function toggleExpandir(id) {
    setComandaExpandida((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function prepararAberturaNovoCaixa() {
    const ocupados = new Set(caixasAbertos.map((c) => Number(c.numeroCaixa)));
    let proximo = 1;
    while (ocupados.has(proximo)) proximo++;
    setFormCaixa({
      numeroCaixa: proximo,
      nomeCaixa: `Caixa ${proximo}`,
      valorAbertura: '',
      observacao: '',
      dataAbertura: '',
    });
    setModalAbrirCaixa(true);
  }

  function abrirCaixa(event) {
    event.preventDefault();
    const num = Number(formCaixa.numeroCaixa || 1);
    const nome = formCaixa.nomeCaixa || `Caixa ${num}`;
    if (!window.confirm(`Confirmar abertura do Caixa ${num} (${nome})?`)) return;
    let customDate = `${data}T12:00:00.000Z`;
    if (formCaixa.dataAbertura) {
      customDate = new Date(formCaixa.dataAbertura).toISOString();
    }
    onOpenCaixa({
      ...formCaixa,
      numeroCaixa: num,
      nomeCaixa: nome,
      valorAbertura: Number(formCaixa.valorAbertura || 0),
      dataOperacao: customDate,
      abertoEm: formCaixa.dataAbertura ? customDate : undefined,
      confirmado: true,
    });
    setModalAbrirCaixa(false);
  }

  function registrarMovimento(event) {
    event.preventDefault();
    if (!caixaAtivo) return;
    const targetCaixa = caixaAtivo;
    if (!window.confirm(`Confirmar ${formMovimento.tipo === 'sangria' ? 'sangria' : 'suprimento'} de ${moeda(formMovimento.valor)} no Caixa ${targetCaixa.numeroCaixa}?`)) return;
    let customDate = undefined;
    if (formMovimento.dataMovimento) {
      customDate = new Date(formMovimento.dataMovimento).toISOString();
    }
    onMove(targetCaixa, { ...formMovimento, valor: Number(formMovimento.valor || 0), criadoEm: customDate, confirmado: true });
    setFormMovimento({ tipo: 'suprimento', valor: '', descricao: '', dataMovimento: '' });
  }

  function fecharCaixa(event) {
    event.preventDefault();
    if (!caixaAtivo) return;
    const targetCaixa = caixaAtivo;
    const valor = Number(formFechamento.valorInformado || 0);
    if (!window.confirm(`Confirmar fechamento do Caixa ${targetCaixa.numeroCaixa} (${targetCaixa.nomeCaixa || 'Caixa ' + targetCaixa.numeroCaixa}) com valor contado de ${moeda(valor)}?`)) return;
    let customDate = undefined;
    if (formFechamento.dataFechamento) {
      customDate = new Date(formFechamento.dataFechamento).toISOString();
    }
    onClose(targetCaixa, { ...formFechamento, valorInformado: valor, fechadoEm: customDate, confirmado: true });
    setFormFechamento({ valorInformado: '', observacao: '', dataFechamento: '' });
  }

  // Aciona o procedimento de cancelamento de comanda finalizada
  async function executarProcedimentoCancelamento(event) {
    event.preventDefault();
    if (!modalCancelamento) return;
    const motivoFinal = motivoPredefinido === 'Outro motivo (especificar abaixo)'
      ? motivoDetalhado.trim()
      : `${motivoPredefinido}${motivoDetalhado.trim() ? ` — ${motivoDetalhado.trim()}` : ''}`;

    if (!motivoFinal) {
      alert('Por favor, informe a justificativa para o cancelamento.');
      return;
    }
    // Senha opcional para usuários já autenticados como gestores

    try {
      setProcessandoCancelamento(true);
      if (onCancelarComandaFinalizada) {
        await onCancelarComandaFinalizada(modalCancelamento, {
          motivo: motivoFinal,
          reabrirAgendamento,
          senhaGerente: cancelarSenhaGerente.trim(),
          confirmado: true,
        });
      }
      setModalCancelamento(null);
      setMotivoDetalhado('');
      setCancelarSenhaGerente('');
    } catch (err) {
      alert(`Erro no cancelamento: ${err.message || 'Falha ao estornar comanda'}`);
    } finally {
      setProcessandoCancelamento(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* Top Banner & KPIs */}
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <section style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 12%, var(--card)), var(--card))', border: '1px solid var(--line)', borderRadius: 16, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em' }}>Operação da unidade</div>
              <h2 style={{ margin: '6px 0 4px' }}>Abertura e fechamento do dia</h2>
              <p style={{ color: 'var(--muted)', margin: 0 }}>Controle de caixas múltiplos, conferência Avec e cancelamento auditável de comandas.</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <strong style={{ display: 'block', fontSize: 18 }}>{fmtDateOnly(data)}</strong>
              <small style={{ color: 'var(--muted)' }}>{resumo.lojaId ? `Unidade ${resumo.lojaId}` : 'Unidade da sessão'}</small>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ width: 11, height: 11, borderRadius: '50%', background: caixasAbertos.length > 0 ? '#14b87a' : '#f59e0b' }} />
              <strong>
                {caixasAbertos.length === 0 && 'Nenhum caixa aberto'}
                {caixasAbertos.length === 1 && `1 caixa aberto: Caixa ${caixaAtivo?.numeroCaixa || ''}${caixaAtivo?.nomeCaixa ? ` (${caixaAtivo.nomeCaixa})` : ''}`}
                {caixasAbertos.length > 1 && `${caixasAbertos.length} caixas abertos simultaneamente`}
              </strong>
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>
                {caixasAbertos.length === 0
                  ? 'Abra um caixa para iniciar a operação'
                  : caixasAbertos.map((c) => `Caixa ${c.numeroCaixa}${c.nomeCaixa ? ` (${c.nomeCaixa})` : ''}`).join(' · ')}
              </span>
            </div>
            <button
              type="button"
              onClick={prepararAberturaNovoCaixa}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: '1px solid #14b87a',
                background: '#14b87a',
                color: '#fff',
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>+ Abrir novo caixa (2, 3, 4...)</span>
          </button>
          <a
            href="/admin/fechamento-diario"
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid #2563eb',
              background: '#eff6ff',
              color: '#2563eb',
              fontSize: 13,
              fontWeight: 800,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>🔐 Conciliação &amp; Fechamento Geral ERP &rarr;</span>
          </a>
        </div>

          {/* Abas e seleção rápida de Caixas Abertos */}
          {caixasAbertos.length > 0 && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                Caixa Ativo no Painel:
              </span>
              {caixasAbertos.map((c) => {
                const isAtivo = (caixaAtivo?.id === c.id);
                const saldo = c.valorEsperadoAtual != null ? c.valorEsperadoAtual : c.valorAbertura;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCaixaAtivoId(c.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      border: isAtivo ? '2px solid #14b87a' : '1px solid var(--line)',
                      background: isAtivo ? 'rgba(20, 184, 122, 0.15)' : 'var(--card)',
                      color: isAtivo ? '#14b87a' : 'var(--fg)',
                      fontWeight: 800,
                      fontSize: 13,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span>{isAtivo ? '🟢' : '⚪'} Caixa {c.numeroCaixa}</span>
                    {c.nomeCaixa && <span style={{ fontSize: 11, opacity: 0.85 }}>({c.nomeCaixa})</span>}
                    <span style={{ padding: '2px 6px', borderRadius: 6, background: isAtivo ? '#14b87a' : 'var(--bg)', color: isAtivo ? '#fff' : 'var(--muted)', fontSize: 11, fontWeight: 700 }}>
                      {moeda(saldo)}
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={prepararAberturaNovoCaixa}
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1px dashed var(--accent)',
                  background: 'rgba(224, 92, 92, 0.08)',
                  color: 'var(--accent)',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
                title="Abrir mais um caixa simultâneo"
              >
                + Outro caixa
              </button>
            </div>
          )}
        </section>
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 10 }}>
          <Kpi label="Recebido em dinheiro" value={moeda(resumo.recebimentosDinheiro)} note="Movimentos do caixa físico" color="#14b87a" />
          <Kpi label="Receita recebida" value={moeda(resumo.receitaRecebida)} note="Meios pagos (Dinheiro, PIX, Cartão)" color="#14b87a" />
          <Kpi label="Faturamento" value={moeda(resumo.faturamentoComandas)} note={`${resumo.comandasPagas || 0} comanda(s) faturada(s)`} />
          <Kpi label="Faturado em conta" value={moeda(resumo.faturadoEmConta)} note={`${resumo.emConta || 0} comanda(s) a receber`} color="#8b5cf6" />
        </section>
      </div>

      {/* Formulário de Abertura quando não há nenhum caixa aberto */}
      {caixasAbertos.length === 0 && (
        <section style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 18 }}>
          <div style={{ marginBottom: 14 }}>
            <h3 style={{ margin: 0 }}>Abrir caixa</h3>
            <p style={{ margin: '5px 0 0', color: 'var(--muted)' }}>A abertura cria o caixa operacional da empresa/unidade ativa.</p>
          </div>
          <form onSubmit={abrirCaixa} style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <label>
              <span style={labelStyle}>Número do caixa</span>
              <input type="number" min="1" value={formCaixa.numeroCaixa} onChange={(event) => setFormCaixa((atual) => ({ ...atual, numeroCaixa: event.target.value }))} style={inputStyle} />
            </label>
            <label>
              <span style={labelStyle}>Nome / Identificador</span>
              <input value={formCaixa.nomeCaixa || ''} onChange={(event) => setFormCaixa((atual) => ({ ...atual, nomeCaixa: event.target.value }))} style={inputStyle} placeholder="Ex.: Balcão, Bar, Noturno" />
            </label>
            <label>
              <span style={labelStyle}>Fundo de abertura (R$)</span>
              <input type="number" min="0" step="0.01" value={formCaixa.valorAbertura} onChange={(event) => setFormCaixa((atual) => ({ ...atual, valorAbertura: event.target.value }))} style={inputStyle} />
            </label>
            <label>
              <span style={labelStyle}>Data/Hora de abertura</span>
              <input type="datetime-local" value={formCaixa.dataAbertura} onChange={(event) => setFormCaixa((atual) => ({ ...atual, dataAbertura: event.target.value }))} style={inputStyle} />
            </label>
            <label>
              <span style={labelStyle}>Observação</span>
              <input value={formCaixa.observacao} onChange={(event) => setFormCaixa((atual) => ({ ...atual, observacao: event.target.value }))} style={inputStyle} placeholder="Ex.: turno da manhã" />
            </label>
            <button type="submit" disabled={salvando} style={{ ...primary, gridColumn: '1 / -1' }}>Confirmar abertura</button>
          </form>
        </section>
      )}

      {/* Operações com Caixa Aberto (Movimentar e Fechar o Caixa Selecionado) */}
      {caixaAtivo && (
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          <section style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h3 style={{ margin: 0 }}>Movimentar Caixa {caixaAtivo.numeroCaixa}</h3>
                <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>
                  {caixaAtivo.nomeCaixa ? `${caixaAtivo.nomeCaixa} · ` : ''}Suprimento ou sangria de numerário físico.
                </p>
              </div>
              {caixasAbertos.length > 1 && (
                <select
                  value={caixaAtivo.id}
                  onChange={(e) => setCaixaAtivoId(e.target.value)}
                  style={{ ...inputStyle, width: 'auto', padding: '4px 8px', fontSize: 12 }}
                >
                  {caixasAbertos.map((c) => (
                    <option key={c.id} value={c.id}>
                      Operando: Caixa {c.numeroCaixa}{c.nomeCaixa ? ` (${c.nomeCaixa})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <form onSubmit={registrarMovimento} style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                <label>
                  <span style={labelStyle}>Tipo</span>
                  <select value={formMovimento.tipo} onChange={(event) => setFormMovimento((atual) => ({ ...atual, tipo: event.target.value }))} style={inputStyle}>
                    <option value="suprimento">Suprimento (+)</option>
                    <option value="sangria">Sangria (-)</option>
                  </select>
                </label>
                <label>
                  <span style={labelStyle}>Valor (R$)</span>
                  <input required type="number" min="0.01" step="0.01" value={formMovimento.valor} onChange={(event) => setFormMovimento((atual) => ({ ...atual, valor: event.target.value }))} style={inputStyle} />
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label>
                  <span style={labelStyle}>Descrição</span>
                  <input required value={formMovimento.descricao} onChange={(event) => setFormMovimento((atual) => ({ ...atual, descricao: event.target.value }))} style={inputStyle} placeholder="Motivo do movimento" />
                </label>
                <label>
                  <span style={labelStyle}>Data/Hora</span>
                  <input type="datetime-local" value={formMovimento.dataMovimento} onChange={(event) => setFormMovimento((atual) => ({ ...atual, dataMovimento: event.target.value }))} style={inputStyle} />
                </label>
              </div>
              <button type="submit" disabled={salvando} style={secondary}>
                Confirmar movimento no Caixa {caixaAtivo.numeroCaixa}
              </button>
            </form>
          </section>

          <section style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h3 style={{ margin: 0 }}>Fechar Caixa {caixaAtivo.numeroCaixa}</h3>
                <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>
                  {caixaAtivo.nomeCaixa ? `${caixaAtivo.nomeCaixa} · ` : ''}Saldo esperado: <strong style={{ color: '#14b87a' }}>{moeda(caixaAtivo.valorEsperadoAtual ?? caixaAtivo.valorAbertura)}</strong>
                </p>
              </div>
              {caixasAbertos.length > 1 && (
                <select
                  value={caixaAtivo.id}
                  onChange={(e) => setCaixaAtivoId(e.target.value)}
                  style={{ ...inputStyle, width: 'auto', padding: '4px 8px', fontSize: 12 }}
                >
                  {caixasAbertos.map((c) => (
                    <option key={c.id} value={c.id}>
                      Fechar: Caixa {c.numeroCaixa}{c.nomeCaixa ? ` (${c.nomeCaixa})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <form onSubmit={fecharCaixa} style={{ display: 'grid', gap: 12 }}>
              <label>
                <span style={labelStyle}>Valor contado (R$)</span>
                <input required type="number" min="0" step="0.01" value={formFechamento.valorInformado} onChange={(event) => setFormFechamento((atual) => ({ ...atual, valorInformado: event.target.value }))} style={inputStyle} placeholder="Informe o numerário físico contado" />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label>
                  <span style={labelStyle}>Observação</span>
                  <input value={formFechamento.observacao} onChange={(event) => setFormFechamento((atual) => ({ ...atual, observacao: event.target.value }))} style={inputStyle} placeholder="Opcional" />
                </label>
                <label>
                  <span style={labelStyle}>Data/Hora</span>
                  <input type="datetime-local" value={formFechamento.dataFechamento} onChange={(event) => setFormFechamento((atual) => ({ ...atual, dataFechamento: event.target.value }))} style={inputStyle} />
                </label>
              </div>
              <button type="submit" disabled={salvando} style={{ ...secondary, color: '#e05c5c', borderColor: 'color-mix(in srgb, #e05c5c 40%, var(--line))', fontWeight: 800 }}>
                Confirmar fechamento do Caixa {caixaAtivo.numeroCaixa}
              </button>
            </form>
          </section>
        </div>
      )}

      {/* SEÇÃO 1: CAIXAS E MOVIMENTOS DO DIA */}
      <section style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 18, overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0 }}>Caixas do dia e sessões de atendimento</h3>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>Histórico de caixas físicos abertos e fechados na data.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {resumo.fechamentoDia ? (
              <button type="button" style={{ ...primary, background: '#14b87a' }} onClick={() => onViewDay(resumo.fechamentoDia)}>
                Ver relatório de fechamento
              </button>
            ) : (
              <button type="button" style={secondary} onClick={() => onCloseDay(data)} disabled={salvando}>
                Fechar dia financeiro
              </button>
            )}
          </div>
        </div>

        {caixas.length === 0 ? (
          <div style={{ color: 'var(--muted)', padding: '20px 0', textAlign: 'center' }}>Nenhum caixa físico registrado para esta data.</div>
        ) : (
          <table style={{ width: '100%', minWidth: 740, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Caixa</th>
                <th style={th}>Status</th>
                <th style={th}>Abertura</th>
                <th style={th}>Esperado</th>
                <th style={th}>Contado</th>
                <th style={th}>Divergência</th>
                <th style={{ ...th, textAlign: 'right' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {caixas.map((caixa) => (
                <tr key={caixa.id} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <strong>Caixa {caixa.numeroCaixa}</strong>
                      {caixa.nomeCaixa && <span style={{ fontSize: 11, background: 'var(--bg)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--line)' }}>{caixa.nomeCaixa}</span>}
                      {caixaAtivo?.id === caixa.id && caixa.status === 'aberto' && (
                        <span style={{ fontSize: 10, background: '#14b87a', color: '#fff', padding: '1px 5px', borderRadius: 4, fontWeight: 800 }}>ATIVO</span>
                      )}
                    </div>
                    <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                      {new Date(caixa.abertoEm).toLocaleDateString('pt-BR')} às {new Date(caixa.abertoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>
                  <td style={td}>
                    <span style={{ color: caixa.status === 'aberto' ? '#14b87a' : 'var(--muted)', fontWeight: 800 }}>
                      {statusLabel(caixa.status)}
                    </span>
                  </td>
                  <td style={td}>{moeda(caixa.valorAbertura)}</td>
                  <td style={td}>
                    {caixa.status === 'aberto'
                      ? (caixa.valorEsperadoAtual != null ? moeda(caixa.valorEsperadoAtual) : '—')
                      : (caixa.valorEsperado != null ? moeda(caixa.valorEsperado) : '—')}
                  </td>
                  <td style={td}>{caixa.valorInformado == null ? '—' : moeda(caixa.valorInformado)}</td>
                  <td style={{ ...td, color: Number(caixa.divergencia || 0) === 0 ? '#14b87a' : '#e05c5c', fontWeight: 800 }}>
                    {caixa.divergencia == null ? '—' : moeda(caixa.divergencia)}
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}>
                      {caixa.status === 'aberto' && caixaAtivo?.id !== caixa.id && (
                        <button
                          type="button"
                          style={{
                            padding: '4px 8px',
                            borderRadius: 6,
                            border: '1px solid #14b87a',
                            background: 'transparent',
                            color: '#14b87a',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                          onClick={() => setCaixaAtivoId(caixa.id)}
                        >
                          Tornar ativo
                        </button>
                      )}
                      <button
                        type="button"
                        style={{
                          padding: '4px 8px',
                          borderRadius: 6,
                          border: '1px solid var(--line)',
                          background: filtroCaixaId === caixa.id ? 'var(--accent)' : 'transparent',
                          color: filtroCaixaId === caixa.id ? '#fff' : 'var(--fg)',
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                        onClick={() => setFiltroCaixaId(filtroCaixaId === caixa.id ? '' : caixa.id)}
                      >
                        {filtroCaixaId === caixa.id ? '✓ Vendo caixa' : 'Ver comandas'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Movimentos do Caixa (suprimentos, sangrias, estornos) */}
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
            Movimentos físicos recentes (Sangrias, Suprimentos e Estornos)
          </div>
          {movimentos.length === 0 ? (
            <small style={{ color: 'var(--muted)' }}>Nenhum movimento manual registrado.</small>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {movimentos.slice(-10).reverse().map((mov) => {
                const isNeg = mov.tipo === 'sangria' || mov.tipo === 'estorno_recebimento';
                return (
                  <div key={mov.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--line)' }}>
                    <div>
                      <strong style={{ fontSize: 13 }}>{statusLabel(mov.tipo)}</strong>
                      <span style={{ color: 'var(--muted)', fontSize: 12, marginLeft: 8 }}>{mov.descricao || '—'}</span>
                      {mov.usuario && <small style={{ color: 'var(--muted)', display: 'block', fontSize: 11 }}>Registrado por: {mov.usuario}</small>}
                    </div>
                    <strong style={{ color: isNeg ? '#e05c5c' : '#14b87a', fontSize: 14 }}>
                      {isNeg ? `- ${moeda(mov.valor)}` : `+ ${moeda(mov.valor)}`}
                    </strong>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* CONFERÊNCIA DETALHADA DO CAIXA SELECIONADO (PADRÃO AVEC) */}
      {caixaExibidoId && (
        <BarbeariaCaixaDetalhado
          caixaId={caixaExibidoId}
          data={data}
          profissionais={profissionais}
          onOpenComanda={onOpenComanda}
          onCancelarComandaFinalizada={onCancelarComandaFinalizada}
          onCaixaAtualizado={onRefresh}
          toast={toast}
        />
      )}

      {/* SEÇÃO 2: DETALHAMENTO DE COMANDAS FECHADAS NO CAIXA */}
      <section style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0 }}>Comandas Fechadas no Caixa</h3>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13 }}>
              Consulte exatamente o que foi fechado em cada comanda (serviços, produtos, valores e meios de pagamento) e realize cancelamentos com estorno formal.
            </p>
          </div>
          <span style={{ fontSize: 12, color: 'var(--muted)', background: 'var(--bg)', padding: '6px 10px', borderRadius: 6, border: '1px solid var(--line)' }}>
            Exibindo <strong>{comandasDoCaixa.length}</strong> de <strong>{todasComandas.length}</strong> comanda(s)
          </span>
        </div>

        {/* Mini KPIs das Comandas do Caixa */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
          <div style={{ background: 'var(--bg)', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--line)' }}>
            <small style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Faturado Filtrado</small>
            <strong style={{ display: 'block', fontSize: 18, color: '#14b87a', marginTop: 4 }}>{moeda(totaisFiltrados.totalFaturado)}</strong>
            <small style={{ color: 'var(--muted)' }}>{totaisFiltrados.pagasCount} paga(s)</small>
          </div>
          <div style={{ background: 'var(--bg)', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--line)' }}>
            <small style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Dinheiro Caixa</small>
            <strong style={{ display: 'block', fontSize: 18, color: '#14b87a', marginTop: 4 }}>{moeda(totaisFiltrados.totalDinheiro)}</strong>
            <small style={{ color: 'var(--muted)' }}>numerário físico</small>
          </div>
          <div style={{ background: 'var(--bg)', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--line)' }}>
            <small style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>PIX</small>
            <strong style={{ display: 'block', fontSize: 18, color: '#38bdf8', marginTop: 4 }}>{moeda(totaisFiltrados.totalPix)}</strong>
            <small style={{ color: 'var(--muted)' }}>instantâneo</small>
          </div>
          <div style={{ background: 'var(--bg)', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--line)' }}>
            <small style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Cartão</small>
            <strong style={{ display: 'block', fontSize: 18, color: '#f59e0b', marginTop: 4 }}>{moeda(totaisFiltrados.totalCartao)}</strong>
            <small style={{ color: 'var(--muted)' }}>débito/crédito</small>
          </div>
          <div style={{ background: 'var(--bg)', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--line)' }}>
            <small style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Em Conta</small>
            <strong style={{ display: 'block', fontSize: 18, color: '#8b5cf6', marginTop: 4 }}>{moeda(totaisFiltrados.totalConta)}</strong>
            <small style={{ color: 'var(--muted)' }}>crediário cliente</small>
          </div>
        </div>

        {/* Barra de Filtros e Busca */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 16 }}>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por cliente, tel, barbeiro ou item..."
            style={inputStyle}
          />
          <select value={filtroCaixaId} onChange={(e) => setFiltroCaixaId(e.target.value)} style={inputStyle}>
            <option value="">Todos os caixas</option>
            {caixas.map((c) => (
              <option key={c.id} value={c.id}>
                Caixa {c.numeroCaixa}{c.nomeCaixa ? ` (${c.nomeCaixa})` : ''} ({c.status})
              </option>
            ))}
          </select>
          <select value={filtroMeio} onChange={(e) => setFiltroMeio(e.target.value)} style={inputStyle}>
            <option value="">Todos os meios de pagamento</option>
            <option value="dinheiro">Dinheiro</option>
            <option value="pix">PIX</option>
            <option value="cartao_credito">Cartão de Crédito</option>
            <option value="cartao_debito">Cartão de Débito</option>
            <option value="conta">Em Conta</option>
          </select>
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} style={inputStyle}>
            <option value="todas_fechadas">Fechadas e Canceladas</option>
            <option value="paga">Somente Pagas</option>
            <option value="em_conta">Somente Em Conta</option>
            <option value="cancelada">Somente Canceladas</option>
          </select>
        </div>

        {/* Lista de Comandas com Detalhamento do que foi fechado */}
        {comandasDoCaixa.length === 0 ? (
          <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '30px 10px', background: 'var(--bg)', borderRadius: 10 }}>
            Nenhuma comanda encontrada para os filtros selecionados.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {comandasDoCaixa.map((comanda) => {
              const expandida = Boolean(comandaExpandida[comanda.id]);
              const cancelada = comanda.status === 'cancelada' || comanda.estornada;
              const itens = comanda.itens || [];
              const servicos = itens.filter((i) => i.tipo === 'servico' || i.tipo === 'pacote');
              const produtos = itens.filter((i) => i.tipo === 'produto');
              const pagamentos = comanda.pagamentos || [];
              const horaFormatada = comanda.fechadaEm
                ? new Date(comanda.fechadaEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                : (comanda.atualizadaEm ? new Date(comanda.atualizadaEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—');

              return (
                <div
                  key={comanda.id}
                  style={{
                    background: cancelada ? 'color-mix(in srgb, #e05c5c 6%, var(--bg))' : 'var(--bg)',
                    border: cancelada ? '1px solid rgba(224, 92, 92, 0.35)' : '1px solid var(--line)',
                    borderRadius: 12,
                    padding: 14,
                    transition: 'all 0.2s ease',
                  }}
                >
                  {/* Linha Superior: Cabeçalho da Comanda */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 800,
                          background: cancelada ? '#e05c5c' : (comanda.status === 'paga' ? '#14b87a' : '#8b5cf6'),
                          color: '#fff',
                          textTransform: 'uppercase',
                        }}
                      >
                        {cancelada ? 'Cancelada / Estornada' : (comanda.status === 'paga' ? 'Paga' : 'Em Conta')}
                      </span>
                      <strong style={{ fontSize: 14 }}>{comanda.clienteNome || 'Cliente Eventual'}</strong>
                      {comanda.clienteTelefone && (
                        <small style={{ color: 'var(--muted)' }}>({comanda.clienteTelefone})</small>
                      )}
                      <span style={{ color: 'var(--muted)', fontSize: 12 }}>#{comanda.id}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                        Fechada às <strong>{horaFormatada}</strong>
                      </span>
                      <strong style={{ fontSize: 16, color: cancelada ? 'var(--muted)' : 'var(--fg)', textDecoration: cancelada ? 'line-through' : 'none' }}>
                        {moeda(comanda.totalFaturado ?? comanda.total)}
                      </strong>
                    </div>
                  </div>

                  {/* Resumo rápido do Profissional e Meios */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 8, fontSize: 12, flexWrap: 'wrap' }}>
                    <div style={{ color: 'var(--muted)' }}>
                      Profissional: <strong style={{ color: 'var(--fg)' }}>{comanda.profissionalNome || 'Profissional da casa'}</strong>
                      {comanda.caixaId && <span style={{ marginLeft: 10 }}>· Caixa vinculado: <strong>Caixa {comanda.caixaId.slice(-1)}</strong></span>}
                    </div>

                    {/* Tags de Meios de Pagamento */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {pagamentos.map((p, idx) => (
                        <span
                          key={p.id || idx}
                          style={{
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: 'var(--card)',
                            border: '1px solid var(--line)',
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {p.meio?.toUpperCase()}: {moeda(p.valor)}
                          {p.caixaId && <small style={{ color: 'var(--muted)', marginLeft: 4 }}>(Cx)</small>}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Alerta de Cancelamento se estornada */}
                  {cancelada && (
                    <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(224, 92, 92, 0.08)', border: '1px solid rgba(224, 92, 92, 0.25)', fontSize: 12 }}>
                      <strong style={{ color: '#e05c5c' }}>Comanda Cancelada / Estornada no Caixa:</strong>
                      <span style={{ marginLeft: 6, color: 'var(--fg)' }}>
                        {comanda.cancelamentoMotivo || 'Estorno operacional de caixa'}
                      </span>
                      {comanda.canceladoPor && (
                        <span style={{ color: 'var(--muted)', marginLeft: 8 }}>(por {comanda.canceladoPor})</span>
                      )}
                    </div>
                  )}

                  {/* Botão de Expansão / Detalhamento do que foi fechado */}
                  <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--line)', paddingTop: 10, flexWrap: 'wrap', gap: 8 }}>
                    <button
                      type="button"
                      style={{ background: 'transparent', border: 0, padding: 0, color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                      onClick={() => toggleExpandir(comanda.id)}
                    >
                      {expandida ? '▲ Ocultar itens fechados' : `▼ Ver o que foi fechado (${itens.length} item(ns))` }
                    </button>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {onOpenComanda && (
                        <button
                          type="button"
                          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                          onClick={() => onOpenComanda(comanda)}
                        >
                          Abrir comanda completa
                        </button>
                      )}
                      {!cancelada && onOpenComanda && (
                        <button
                          type="button"
                          style={{
                            padding: '6px 12px',
                            borderRadius: 6,
                            border: '1px solid rgba(2, 132, 199, 0.4)',
                            background: 'rgba(2, 132, 199, 0.08)',
                            color: '#0284c7',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                          onClick={() => onOpenComanda(comanda)}
                          title="Alterar valor de algum serviço ou produto e refinalizar comanda"
                        >
                          ✏️ Alterar valor de item / Refinalizar
                        </button>
                      )}

                      {/* Botão Formal do Procedimento de Cancelamento de Comanda Finalizada */}
                      {!cancelada && (
                        <button
                          type="button"
                          style={{
                            padding: '6px 12px',
                            borderRadius: 6,
                            border: '1px solid rgba(224, 92, 92, 0.4)',
                            background: 'rgba(224, 92, 92, 0.08)',
                            color: '#e05c5c',
                            fontSize: 12,
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                          onClick={() => {
                            setModalCancelamento(comanda);
                            setMotivoPredefinido(MOTIVOS_CANCELAMENTO[0]);
                            setMotivoDetalhado('');
                            setReabrirAgendamento(Boolean(comanda.agendamentoId));
                          }}
                        >
                          🚫 Cancelar comanda finalizada
                        </button>
                      )}
                    </div>
                  </div>

                  {/* DETALHAMENTO EXPANDIDO (O QUE FOI FECHADO) */}
                  {expandida && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)', display: 'grid', gap: 12 }}>
                      {/* Serviços */}
                      {servicos.length > 0 && (
                        <div>
                          <strong style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                            Serviços Executados ({servicos.length})
                          </strong>
                          <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
                            {servicos.map((s, idx) => (
                              <div key={s.id || idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--card)', borderRadius: 6, fontSize: 13 }}>
                                <div>
                                  <span>✂️ <strong>{s.nome}</strong></span>
                                  {s.profissionalNome && <small style={{ color: 'var(--muted)', marginLeft: 8 }}>({s.profissionalNome})</small>}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                  <strong>{moeda(s.preco ?? s.precoUnitario)}</strong>
                                  {!cancelada && onOpenComanda && (
                                    <button
                                      type="button"
                                      style={{
                                        marginLeft: 8,
                                        padding: '2px 8px',
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: '#0284c7',
                                        background: 'rgba(2, 132, 199, 0.08)',
                                        border: '1px solid rgba(2, 132, 199, 0.3)',
                                        borderRadius: 4,
                                        cursor: 'pointer',
                                      }}
                                      onClick={() => onOpenComanda(comanda)}
                                      title="Alterar valor do item e refinalizar comanda"
                                    >
                                      ✏️ Alterar
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Produtos */}
                      {produtos.length > 0 && (
                        <div>
                          <strong style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                            Produtos Vendidos ({produtos.length})
                          </strong>
                          <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
                            {produtos.map((p, idx) => (
                              <div key={p.id || idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--card)', borderRadius: 6, fontSize: 13 }}>
                                <div>
                                  <span>🧴 <strong>{p.nome}</strong></span>
                                  <small style={{ color: 'var(--muted)', marginLeft: 8 }}>({p.quantidade || 1}x {moeda(p.precoUnitario || p.preco)})</small>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                  <strong>{moeda(p.subtotal ?? (Number(p.preco || 0) * Number(p.quantidade || 1)))}</strong>
                                  {!cancelada && onOpenComanda && (
                                    <button
                                      type="button"
                                      style={{
                                        marginLeft: 8,
                                        padding: '2px 8px',
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: '#0284c7',
                                        background: 'rgba(2, 132, 199, 0.08)',
                                        border: '1px solid rgba(2, 132, 199, 0.3)',
                                        borderRadius: 4,
                                        cursor: 'pointer',
                                      }}
                                      onClick={() => onOpenComanda(comanda)}
                                      title="Alterar valor do item e refinalizar comanda"
                                    >
                                      ✏️ Alterar
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Discriminação de Subtotal, Desconto e Total */}
                      <div style={{ background: 'var(--card)', padding: '10px 14px', borderRadius: 8, fontSize: 13, display: 'grid', gap: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)' }}>
                          <span>Subtotal dos itens:</span>
                          <span>{moeda(comanda.subtotal || comanda.total)}</span>
                        </div>
                        {Number(comanda.desconto || 0) > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#14b87a' }}>
                            <span>Desconto aplicado:</span>
                            <span>- {moeda(comanda.desconto)}</span>
                          </div>
                        )}
                        {Number(comanda.gorjeta || 0) > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#38bdf8' }}>
                            <span>Gorjeta:</span>
                            <span>+ {moeda(comanda.gorjeta)}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15, borderTop: '1px solid var(--line)', paddingTop: 6, marginTop: 4 }}>
                          <span>Valor Total Faturado:</span>
                          <span style={{ color: cancelada ? '#e05c5c' : '#14b87a' }}>
                            {moeda(comanda.totalFaturado ?? comanda.total)}
                          </span>
                        </div>
                      </div>

                      {/* Detalhamento dos Recebimentos */}
                      <div>
                        <strong style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                          Recebimentos Registrados no Fechamento
                        </strong>
                        <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
                          {pagamentos.map((p, idx) => (
                            <div key={p.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--card)', borderRadius: 6, fontSize: 13 }}>
                              <div>
                                <strong>{p.meio?.toUpperCase()}</strong>
                                {p.caixaId && <span style={{ color: 'var(--muted)', fontSize: 11, marginLeft: 8 }}>· Registrado no Caixa {p.caixaId.slice(-1)}</span>}
                                {p.registradoEm && <span style={{ color: 'var(--muted)', fontSize: 11, marginLeft: 8 }}>às {new Date(p.registradoEm).toLocaleTimeString('pt-BR')}</span>}
                              </div>
                              <strong style={{ color: '#14b87a' }}>{moeda(p.valor)}</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* MODAL DO PROCEDIMENTO DE CANCELAMENTO DE COMANDA FINALIZADA */}
      {modalCancelamento && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !processandoCancelamento) setModalCancelamento(null);
          }}
        >
          <div
            style={{
              background: 'var(--card)',
              border: '1px solid var(--line)',
              borderRadius: 16,
              maxWidth: 540,
              width: '100%',
              padding: 24,
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
              display: 'grid',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--line)', paddingBottom: 14 }}>
              <span style={{ fontSize: 24 }}>⚠️</span>
              <div>
                <h3 style={{ margin: 0, color: '#e05c5c', fontSize: 18 }}>
                  Procedimento de Cancelamento de Comanda Finalizada
                </h3>
                <small style={{ color: 'var(--muted)' }}>
                  Estorno coordenado de caixa, financeiro e estoque
                </small>
              </div>
            </div>

            {/* Resumo da Comanda que será cancelada */}
            <div style={{ background: 'var(--bg)', padding: 12, borderRadius: 10, border: '1px solid var(--line)', fontSize: 13, display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>Comanda:</span>
                <strong>{modalCancelamento.id}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>Cliente:</span>
                <strong>{modalCancelamento.clienteNome || 'Cliente Eventual'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>Valor Faturado a Estornar:</span>
                <strong style={{ color: '#e05c5c', fontSize: 15 }}>
                  {moeda(modalCancelamento.totalFaturado ?? modalCancelamento.total)}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>Meios recebidos:</span>
                <span>
                  {(modalCancelamento.pagamentos || []).map((p) => `${p.meio?.toUpperCase()} (${moeda(p.valor)})`).join(', ') || 'Nenhum'}
                </span>
              </div>
            </div>

            {/* Aviso dos Efeitos do Cancelamento */}
            <div style={{ padding: 12, borderRadius: 10, background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)', fontSize: 12, color: 'var(--fg)', lineHeight: 1.5 }}>
              <strong style={{ color: '#f59e0b', display: 'block', marginBottom: 4 }}>O que acontecerá ao confirmar:</strong>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li><strong>Caixa Operacional:</strong> os recebimentos em dinheiro serão estornados (reduzindo o numerário esperado do caixa).</li>
                <li><strong>Financeiro Central:</strong> lançamentos de receita pagos serão revertidos de forma compensatória e auditada.</li>
                <li><strong>Estoque:</strong> produtos lançados nesta comanda serão devolvidos ao saldo físico de estoque.</li>
                <li><strong>Comissões e Contas:</strong> comissões da comanda serão estornadas e contas em aberto canceladas.</li>
              </ul>
            </div>

            {/* Formulário de Justificativa */}
            <form onSubmit={executarProcedimentoCancelamento} style={{ display: 'grid', gap: 12 }}>
              <label>
                <span style={labelStyle}>Motivo do cancelamento (obrigatório)</span>
                <select
                  value={motivoPredefinido}
                  onChange={(e) => setMotivoPredefinido(e.target.value)}
                  style={inputStyle}
                  disabled={processandoCancelamento}
                >
                  {MOTIVOS_CANCELAMENTO.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </label>

              <label>
                <span style={labelStyle}>Observação / Justificativa adicional</span>
                <textarea
                  rows={2}
                  value={motivoDetalhado}
                  onChange={(e) => setMotivoDetalhado(e.target.value)}
                  style={{ ...inputStyle, resize: 'vertical' }}
                  placeholder="Descreva detalhes que justifiquem o cancelamento desta comanda já finalizada..."
                  disabled={processandoCancelamento}
                />
              </label>

              {modalCancelamento.agendamentoId && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={reabrirAgendamento}
                    onChange={(e) => setReabrirAgendamento(e.target.checked)}
                    disabled={processandoCancelamento}
                  />
                  <span>Reabrir horário do agendamento vinculado na agenda operacional</span>
                </label>
              )}

              <label style={{ display: 'grid', gap: 4 }}>
                <span style={{ ...labelStyle, color: '#e05c5c', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>🔒 Senha de Gerente / Administrador</span>
                  <small style={{ color: 'var(--muted)', fontWeight: 400 }}>(Opcional se já estiver logado como gestor/admin)</small>
                </span>
                <input
                  type="password"
                  value={cancelarSenhaGerente}
                  onChange={(e) => setCancelarSenhaGerente(e.target.value)}
                  style={{ ...inputStyle, borderColor: '#e05c5c' }}
                  placeholder="Senha de gerente (opcional para admin logado)..."
                  disabled={processandoCancelamento}
                />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  style={secondary}
                  onClick={() => setModalCancelamento(null)}
                  disabled={processandoCancelamento}
                >
                  Voltar / Manter comanda
                </button>
                <button
                  type="submit"
                  style={{
                    ...primary,
                    background: '#e05c5c',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  disabled={processandoCancelamento}
                >
                  {processandoCancelamento ? 'Estornando comanda...' : 'Confirmar Cancelamento & Estorno'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE ABERTURA DE NOVO CAIXA (MÚLTIPLOS CAIXAS) */}
      {modalAbrirCaixa && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !salvando) setModalAbrirCaixa(false);
          }}
        >
          <div
            style={{
              background: 'var(--card)',
              border: '1px solid var(--line)',
              borderRadius: 16,
              maxWidth: 480,
              width: '100%',
              padding: 24,
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
              display: 'grid',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', paddingBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18 }}>Abrir Novo Caixa</h3>
                <small style={{ color: 'var(--muted)' }}>
                  Abertura simultânea de caixas (Caixa 1, 2, 3, 4...)
                </small>
              </div>
              <button
                type="button"
                onClick={() => setModalAbrirCaixa(false)}
                style={{ background: 'transparent', border: 0, fontSize: 18, cursor: 'pointer', color: 'var(--muted)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={abrirCaixa} style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10 }}>
                <label>
                  <span style={labelStyle}>Número do caixa *</span>
                  <input
                    required
                    type="number"
                    min="1"
                    value={formCaixa.numeroCaixa}
                    onChange={(event) => setFormCaixa((atual) => ({ ...atual, numeroCaixa: event.target.value }))}
                    style={inputStyle}
                  />
                </label>
                <label>
                  <span style={labelStyle}>Nome / Identificador</span>
                  <input
                    value={formCaixa.nomeCaixa || ''}
                    onChange={(event) => setFormCaixa((atual) => ({ ...atual, nomeCaixa: event.target.value }))}
                    style={inputStyle}
                    placeholder="Ex.: Balcão 2, Bar, Recepção"
                  />
                </label>
              </div>
              <label>
                <span style={labelStyle}>Fundo de abertura / Troco (R$)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formCaixa.valorAbertura}
                  onChange={(event) => setFormCaixa((atual) => ({ ...atual, valorAbertura: event.target.value }))}
                  style={inputStyle}
                  placeholder="0,00"
                />
              </label>
              <label>
                <span style={labelStyle}>Data/Hora de abertura</span>
                <input
                  type="datetime-local"
                  value={formCaixa.dataAbertura}
                  onChange={(event) => setFormCaixa((atual) => ({ ...atual, dataAbertura: event.target.value }))}
                  style={inputStyle}
                />
              </label>
              <label>
                <span style={labelStyle}>Observação</span>
                <input
                  value={formCaixa.observacao}
                  onChange={(event) => setFormCaixa((atual) => ({ ...atual, observacao: event.target.value }))}
                  style={inputStyle}
                  placeholder="Ex.: Turno tarde / Balcão 2"
                />
              </label>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setModalAbrirCaixa(false)} style={secondary}>
                  Cancelar
                </button>
                <button type="submit" disabled={salvando} style={primary}>
                  Confirmar Abertura do Caixa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', font: 'inherit' };
const labelStyle = { display: 'block', color: 'var(--muted)', fontSize: 12, fontWeight: 700, marginBottom: 6 };
const primary = { padding: '10px 14px', border: 0, borderRadius: 9, background: 'var(--accent)', color: '#fff', fontWeight: 800, cursor: 'pointer' };
const secondary = { padding: '10px 14px', border: '1px solid var(--line)', borderRadius: 9, background: 'transparent', color: 'var(--fg)', fontWeight: 800, cursor: 'pointer' };
const th = { padding: '10px 8px', textAlign: 'left', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase' };
const td = { padding: '10px 8px', fontSize: 13 };
