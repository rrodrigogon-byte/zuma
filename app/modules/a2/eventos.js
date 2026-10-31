import { EventEmitter } from 'events';

export const barramentoA2 = new EventEmitter();

barramentoA2.on('cadastro_atualizado', ({ empresaId, tipo, acao, id, payload }) => {
  // Sincronização por evento interno entre os sistemas Nossa Gente e Ultra
  console.log(`[A2_SYNC] Evento interno (Nossa Gente/Ultra) -> Tipo: ${tipo} | Ação: ${acao} | ID: ${id} | Empresa: ${empresaId}`);
});
