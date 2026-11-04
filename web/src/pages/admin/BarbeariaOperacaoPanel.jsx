import { useState } from 'react';
import { fmtDateOnly, fmtR } from '../../lib/api';
import BarbeariaCaixaDetalhado from './BarbeariaCaixaDetalhado';
import { Unlock, Eye } from 'lucide-react';

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
  return { aberto: 'Aberto', fechado: 'Fechado', recebimento: 'Recebimento', sangria: 'Sangria', suprimento: 'Suprimento' }[status] || status || '—';
}

export default function BarbeariaOperacaoPanel({
  data,
  operacao = {},
  onOpenCaixa,
  onMove,
  onClose,
  onCloseDay,
  onViewDay,
  onRefresh,
  toast,
  salvando = false,
}) {
  const [formCaixa, setFormCaixa] = useState({ numeroCaixa: 1, valorAbertura: '', observacao: '', dataAbertura: '' });
  const [formMovimento, setFormMovimento] = useState({ tipo: 'suprimento', valor: '', descricao: '', dataMovimento: '' });
  const [formFechamento, setFormFechamento] = useState({ valorInformado: '', observacao: '', dataFechamento: '' });
  
  const caixas = operacao.caixas || [];
  const caixaAberto = operacao.caixaAberto;
  const movimentos = operacao.movimentos || [];
  const resumo = operacao;

  // Caixa selecionado para visualização no padrão AVEC
  const [caixaAtivoId, setCaixaAtivoId] = useState(null);
  const caixaExibidoId = caixaAtivoId || caixaAberto?.id || caixas[0]?.id || null;

  // Unifica comandas disponíveis (vindas de props ou do resumo da operação)
  const todasComandas = useMemo(() => {
    const lista = (operacao.comandas && operacao.comandas.length ? operacao.comandas : comandasProps) || []
    return lista
  }, [operacao.comandas, comandasProps])

  // Filtra comandas do caixa para exibição
  const comandasDoCaixa = useMemo(() => {
    return todasComandas.filter((comanda) => {
      // Por padrão foca nas que foram finalizadas ou canceladas
      const ehFechadaOuCancelada = ['paga', 'em_conta', 'cancelada'].includes(comanda.status) || comanda.estornada || (comanda.pagamentos && comanda.pagamentos.length > 0)
      if (filtroStatus === 'todas_fechadas' && !ehFechadaOuCancelada) return false
      if (filtroStatus === 'paga' && comanda.status !== 'paga') return false
      if (filtroStatus === 'em_conta' && comanda.status !== 'em_conta') return false
      if (filtroStatus === 'cancelada' && comanda.status !== 'cancelada' && !comanda.estornada) return false

      // Filtro por caixa específico
      if (filtroCaixaId) {
        const vinculadoAoCaixa = String(comanda.caixaId) === String(filtroCaixaId) ||
          (comanda.pagamentos || []).some((p) => String(p.caixaId) === String(filtroCaixaId))
        if (!vinculadoAoCaixa) return false
      }

      // Filtro por meio de pagamento
      if (filtroMeio) {
        const temMeio = (comanda.pagamentos || []).some((p) => String(p.meio || '').toLowerCase() === filtroMeio.toLowerCase())
        if (!temMeio) return false
      }

      // Busca textual por cliente, telefone, barbeiro ou ID
      if (busca.trim()) {
        const termo = busca.toLowerCase().trim()
        const matchCliente = String(comanda.clienteNome || '').toLowerCase().includes(termo)
        const matchTelefone = String(comanda.clienteTelefone || '').includes(termo)
        const matchProf = String(comanda.profissionalNome || '').toLowerCase().includes(termo)
        const matchId = String(comanda.id || '').toLowerCase().includes(termo)
        const matchItens = (comanda.itens || []).some((i) => String(i.nome || '').toLowerCase().includes(termo))
        if (!matchCliente && !matchTelefone && !matchProf && !matchId && !matchItens) return false
      }

      return true
    })
  }, [todasComandas, filtroStatus, filtroCaixaId, filtroMeio, busca])

  // Totais das comandas filtradas
  const totaisFiltrados = useMemo(() => {
    let totalFaturado = 0
    let totalDinheiro = 0
    let totalPix = 0
    let totalCartao = 0
    let totalConta = 0
    let pagasCount = 0
    let canceladasCount = 0

    for (const c of comandasDoCaixa) {
      if (c.status === 'cancelada' || c.estornada) {
        canceladasCount++
        continue
      }
      pagasCount++
      const valor = Number(c.totalFaturado ?? c.total ?? 0)
      totalFaturado += valor

      for (const p of c.pagamentos || []) {
        const v = Number(p.valor || 0)
        const m = String(p.meio || '').toLowerCase()
        if (m === 'dinheiro') totalDinheiro += v
        else if (m === 'pix') totalPix += v
        else if (m.includes('cartao') || m === 'credito' || m === 'debito') totalCartao += v
        else if (m === 'conta') totalConta += v
      }
    }

    return { totalFaturado, totalDinheiro, totalPix, totalCartao, totalConta, pagasCount, canceladasCount }
  }, [comandasDoCaixa])

  function toggleExpandir(id) {
    setComandaExpandida((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function abrirCaixa(event) {
    event.preventDefault();
    if (!window.confirm(`Confirmar abertura do caixa ${formCaixa.numeroCaixa}?`)) return;
    let customDate = `${data}T12:00:00.000Z`;
    if (formCaixa.dataAbertura) {
      customDate = new Date(formCaixa.dataAbertura).toISOString()
    }
    onOpenCaixa({
      ...formCaixa,
      numeroCaixa: Number(formCaixa.numeroCaixa),
      valorAbertura: Number(formCaixa.valorAbertura || 0),
      dataOperacao: customDate,
      abertoEm: formCaixa.dataAbertura ? customDate : undefined,
      confirmado: true,
    });
  }

  function registrarMovimento(event) {
    event.preventDefault();
    if (!caixaAberto) return;
    if (!window.confirm(`Confirmar ${formMovimento.tipo === 'sangria' ? 'sangria' : 'suprimento'} de ${moeda(formMovimento.valor)}?`)) return;
    let customDate = undefined;
    if (formMovimento.dataMovimento) {
      customDate = new Date(formMovimento.dataMovimento).toISOString()
    }
    onMove(caixaAberto, { ...formMovimento, valor: Number(formMovimento.valor || 0), criadoEm: customDate, confirmado: true });
    setFormMovimento({ tipo: 'suprimento', valor: '', descricao: '', dataMovimento: '' });
  }

  function fecharCaixa(event) {
    event.preventDefault();
    if (!caixaAberto) return;
    const valor = Number(formFechamento.valorInformado || 0);
    if (!window.confirm(`Confirmar fechamento do caixa ${caixaAberto.numeroCaixa} com valor contado de ${moeda(valor)}?`)) return;
    let customDate = undefined;
    if (formFechamento.dataFechamento) {
      customDate = new Date(formFechamento.dataFechamento).toISOString()
    }
    onClose(caixaAberto, { ...formFechamento, valorInformado: valor, fechadoEm: customDate, confirmado: true });
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      
      {/* KPI RESUMO DO DIA */}
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <section style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 12%, var(--card)), var(--card))', border: '1px solid var(--line)', borderRadius: 16, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em' }}>Operação da unidade</div>
              <h2 style={{ margin: '6px 0 4px' }}>Abertura, Fechamento e Conferência</h2>
              <p style={{ color: 'var(--muted)', margin: 0 }}>Relatório consolidado por forma de pagamento, drilldown de comandas e reabertura para correções.</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <strong style={{ display: 'block', fontSize: 18 }}>{fmtDateOnly(data)}</strong>
              <small style={{ color: 'var(--muted)' }}>{resumo.lojaId ? `Unidade ${resumo.lojaId}` : 'Unidade da sessão'}</small>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 18 }}>
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: caixaAberto ? '#14b87a' : '#f59e0b' }} />
            <strong>{caixaAberto ? `Caixa ${caixaAberto.numeroCaixa} aberto` : 'Nenhum caixa aberto no momento'}</strong>
            <span style={{ color: 'var(--muted)' }}>
              {caixaAberto ? `desde ${new Date(caixaAberto.abertoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Abra o caixa ou selecione um caixa fechado abaixo para consultar'}
            </span>
          </div>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 10 }}>
          <Kpi label="Recebido em dinheiro" value={moeda(resumo.recebimentosDinheiro)} note="Movimentos dinheiro do caixa" color="#14b87a" />
          <Kpi label="Receita recebida" value={moeda(resumo.receitaRecebida)} note="Total recebido (sem conta)" color="#14b87a" />
          <Kpi label="Faturamento" value={moeda(resumo.faturamentoComandas)} note={`${resumo.comandasPagas || 0} comanda(s) faturada(s)`} />
          <Kpi label="Faturado em conta" value={moeda(resumo.faturadoEmConta)} note={`${resumo.emConta || 0} comanda(s) a receber`} color="#8b5cf6" />
        </section>
      </div>

      {/* SELETOR DE CAIXA CASO HAJA MAIS DE UM */}
      {caixas.length > 1 && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'var(--card)', padding: '10px 16px', borderRadius: 12, border: '1px solid var(--line)', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>Caixas do dia:</span>
          {caixas.map((c) => {
            const isSelected = String(c.id) === String(caixaExibidoId);
            return (
              <button
                type="button"
                key={c.id}
                onClick={() => setCaixaAtivoId(c.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: isSelected ? '2px solid var(--accent)' : '1px solid var(--line)',
                  background: isSelected ? 'var(--accent)' : 'var(--card2)',
                  color: isSelected ? '#ffffff' : 'var(--fg)',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>Caixa {c.numeroCaixa}</span>
                <span style={{ fontSize: 11, opacity: 0.8, textTransform: 'uppercase' }}>({statusLabel(c.status)})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* PAINEL AVEC DETALHADO DO CAIXA COM DRILLDOWN E BOTÃO REABRIR */}
      {caixaExibidoId && (
        <BarbeariaCaixaDetalhado
          key={caixaExibidoId}
          caixaId={caixaExibidoId}
          data={data}
          onCaixaAtualizado={onRefresh}
          toast={toast}
        />
      )}

      {/* FORMULÁRIO DE ABERTURA QUANDO NÃO HOUVER CAIXA ABERTO */}
      {!caixaAberto && (
        <section style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 18 }}>
          <div style={{ marginBottom: 14 }}>
            <h3 style={{ margin: 0 }}>Abrir novo caixa</h3>
            <p style={{ margin: '5px 0 0', color: 'var(--muted)' }}>A abertura cria o caixa operacional da empresa/unidade ativa para registrar recebimentos.</p>
          </div>
          <form onSubmit={abrirCaixa} style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <label>
              <span style={{ display: 'block', color: 'var(--muted)', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Número do caixa</span>
              <input type="number" min="1" value={formCaixa.numeroCaixa} onChange={(event) => setFormCaixa((atual) => ({ ...atual, numeroCaixa: event.target.value }))} style={inputStyle} />
            </label>
            <label>
              <span style={{ display: 'block', color: 'var(--muted)', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Fundo de abertura (R$)</span>
              <input type="number" min="0" step="0.01" value={formCaixa.valorAbertura} onChange={(event) => setFormCaixa((atual) => ({ ...atual, valorAbertura: event.target.value }))} style={inputStyle} />
            </label>
            <label>
              <span style={{ display: 'block', color: 'var(--muted)', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Data/Hora de abertura</span>
              <input type="datetime-local" value={formCaixa.dataAbertura} onChange={(event) => setFormCaixa((atual) => ({ ...atual, dataAbertura: event.target.value }))} style={inputStyle} />
            </label>
            <label>
              <span style={{ display: 'block', color: 'var(--muted)', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Observação</span>
              <input value={formCaixa.observacao} onChange={(event) => setFormCaixa((atual) => ({ ...atual, observacao: event.target.value }))} style={inputStyle} placeholder="Ex.: turno da manhã" />
            </label>
            <button type="submit" disabled={salvando} style={{ ...primary, gridColumn: '1 / -1' }}>Confirmar abertura</button>
          </form>
        </section>
      )}

      {/* AÇÕES DE MOVIMENTO E FECHAMENTO PARA O CAIXA ABERTO */}
      {caixaAberto && (
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          <section style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 18 }}>
            <h3 style={{ margin: 0 }}>Movimentar caixa</h3>
            <p style={{ margin: '5px 0 14px', color: 'var(--muted)' }}>Use suprimento ou sangria para ajustar o numerário físico. Não altera o faturamento.</p>
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
              <button type="submit" disabled={salvando} style={secondary}>Confirmar movimento</button>
            </form>
          </section>

          <section style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 18 }}>
            <h3 style={{ margin: 0 }}>Fechar caixa</h3>
            <p style={{ margin: '5px 0 14px', color: 'var(--muted)' }}>O esperado considera abertura, dinheiro de comandas, suprimentos e sangrias.</p>
            <form onSubmit={fecharCaixa} style={{ display: 'grid', gap: 12 }}>
              <label>
                <span style={labelStyle}>Valor contado (R$)</span>
                <input required type="number" min="0" step="0.01" value={formFechamento.valorInformado} onChange={(event) => setFormFechamento((atual) => ({ ...atual, valorInformado: event.target.value }))} style={inputStyle} placeholder="Informe o numerário físico" />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label>
                  <span style={labelStyle}>Observação</span>
                  <input value={formFechamento.observacao} onChange={(event) => setFormFechamento((atual) => ({ ...atual, observacao: event.target.value }))} style={inputStyle} />
                </label>
                <label>
                  <span style={labelStyle}>Data/Hora</span>
                  <input type="datetime-local" value={formFechamento.dataFechamento} onChange={(event) => setFormFechamento((atual) => ({ ...atual, dataFechamento: event.target.value }))} style={inputStyle} />
                </label>
              </div>
              <button type="submit" disabled={salvando} style={{ ...secondary, color: '#e05c5c', fontWeight: 800 }}>Confirmar fechamento</button>
            </form>
          </section>
        </div>
      )}

      {/* TABELA CONSOLIDADA DE CAIXAS DO DIA */}
      <section style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 18, overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h3 style={{ margin: 0 }}>Histórico de caixas e movimentos do dia</h3>
            <p style={{ margin: '5px 0 0', color: 'var(--muted)' }}>Selecione um caixa para conferência completa ou reabertura.</p>
          </div>
          {resumo.fechamentoDia ? (
            <button type="button" style={{ ...primary, background: '#14b87a' }} onClick={() => onViewDay(resumo.fechamentoDia)}>
              Ver relatório de fechamento do dia
            </button>
          ) : (
            <button type="button" style={secondary} onClick={() => onCloseDay(data)} disabled={salvando}>
              Fechar dia financeiro
            </button>
          )}
        </div>

        {caixas.length === 0 ? (
          <div style={{ color: 'var(--muted)', padding: '20px 0' }}>Nenhum caixa registrado para esta data.</div>
        ) : (
          <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Caixa</th>
                <th style={th}>Status</th>
                <th style={th}>Responsável</th>
                <th style={th}>Abertura</th>
                <th style={th}>Esperado</th>
                <th style={th}>Contado</th>
                <th style={th}>Divergência</th>
                <th style={{ ...th, textAlign: 'center' }}>Conferência</th>
              </tr>
            </thead>
            <tbody>
              {caixas.map((caixa) => (
                <tr
                  key={caixa.id}
                  style={{
                    borderTop: '1px solid var(--line)',
                    background: String(caixa.id) === String(caixaExibidoId) ? 'rgba(37, 99, 235, 0.05)' : 'transparent',
                    cursor: 'pointer',
                  }}
                  onClick={() => setCaixaAtivoId(caixa.id)}
                >
                  <td style={td}>
                    <strong>Caixa {caixa.numeroCaixa}</strong>
                    <div style={{ color: 'var(--muted)', fontSize: 12 }}>{new Date(caixa.abertoEm).toLocaleDateString('pt-BR')} &middot; {caixa.lojaId || 'unidade corporativa'}</div>
                  </td>
                  <td style={td}>
                    <span style={{ color: caixa.status === 'aberto' ? '#14b87a' : 'var(--muted)', fontWeight: 800 }}>
                      {statusLabel(caixa.status)}
                    </span>
                  </td>
                  <td style={td}>{caixa.responsavel?.split('@')[0] || 'Sistema'}</td>
                  <td style={td}>{moeda(caixa.valorAbertura)}</td>
                  <td style={td}>{caixa.valorEsperado == null ? '—' : moeda(caixa.valorEsperado)}</td>
                  <td style={td}>{caixa.valorInformado == null ? '—' : moeda(caixa.valorInformado)}</td>
                  <td style={{ ...td, color: Number(caixa.divergencia || 0) === 0 ? '#14b87a' : '#e05c5c', fontWeight: 800 }}>
                    {caixa.divergencia == null ? '—' : moeda(caixa.divergencia)}
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCaixaAtivoId(caixa.id);
                      }}
                      style={{ padding: '6px 12px', background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      <Eye size={13} /> Conferir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* ÚLTIMOS MOVIMENTOS DE SANGRIA E SUPRIMENTO */}
        <div style={{ display: 'grid', gap: 8, marginTop: 18 }}>
          {movimentos.length === 0 ? (
            <small style={{ color: 'var(--muted)' }}>Nenhum movimento manual ou recebimento em dinheiro registrado.</small>
          ) : (
            movimentos.slice(-12).reverse().map((movimento) => (
              <div key={movimento.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '9px 0', borderTop: '1px solid var(--line)' }}>
                <div>
                  <strong>{statusLabel(movimento.tipo)}</strong>
                  <small style={{ display: 'block', color: 'var(--muted)' }}>{movimento.descricao || '—'}</small>
                </div>
                <strong style={{ color: movimento.tipo === 'sangria' ? '#e05c5c' : '#14b87a' }}>{moeda(movimento.valor)}</strong>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--fg)', font: 'inherit' };
const labelStyle = { display: 'block', color: 'var(--muted)', fontSize: 12, fontWeight: 700, marginBottom: 6 };
const primary = { padding: '10px 14px', border: 0, borderRadius: 9, background: 'var(--accent)', color: '#fff', fontWeight: 800, cursor: 'pointer' };
const secondary = { padding: '10px 14px', border: '1px solid var(--line)', borderRadius: 9, background: 'transparent', color: 'var(--fg)', fontWeight: 800, cursor: 'pointer' };
const th = { padding: '10px 8px', textAlign: 'left', color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase' };
const td = { padding: '10px 8px', fontSize: 13 };
