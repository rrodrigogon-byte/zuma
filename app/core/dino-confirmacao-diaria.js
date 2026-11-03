import { db, save } from '../db.js';
import * as cadastrosMestres from '../cadastros-mestres-kytto.js';
import * as barbearia from '../barbearia-erp-kytto.js';
import * as clientes from '../clientes-contas-kytto.js';
import { queueAppointmentNotifications } from './barbershop-appointment-notifications.js';

export function obterEmpresasBarbearia() {
  const ids = new Set([
    'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
    'emp_dino',
    'emp-kytto-001',
    'dino',
  ]);
  try {
    const empresas = cadastrosMestres.listarEmpresas({ incluirInativas: false });
    for (const emp of empresas) if (emp?.id) ids.add(emp.id);
  } catch {}
  try {
    const raiz = db();
    for (const k of Object.keys(raiz?.barbearias || {})) ids.add(k);
    for (const k of Object.keys(raiz?.barbeariaKytto?.empresas || {})) ids.add(k);
  } catch {}
  return Array.from(ids);
}

function garantirConsentimentoAgendamento(empresaId, ag) {
  try {
    const clienteId = ag.clienteId;
    if (clienteId) {
      const cli = clientes.obterCliente(empresaId, clienteId);
      if (cli && cli.consentimentos?.whatsapp?.atendimento?.origem !== 'opt_out' && cli.consentimentos?.whatsapp?.atendimento?.concedido !== true) {
        clientes.atualizarConsentimentoCliente(empresaId, clienteId, {
          canal: 'whatsapp',
          finalidade: 'atendimento',
          concedido: true,
          origem: 'agendamento_barbearia',
        });
      }
    } else if (ag.clienteTelefone) {
      let cli = null;
      try {
        const todos = Object.values(clientes.clientesPersistidos?.(empresaId)?.clientes || {});
        const digits = ag.clienteTelefone.replace(/\D/g, '').slice(-8);
        cli = todos.find((c) => c.telefone && c.telefone.replace(/\D/g, '').endsWith(digits));
      } catch {}
      if (!cli) {
        cli = clientes.criarCliente(empresaId, { nome: ag.clienteNome || 'Cliente', telefone: ag.clienteTelefone });
      }
      if (cli?.id) {
        ag.clienteId = cli.id;
        clientes.atualizarConsentimentoCliente(empresaId, cli.id, {
          canal: 'whatsapp',
          finalidade: 'atendimento',
          concedido: true,
          origem: 'agendamento_barbearia',
        });
      }
    }
  } catch {}
}

export async function processarConfirmacoesDiarias(options = {}) {
  const now = options.agora || new Date();
  const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba' });
  const timeFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Cuiaba', hour: '2-digit', hour12: false });
  const hoje = dateFormatter.format(now);
  const amanha = dateFormatter.format(new Date(now.valueOf() + 24 * 60 * 60 * 1000));
  const horaCuiaba = options.hora !== undefined ? options.hora : parseInt(timeFormatter.format(now), 10);
  const forcar = options.forcar === true;

  // 1. Confirmação do dia: SEMPRE NO PERÍODO DA MANHÃ, DAS 07h00 ÀS 09h00 (horário de Cuiabá)
  const janelaManha = (horaCuiaba >= 7 && horaCuiaba <= 9) || forcar;
  // 2. Confirmação da véspera: ENVIANDO SEMPRE UM DIA ANTES (horário comercial/tarde da véspera, das 10h00 às 20h00)
  const janelaVespera = (horaCuiaba >= 10 && horaCuiaba <= 20) || forcar;
  
  const empresasIds = obterEmpresasBarbearia();
  let totalEnviadas = 0;
  let alterou = false;

  for (const empresaId of empresasIds) {
    const estado = barbearia.estadoEmpresa ? barbearia.estadoEmpresa(empresaId, false) : null;
    // 1. Confirmação do dia de hoje (pela manhã: das 07h00 às 09h00)
    if (janelaManha) {
      const agendamentosHoje = barbearia.listarAgendamentos(empresaId, { de: hoje, ate: hoje });
      for (const ag of agendamentosHoje) {
        if (ag.status === 'agendado') {
          // Evita reenvio se já enviado na manhã de hoje
          if (ag.confirmacaoDiaData === hoje) continue;

          garantirConsentimentoAgendamento(empresaId, ag);
          const res = await queueAppointmentNotifications(
            { empresaId, legacyEmpresaId: empresaId, lojaId: ag.lojaId },
            ag,
            'confirmacao_dia'
          ).catch(() => null);
          if (res && res.queued > 0) {
            totalEnviadas += res.queued;
            const agReal = estado?.agendamentos?.[String(ag.id)];
            if (agReal) {
              agReal.confirmacaoDiaData = hoje;
              agReal.confirmacaoDiaEnviadaEm = now.toISOString();
            }
            ag.confirmacaoDiaData = hoje;
            ag.confirmacaoDiaEnviadaEm = now.toISOString();
            alterou = true;
          }
        }
      }
    }

    // 2. Confirmação da véspera / dia anterior (para amanhã)
    if (janelaVespera) {
      const agendamentosAmanha = barbearia.listarAgendamentos(empresaId, { de: amanha, ate: amanha });
      for (const ag of agendamentosAmanha) {
        if (ag.status === 'agendado') {
          // Evita reenvio se já enviado na véspera
          if (ag.lembreteVesperaData === hoje) continue;

          garantirConsentimentoAgendamento(empresaId, ag);
          const res = await queueAppointmentNotifications(
            { empresaId, legacyEmpresaId: empresaId, lojaId: ag.lojaId },
            ag,
            'lembrete'
          ).catch(() => null);
          if (res && res.queued > 0) {
            totalEnviadas += res.queued;
            const agReal = estado?.agendamentos?.[String(ag.id)];
            if (agReal) {
              agReal.lembreteVesperaData = hoje;
              agReal.lembreteVesperaEnviadoEm = now.toISOString();
            }
            ag.lembreteVesperaData = hoje;
            ag.lembreteVesperaEnviadoEm = now.toISOString();
            alterou = true;
          }
        }
      }
    }
  }
  if (alterou) {
    try { save(); } catch {}
  }
  return totalEnviadas;
}

export function startDinoDailyConfirmationWorker() {
  if (process.env.DINO_DAILY_CONFIRMATION_ENABLED === '0') return null;

  console.log('[Dino Confirmacao Diaria] Inicializando agendador de confirmacoes (vespera + manha 07h-09h)');

  // Varredura inicial 10 segundos após boot respeitando a janela horária
  setTimeout(() => {
    processarConfirmacoesDiarias().then((count) => {
      if (count > 0) console.log(`[Dino Confirmacao Diaria] Varredura inicial: ${count} confirmacoes enfileiradas.`);
    }).catch((e) => {
      console.warn('[Dino Confirmacao Diaria] erro na varredura inicial:', e?.message || e);
    });
  }, 10000);

  // Verificação a cada 15 minutos ao longo do dia
  const timer = setInterval(async () => {
    try {
      const enviadas = await processarConfirmacoesDiarias();
      if (enviadas > 0) {
        console.log(`[Dino Confirmacao Diaria] ${enviadas} confirmacoes enfileiradas.`);
      }
    } catch (e) {
      console.warn('[Dino Confirmacao Diaria] falhou', String(e?.message || e).slice(0, 200));
    }
  }, 15 * 60 * 1000);
  
  timer.unref?.();
  return timer;
}
