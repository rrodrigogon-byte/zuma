import { db, save } from '../db.js';
import * as cadastrosMestres from '../cadastros-mestres-kytto.js';
import * as barbearia from '../barbearia-erp-kytto.js';
import { queueAppointmentNotifications } from './barbershop-appointment-notifications.js';
import { estaEmOptOut } from './whatsapp-antiban.js';

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
  // 2. Confirmação da véspera (24h antes): horário comercial da véspera, das 10h00 às 20h00
  const janelaVespera = (horaCuiaba >= 10 && horaCuiaba <= 20) || forcar;
  // 3. Janela de atendimento para lembretes de 30m antes (das 07h30 às 20h30)
  const janelaComercial = (horaCuiaba >= 7 && horaCuiaba <= 20) || forcar;
  
  const empresasIds = obterEmpresasBarbearia();
  let totalEnviadas = 0;
  let alterou = false;
  const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.npm_lifecycle_event === 'test') || process.execArgv.includes('--test') || process.argv.includes('--test');
  const aplicarDelay = options.intervaloMs !== undefined
    ? options.intervaloMs
    : (isTest || options.semDelay ? 0 : Math.round(15000 + Math.random() * 15000));

  for (const empresaId of empresasIds) {
    const estado = barbearia.estadoEmpresa ? barbearia.estadoEmpresa(empresaId, false) : null;
    // 1. Confirmação do dia de hoje (pela manhã: das 07h00 às 09h00)
    if (janelaManha) {
      const agendamentosHoje = barbearia.listarAgendamentos(empresaId, { de: hoje, ate: hoje });
      for (const ag of agendamentosHoje) {
        if (ag.status === 'agendado') {
          // Evita reenvio se já enviado na manhã de hoje
          if (ag.confirmacaoDiaData === hoje) continue;
          if (ag.clienteTelefone && estaEmOptOut(empresaId, ag.clienteTelefone)) continue;

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
          if (aplicarDelay > 0) await new Promise((r) => setTimeout(r, aplicarDelay));
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
          if (ag.clienteTelefone && estaEmOptOut(empresaId, ag.clienteTelefone)) continue;

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
          if (aplicarDelay > 0) await new Promise((r) => setTimeout(r, aplicarDelay));
        }
      }
    }

    // 3. Lembrete de 30 minutos antes do atendimento (no dia de hoje)
    if (janelaComercial) {
      const agendamentosHoje30m = barbearia.listarAgendamentos(empresaId, { de: hoje, ate: hoje });
      for (const ag of agendamentosHoje30m) {
        if (['agendado', 'confirmado'].includes(ag.status)) {
          if (ag.lembrete30mEnviadoEm) continue;
          const dataHora = new Date(ag.dataHora);
          if (isNaN(dataHora.valueOf())) continue;
          const diffMinutos = (dataHora.valueOf() - now.valueOf()) / 60000;
          // Envia se faltar entre 20 e 45 minutos para o horário
          if (diffMinutos >= 20 && diffMinutos <= 45) {
            // Evita redundância se criado há menos de 45 minutos
            const criadoEm = new Date(ag.criadoEm || ag.dataCriacao || 0).valueOf();
            if (criadoEm && now.valueOf() - criadoEm < 45 * 60000) continue;

            // Proteção Anti-Ban Meta: não envia se cliente está em Opt-Out
            if (ag.clienteTelefone && estaEmOptOut(empresaId, ag.clienteTelefone)) continue;

            const res = await queueAppointmentNotifications(
              { empresaId, legacyEmpresaId: empresaId, lojaId: ag.lojaId },
              ag,
              'lembrete_30m'
            ).catch(() => null);

            if (res && res.queued > 0) {
              totalEnviadas += res.queued;
              const agReal = estado?.agendamentos?.[String(ag.id)];
              if (agReal) agReal.lembrete30mEnviadoEm = now.toISOString();
              ag.lembrete30mEnviadoEm = now.toISOString();
              alterou = true;
            }
            if (aplicarDelay > 0) await new Promise((r) => setTimeout(r, aplicarDelay));
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

  console.log('[Dino Confirmacao Diaria] Inicializando agendador de confirmacoes (24h antes + manha 07h-09h + 30m antes)');

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
