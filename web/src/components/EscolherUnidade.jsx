import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { lojasDaEmpresa } from '../lib/context-selection'

/**
 * Telas cujo dado é por unidade (Financeiro, caixa, estoque) usam isto antes de carregar.
 * - empresa com uma unidade: já vem escolhida pelo contexto, nada aparece;
 * - várias unidades: a pessoa escolhe aqui mesmo, sem procurar o seletor do menu;
 * - nenhuma unidade: explica e leva ao cadastro de Unidades.
 * Retorna null quando há unidade ativa da empresa ativa.
 */
export function useUnidadeAtiva() {
  const { empresaAtiva, lojaAtiva, lojasAcessiveis, user } = useAuth()
  const lojas = lojasDaEmpresa(lojasAcessiveis, empresaAtiva?.id)
  const valida = lojaAtiva?.id && lojas.some((loja) => String(loja.id) === String(lojaAtiva.id))
  // sessão presa a uma unidade (token assinado com a loja): vale mesmo sem a lista no navegador
  const assinada = !valida && user?.lojaId && (!lojas.length || lojas.some((loja) => String(loja.id) === String(user.lojaId)))
    ? { id: user.lojaId, nome: lojas.find((loja) => String(loja.id) === String(user.lojaId))?.nome || 'Unidade da sessão' }
    : null
  return { unidade: valida ? lojaAtiva : assinada, lojas, empresaAtiva }
}

export default function EscolherUnidade({ titulo = 'Escolha a unidade', motivo = 'Os lançamentos ficam separados por unidade.' }) {
  const { trocarLoja, isPlatformAdmin } = useAuth()
  const { unidade, lojas, empresaAtiva } = useUnidadeAtiva()
  if (unidade) return null
  const nomeEmpresa = empresaAtiva?.nome_fantasia || empresaAtiva?.nome || 'esta empresa'
  return (
    <section className="card" role="region" aria-label={titulo} style={{ padding: 20, display: 'grid', gap: 12, maxWidth: 640 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>{titulo}</h2>
      {lojas.length === 0 ? (
        <>
          <p style={{ margin: 0, color: 'var(--muted)' }}>
            {isPlatformAdmin
              ? `Nenhuma unidade de ${nomeEmpresa} está liberada para o seu acesso, ou a empresa ainda não tem unidade cadastrada. ${motivo}`
              : `Nenhuma unidade de ${nomeEmpresa} está disponível para você. ${motivo} Peça ao gestor da empresa para liberar o seu acesso a uma unidade.`}
          </p>
          <div><Link className="btn btn-primary" to="/admin/lojas">Ver unidades</Link></div>
        </>
      ) : (
        <>
          <p style={{ margin: 0, color: 'var(--muted)' }}>{motivo} Em qual unidade de {nomeEmpresa} você quer trabalhar?</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {lojas.map((loja) => (
              <button key={loja.id} type="button" className="btn btn-ghost" onClick={() => trocarLoja(loja.id)}>
                {loja.codigo ? `${loja.codigo} · ` : ''}{loja.nome || loja.nome_fantasia}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
