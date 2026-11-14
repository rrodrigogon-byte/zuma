/**
 * ============================================================================
 * KYTTO ERP · BARBEARIA DINO: MOTOR KYTTOIA DE VOZ SINTÉTICA HUMANIZADA (T-REX)
 * ============================================================================
 * Geração de mensagens de voz sintética acolhedoras para clientes da Dino Barbearia:
 * 1. Parabéns de Aniversário com Cortesia (Barboterapia / Chopp Artesanal)
 * 2. Mensagem VIP de Resgate de Cliente Inativo (> 60 dias sem visita)
 * 3. Confirmação Especial de Atendimento com Barbeiro Titular
 *
 * Em conformidade com a Diretriz Oficial: Motor KyttoIA 2.5 Flash.
 */
import { db, save } from '../db.js';
import { kyttoEventBus } from './kytto-event-bus.js';

export const MOTOR_IA_OFICIAL = 'Motor KyttoIA 2.5 Flash Industrial Engine';

export const ROTEIROS_VOZ_TREX = {
  aniversario: {
    tipo: 'aniversario',
    titulo: 'Parabéns VIP com Cortesia Especial',
    gerarTextoFala: (nomeCliente) => 
      `Fala aí, ${nomeCliente}! Aqui é o T-Rex da Barbearia Dino! Cara, vi aqui que hoje é seu aniversário e não podia deixar de passar pra te desejar os parabéns, muita saúde, sucesso e prosperidade, irmão! E ó, de presente do Dino e de toda a nossa equipe aqui em Tangará, você tem uma Barboterapia na toalha quente por nossa conta ou um chopp trincando pra brindar na sua próxima visita! Responde aqui pra mim que eu já garanto o seu horário VIP com a Nati ou com o Bruno. Um grande abraço do T-Rex!`,
    duracaoEstimadaSegundos: 28,
    tomEmocional: 'caloroso_festivo'
  },
  resgate_vip: {
    tipo: 'resgate_vip',
    titulo: 'Saudades do Estilo Dino (Cliente > 60 dias)',
    gerarTextoFala: (nomeCliente, nomeBarbeiro = 'Nati') => 
      `Opa, ${nomeCliente}! Tudo bem por aí? Aqui é o T-Rex da Dino Barbearia! Rapaz, puxei a ficha aqui e vi que já faz mais de 60 dias que você não dá uma alinhada nesse visual com a gente! O ${nomeBarbeiro} já me perguntou de você essa semana, cara! Separei uma condição muito especial pra você passar aqui entre hoje e amanhã: além do corte e da barba impecável, tem um café espresso especial te esperando. Bora agendar? Me avisa aqui se você prefere de manhã ou de tarde que eu reservo seu lugar na cadeira! Valeu, irmão!`,
    duracaoEstimadaSegundos: 32,
    tomEmocional: 'amigavel_persuasivo'
  },
  confirmacao_agenda: {
    tipo: 'confirmacao_agenda',
    titulo: 'Confirmação Humanizada de Agendamento',
    gerarTextoFala: (nomeCliente, horario, barbeiro) => 
      `Fala ${nomeCliente}, beleza? T-Rex na área! Só passando pra confirmar nosso compromisso amanhã às ${horario} com o ${barbeiro} aqui na Dino Barbearia. A tesoura já tá afiada e a pomada no ponto! Te vejo amanhã, meu amigo! Até lá!`,
    duracaoEstimadaSegundos: 16,
    tomEmocional: 'agil_profissional'
  }
};

/**
 * Gera os metadados e o script do áudio sintetizado pelo Motor KyttoIA
 */
export async function sintetizarAudioTRex(dados = {}) {
  const {
    clienteNome,
    clienteTelefone,
    tipoMensagem = 'aniversario',
    barbeiroNome = 'Nati',
    horario = '10:00',
    empresaId = 'd0d0ac01-8e50-4b61-8c79-de4aaa914001'
  } = dados;

  if (!clienteNome) {
    throw new Error('Nome do cliente é obrigatório para sintetização de voz.');
  }

  const template = ROTEIROS_VOZ_TREX[tipoMensagem] || ROTEIROS_VOZ_TREX.aniversario;
  let scriptFala = '';

  if (tipoMensagem === 'aniversario') {
    scriptFala = template.gerarTextoFala(clienteNome);
  } else if (tipoMensagem === 'resgate_vip') {
    scriptFala = template.gerarTextoFala(clienteNome, barbeiroNome);
  } else if (tipoMensagem === 'confirmacao_agenda') {
    scriptFala = template.gerarTextoFala(clienteNome, horario, barbeiroNome);
  } else {
    scriptFala = template.gerarTextoFala(clienteNome);
  }

  const audioId = `vox-trex-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const registroAudio = {
    id: audioId,
    empresaId,
    clienteNome,
    clienteTelefone: clienteTelefone ? String(clienteTelefone).replace(/\D/g, '') : '',
    tipoMensagem,
    motorIa: MOTOR_IA_OFICIAL,
    scriptFala,
    duracaoSegundos: template.duracaoEstimadaSegundos,
    formato: 'audio/ogg; codecs=opus',
    status: 'pronto_para_envio',
    criadoEm: new Date().toISOString()
  };

  const data = db();
  data.dino_audios_trex ||= [];
  data.dino_audios_trex.unshift(registroAudio);
  save();

  // Emitir evento interno de áudio pronto para disparo
  try {
    kyttoEventBus.emitirEvento('barbearia.audio_trex_sintetizado', {
      audioId,
      clienteNome,
      clienteTelefone: registroAudio.clienteTelefone,
      tipoMensagem,
      motorIa: MOTOR_IA_OFICIAL,
      duracaoSegundos: template.duracaoEstimadaSegundos
    }, {
      sistemaOrigem: 'Motor KyttoIA Barbearia Dino',
      sistemaDestino: 'Ultra / WhatsApp Bot',
      tipo: 'evento_interno_sincronizado'
    });
  } catch (e) {
    console.warn('[EventBus Áudio T-Rex] Erro:', e.message);
  }

  return {
    ok: true,
    mensagem: `Áudio humanizado do T-Rex sintetizado com sucesso pelo ${MOTOR_IA_OFICIAL}!`,
    audio: registroAudio
  };
}

/**
 * Lista o histórico de áudios sintetizados
 */
export function listarAudiosSintetizadosTRex(limite = 20) {
  const data = db();
  const audios = data.dino_audios_trex || [];
  return {
    total: audios.length,
    motorIa: MOTOR_IA_OFICIAL,
    audios: audios.slice(0, limite)
  };
}
