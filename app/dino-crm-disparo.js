import { db } from './core/database.js'
import { v4 as uuid } from 'uuid'
import { enviarMensagem } from './core/whatsapp.js'

export async function dispararCampanhaCRM({ empresaId, lojaId, filtros, mensagem, clientesIds }) {
  // Coletar clientes alvo
  let clientes = []
  if (clientesIds && clientesIds.length > 0) {
     clientes = (db().clientes || []).filter(c => clientesIds.includes(c.id))
  } else {
     clientes = (db().clientes || []).filter(c => c.empresa_id === empresaId && c.loja_id === lojaId)
  }

  // Filtrar apenas quem tem telefone válido
  clientes = clientes.filter(c => c.telefone && String(c.telefone).length >= 10)

  if (clientes.length === 0) return { ok: false, error: 'Nenhum cliente válido para disparo' }

  // Obter instância do WhatsApp ativa da loja
  const params = db().parametros_loja?.find(p => p.empresa_id === empresaId && p.loja_id === lojaId) || {}
  const whatsapp_instance = params.whatsapp_instance || 'dino'

  const campanha = {
    id: uuid(),
    empresa_id: empresaId,
    loja_id: lojaId,
    criado_em: new Date().toISOString(),
    mensagem,
    status: 'processando',
    alvos: clientes.length,
    enviados: 0,
    falhas: 0
  }
  
  if (!db().campanhas) db().campanhas = []
  db().campanhas.push(campanha)

  // Enviar assincronamente (background)
  setTimeout(async () => {
    for (const c of clientes) {
      try {
         const texto = mensagem.replace(/\{Nome do Cliente\}/g, c.nome.split(' ')[0])
                               .replace(/\{Nome\}/g, c.nome.split(' ')[0])
                               .replace(/\{Profissional\}/g, c.profissional_preferido || 'nossa equipe')
                               .replace(/\{Link Agendamento\}/g, `https://dino.kytto.com.br/agendamento/${lojaId}?t=${c.telefone}`)
                               
         await enviarMensagem({ empresa_id: empresaId, loja_id: lojaId, whatsapp_instance }, c.telefone, texto)
         campanha.enviados++
      } catch (err) {
         console.warn('[CRM Disparo] Erro ao enviar para', c.telefone, err.message)
         campanha.falhas++
      }
      // rate limit basic (delay between messages)
      await new Promise(r => setTimeout(r, 1500))
    }
    campanha.status = 'concluida'
  }, 2000)

  return { ok: true, campanha }
}
