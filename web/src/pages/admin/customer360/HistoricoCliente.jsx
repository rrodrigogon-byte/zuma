import { fmtR } from '../../../lib/api'
import { Badge, EmptyLine, fmtDay, Table } from './shared'

// Abas "Visão do cliente" e "Consumo" da ficha 360: sugestões de venda,
// gostos, família, plano e tudo o que o cliente já consumiu.

const CATEGORIAS = {
  atencao: { rotulo: 'Atenção', tom: 'danger' },
  plano: { rotulo: 'Plano', tom: 'success' },
  retorno: { rotulo: 'Retorno', tom: 'warning' },
  venda: { rotulo: 'Venda', tom: 'accent' },
  relacionamento: { rotulo: 'Relacionamento', tom: 'info' },
}
const TIPO_ITEM = { servico: 'Serviço', produto: 'Revenda', loja: 'Loja Dino' }
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const quando = (dias) => (dias === 0 ? 'hoje' : dias === 1 ? 'amanhã' : `em ${dias} dias`)
const linkInstagram = (u) => `https://www.instagram.com/${encodeURIComponent(String(u || '').replace(/^@/, ''))}/`

export function VisaoCliente({ historico, agendarHref }) {
  if (!historico) return <EmptyLine>O histórico detalhado não pôde ser montado agora. As demais abas continuam disponíveis.</EmptyLine>
  const { sugestoes = [], dicas = [], familia = [], preferencias, redesSociais = {}, planos = [], aniversario, contatoMarketing } = historico
  const gostos = preferencias ? [
    ['Corte', preferencias.corte], ['Barba', preferencias.barba], ['Bebida', preferencias.bebida], ['Perfumes', preferencias.perfumes],
    ['Produtos que usa', preferencias.produtos], ['Melhor horário', preferencias.horario], ['Atendimento', preferencias.atendimento],
    ['Bairro/Região', preferencias.bairro], ['Cidade', preferencias.cidade],
    ['Profissional preferido', preferencias.profissionalPreferido?.nome],
  ].filter(([, valor]) => valor) : []

  return <div className="c360-stack">
    <section className="c360-h-bloco" aria-labelledby="c360-h-sug">
      <div className="c360-h-titulo">
        <h3 id="c360-h-sug">Sugestões de venda e atenção</h3>
        {agendarHref && <a className="c360-btn ghost" href={agendarHref}>Agendar</a>}
      </div>
      <p className="c360-muted">Cada sugestão mostra de onde veio. Nada é enviado ao cliente automaticamente: confirme no atendimento.</p>
      {contatoMarketing && !contatoMarketing.whatsapp && <p className="c360-note">Oferta por WhatsApp só com autorização de marketing, que este cliente não deu. Ofereça pessoalmente no atendimento.</p>}
      {sugestoes.length ? <ul className="c360-h-sugestoes">
        {sugestoes.map((s) => <li key={s.id} className={s.prioridade === 1 ? 'is-prioridade' : ''}>
          <Badge tone={CATEGORIAS[s.categoria]?.tom || 'muted'}>{CATEGORIAS[s.categoria]?.rotulo || 'Sugestão'}</Badge>
          <div><strong>{s.titulo}</strong><small>{s.detalhe}</small></div>
        </li>)}
      </ul> : <EmptyLine>Nenhuma sugestão agora: o cliente está em dia com serviços, produtos e plano.</EmptyLine>}
    </section>

    {dicas.length > 0 && <section className="c360-h-bloco" aria-labelledby="c360-h-dicas">
      <h3 id="c360-h-dicas">Dicas para o atendimento</h3>
      <ul className="c360-h-dicas">{dicas.map((d) => <li key={d.id}>{d.titulo}</li>)}</ul>
    </section>}

    <div className="c360-h-grade">
      <section className="c360-h-bloco" aria-labelledby="c360-h-gostos">
        <h3 id="c360-h-gostos">Gostos e preferências</h3>
        {gostos.length ? <dl className="c360-h-dl">{gostos.map(([rotulo, valor]) => <div key={rotulo}><dt>{rotulo}</dt><dd>{valor}</dd></div>)}</dl> : <EmptyLine>Nenhuma preferência cadastrada. Preencha no cadastro do cliente.</EmptyLine>}
        {(preferencias?.tags || []).length > 0 && <div className="c360-tags">{preferencias.tags.map((t) => <Badge key={t}>{t}</Badge>)}</div>}
        {preferencias?.observacoes && <p className="c360-muted">{preferencias.observacoes}</p>}
        {aniversario && <p className="c360-muted">Aniversário do cliente: {fmtDay(aniversario.data)} ({quando(aniversario.dias)}{aniversario.idade ? `, faz ${aniversario.idade} anos` : ''})</p>}
      </section>

      <section className="c360-h-bloco" aria-labelledby="c360-h-familia">
        <h3 id="c360-h-familia">Família</h3>
        {familia.length ? <ul className="c360-h-familia">{familia.map((m) => <li key={m.id}>
          <div><strong>{m.nome}</strong><small>{m.relacaoNome}{m.telefone ? ` · ${m.telefone}` : ''}{m.observacao ? ` · ${m.observacao}` : ''}</small></div>
          {m.proximoAniversario && <span className={m.proximoAniversario.dias <= 30 ? 'c360-h-aniv perto' : 'c360-h-aniv'}>🎂 {fmtDay(m.proximoAniversario.data)}<small>{quando(m.proximoAniversario.dias)}{m.proximoAniversario.idade ? ` · ${m.proximoAniversario.idade} anos` : ''}</small></span>}
        </li>)}</ul> : <EmptyLine>Nenhum familiar cadastrado.</EmptyLine>}
        {historico.familiaConsentimento?.concedido && <small className="c360-muted">Responsável autorizou o registro dos filhos{historico.familiaConsentimento.registradoEm ? ` em ${fmtDay(historico.familiaConsentimento.registradoEm)}` : ''}.</small>}
      </section>

      <section className="c360-h-bloco" aria-labelledby="c360-h-plano">
        <h3 id="c360-h-plano">Plano</h3>
        {planos.length ? planos.map((p) => <div key={p.assinaturaId} className={p.utilizavel ? 'c360-h-plano ok' : 'c360-h-plano alerta'}>
          <strong>{p.planoNome}</strong>
          <small>{p.utilizavel ? `${p.sessoesRestantes} de ${p.sessoesNoCiclo} sessão(ões) disponível(is)${p.cicloFim ? ` até ${fmtDay(p.cicloFim)}` : ''}` : `Não abate agora: ${p.motivo || p.situacaoPagamento}`}</small>
          <small>Cobre: {p.todosOsServicos ? 'qualquer serviço' : (p.servicosNomes || []).join(', ')}</small>
        </div>) : <EmptyLine>Sem plano ativo.</EmptyLine>}
      </section>

      <section className="c360-h-bloco" aria-labelledby="c360-h-redes">
        <h3 id="c360-h-redes">Redes sociais</h3>
        {redesSociais.instagram || redesSociais.linkedin ? <div className="c360-tags">
          {redesSociais.instagram && <a className="c360-btn ghost" href={linkInstagram(redesSociais.instagram)} target="_blank" rel="noopener noreferrer">Instagram @{redesSociais.instagram.replace(/^@/, '')}</a>}
          {redesSociais.linkedin && <a className="c360-btn ghost" href={redesSociais.linkedin} target="_blank" rel="noopener noreferrer">LinkedIn</a>}
        </div> : <EmptyLine>Sem redes cadastradas.</EmptyLine>}
        <small className="c360-muted">O Kytto guarda só o link; o perfil abre na própria rede.</small>
      </section>
    </div>
  </div>
}

export function ConsumoCliente({ historico }) {
  if (!historico) return <EmptyLine>O consumo detalhado não pôde ser montado agora.</EmptyLine>
  const c = historico.consumo
  const maximo = Math.max(1, ...c.meses.map((m) => m.valor + m.abatido))
  return <div className="c360-stack">
    <div className="c360-kpis" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
      <article><span>Total consumido</span><strong>{fmtR(c.total)}</strong><small>{c.compras} comanda(s)/compra(s) pagas</small></article>
      <article><span>Ticket médio</span><strong>{fmtR(c.ticketMedio)}</strong><small>por comanda ou compra no balcão</small></article>
      <article><span>Últimos 12 meses</span><strong>{fmtR(c.ultimos12Meses)}</strong><small>média {fmtR(c.mediaMensal12)}/mês</small></article>
      <article><span>Serviços</span><strong>{fmtR(c.porTipo.servicos)}</strong><small>{c.abatidoPlano > 0 ? `+ ${fmtR(c.abatidoPlano)} cobertos pelo plano` : 'sem uso de plano'}</small></article>
      <article><span>Revenda da barbearia</span><strong>{fmtR(c.porTipo.revenda)}</strong><small>produtos no balcão e na comanda</small></article>
    </div>
    {c.comandasAbertas > 0 && <p className="c360-note">{c.comandasAbertas} comanda(s) ainda aberta(s): entram no consumo quando forem pagas.</p>}

    <section className="c360-h-bloco" aria-labelledby="c360-h-meses" style={{ background: 'var(--card)', padding: '24px', borderRadius: '12px', border: '1px solid var(--line)' }}>
      <h3 id="c360-h-meses" style={{ marginTop: 0, marginBottom: '24px' }}>Consumo mês a mês</h3>
      <div className="c360-h-barras" role="img" aria-label={`Consumo dos últimos 12 meses: ${c.meses.map((m) => `${MESES[Number(m.mes.slice(5)) - 1]} ${fmtR(m.valor)}`).join(', ')}`} style={{ display: 'flex', gap: '8px', height: '200px', borderBottom: '1px solid var(--line)', paddingBottom: '12px', marginBottom: '16px' }}>
        {c.meses.map((m) => <div key={m.mes} className="c360-h-barra" title={`${MESES[Number(m.mes.slice(5)) - 1]}/${m.mes.slice(2, 4)}: ${fmtR(m.valor)}${m.abatido ? ` + ${fmtR(m.abatido)} pelo plano` : ''}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
          <div className="c360-h-coluna" style={{ width: '40px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%', position: 'relative' }}>
            {m.abatido > 0 && <span className="plano" style={{ position: 'relative', width: '100%', height: `${(m.abatido / maximo) * 100}%`, background: '#10b981', minHeight: '4px', borderTopLeftRadius: '4px', borderTopRightRadius: '4px', transition: 'height 0.3s' }} />}
            <span className="pago" style={{ position: 'relative', width: '100%', height: `${(m.valor / maximo) * 100}%`, background: '#3b82f6', minHeight: '4px', borderTopLeftRadius: m.abatido > 0 ? 0 : '4px', borderTopRightRadius: m.abatido > 0 ? 0 : '4px', transition: 'height 0.3s' }} />
          </div>
          <small style={{ marginTop: '12px', color: 'var(--muted)', fontSize: '12px' }}>{MESES[Number(m.mes.slice(5)) - 1].toLowerCase()}</small>
        </div>)}
      </div>
      <div className="c360-h-legenda" style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--muted)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><i className="pago" style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#3b82f6' }} /> Pago</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><i className="plano" style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#10b981' }} /> Coberto pelo plano</span>
      </div>
    </section>

    <h3>Mais consumidos</h3>
    <Table caption="Itens mais consumidos" rows={c.maisConsumidos.map((i) => ({ ...i, id: i.chave }))} empty="Nenhum consumo registrado em comandas ou no balcão." columns={[
      { key: 'nome', label: 'Item' }, { key: 'tipo', label: 'Tipo', render: (r) => TIPO_ITEM[r.tipo] || r.tipo },
      { key: 'vezes', label: 'Vezes', align: 'right' }, { key: 'quantidade', label: 'Unidades', align: 'right' },
      { key: 'ultimaEm', label: 'Última vez', render: (r) => fmtDay(r.ultimaEm) }, { key: 'valor', label: 'Total pago', align: 'right', render: (r) => <span>{fmtR(r.valor)}{r.abatidoPlano > 0 && <small className="c360-muted" style={{ display: 'block' }}>+ {fmtR(r.abatidoPlano)} pelo plano</small>}</span> },
    ]} />

    <h3>Tudo o que consumiu</h3>
    <Table caption="Itens consumidos" rows={historico.linhas.map((l, i) => ({ ...l, id: `${l.origemId}-${i}` }))} empty="Nenhum item consumido." columns={[
      { key: 'em', label: 'Data', render: (r) => fmtDay(r.em) }, { key: 'nome', label: 'Item' }, { key: 'tipo', label: 'Tipo', render: (r) => TIPO_ITEM[r.tipo] || r.tipo },
      { key: 'quantidade', label: 'Qtd.', align: 'right' }, { key: 'profissional', label: 'Profissional', render: (r) => r.profissional || '—' },
      { key: 'origem', label: 'Onde', render: (r) => r.origem === 'balcao' ? 'Balcão' : 'Comanda' },
      { key: 'valor', label: 'Valor', align: 'right', render: (r) => r.abatidoPlano > 0 ? <span><Badge tone="success">{r.plano || 'Plano'}</Badge> <s className="c360-muted">{fmtR(r.abatidoPlano)}</s></span> : fmtR(r.valor) },
    ]} />
    {historico.linhas.length >= 300 && <p className="c360-muted">Mostrando os 300 itens mais recentes.</p>}
  </div>
}
