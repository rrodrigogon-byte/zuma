// Ferramentas do Clube para a IA do WhatsApp (function-calling no mesmo formato do
// whatsapp-ai-tools.js: tipos em MAIÚSCULAS, padrão Gemini; a reserva Anthropic converte).
// A identidade (empresa e cliente) vem SEMPRE da conversa autenticada pelo número de telefone,
// nunca de argumentos que o modelo escreve.
import * as aulas from '../aulas/servico.js';
import * as acesso from '../acesso/repositorio.js';
import { decidirAcesso } from '../acesso/regras.js';
import { contratoParaAcesso } from '../contratos/servico.js';
import { gerarQrDinamico } from '../acesso/qr.js';
import { ErroDominio } from '../acesso/banco.js';
import * as retencao from '../retencao/operacoes.js';
import { registrarOptout } from '../retencao/servico.js';
import { criarPasse, passeParaAcesso } from '../parceiros/servico.js';
import * as quadras from '../quadras/servico.js';

export const declaracoesClube = [
  {
    name: 'clube_listar_vagas',
    description: 'Lista as aulas de um dia com vagas livres. Use quando o aluno perguntar por horários ou vagas.',
    parameters: {
      type: 'OBJECT',
      properties: {
        dia: { type: 'STRING', description: 'Data no formato AAAA-MM-DD' },
        modalidade: { type: 'STRING', description: 'Parte do nome da modalidade (ex.: funcional, pilates). Vazio = todas.' },
      },
      required: ['dia'],
    },
  },
  {
    name: 'clube_reservar_aula',
    description: 'Reserva uma vaga para o aluno da conversa. Confirme a aula com o aluno antes de chamar.',
    parameters: { type: 'OBJECT', properties: { ocorrencia_id: { type: 'STRING' } }, required: ['ocorrencia_id'] },
  },
  {
    name: 'clube_entrar_fila',
    description: 'Coloca o aluno na lista de espera de uma aula lotada.',
    parameters: { type: 'OBJECT', properties: { ocorrencia_id: { type: 'STRING' } }, required: ['ocorrencia_id'] },
  },
  {
    name: 'clube_responder_fila',
    description: 'Registra a resposta do aluno quando ele foi chamado da lista de espera (SIM aceita, NÃO libera para o próximo).',
    parameters: {
      type: 'OBJECT',
      properties: { ocorrencia_id: { type: 'STRING' }, aceitar: { type: 'BOOLEAN' } },
      required: ['ocorrencia_id', 'aceitar'],
    },
  },
  {
    name: 'clube_minhas_reservas',
    description: 'Lista as próximas aulas reservadas pelo aluno.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'clube_cancelar_reserva',
    description: 'Cancela uma reserva do aluno. Avise que, a menos de 2 h da aula, conta como falta.',
    parameters: { type: 'OBJECT', properties: { reserva_id: { type: 'STRING' } }, required: ['reserva_id'] },
  },
  {
    name: 'clube_status_acesso',
    description: 'Explica se o aluno consegue entrar agora e, se não, o motivo e o que fazer.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'clube_qr_entrada',
    description: 'Gera o passe de entrada do aluno: um link com o QR que ele mostra na catraca (vale 15 minutos).',
    parameters: { type: 'OBJECT', properties: {} },
  },
  // Item 4 — retenção
  {
    name: 'clube_consultar_frequencia',
    description: 'Mostra a frequência do aluno: último treino, média por semana e horários em que ele costuma vir. Use para sugerir horário.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'clube_consultar_financeiro',
    description: 'Mostra a situação financeira do aluno: mensalidade, vencimento, dias de atraso e valor atualizado com multa e juros.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'clube_gerar_link_pagamento',
    description: 'Gera o link de pagamento (Pix ou cartão) do valor em aberto ou da próxima mensalidade. Ao pagar, a catraca libera sozinha.',
    parameters: { type: 'OBJECT', properties: { parcelas: { type: 'INTEGER', description: 'Parcelas no cartão (padrão 1)' } } },
  },
  {
    name: 'clube_propor_acordo',
    description: 'Registra acordo para valor em atraso: parcelamento ou promessa de pagamento numa data. Só dentro da regra da academia; fora dela, a ferramenta passa para um atendente. Nunca prometa condição antes de chamar.',
    parameters: {
      type: 'OBJECT',
      properties: {
        tipo: { type: 'STRING', enum: ['parcelamento', 'promessa'] },
        parcelas: { type: 'INTEGER', description: 'Para parcelamento: número de parcelas' },
        promessa_ate: { type: 'STRING', description: 'Para promessa: data AAAA-MM-DD em que vai pagar' },
      },
      required: ['tipo'],
    },
  },
  {
    name: 'clube_congelar_plano',
    description: 'Congela (pausa) o plano do aluno por alguns dias, dentro da regra do plano. Os dias voltam no vencimento. Confirme os dias com o aluno antes.',
    parameters: {
      type: 'OBJECT',
      properties: { dias: { type: 'INTEGER' }, inicio: { type: 'STRING', description: 'AAAA-MM-DD; vazio = hoje' } },
      required: ['dias'],
    },
  },
  {
    name: 'clube_registrar_motivo_saida',
    description: 'Registra o motivo de o aluno ter parado ou querer sair (alimenta o relatório da academia).',
    parameters: {
      type: 'OBJECT',
      properties: {
        categoria: { type: 'STRING', enum: ['preco', 'horario', 'mudanca', 'saude', 'resultado', 'atendimento', 'estrutura', 'tempo', 'outro'] },
        detalhe: { type: 'STRING' },
      },
      required: ['categoria'],
    },
  },
  {
    name: 'clube_transferir_para_humano',
    description: 'Passa a conversa para um atendente. Use SEMPRE em: pedido de cancelamento com conflito, reclamação, assunto de saúde, ou quando o aluno pedir uma pessoa.',
    parameters: {
      type: 'OBJECT',
      properties: {
        tipo: { type: 'STRING', enum: ['cancelamento', 'reclamacao', 'saude', 'outro'] },
        motivo: { type: 'STRING', description: 'Resumo curto do que o aluno precisa' },
      },
      required: ['tipo', 'motivo'],
    },
  },
  {
    name: 'clube_registrar_nota',
    description: 'Registra a nota de 0 a 10 que o aluno deu na pesquisa da primeira semana, com comentário opcional.',
    parameters: { type: 'OBJECT', properties: { nota: { type: 'INTEGER' }, comentario: { type: 'STRING' } }, required: ['nota'] },
  },
  {
    name: 'clube_parar_mensagens',
    description: 'O aluno pediu para não receber mais mensagens de ofertas e lembretes. Cobrança de valor devido continua, só informativa.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'clube_registrar_interesse',
    description: 'Registra que a pessoa pediu preço, visitou ou fez aula experimental e ainda não se matriculou (a IA retorna depois).',
    parameters: {
      type: 'OBJECT',
      properties: {
        origem: { type: 'STRING', enum: ['visita', 'preco', 'experimental', 'indicacao', 'outro'] },
        interesse: { type: 'STRING', description: 'Ex.: musculação de manhã, pilates' },
      },
      required: ['origem'],
    },
  },
  // Quadras (tênis, beach tennis, padel…)
  {
    name: 'clube_quadras_livres',
    description: 'Lista os horários com quadra livre num dia (tênis, beach tennis, padel…). Use quando o sócio quiser jogar ou perguntar por quadra. Nunca invente horário.',
    parameters: {
      type: 'OBJECT',
      properties: {
        dia: { type: 'STRING', description: 'Data no formato AAAA-MM-DD' },
        modalidade: { type: 'STRING', description: 'tenis, beach_tennis, padel… Vazio = todas.' },
        hora: { type: 'STRING', description: 'HH:MM: mostra a partir deste horário (opcional)' },
        duracao_min: { type: 'INTEGER', description: 'Minutos de jogo (opcional; padrão do clube)' },
      },
      required: ['dia'],
    },
  },
  {
    name: 'clube_reservar_quadra',
    description: 'Reserva uma quadra para o sócio da conversa. Confirme quadra, dia e horário com ele antes de chamar.',
    parameters: {
      type: 'OBJECT',
      properties: {
        quadra_id: { type: 'STRING' },
        dia: { type: 'STRING', description: 'AAAA-MM-DD' },
        hora: { type: 'STRING', description: 'HH:MM de início' },
        duracao_min: { type: 'INTEGER', description: 'Opcional; padrão do clube' },
      },
      required: ['quadra_id', 'dia', 'hora'],
    },
  },
  {
    name: 'clube_minhas_reservas_quadra',
    description: 'Lista as próximas reservas de quadra do sócio.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'clube_cancelar_reserva_quadra',
    description: 'Cancela uma reserva de quadra do sócio (o id vem de clube_minhas_reservas_quadra). Confirme com ele antes.',
    parameters: { type: 'OBJECT', properties: { reserva_id: { type: 'STRING' } }, required: ['reserva_id'] },
  },
];

async function avisarTerceiros(enviarAvisos, avisos) {
  if (!enviarAvisos || !avisos?.length) return;
  // falha no envio a terceiros não desfaz a ação do aluno (a rotina de fila reenvia/expira)
  try { await enviarAvisos(avisos); } catch (error) { console.error('[clube] avisos fila', String(error?.message || '').slice(0, 200)); }
}

const ORIENTACAO = {
  inadimplente: 'Mensalidade em aberto: ofereça o link de pagamento; a entrada libera em até 1 minuto após o Pix.',
  contrato_pendente: 'Contrato pendente: reenvie o link de aceite.',
  fora_do_horario: 'Fora do horário do plano: informe o horário e ofereça upgrade.',
  limite_atingido: 'Limite do plano atingido: ofereça diária avulsa.',
  sem_reserva: 'Plano exige reserva: mostre as vagas de hoje.',
  bloqueio_manual: 'Pendência no cadastro: encaminhe para a recepção (não explique detalhes internos).',
  sem_plano: 'Sem plano ativo: ofereça os planos.',
};

/**
 * @param {object} db
 * @param {{ empresaId: string, customerId: string, fuso?: string, qrSecret?: string }} conversa
 * @param {string} nome
 * @param {object} args
 * @param {{ agora?: Date, enviarAvisos?: Function, gerarLinkPagamento?: Function, notificarGestor?: Function, financeiroExterno?: Function }} opcoes
 *   `enviarAvisos` (o mesmo devolvido por montarClube) avisa quem foi chamado da fila. Esses avisos
 *   são de OUTRAS pessoas: nunca voltam para o modelo, que só fala com o aluno da conversa.
 */
export async function executarFerramentaClube(db, conversa, nome, args = {}, {
  agora = new Date(), enviarAvisos = null, gerarLinkPagamento = null, notificarGestor = null, financeiroExterno = null,
} = {}) {
  const { empresaId, customerId } = conversa;
  if (!empresaId || !customerId) return { ok: false, erro: 'Cliente não identificado na conversa.' };
  const fuso = conversa.fuso || (await db.query(
    'SELECT fuso FROM aulas_turmas WHERE empresa_id = $1 AND ativa ORDER BY criado_em LIMIT 1', [empresaId],
  )).rows[0]?.fuso || 'America/Cuiaba';
  try {
    switch (nome) {
      case 'clube_listar_vagas': {
        const vagas = await aulas.listarVagas(db, empresaId, { dia: args.dia, modalidade: args.modalidade || '', agora, fuso });
        return {
          ok: true,
          aulas: vagas.map((v) => ({
            ocorrencia_id: v.id, aula: v.rotulo, professor: v.professor, vagas: v.vagasAlunos, fila: v.fila,
          })),
        };
      }
      case 'clube_reservar_aula': {
        const r = await aulas.reservar(db, empresaId, { ocorrenciaId: args.ocorrencia_id, customerId, origem: 'whatsapp', agora });
        return { ok: true, reserva_id: r.reservaId, aula: r.aula };
      }
      case 'clube_entrar_fila': {
        const r = await aulas.entrarNaFila(db, empresaId, { ocorrenciaId: args.ocorrencia_id, customerId, agora });
        return { ok: true, posicao: r.posicao };
      }
      case 'clube_responder_fila': {
        const r = await aulas.responderFila(db, empresaId, { ocorrenciaId: args.ocorrencia_id, customerId, aceitar: Boolean(args.aceitar), agora });
        await avisarTerceiros(enviarAvisos, r.avisos);
        return { ok: true, reservado: r.reservado, motivo: r.motivo || null };
      }
      case 'clube_minhas_reservas': {
        const r = await db.query(
          `SELECT r.id, m.nome AS modalidade, o.inicio, t.fuso FROM aulas_reservas r
             JOIN aulas_ocorrencias o ON o.id = r.ocorrencia_id JOIN aulas_turmas t ON t.id = o.turma_id
             JOIN aulas_modalidades m ON m.id = t.modalidade_id
            WHERE r.empresa_id = $1 AND r.customer_id = $2 AND r.status = 'reservada' AND o.inicio > $3
            ORDER BY o.inicio LIMIT 10`,
          [empresaId, customerId, agora],
        );
        return {
          ok: true,
          reservas: r.rows.map((x) => ({
            reserva_id: x.id,
            aula: `${x.modalidade} · ${new Date(x.inicio).toLocaleString('pt-BR', { timeZone: x.fuso, weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`,
          })),
        };
      }
      case 'clube_cancelar_reserva': {
        const r = await aulas.cancelarReserva(db, empresaId, { reservaId: args.reserva_id, customerId, agora });
        await avisarTerceiros(enviarAvisos, r.avisos);
        return { ok: true, tardio: r.tardio };
      }
      case 'clube_status_acesso': {
        const ctx = await acesso.carregarContexto(db, { empresaId, customerId, agora, fuso }, { contrato: contratoParaAcesso, reservas: aulas.reservasParaAcesso, parceiro: passeParaAcesso });
        if (!ctx) return { ok: true, liberado: false, motivo: 'sem_cadastro', orientacao: ORIENTACAO.sem_plano };
        const d = decidirAcesso({ ...ctx, agora, fuso });
        return { ok: true, liberado: d.liberado, motivo: d.codigo, mensagem: d.mensagem, orientacao: ORIENTACAO[d.codigo] || (d.codigo === 'parceiro' ? 'Check-in do app parceiro válido: pode entrar.' : null) };
      }
      case 'clube_qr_entrada': {
        if (!conversa.qrSecret) return { ok: false, erro: 'QR de entrada não está ativo nesta academia.' };
        const pe = await db.query('SELECT user_id_equipamento FROM acesso_pessoas_equipamento WHERE empresa_id = $1 AND customer_id = $2', [empresaId, customerId]);
        if (!pe.rows[0]) return { ok: false, erro: 'Aluno sem matrícula de acesso.' };
        // link de uma página com o QR que muda a cada 30 s (um código em texto no WhatsApp não serve na catraca)
        if (conversa.urlPublica) {
          const passe = await criarPasse(db, { empresaId, customerId, origem: 'aluno', expiraEm: new Date(agora.getTime() + 15 * 60000) });
          return { ok: true, link: `${String(conversa.urlPublica).replace(/\/$/, '')}/clube/passe/${passe.token}`, valido_por_minutos: 15 };
        }
        const qr = gerarQrDinamico(conversa.qrSecret, Number(pe.rows[0].user_id_equipamento), agora.getTime());
        return { ok: true, qr: qr.valor, expira_em: qr.expiraEm.toISOString() };
      }
      case 'clube_consultar_frequencia':
        return { ok: true, ...(await retencao.consultarFrequencia(db, empresaId, customerId, { agora })) };
      case 'clube_consultar_financeiro': {
        const f = await retencao.consultarFinanceiro(db, empresaId, customerId, { agora, externo: financeiroExterno });
        delete f.regra; // a regra de acordo fica com a ferramenta de acordo, não vira oferta antecipada
        return { ok: true, ...f };
      }
      case 'clube_gerar_link_pagamento': {
        const r = await retencao.gerarLink(db, empresaId, customerId, { agora, gerarLinkPagamento, externo: financeiroExterno, parcelas: Number(args.parcelas) || 1 });
        return { ok: true, link: r.link, valor: r.valorFormatado, parcelas: r.parcelas };
      }
      case 'clube_propor_acordo': {
        const r = await retencao.proporAcordo(db, empresaId, customerId, { tipo: args.tipo, parcelas: args.parcelas, promessaAte: args.promessa_ate }, { agora, gerarLinkPagamento, externo: financeiroExterno, notificarGestor });
        if (r.humano) return { ok: true, transferido_para_humano: true, orientacao: 'Fora da regra da academia: avise que um atendente vai responder.' };
        return { ok: true, acordo: r.tipo, valor: r.valorFormatado, parcelas: r.parcelas, promessa_ate: r.promessaAte, link: r.link };
      }
      case 'clube_congelar_plano': {
        const r = await retencao.congelarPlano(db, empresaId, customerId, { dias: args.dias, inicio: args.inicio }, { agora });
        return { ok: true, congelado_de: r.inicio, ate: r.fim, volta_em: r.voltaEm, dias: r.dias, restante_no_ano: r.restanteNoAno };
      }
      case 'clube_registrar_motivo_saida':
        return { ok: true, ...(await retencao.registrarMotivoSaida(db, empresaId, customerId, { categoria: args.categoria, detalhe: args.detalhe })) };
      case 'clube_transferir_para_humano': {
        const r = await retencao.abrirOcorrencia(db, empresaId, customerId, { tipo: args.tipo, descricao: args.motivo }, { notificarGestor, agora });
        return { ok: true, protocolo: r.protocolo, orientacao: 'Avise que um atendente vai continuar a conversa e informe o protocolo.' };
      }
      case 'clube_registrar_nota': {
        const r = await retencao.registrarNota(db, empresaId, customerId, { nota: args.nota, comentario: args.comentario }, { notificarGestor, agora });
        return { ok: true, registrada: true, atendente_avisado: Boolean(r.ocorrencia) };
      }
      case 'clube_parar_mensagens':
        await registrarOptout(db, { empresaId, customerId, agora });
        return { ok: true, orientacao: 'Confirme que ofertas e lembretes foram desligados.' };
      case 'clube_registrar_interesse':
        return { ok: true, ...(await retencao.registrarInteresse(db, empresaId, customerId, { origem: args.origem, interesse: args.interesse })) };
      case 'clube_quadras_livres': {
        const r = await quadras.horariosLivres(db, empresaId, {
          data: args.dia, modalidade: quadras.normalizarModalidade(args.modalidade), aPartirDe: args.hora || '', duracaoMin: args.duracao_min || null, agora, respeitarAntecedencia: true,
        });
        if (r.reservaAindaFechada) return { ok: true, dia: r.diaRotulo, horarios: [], orientacao: `As reservas de quadra abrem ${r.aberturaDias} dia(s) antes. Ofereça um dia mais próximo.` };
        if (!r.aberto) return { ok: true, dia: r.diaRotulo, fechado: true, orientacao: 'O clube não abre neste dia.' };
        return { ok: true, dia: r.diaRotulo, duracao_min: r.duracaoMin, horarios: r.horarios.map((h) => ({ hora: h.hora, quadras: h.quadras.map((q) => ({ quadra_id: q.id, nome: q.nome, modalidade: q.modalidade })) })) };
      }
      case 'clube_reservar_quadra': {
        const r = await quadras.reservar(db, empresaId, {
          quadraId: args.quadra_id, customerId, data: args.dia, hora: args.hora, duracaoMin: args.duracao_min || null, tipo: 'socio', origem: 'whatsapp', agora,
        });
        return { ok: true, reserva_id: r.reservaId, reserva: r.rotulo };
      }
      case 'clube_minhas_reservas_quadra': {
        const l = await quadras.reservasDoCliente(db, empresaId, customerId, { agora });
        return { ok: true, reservas: l.map((x) => ({ reserva_id: x.id, reserva: x.rotulo })) };
      }
      case 'clube_cancelar_reserva_quadra': {
        const r = await quadras.cancelarReserva(db, empresaId, { reservaId: args.reserva_id, customerId, agora });
        return { ok: true, cancelada: r.cancelada, tardio: r.tardio };
      }
      default:
        return { ok: false, erro: `Ferramenta desconhecida: ${nome}` };
    }
  } catch (error) {
    if (error instanceof ErroDominio) return { ok: false, codigo: error.code, erro: error.message };
    throw error;
  }
}
