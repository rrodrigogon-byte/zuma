import {useState} from 'react'
import {api} from '../../../lib/api'
const labels={novo:'Novo contato',avulso:'Cliente avulso',recorrente:'Cliente recorrente',pacote_ativo:'Pacote ativo',pacote_vencido:'Pacote vencido',pacote_pausado:'Pacote pausado',pacote_esgotado:'Sessões esgotadas',pacote_pendente:'Ativação ou pagamento pendente',cadastro_ambiguo:'Cadastros precisam de conferência',telefone_invalido:'Telefone inválido'}
const date=value=>value?new Date(value).toLocaleDateString('pt-BR',{timeZone:'America/Cuiaba'}):'Sem pagamento confirmado'
export default function PerfilPacoteTelefone(){
 const [telefone,setTelefone]=useState(''),[perfil,setPerfil]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState('')
 async function consultar(e){e.preventDefault();setLoading(true);setError('');setPerfil(null);try{setPerfil(await api.post('/api/admin/barbearia/captacao/perfil-cliente',{telefone}))}catch(e){setError(e.message||'Não foi possível consultar o cliente.')}finally{setLoading(false)}}
 return <section aria-label="Perfil e pacotes pelo telefone" style={{background:'var(--card)',border:'1px solid var(--line)',borderRadius:14,padding:20}}>
  <h2>Perfil e pacotes pelo telefone</h2><p>Consulte os dados da empresa ativa. A IA usa o telefone da própria conversa para reconhecer o cliente; cadastros ambíguos exigem conferência da equipe.</p>
  <form onSubmit={consultar} style={{display:'flex',gap:10,flexWrap:'wrap'}}><label>Telefone do cliente <input type="tel" disabled={loading} required autoComplete="off" value={telefone} onChange={e=>{setTelefone(e.target.value);setPerfil(null)}} placeholder="(65) 99999-9999" /></label><button type="submit" disabled={loading}>{loading?'Consultando…':'Consultar perfil'}</button></form>
  {error&&<p role="alert">{error}</p>}{perfil&&<div role="status"><h3>{labels[perfil.perfil]||perfil.perfil}</h3>{perfil.orientacao&&<p>{perfil.orientacao}</p>}{perfil.visitasConhecidas!==undefined&&<p>{perfil.visitasConhecidas} atendimento(s) concluído(s) identificado(s).</p>}{(perfil.pacotes||[]).map(p=><article key={p.assinaturaId} style={{borderTop:'1px solid var(--line)',padding:'12px 0'}}><strong>{p.plano}</strong><p>{p.utilizavel?'Benefícios disponíveis':'Benefícios indisponíveis'} · {p.restantes} de {p.sessoesNoCiclo} procedimentos restantes no ciclo</p><p>Pago até: {date(p.pagoAte)} · Renovação: {date(p.proximaRenovacao)}</p><p>Serviços: {p.servicosIncluidos.join(', ')||'Conforme contrato legado'}</p></article>)}</div>}
 </section>
}
