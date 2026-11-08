import { kyttoEventBus } from './kytto-event-bus.js';
import * as barbearia from '../barbearia-erp-kytto.js';
import * as captacao from '../dino-captacao-kytto.js';
import { enviarMensagem } from './whatsapp.js';
import { obterConexao } from '../whatsapp-conexao-kytto.js';

const EMPRESA_DINO_ID = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
const DIA_MS = 86400000;

/**
 * Normaliza e formata moeda em BRL
 */
function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor || 0));
}

/**
 * Localiza planos/assinaturas e pacotes que vencem em breve (D-3 a D-0) ou estão em carência (D+1 a D+10).
 */
export function listarPlanosParaRenovacao(empresaId = EMPRESA_DINO_ID, opcoes = {}) {
  const agora = opcoes.now ? new Date(opcoes.now) : new Date();
  const agoraMs = agora.valueOf();
  const assinaturas = barbearia.listarAssinaturas(empresaId);
  const planos = barbearia.listarPlanos(empresaId);
  const mapaPlanos = new Map(planos.map(p => [String(p.id), p]));

  const pendencias = [];

  for (const ass of assinaturas) {
    if (ass.status !== 'ativa' && ass.status !== 'pausada') continue;

    const plano = mapaPlanos.get(String(ass.planoId)) || ass.plano || {};
    const resumo = captacao.resumoAssinatura(empresaId, ass.id, opcoes);
    const pagoAteMs = resumo?.pagoAte ? new Date(resumo.pagoAte).valueOf() : (ass.proximoVencimento ? new Date(ass.proximoVencimento).valueOf() : null);

    if (!pagoAteMs || Number.isNaN(pagoAteMs)) continue;

    const diffDias = Math.round((pagoAteMs - agoraMs) / DIA_MS);

    // Seleciona quem vence nos próximos 3 dias, hoje, ou está vencido até 10 dias (carência)
    if (diffDias >= -10 && diffDias <= 3) {
      const situacao = diffDias > 0 ? 'vence_em_breve' : (diffDias === 0 ? 'vence_hoje' : 'vencido_carencia');
      const clienteNome = ass.clienteNome || ass.cliente?.nome || 'Cliente VIP';
      const clienteTelefone = ass.clienteTelefone || ass.cliente?.telefone || '';
      const valorMensalidade = Number(plano.preco || ass.valor || 120);

      pendencias.push({
        assinaturaId: ass.id,
        empresaId,
        clienteNome,
        clienteTelefone,
        planoNome: plano.nome || 'Clube VIP',
        valorMensalidade,
        valorFormatado: formatarMoeda(valorMensalidade),
        pagoAte: new Date(pagoAteMs).toISOString().split('T')[0],
        diffDias,
        situacao,
        sessoesRestantes: resumo?.sessoesRestantes || 0
      });
    }
  }

  return pendencias;
}

/**
 * Renderiza mensagem amigável e calorosa do T-Rex / Agente IA para renovação do plano.
 */
export function renderizarMensagemRenovacao({ clienteNome, planoNome, valorFormatado, pagoAte, situacao, diffDias, chavePix = '50.073.355/0002-60', linkCartao = 'https://kytto.com.br/pay/clube-dino' }) {
  const primeiroNome = String(clienteNome || '').trim().split(' ')[0] || 'amigo';
  const dataBr = pagoAte ? pagoAte.split('-').reverse().join('/') : 'hoje';

  if (situacao === 'vence_em_breve') {
    return `Olá, ${primeiroNome}! 🦕 Passando para lembrar com carinho que a mensalidade do seu plano *${planoNome}* na Barbearia Dino vence em ${diffDias} dias (${dataBr}).

Já podemos garantir o seu próximo horário na agenda para você manter o visual sempre alinhado com a nossa equipe! ✂️

Para sua maior comodidade na renovação:
🔹 *Chave PIX (CNPJ):* \`${chavePix}\` (Dino Barbearia Ltda)
🔹 *Cartão de Crédito:* ${linkCartao}

Valor: *${valorFormatado}*

Prefere pagar pelo PIX ou prefere que eu envie o link do cartão? Se quiser, já me diga o melhor dia e horário que já reservo sua cadeira!`;
  }

  if (situacao === 'vence_hoje') {
    return `Olá, ${primeiroNome}! 🦕 Tudo bem? Hoje (${dataBr}) é a data de renovação do seu *${planoNome}* na Barbearia Dino!

Queremos garantir que você continue aproveitando todos os seus cortes e benefícios exclusivos sem interrupção. 💈

Opções práticas para renovar:
🔹 *Chave PIX (CNPJ):* \`${chavePix}\`
🔹 *Link Cartão:* ${linkCartao}
Valor: *${valorFormatado}*

Já reservei sua preferência na nossa agenda! É só me avisar se prefere PIX ou cartão, e qual o próximo horário que você quer vir dar aquele talento no visual!`;
  }

  // vencido_carencia
  return `Olá, ${primeiroNome}! 🦕 Tudo certinho? Passando aqui para te dar um alô: seu plano *${planoNome}* venceu dia ${dataBr}, mas deixamos liberado para você continuar cortando com a gente enquanto regulariza, sem nenhum estresse! 🤝

Para renovar o seu ciclo e continuar com seus atendimentos garantidos:
🔹 *Chave PIX (CNPJ):* \`${chavePix}\`
🔹 *Link Cartão:* ${linkCartao}
Valor: *${valorFormatado}*

Se precisar de qualquer flexibilidade ou quiser agendar seu retorno para hoje ou amanhã, é só me responder aqui!`;
}

/**
 * Executa uma rodada da automação de vencimento de planos com emissão de evento interno.
 */
export async function executarRodadaVencimentoPlanos(empresaId = EMPRESA_DINO_ID, opcoes = {}) {
  const pendencias = listarPlanosParaRenovacao(empresaId, opcoes);
  const disparar = opcoes.dispararMensagem === true;
  const resultados = [];

  for (const item of pendencias) {
    const mensagem = renderizarMensagemRenovacao(item);
    let enviado = false;
    let erro = null;

    if (disparar && item.clienteTelefone) {
      try {
        const conexao = obterConexao(empresaId, 'cliente');
        const instance = conexao?.instance || 'dino';
        await enviarMensagem({
          empresaId,
          instance,
          telefone: item.clienteTelefone,
          mensagem
        });
        enviado = true;
      } catch (err) {
        erro = err.message;
      }
    }

    // Emite evento interno no KyttoEventBus
    kyttoEventBus.emitir('plano.vencendo', {
      assinaturaId: item.assinaturaId,
      clienteNome: item.clienteNome,
      clienteTelefone: item.clienteTelefone,
      planoNome: item.planoNome,
      situacao: item.situacao,
      diffDias: item.diffDias,
      valor: item.valorMensalidade,
      enviado,
      erro
    }, { empresaId, origem: 'automacao-planos' });

    resultados.push({
      ...item,
      mensagem,
      enviado,
      erro
    });
  }

  return {
    empresaId,
    totalPendencias: pendencias.length,
    processados: resultados.length,
    enviados: resultados.filter(r => r.enviado).length,
    itens: resultados
  };
}
