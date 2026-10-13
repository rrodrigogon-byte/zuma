import { dateTime } from './format'
import { operationalStatusKeys, sumCounts, timestampStateLabel } from './whatsapp-ai-operational'

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

export function WhatsappAiOperationalSection({ status, readAt }) {
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
      <dl className="dadm-result dadm-operational-result">
        <StatusRow label="Estado da IA no servidor" value={status.featureEnabled ? 'Liberada' : 'Desativada'} hint={status.featureEnabled ? undefined : 'A funcionalidade está desligada no servidor.'} />
        <StatusRow label="Canal desta unidade" value={channelLabel(status.channel)} hint={status.channel?.configured && status.channel.status === 'rascunho' ? 'Revisar configuração antes de ativar.' : status.channel?.configured && status.channel.status === 'pausado' ? 'Retomar somente após revisão da operação.' : undefined} />
        <StatusRow label="Circuito da IA" value={status.channel.aiCircuitOpen === true ? 'Aberto · automação não saudável' : status.channel.aiCircuitOpen === false ? 'Fechado' : 'Não verificável'} hint={status.channel.aiCircuitOpen === true ? `${count(status.channel.aiConsecutiveFailures)} falha(s) consecutiva(s); não ativar automação sem revisão.` : undefined} />
        <StatusRow label="Último evento recebido" value={timestamp(status.channel?.lastEventAt, 'sem evento')} hint="Evento não é a mesma coisa que a última leitura do painel." />
        <StatusRow label="Worker compartilhado" value={!status.worker.verifiable ? 'Não verificável' : status.worker.active === true ? 'Lease ativo · observável' : 'Lease inativo'} hint="Escopo global; heartbeat recente não prova atendimento saudável nesta unidade." />
        <StatusRow label="Expiração do lease global" value={timestamp(status.worker.leaseExpiresAt, 'sem registro')} />
        <StatusRow label="Último heartbeat global" value={timestamp(status.worker.lastHeartbeatAt, 'sem registro')} />
        <StatusRow label="Execuções do provedor · 24 h" value={count(status.provider24h.total)} hint={status.provider24h.total === 0 ? 'Sem execuções; isso não comprova sucesso nem falha.' : undefined} />
        <StatusRow label="Latência média · 24 h" value={status.provider24h.total === 0 ? 'sem execuções' : status.provider24h.avgLatencyMs == null ? 'não verificável' : `${count(status.provider24h.avgLatencyMs)} ms`} hint={status.provider24h.total > 0 ? 'Média registrada; não é p95.' : undefined} />
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
      <ul className="dadm-operational-actions">
        {!status.featureEnabled && <Item>IA desativada no servidor: confirmar a decisão com a administração antes de qualquer ativação.</Item>}
        {!status.channel.configured && <Item>Canal não configurado nesta unidade: revisar o vínculo e a configuração autorizada; não há ação mutável nesta seção.</Item>}
        {status.channel.status === 'rascunho' && <Item>Canal em rascunho: revisar configuração e permissões antes de ativar.</Item>}
        {status.channel.status === 'pausado' && <Item>Canal pausado: confirmar com a equipe se a operação deve permanecer interrompida.</Item>}
        {status.channel.aiCircuitOpen === true && <Item tone="danger">Circuito da IA aberto: o canal não é uma automação saudável agora. Confirmar falhas consecutivas e manter a revisão humana antes de ativar ou retomar.</Item>}
        {status.worker.verifiable && status.worker.active === true && <Item>Worker compartilhado com heartbeat recente e lease ativo: acompanhar os registros desta unidade separadamente; isso não comprova atendimento saudável.</Item>}
        {status.worker.verifiable && status.worker.active !== true && <Item tone="danger">Worker compartilhado observável, mas sem lease ativo: confirmar a operação global com a equipe responsável.</Item>}
        {!status.worker.verifiable && <Item tone="danger">Worker compartilhado não verificável: heartbeat ausente, antigo, futuro ou inválido; confirmar a operação global sem atribuir a causa a esta unidade.</Item>}
        {sumCounts(status.tasks, operationalStatusKeys.taskPending) > 0 && <Item>Há tarefas pendentes ou em processamento: acompanhar a fila da unidade; esta tela não reprocessa tarefas.</Item>}
        {sumCounts(status.tasks, operationalStatusKeys.taskFailed) > 0 && <Item tone="danger">Há tarefas com falha: revisar o diagnóstico protegido e a causa operacional; não reprocessar por este painel.</Item>}
        {(status.tasks.counts?.deadLetter || 0) > 0 && <Item tone="danger">Há registros em dead-letter: encaminhar para análise manual e preservar a evidência antes de qualquer correção.</Item>}
        {unassignedHuman > 0 && <Item>Há sessões humano sem responsável: encaminhar à equipe responsável pela unidade.</Item>}
        {humanSessions > 0 && unassignedHuman === 0 && <Item>Sessões humano estão registradas nesta unidade; a contagem não prova que estejam aguardando atendimento.</Item>}
        {deliveryOther > 0 && <Item>Há outros registros de entrega não classificados: conferir no provedor. “Enviado” significa envio registrado, não entrega nem leitura.</Item>}
        {status.deliveries.counts?.failed > 0 && <Item tone="danger">Há falhas de entrega registradas: conferir no provedor antes de qualquer reenvio.</Item>}
        {status.deliveries.unclassified > 0 && <Item>Há registros com códigos de entrega não classificados; eles foram preservados como “outros registros”, sem inferir sucesso ou falha.</Item>}
        {status.provider24h.total === 0 && <Item>Sem execuções do provedor nas últimas 24 horas: ausência de registros não equivale a operação saudável.</Item>}
        {status.provider24h.total > 0 && status.provider24h.failed > 0 && <Item tone="danger">Há falhas de provedor nas últimas 24 horas: revisar a causa com a equipe responsável.</Item>}
        {status.featureEnabled && status.channel.configured && status.channel.status === 'ativo' && sumCounts(status.tasks, operationalStatusKeys.taskPending) === 0 && sumCounts(status.tasks, operationalStatusKeys.taskFailed) === 0 && status.provider24h.total === 0 && <Item>Os contadores atuais não apontam registros de fila, mas zeros e HTTP 200 não permitem concluir que está tudo certo.</Item>}
      </ul>
      <p className="dadm-operational-reading">Última leitura do painel: {readAt ? dateTime(readAt) : 'sem leitura válida'}. Horários acima identificam eventos ou lease, não substituem esta leitura.</p>
    </>}
  </section>
}
