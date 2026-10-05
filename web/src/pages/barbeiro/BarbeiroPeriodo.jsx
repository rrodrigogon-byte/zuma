import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { lerAgenda, erroAgenda } from '../../lib/agenda-read'
import { diasEntre, periodoMes, somarDias, diaDoItem, diaLegivel } from '../../lib/barbearia-calendar'
export default function BarbeiroPeriodo({ dia, profissionalId, onDateChange, refreshKey }) {
  const [modo,setModo] = useState('dia')
  const [consulta,setConsulta] = useState(null)
  const [erro,setErro] = useState('')
  const [revisao,setRevisao] = useState(0)
  const range = modo === 'mes' ? periodoMes(dia) : { de: dia, ate: somarDias(dia,6) }
  const chave = JSON.stringify([range.de,range.ate,profissionalId,refreshKey,revisao])
  useEffect(() => {
    if (modo === 'dia') return
    let ativo=true;setErro('')
    lerAgenda(() => api.get(`/api/admin/barbearia/modo-barbeiro/periodo?${new URLSearchParams({...range,profissionalId})}`),{ativo:()=>ativo})
      .then(r=>{if(ativo&&r)setConsulta({chave,itens:r.itens})}).catch(e=>{if(ativo)setErro(erroAgenda(e))})
    return ()=>{ativo=false}
  },[chave,modo])
  const button={padding:'10px',minHeight:44,border:'1px solid #2b3140',borderRadius:10,color:'#e8eaf2',background:'#161922',cursor:'pointer'}
  return <section aria-label="Período da minha agenda" style={{display:'grid',gap:10}}><div role="group" aria-label="Visualização da minha agenda" style={{display:'flex',gap:8}}>{[['dia','Dia'],['semana','Semana'],['mes','Mês']].map(([id,nome])=><button type="button" key={id} aria-pressed={modo===id} onClick={()=>setModo(id)} style={{...button,flex:1,background:modo===id?'#6e7ce0':'#161922'}}>{nome}</button>)}</div>
    {modo!=='dia'&&<><div style={{display:'flex',justifyContent:'space-between',gap:8}}><button type="button" style={button} aria-label="Período anterior" onClick={()=>onDateChange(modo==='mes'?periodoMes(dia,-1).de:somarDias(dia,-7))}>‹</button><span>{diaLegivel(range.de)} — {diaLegivel(range.ate)}</span><button type="button" style={button} aria-label="Próximo período" onClick={()=>onDateChange(modo==='mes'?periodoMes(dia,1).de:somarDias(dia,7))}>›</button></div>
      {erro?<p role="alert">{erro} <button type="button" style={button} onClick={()=>setRevisao(n=>n+1)}>Tentar novamente</button></p>:consulta?.chave!==chave?<p role="status">Carregando período…</p>:<div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:6}}>{diasEntre(range.de,range.ate).map(d=>{const n=consulta.itens.filter(i=>diaDoItem(i)===d&&i.status!=='cancelado').length;return <button type="button" key={d} style={{...button,borderColor:dia===d?'#6e7ce0':'#2b3140'}} aria-pressed={dia===d} onClick={()=>onDateChange(d)}>{diaLegivel(d)}<small style={{display:'block'}}>{n} atendimento(s)</small></button>})}</div>}<small>Toque no dia para ver os atendimentos abaixo.</small></>}
  </section>
}
