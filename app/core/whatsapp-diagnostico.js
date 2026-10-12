// Diagnóstico do WhatsApp da Dino, de ponta a ponta e só de leitura.
// Responde, sem mostrar conteúdo de mensagem, número completo ou segredo:
//   1. o backend aceita a chave e conhece a instância? o número está conectado?
//   2. cada trava de segurança do Kytto (empresa dona, linha verificada, modo de
//      entrada, modo de saída, piloto) está aberta ou fechada, e por quê;
//   3. o backend gravou mensagens recebidas desta instância e elas entraram no Kytto?
// As conclusões (puras, testáveis) dizem exatamente o que ajustar e onde.

import { chatbotBackendConfig, chatbotBackendMode, fetchInboundMessages, getInstanceStatus, listInstances, whatsappProviderConfigured, whatsappProviderName } from './whatsapp-provider.js';
import { canalDaEmpresa, estadoDaEntrada } from './whatsapp-isa-poll.js';
import { egressMode } from './whatsapp-egress.js';

const DIA_MS = 24 * 60 * 60 * 1000;
const hora = (iso) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Cuiaba', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

function resumoMensagens(lista = []) {
  const tempos = lista.map((m) => Date.parse(m.timestamp)).filter(Number.isFinite);
  const contatos = new Set(lista.map((m) => String(m.chatId || '').replace(/\D/g, '')).filter(Boolean));
  return { total: lista.length, contatos: contatos.size, ultimaEm: tempos.length ? new Date(Math.max(...tempos)).toISOString() : null };
}

/** Conclusões em linguagem de operação, na ordem em que precisam ser resolvidas. */
export function conclusoesDoDiagnostico(f = {}) {
  const out = [];
  const add = (ok, titulo, detalhe) => out.push({ ok, titulo, detalhe });
  if (f.provedor !== 'chatbot_backend') { add(false, 'Provedor', 'WHATSAPP_PROVIDER não é chatbot_backend no Render.'); return out; }
  if (!f.configurado) { add(false, 'Backend configurado', 'Falta CHATBOT_BACKEND_URL (https) ou CHATBOT_BACKEND_KEY (20+ caracteres) no Render.'); return out; }
  if (f.modo !== 'instancias') { add(false, 'Modo do backend', 'Defina CHATBOT_BACKEND_MODE=instancias e CHATBOT_BACKEND_INSTANCE=dino no Render (o modo isa lê a sessão raiz).'); return out; }
  if (f.chaveRecusada) { add(false, 'Chave do backend', 'O backend recusou a chave (401/403). Confira CHATBOT_BACKEND_KEY no Render e API_KEY no backend.'); return out; }
  add(true, 'Chave do backend', 'Aceita.');
  const lista = f.instancias || [];
  const conhecida = lista.some((i) => i.name === f.instancia);
  add(conhecida || !lista.length, 'Instância no backend', conhecida || !lista.length ? `"${f.instancia}" configurada.` : `"${f.instancia}" ainda não existe no servidor de WhatsApp (hoje: ${lista.map((i) => i.name).join(', ')}). Inclua "${f.instancia}" em WHATSAPP_INSTANCE_NAMES do backend (Cloud Run) e publique; depois gere o QR aqui.`);
  add(f.estado === 'open', 'Sessão conectada', f.estado === 'open' ? 'Sessão aberta no backend.' : `Estado "${f.estado || 'desconhecido'}": leia o QR em /admin/whatsapp.`);
  add(f.numeroIdentificado === true, 'Número identificado pelo backend', f.numeroIdentificado
    ? 'A própria sessão informou o telefone da linha.'
    : 'Sessão aberta não prova qual é a linha. Confira Aparelhos conectados no celular da empresa e solicite ao backend que exponha o número da própria sessão; uma referência manual não confirma titularidade.');

  const e = f.entrada || {};
  add(Boolean(e.empresaPorVariavel && f.canal), 'Empresa dona do número',
    !e.empresaPorVariavel ? `A instância "${f.instancia}" não tem empresa dona no servidor. No Render, inclua "${f.instancia}=<id da empresa>" em CHATBOT_BACKEND_INSTANCES (separado por vírgula), ou use o par CHATBOT_BACKEND_INSTANCE + CHATBOT_BACKEND_EMPRESA_ID para uma única linha. Sem isso nada entra nem sai.`
      : f.canal ? 'Canal ativo da instância encontrado nesta empresa.'
        : 'A instância tem empresa dona, mas não há canal ativo com ela nessa empresa (ou há dois). Ative o atendente em Integrações.');
  add(e.linhaVerificada === true, 'Linha verificada', e.linhaVerificada ? 'Linha conferida no aparelho.' : `Depois de confirmar no celular da empresa (Aparelhos conectados) que a sessão é deste número, inclua "${f.instancia}" em WHATSAPP_LINE_VERIFIED_INSTANCES no Render (para a linha padrão também vale WHATSAPP_LINE_VERIFIED=1). Até lá entrada e saída desta linha ficam fechadas.`);

  const pedido = e.modoPedido || '';
  const efetivo = e.modo || 'off';
  let entradaOk = efetivo === 'pilot' ? e.pilotos > 0 : efetivo === 'on';
  let entradaTexto = '';
  if (efetivo === 'off') {
    entradaOk = false;
    entradaTexto = !e.linhaVerificada ? 'Fechada até a linha ser verificada.'
      : pedido === 'on' && !e.rolloutAprovado ? 'WHATSAPP_POLL_MODE=on exige WHATSAPP_FULL_ROLLOUT_APPROVED=1. Para o piloto use WHATSAPP_POLL_MODE=pilot.'
        : 'Defina WHATSAPP_POLL_MODE=pilot (ou on com rollout aprovado).';
  } else if (efetivo === 'shadow') { entradaOk = false; entradaTexto = 'shadow: lê as mensagens, mas a IA não responde.'; }
  else if (efetivo === 'pilot') entradaTexto = e.pilotos > 0 ? `Piloto: só ${e.pilotos} telefone(s) de WHATSAPP_POLL_PILOT_PHONES.` : 'pilot sem WHATSAPP_POLL_PILOT_PHONES: ninguém é atendido.';
  else entradaTexto = 'Liberada para todos os clientes.';
  add(entradaOk, 'Entrada das mensagens', entradaTexto);
  if (efetivo === 'pilot' && Number(e.ultimaPassada?.resultado?.foraDoPiloto) > 0) {
    add(false, 'Mensagens fora do piloto', `${Number(e.ultimaPassada.resultado.foraDoPiloto)} mensagem(ns) da última consulta são de contatos fora da lista e não recebem resposta automática. Confira WHATSAPP_POLL_PILOT_PHONES; após ajustar, envie uma mensagem nova. Mensagens já ignoradas não são reenviadas.`);
  }

  const saida = f.saida || 'off';
  const linhaPronta = f.estado === 'open' && Boolean(e.empresaPorVariavel && f.canal) && e.linhaVerificada === true;
  add(linhaPronta && (saida === 'on' || (saida === 'pilot' && e.pilotos > 0)), 'Saída das respostas',
    saida === 'off' ? 'WHATSAPP_EGRESS_MODE está desligado: a IA lê e decide, mas nenhuma resposta sai. Defina WHATSAPP_EGRESS_MODE=pilot (ou on com WHATSAPP_FULL_ROLLOUT_APPROVED=1).'
      : !linhaPronta ? 'Envio bloqueado: confirme sessão conectada, empresa dona, canal ativo e linha verificada. O modo global de saída não libera esta instância.'
      : saida === 'pilot' ? (e.pilotos > 0 ? 'Piloto: respostas só para os telefones de teste.' : 'pilot sem WHATSAPP_POLL_PILOT_PHONES: nenhuma resposta sai.')
        : 'Liberada para todos os clientes.');

  if (entradaOk) {
    const passada = e.ultimaPassada || {};
    const recente = passada.em && (Date.parse(f.agora) - Date.parse(passada.em)) < 5 * 60 * 1000;
    add(Boolean(e.workerIniciado && recente && !passada.erro && !passada.resultado?.pulou), 'Leitura rodando',
      !e.workerIniciado ? 'O leitor não iniciou neste servidor: ele só liga no boot. Reinicie o serviço no Render (ou salve as variáveis, que reinicia).'
        : !passada.em ? 'Aguardando a primeira passada.'
          : passada.erro ? `Erro na última passada: ${passada.erro}`
            : passada.resultado?.pulou ? `Última passada pulou: ${passada.resultado.pulou}.`
              : recente ? `Última passada às ${hora(passada.em)}.` : 'Parada há mais de 5 minutos.');
  }

  const m = f.mensagens24h;
  if (m) {
    add(m.total > 0, 'Mensagens gravadas no backend (24 h)',
      m.total > 0 ? `${m.total} recebida(s) de ${m.contatos} contato(s); a última em ${hora(m.ultimaEm)}.`
        : 'O backend não gravou nenhuma mensagem recebida desta instância nas últimas 24 h. Se alguém escreveu para o número, ligue WHATSAPP_CAPTURE_ORGANIC=true no backend (Cloud Run): sem isso ele só guarda respostas a mensagens que a própria API enviou.');
    if (m.total > 0 && f.canal) {
      const ultimaNoKytto = Date.parse(f.canal.ultimo_evento_em || 0) || 0;
      const atrasada = Date.parse(m.ultimaEm) - ultimaNoKytto > 2 * 60 * 1000;
      add(!atrasada, 'Mensagens chegando no Kytto', atrasada ? 'Há mensagem no backend que não entrou no Kytto: resolva os itens pendentes acima.' : 'O horário de entrada está atualizado. Isso não comprova resposta: confira o piloto e a fila humana em Atendente IA.');
    }
  } else if (f.erroLeitura) {
    add(false, 'Leitura no backend', `GET /messages falhou (${f.erroLeitura}).`);
  }
  return out;
}

export async function diagnosticarWhatsapp({ fetchImpl, agora = Date.now(), instance, semDono = false } = {}) {
  // Diagnóstico da linha da empresa (multi-instância); sem `instance`, a padrão do ambiente.
  const cfg = chatbotBackendConfig(instance ? { instance } : {});
  const fatos = {
    agora: new Date(agora).toISOString(),
    provedor: whatsappProviderName(),
    configurado: whatsappProviderConfigured(),
    modo: chatbotBackendMode(),
    instancia: cfg.instance,
    entrada: estadoDaEntrada({ instance: cfg.instance }),
    saida: egressMode(),
  };
  if (fatos.provedor === 'chatbot_backend' && fatos.configurado && fatos.modo === 'instancias') {
    const [instancias, status, entradas] = await Promise.all([
      listInstances(fetchImpl).catch(() => ({ ok: false, items: [] })),
      getInstanceStatus(cfg.instance, fetchImpl).catch(() => ({ ok: false, state: 'unknown' })),
      // Linha sem empresa dona registrada: não lê mensagens (só estado e lista de instâncias).
      semDono ? Promise.resolve(null) : fetchInboundMessages({ instance: cfg.instance, from: agora - DIA_MS, limit: 200 }, fetchImpl).catch(() => ({ ok: false, messages: [] })),
    ]);
    fatos.chaveRecusada = Boolean(instancias.authError || status.authError || entradas?.authError);
    fatos.instancias = (instancias.items || []).map((i) => ({ name: i.name, state: i.state || '' }));
    fatos.estado = status.state || 'unknown';
    fatos.numeroIdentificado = Boolean(status.ok && status.state === 'open' && status.phone);
    fatos.mensagens24h = entradas?.ok ? resumoMensagens(entradas.messages) : null;
    fatos.erroLeitura = !entradas || entradas.ok ? null : (entradas.error || `HTTP_${entradas.status ?? '-'}`);
  }
  const canal = await canalDaEmpresa({ instance: cfg.instance }).catch(() => null);
  fatos.canal = canal ? { id: canal.id, ultimo_evento_em: canal.ultimo_evento_em } : null;
  return { ...fatos, conclusoes: conclusoesDoDiagnostico(fatos) };
}
