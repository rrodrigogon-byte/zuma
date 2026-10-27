import * as cadastrosMestres from '../cadastros-mestres-kytto.js';
import * as barbearia from '../barbearia-erp-kytto.js';
import { queueAppointmentNotifications } from './barbershop-appointment-notifications.js';

export function startDinoDailyConfirmationWorker() {
  if (process.env.DINO_DAILY_CONFIRMATION_ENABLED === '0') return null;

  console.log('[Dino Confirmacao Diaria] Inicializando agendador de confirmacoes (09:00 - 10:00)');
  const timer = setInterval(async () => {
    try {
      const now = new Date();
      // O fuso da operação é America/Cuiaba
      const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Cuiaba', hour: '2-digit', minute: '2-digit', hour12: false });
      const cuiaba = formatter.format(now);
      const hourStr = cuiaba.split(':')[0];
      const hour = parseInt(hourStr, 10);

      // Roda sempre as 09 da manha
      if (hour === 9) {
        const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba' });
        const dia = dateFormatter.format(now);
        
        let confirmacoesEnviadas = 0;
        const empresas = cadastrosMestres.listarEmpresas({ incluirInativas: false });
        for (const emp of empresas) {
          const empresaId = emp.id;
          const agendamentos = barbearia.listarAgendamentos(empresaId, { de: dia, ate: dia });
          for (const ag of agendamentos) {
            // Confirmar agendamentos que ainda nao estao confirmados nem cancelados,
            // desde que faltam ao menos alguma hora pro atendimento,
            // mas como roda as 9h, notifica todo mundo do dia.
            if (ag.status === 'agendado') {
               const res = await queueAppointmentNotifications({ empresaId, legacyEmpresaId: empresaId, lojaId: ag.lojaId }, ag, 'confirmacao_dia').catch(() => null);
               if (res && res.queued > 0) {
                 confirmacoesEnviadas += res.queued;
               }
            }
          }
        }
        
        if (confirmacoesEnviadas > 0) {
          console.log(`[Dino Confirmacao Diaria] ${confirmacoesEnviadas} notificacoes de confirmacao enfileiradas para o dia ${dia}.`);
        }
      }
    } catch (e) {
      console.warn('[Dino Confirmacao Diaria] falhou', String(e?.message || e).slice(0, 200));
    }
  }, 10 * 60 * 1000); // Roda a cada 10 minutos para garantir que o range (09:00 - 09:59) seja pego. A idempotência da tabela bloqueia duplicação.
  
  timer.unref?.();
  return timer;
}
