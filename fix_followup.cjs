const fs = require('fs');

let toolsCode = fs.readFileSync('app/core/whatsapp-ai-tools.js', 'utf8');

if (!toolsCode.includes('function minutesOf')) {
  toolsCode += `
const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const PERIODOS_VALIDOS = new Set(['manha', 'tarde', 'noite', 'qualquer']);

function periodOf(time) {
  const hour = Number(String(time || '').split(':')[0]);
  if (!Number.isFinite(hour)) return 'qualquer';
  if (hour < 12) return 'manha';
  if (hour < 18) return 'tarde';
  return 'noite';
}

function normalizePeriod(value) {
  const plainValue = String(value || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().trim();
  return PERIODOS_VALIDOS.has(plainValue) ? plainValue : 'qualquer';
}

function minutesOf(hhmm) {
  const match = String(hhmm || '').match(/^(\\d{1,2}):(\\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : NaN;
}

export async function earliestSlots({ fetchDay, fromDate, days = 7, period = 'qualquer', limit = 6, notBefore = '', aroundTime = '' } = {}) {
  const safeDays = Math.min(14, Math.max(1, Number(days) || 7));
  const safeLimit = Math.min(10, Math.max(1, Number(limit) || 6));
  const wanted = normalizePeriod(period);
  const found = [];
  const closed = [];
  for (let offset = 0; offset < safeDays && found.length < safeLimit; offset += 1) {
    const date = addDaysIso(fromDate, offset);
    let day;
    try {
      day = await fetchDay(date);
    } catch (error) {
      if (error?.code === 'SLOT_UNAVAILABLE') { closed.push(date); continue; }
      if (error?.code === 'DATE_OUT_OF_RANGE') break;
      throw error;
    }
    let candidates = (Array.isArray(day?.slots) ? day.slots : [])
      .filter((time) => !(offset === 0 && notBefore && String(time) <= notBefore))
      .filter((time) => wanted === 'qualquer' || periodOf(time) === wanted);
    const target = minutesOf(aroundTime);
    if (Number.isFinite(target)) {
      candidates = [...candidates]
        .sort((a, b) => Math.abs(minutesOf(a) - target) - Math.abs(minutesOf(b) - target))
        .slice(0, 2)
        .sort((a, b) => minutesOf(a) - minutesOf(b));
    }
    for (const time of candidates) {
      const weekday = DIAS_SEMANA[new Date(\`\${date}T12:00:00Z\`).getUTCDay()];
      found.push({ date, weekday, time: String(time).slice(0, 5), professional: day.professionalByTime?.[time] || day.professional?.nome || null });
      if (found.length >= safeLimit) break;
    }
  }
  return { slots: found, searchedDays: safeDays, period: wanted, closedDays: closed };
}
`;
  fs.writeFileSync('app/core/whatsapp-ai-tools.js', toolsCode, 'utf8');
}
