import { db } from '../db.js';
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

export async function processarConfirmacoesDiarias() {
  const now = new Date();
  const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba' });
  const hoje = dateFormatter.format(now);
  const amanha = dateFormatter.format(new Date(now.valueOf() + 24 * 60 * 60 * 1000));
  
  const empresasIds = obterEmpresasBarbearia();
  let totalEnviadas = 0;

  for (const empresaId of empresasIds) {
    // 1. Confirmação do dia de hoje (pela manhã)
    const agendamentosHoje = barbearia.listarAgendamentos(empresaId, { de: hoje, ate: hoje });
    for (const ag of agendamentosHoje) {
      if (ag.status === 'agendado') {
        garantirConsentimentoAgendamento(empresaId, ag);
        const res = await queueAppointmentNotifications(
          { empresaId, legacyEmpresaId: empresaId, lojaId: ag.lojaId },
          ag,
          'confirmacao_dia'
        ).catch(() => null);
        if (res && res.queued > 0) totalEnviadas += res.queued;
      }
    }

    // 2. Confirmação da véspera / dia anterior (para amanhã)
    const agendamentosAmanha = barbearia.listarAgendamentos(empresaId, { de: amanha, ate: amanha });
    for (const ag of agendamentosAmanha) {
      if (ag.status === 'agendado') {
        garantirConsentimentoAgendamento(empresaId, ag);
        const res = await queueAppointmentNotifications(
          { empresaId, legacyEmpresaId: empresaId, lojaId: ag.lojaId },
          ag,
          'lembrete'
        ).catch(() => null);
        if (res && res.queued > 0) totalEnviadas += res.queued;
      }
    }
  }
  return totalEnviadas;
}

export function startDinoDailyConfirmationWorker() {
  if (process.env.DINO_DAILY_CONFIRMATION_ENABLED === '0') return null;

  console.log('[Dino Confirmacao Diaria] Inicializando agendador de confirmacoes (vespera + dia)');

  // Varredura logo após a subida do servidor
  setTimeout(() => {
    processarConfirmacoesDiarias().then((count) => {
      if (count > 0) console.log(`[Dino Confirmacao Diaria] Varredura inicial: ${count} confirmacoes enfileiradas.`);
    }).catch((e) => {
      console.warn('[Dino Confirmacao Diaria] erro na varredura inicial:', e?.message || e);
    });
  }, 10000);

  const timer = setInterval(async () => {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Cuiaba', hour: '2-digit', hour12: false });
      const hour = parseInt(formatter.format(now), 10);

      // Executa de manhã e durante o expediente (entre 07:00 e 13:00 de Cuiabá)
      if (hour >= 7 && hour <= 13) {
        const enviadas = await processarConfirmacoesDiarias();
        if (enviadas > 0) {
          console.log(`[Dino Confirmacao Diaria] ${enviadas} confirmacoes enfileiradas.`);
        }
      }
    } catch (e) {
      console.warn('[Dino Confirmacao Diaria] falhou', String(e?.message || e).slice(0, 200));
    }
  }, 15 * 60 * 1000); // Roda a cada 15 minutos
  
  timer.unref?.();
  return timer;
}
