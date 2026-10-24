import { RELACOES, linkInstagram } from './comanda-nova'
import './comanda-nova.css'

export const RELACIONAMENTO_VAZIO = {
  familia: [],
  familiaConsentimento: false,
  preferencias: { corte: '', barba: '', bebida: '', perfumes: '', produtos: '', horario: '', atendimento: '', observacoes: '', tags: '', profissionalPreferidoId: '' },
  redesSociais: { instagram: '', linkedin: '' },
}

/** Converte o cliente da API para o formulário. */
export function relacionamentoDoCliente(cliente = {}) {
  const pref = cliente.preferencias || {}
  return {
    familia: (cliente.familia || []).map((f) => ({ ...f, dataNascimento: f.dataNascimento ? f.dataNascimento.split('-').reverse().join('/') : (f.aniversario ? f.aniversario.split('-').reverse().join('/') : '') })),
    familiaConsentimento: cliente.familiaConsentimento?.concedido === true,
    preferencias: { ...RELACIONAMENTO_VAZIO.preferencias, ...pref, tags: (pref.tags || []).join(', '), profissionalPreferidoId: pref.profissionalPreferidoId || '' },
    redesSociais: { instagram: cliente.redesSociais?.instagram || '', linkedin: cliente.redesSociais?.linkedin || '' },
  }
}

/** Corpo para a API (só manda o que o formulário controla). */
export function relacionamentoParaApi(valor) {
  return {
    familia: (valor.familia || []).filter((f) => String(f.nome || '').trim()).map(({ id, relacao, nome, dataNascimento, telefone, observacao }) => ({ id, relacao, nome, dataNascimento, telefone, observacao })),
    familiaConsentimento: valor.familiaConsentimento === true,
    preferencias: { ...valor.preferencias, tags: String(valor.preferencias?.tags || '').split(',').map((t) => t.trim()).filter(Boolean) },
    redesSociais: { ...valor.redesSociais },
  }
}

const CAMPOS_PREF = [
  ['corte', 'Corte preferido', 'Ex.: degradê baixo, tesoura em cima'],
  ['barba', 'Barba', 'Ex.: navalha, desenhada'],
  ['bebida', 'Bebida', 'Ex.: café sem açúcar, água com gás'],
  ['perfumes', 'Perfumes de que gosta', 'Ex.: amadeirados, Xerjoff'],
  ['produtos', 'Produtos que usa', 'Ex.: pomada efeito seco'],
  ['horario', 'Melhor horário', 'Ex.: sábado de manhã'],
]

export default function ClienteRelacionamento({ valor, onChange, profissionais = [], inputStyle }) {
  const v = valor || RELACIONAMENTO_VAZIO
  const set = (campos) => onChange({ ...v, ...campos })
  const setPref = (campo, texto) => set({ preferencias: { ...v.preferencias, [campo]: texto } })
  const setFam = (indice, campos) => set({ familia: v.familia.map((f, i) => (i === indice ? { ...f, ...campos } : f)) })
  const temMenor = v.familia.some((f) => ['filho', 'filha', 'enteado', 'enteada'].includes(f.relacao))
  const estilo = inputStyle || undefined
  return (
    <div className="cn-form" style={{ gridColumn: '1 / -1' }}>
      <div className="cn-bloco">
        <span className="cn-rotulo">Família</span>
        {v.familia.map((f, i) => (
          <div key={f.id || i} style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, .8fr) minmax(140px, 1.4fr) minmax(110px, .9fr) minmax(120px, 1fr) 28px', gap: 8, alignItems: 'center' }}>
            <select aria-label="Parentesco" className="cn-input" style={estilo} value={f.relacao} onChange={(e) => setFam(i, { relacao: e.target.value })}>{RELACOES.map(([chave, rotulo]) => <option key={chave} value={chave}>{rotulo}</option>)}</select>
            <input aria-label="Nome do familiar" className="cn-input" style={estilo} placeholder="Nome" value={f.nome} onChange={(e) => setFam(i, { nome: e.target.value })} />
            <input aria-label="Aniversário do familiar" className="cn-input" style={estilo} placeholder="DD/MM ou DD/MM/AAAA" inputMode="numeric" value={f.dataNascimento || ''} onChange={(e) => setFam(i, { dataNascimento: e.target.value })} />
            <input aria-label="Telefone do familiar" className="cn-input" style={estilo} placeholder="Telefone (opcional)" inputMode="tel" value={f.telefone || ''} onChange={(e) => setFam(i, { telefone: e.target.value })} />
            <button type="button" className="cn-remover" aria-label={`Remover ${f.nome || 'familiar'}`} onClick={() => set({ familia: v.familia.filter((_, j) => j !== i) })}>×</button>
          </div>
        ))}
        <div><button type="button" className="cn-link" onClick={() => set({ familia: [...v.familia, { relacao: v.familia.length ? 'filho' : 'esposa', nome: '', dataNascimento: '', telefone: '' }] })}>+ Adicionar familiar</button></div>
        {temMenor && (
          <label className="cn-usar-plano" style={{ whiteSpace: 'normal', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 8 }}>
            <input type="checkbox" style={{ width: 'auto', flex: '0 0 auto', marginTop: 2 }} checked={v.familiaConsentimento === true} onChange={(e) => set({ familiaConsentimento: e.target.checked })} />
            O cliente (responsável) autorizou registrar os dados dos filhos, para lembrar aniversários e agendar com ele.
          </label>
        )}
      </div>
      <div className="cn-bloco">
        <span className="cn-rotulo">Preferências</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
          {CAMPOS_PREF.map(([campo, rotulo, dica]) => (
            <label key={campo} className="cn-campo"><span>{rotulo}</span><input className="cn-input" style={estilo} placeholder={dica} value={v.preferencias[campo] || ''} onChange={(e) => setPref(campo, e.target.value)} /></label>
          ))}
          <label className="cn-campo"><span>Profissional preferido</span>
            <select className="cn-input" style={estilo} value={v.preferencias.profissionalPreferidoId || ''} onChange={(e) => setPref('profissionalPreferidoId', e.target.value)}>
              <option value="">Sem preferência</option>
              {profissionais.filter((p) => p.ativo !== false).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </label>
          <label className="cn-campo"><span>Etiquetas</span><input className="cn-input" style={estilo} placeholder="Separe por vírgula: conversa pouca, pontual" value={v.preferencias.tags || ''} onChange={(e) => setPref('tags', e.target.value)} /></label>
          <label className="cn-campo cn-largo"><span>Outras preferências</span><textarea className="cn-input" style={estilo} rows={2} value={v.preferencias.observacoes || ''} onChange={(e) => setPref('observacoes', e.target.value)} /></label>
        </div>
      </div>
      <div className="cn-bloco">
        <span className="cn-rotulo">Redes sociais</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
          <label className="cn-campo"><span>Instagram</span><input className="cn-input" style={estilo} placeholder="@usuario ou link do perfil" value={v.redesSociais.instagram} onChange={(e) => set({ redesSociais: { ...v.redesSociais, instagram: e.target.value } })} /></label>
          <label className="cn-campo"><span>LinkedIn</span><input className="cn-input" style={estilo} placeholder="linkedin.com/in/..." value={v.redesSociais.linkedin} onChange={(e) => set({ redesSociais: { ...v.redesSociais, linkedin: e.target.value } })} /></label>
        </div>
        <div className="cn-chips">
          {v.redesSociais.instagram && <a className="cn-chip link" href={linkInstagram(v.redesSociais.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').split('/')[0])} target="_blank" rel="noopener noreferrer">Abrir Instagram</a>}
          {/linkedin\.com\//i.test(v.redesSociais.linkedin) && <a className="cn-chip link" href={v.redesSociais.linkedin.startsWith('http') ? v.redesSociais.linkedin : `https://${v.redesSociais.linkedin}`} target="_blank" rel="noopener noreferrer">Abrir LinkedIn</a>}
        </div>
        <small>Só guardamos o link. O Kytto não lê nem copia nada dessas redes; a equipe abre o perfil quando quiser conhecer melhor o cliente.</small>
      </div>
    </div>
  )
}
