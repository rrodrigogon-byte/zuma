import { dateTime } from './format'
import { operationalStatusKeys, sumCounts, timestampStateLabel, whatsappOperationalSummary } from './whatsapp-ai-operational'

const numberFormat = new Intl.NumberFormat('pt-BR')

function count(value) {
  return value == null ? 'não verificável' : numberFormat.format(value)
}

function timestamp(value, missing = 'sem registro') {
  const label = timestampStateLabel(value, { missing })
  if (!value || ['missing', 'invalid', 'future', 'expired'].includes(value.state)) return label
  return `${dateTime(value.value)}${value.state === 'stale' ? ' · leitura antiga' : ''}`
}

function Item({ children, tone = '' }) {
  return <li className={tone ? `dadm-operational-item ${tone}` : 'dadm-operational-item'}><span aria-hidden="true">{tone === 'danger' ? '!' : '•'}</span><p>{children}</p></li>
}

function StatusRow({ label, value, hint }) {
  return <div><dt>{label}</dt><dd>{value}{hint && <small>{hint}</small>}</dd></div>
}

function channelLabel(channel) {
  if (!channel?.configured) return 'Não configurado'
  if (channel.status === 'ativo') return 'Ativo'
  if (channel.status === 'rascunho') return 'Rascunho'
  if (channel.status === 'pausado') return 'Pausado'
  return 'Não verificável'
}

function providerLatencyLabel(provider) {
  const latency = provider?.latency24h
  if (!latency || latency.sampleSize == null) return { value: 'não verificável', hint: 'Percentis indisponíveis nesta leitura.' }
  if (latency.sampleSize === 0) return { value: 'sem amostras válidas', hint: '0 durações positivas registradas; zero também pode ser ausência de medição.' }
  if (latency.p50Ms == null || latency.p95Ms == null) return { value: 'não verificável', hint: 'Percentis indisponíveis nesta leitura.' }
  return {
    value: `p50 ${numberFormat.format(latency.p50Ms)} ms · p95 ${numberFormat.format(latency.p95Ms)} ms`,
    hint: `${count(latency.sampleSize)} durações positivas · janela 24 h · unidade atual. Zero/default não participa dos percentis. Mede somente execuções do provedor, não é latência ponta a ponta da conversa; não comprova SLA, especialmente com amostra pequena.`,
  }
}

export function WhatsappAiOperationalSection({ status, readAt }) {
  const guidance = whatsappOperationalSummary(status)
  const providerLatency = providerLatencyLabel(status?.kind === 'valid' ? status.provider24h : null)
  const humanSessions = status?.kind === 'valid' ? sumCounts(status.sessions, operationalStatusKeys.sessionHuman) : null
  const unassignedHuman = status?.kind === 'valid' ? status.humanQueue.unassigned : null
  const deliveryOther = status?.kind === 'valid'
    ? sumCounts(status.deliveries, ['unknown', 'skipped', 'legacy']) + Number(status.deliveries.unclassified || 0)
    : null
  return <section className="dadm-card dadm-operational" aria-labelledby="wa-ai-health">
    <div className="c360-card-head"><h2 id="wa-ai-health">Saúde e pendências da IA</h2><span className="dadm-operational-scope">Empresa e unidade atuais</span></div>
    {status?.kind === 'loading' && <p className="c360-empty" role="status">Consultando a leitura operacional…</p>}
    {status?.kind === 'unverifiable' && <>
      <p className="dadm-note warn" role="status">
        {status.reason === 'permission' ? 'Não verificável por permissão: seu perfil não pode ler o status operacional.' : status.reason === 'context' ? 'Não verificável: selecione uma empresa e uma unidade autorizadas.' : status.reason === 'unavailable' ? 'Indisponível agora: o servidor não respondeu ao status operacional. Tente a atualização manual.' : 'Não verificável: a leitura operacional está indisponível ou não passou na validação.'}
      </p>
      <p className="dadm-operational-reading">Última leitura do painel: {readAt ? dateTime(readAt) : 'sem leitura válida'}</p>
    </>}
    {status?.kind === 'valid' && <>
      <p className="dadm-operational-intro">Leitura agregada da empresa e unidade selecionadas. O worker é compartilhado globalmente: estar ativo não prova atendimento saudável nesta unidade.</p>
      <div className="dadm-operational-guidance" role="status" aria-label="Próximo passo operacional">
        <span>Próximo passo · orientação baseada nesta leitura</span>
        <strong>{guidance.title}</strong>
        <p>{guidance.nextStep}</p>
        <small>{guidance.conditionCount === 0 ? 'Nenhum alerta classificado; não é garantia de saúde.' : `${guidance.conditionCount} condições observadas, não total de atendimentos ou taxa de falha.`} Sem ação automática.</small>
      </div>
      <dl className="dadm-result dadm-operational-result">
        <StatusRow label="Estado da IA no servidor" value={status.featureEnabled ? 'Liberada' : 'Desativada'} hint={status.featureEnabled ? undefined : 'A funcionalidade está desligada no servidor.'} />
        <StatusRow label="Canal desta unidade" value={channelLabel(status.channel)} hint={status.channel?.configured && status.channel.status === 'rascunho' ? 'Revisar configuração antes de ativar.' : status.channel?.configured && status.channel.status === 'pausado' ? 'Retomar somente após revisão da operação.' : undefined} />
        <StatusRow label="Circuito da IA" value={status.channel.aiCircuitOpen === true ? 'Aberto · automação não saudável' : status.channel.aiCircuitOpen === false ? 'Fechado' : 'Não verificável'} hint={status.channel.aiCircuitOpen === true ? `${count(status.channel.aiConsecutiveFailures)} falha(s) consecutiva(s); não ativar automação sem revisão.` : undefined} />
        <StatusRow label="Último evento recebido" value={timestamp(status.channel?.lastEventAt, 'sem evento')} hint="Evento não é a mesma coisa que a última leitura do painel." />
        <StatusRow label="Worker compartilhado" value={!status.worker.verifiable ? 'Não verificável' : status.worker.active === true ? 'Lease ativo · observável' : 'Lease inativo'} hint="Escopo global; heartbeat recente não prova atendimento saudável nesta unidade." />
        <StatusRow label="Expiração do lease global" value={timestamp(status.worker.leaseExpiresAt, 'sem registro')} />
        <StatusRow label="Último heartbeat global" value={timestamp(status.worker.lastHeartbeatAt, 'sem registro')} />
        <StatusRow label="Execuções do provedor · 24 h" value={count(status.provider24h.total)} hint={status.provider24h.total === 0 ? 'Sem execuções; isso não comprova sucesso nem falha.' : undefined} />
        <StatusRow label="Latência média · 24 h" value={status.provider24h.total === 0 ? 'sem execuções' : status.provider24h.latency24h?.sampleSize === 0 ? 'não verificável' : status.provider24h.avgLatencyMs == null ? 'não verificável' : `${count(status.provider24h.avgLatencyMs)} ms`} hint={status.provider24h.total > 0 ? status.provider24h.latency24h?.sampleSize === 0 ? 'Nenhuma latência válida nesta janela; não exibir zero como fallback.' : 'Média legada inclui registros zero/default; percentis usam apenas durações positivas. Não são amostras idênticas.' : undefined} />
        <StatusRow label="Percentis da latência · 24 h" value={providerLatency.value} hint={providerLatency.hint} />
      </dl>
      <div className="dadm-operational-metrics" aria-label="Contagens agregadas">
        <div><span>Sessões humano</span><strong>{count(humanSessions)}</strong></div>
        <div><span>Sem responsável</span><strong>{count(unassignedHuman)}</strong></div>
        <div><span>Pendentes</span><strong>{count(sumCounts(status.tasks, operationalStatusKeys.taskPending))}</strong></div>
        <div><span>Falhas</span><strong>{count(sumCounts(status.tasks, operationalStatusKeys.taskFailed))}</strong></div>
        <div><span>Dead-letter</span><strong>{count(status.tasks.counts?.deadLetter ?? null)}</strong></div>
        <div><span>Outros registros</span><strong>{count(deliveryOther)}</strong></div>
        <div><span>Envio registrado</span><strong>{count(status.deliveries.counts?.sent ?? null)}</strong></div>
        <div><span>Falha de entrega</span><strong>{count(status.deliveries.counts?.failed ?? null)}</strong></div>
      </div>
      <details className="dadm-operational-details">
        <summary>Ver orientações e limites ({guidance.conditionCount})</summary>
        <ul className="dadm-operational-actions">
          {guidance.conditions.map(item => <Item key={item.code} tone={item.severity === 'critical' ? 'danger' : ''}>
            <strong>{item.title}{item.scope === 'global' ? ' · escopo global' : ''}.</strong> {item.nextStep}
          </Item>)}
          <Item>Envio registrado não comprova entrega nem leitura. Worker global não comprova atendimento saudável nesta unidade.</Item>
          {humanSessions > 0 && unassignedHuman === 0 && <Item>Sessões humanas estão registradas; a contagem não prova espera por atendimento.</Item>}
        </ul>
      </details>
      <p className="dadm-operational-reading">Última leitura do painel: {readAt ? dateTime(readAt) : 'sem leitura válida'}. Horários acima identificam eventos ou lease, não substituem esta leitura.</p>
    </>}
  </section>
}
