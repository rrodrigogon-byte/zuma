// ============================================================================
// ENSAIO GERAL COM OS DADOS REAIS DA DINO (antes de ligar o WhatsApp)
//
// O simulador de cenários (whatsapp-ai-cenarios.pg.test.js) prova o fluxo da
// conversa com um catálogo de exemplo. Este ensaio prova a outra metade: que as
// ferramentas da IA se comportam certo com o catálogo, a equipe e os horários
// EXATAMENTE como estão em produção (fixture fixtures/dino-producao.json,
// conferida no admin em 03/10/2026):
//   - 20 serviços com preço e duração reais;
//   - 6 profissionais, segunda a sábado, 06:00–21:00; domingo fechado;
//   - "quem faz cada serviço" como cadastrado (Corte Premium só com o Dino).
// Chama as ferramentas do mesmo jeito que o Gemini chama (executor da IA) e
// grava os agendamentos no mesmo store da agenda. Roda com WHATSAPP_SIM_PG_URL.
// ============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const URL_PG = process.env.WHATSAPP_SIM_PG_URL;
const skip = !URL_PG;
const IDS = { empresa: crypto.randomUUID(), loja: crypto.randomUUID(), canal: crypto.randomUUID() };
const FIXTURE = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'dino-producao.json'), 'utf8'));

if (URL_PG) {
  Object.assign(process.env, {
    DATABASE_URL: URL_PG,
    DB_SSL: 'false',
    DB_PATH: path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dino-ensaio-')), 'db.json'),
    BARBEARIA_AGENDA_FONTE: 'barbearia',
    KYTTO_TIMEZONE: 'America/Cuiaba',
  });
}

const { db } = URL_PG ? await import('./database.js') : { db: null };
const barbearia = await import('../barbearia-erp-kytto.js');
const tools = await import('./whatsapp-ai-tools.js');

const TZ = 'America/Cuiaba';
const DIAS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const diaIso = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const diaSemana = (iso) => DIAS.indexOf(new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(new Date(`${iso}T12:00:00-04:00`)));
function proximo(dow, aPartirDe = 1) {
  for (let i = aPartirDe; i <= aPartirDe + 7; i += 1) {
    const iso = diaIso(new Date(Date.now() + i * 86400000));
    if (diaSemana(iso) === dow) return iso;
  }
  throw new Error('dia não encontrado');
}
const minutos = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + m; };

let PROF = {};
let CORTE_PREMIUM_OFERTA = null;
let SERV = {};
let seq = 0;

async function seed() {
  await db.query(`INSERT INTO empresas (id, nome, cnpj, razao_social) VALUES ($1, 'Barbearia Dino (ensaio)', $2, 'Dino Ensaio LTDA')`, [IDS.empresa, String(Date.now()).slice(-14).padStart(14, '6')]);
  await db.query(`INSERT INTO lojas (id, empresa_id, codigo, nome) VALUES ($1, $2, $3, 'Dino Centro')`, [IDS.loja, IDS.empresa, `ENS${Date.now().toString(36)}`]);
  await db.query(
    `INSERT INTO canais_integracao (id, empresa_id, loja_id, provedor, nome, status, configuracao) VALUES ($1, $2, $3, 'whatsapp', 'Dino WhatsApp', 'ativo', $4::jsonb)`,
    [IDS.canal, IDS.empresa, IDS.loja, JSON.stringify({ display_name: FIXTURE.nomePublico, instance: 'dino', capabilities: { manageAppointments: true, operateStore: true, humanHandoff: true } })],
  );
  const E = IDS.empresa;
  barbearia.atualizarConfiguracao(E, FIXTURE.configuracao);
  for (const p of FIXTURE.profissionais) PROF[p.chave] = barbearia.criarProfissional(E, p.dados);
  for (const s of FIXTURE.servicos) {
    const profissionaisIds = (s.quemFaz || []).map((chave) => PROF[chave].id);
    SERV[s.nome] = barbearia.criarServico(E, { nome: s.nome, categoria: s.categoria, preco: s.preco, duracaoMinutos: s.duracaoMinutos, permiteAgendamentoOnline: true, profissionaisIds });
  }
}

/** Uma conversa nova (sessão no PostgreSQL) e o executor de ferramentas da IA para ela. */
async function conversa(nome = 'Cliente Ensaio') {
  const phone = `55659${String(70000000 + (++seq * 7919) % 19999999).padStart(8, '0')}`;
  const sessao = await db.query(
    `INSERT INTO whatsapp_ai_sessions (empresa_id, loja_id, canal_id, remote_jid, telefone, nome) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [IDS.empresa, IDS.loja, IDS.canal, `${phone}@s.whatsapp.net`, phone, nome],
  );
  const ctx = { empresaId: IDS.empresa, lojaId: IDS.loja, canalId: IDS.canal, sessionId: sessao.rows[0].id, phone, customerName: nome, externalEventId: `ensaio-${seq}`, capabilities: { manageAppointments: true, operateStore: true, humanHandoff: true } };
  return { ctx, phone, ferramenta: (nomeFerramenta, args) => tools.createWhatsappAiToolExecutor({ ...ctx })(nomeFerramenta, args) };
}

async function agendar(servicoNome, { professionalId = 'qualquer', date, time, extras = [] }) {
  const { ctx, phone, ferramenta } = await conversa();
  // A ferramenta recusa lançando erro (o worker transforma em resposta ao cliente).
  let prep;
  try {
    prep = await ferramenta('preparar_agendamento', { serviceId: SERV[servicoNome].id, professionalId, date, time, customerName: 'Cliente Ensaio', extraServiceIds: extras.map((n) => SERV[n].id) });
  } catch (error) { return { prep: { ok: false, erro: error.code || error.message }, phone }; }
  if (prep?.ok === false) return { prep, phone };
  let conf;
  try { conf = await tools.confirmPendingAction(ctx); } catch (error) { conf = { ok: false, erro: error.code || error.message }; }
  return { prep, conf, phone };
}

test('ensaio geral com os dados reais da Dino', { skip, timeout: 240000 }, async (t) => {
  await seed();
  const segunda = proximo(1);
  const sabado = proximo(6);
  const domingo = proximo(0);

  await t.test('catálogo: a IA vê os 20 serviços com preço e duração reais', async () => {
    const { ferramenta } = await conversa();
    const r = await ferramenta('listar_servicos', {});
    const lista = r.servicos || r.items || [];
    assert.equal(lista.length, FIXTURE.servicos.length);
    for (const s of FIXTURE.servicos) {
      const visto = lista.find((x) => x.nome === s.nome);
      assert.ok(visto, `serviço ausente: ${s.nome}`);
      assert.equal(Number(visto.preco), s.preco, `preço de ${s.nome}`);
      assert.equal(Number(visto.duracaoMinutos ?? visto.duracao), s.duracaoMinutos, `duração de ${s.nome}`);
    }
  });

  await t.test('equipe: os 6 profissionais aparecem para a IA', async () => {
    const { ferramenta } = await conversa();
    const r = await ferramenta('listar_profissionais', {});
    const nomes = (r.profissionais || r.items || []).map((p) => p.nome).sort();
    assert.deepEqual(nomes, FIXTURE.profissionais.map((p) => p.dados.nome).sort());
  });

  await t.test('horários: todo serviço, seg–sáb, começa ≥ 06:00 e termina ≤ 21:00; domingo fechado', async () => {
    for (const s of FIXTURE.servicos) {
      for (const dia of [segunda, sabado]) {
        const { ferramenta } = await conversa();
        const r = await ferramenta('sugerir_proximos_horarios', { serviceId: SERV[s.nome].id, professionalId: 'qualquer', fromDate: dia, days: 1, limit: 10 });
        const slots = r.proximosHorarios || [];
        assert.ok(slots.length > 0, `${s.nome} sem horário em ${dia}`);
        for (const slot of slots) {
          assert.equal(slot.date, dia);
          assert.ok(minutos(slot.time) >= minutos('06:00'), `${s.nome} às ${slot.time} antes da abertura`);
          assert.ok(minutos(slot.time) + s.duracaoMinutos <= minutos('21:00'), `${s.nome} (${s.duracaoMinutos} min) às ${slot.time} passa das 21:00`);
        }
      }
      const { ferramenta } = await conversa();
      const dom = await ferramenta('sugerir_proximos_horarios', { serviceId: SERV[s.nome].id, professionalId: 'qualquer', fromDate: domingo, days: 1 });
      assert.equal((dom.proximosHorarios || []).length, 0, `${s.nome} com horário no domingo`);
    }
  });

  await t.test('primeiro e último horário do dia batem com o funcionamento', async () => {
    const { ferramenta } = await conversa();
    const r = await ferramenta('consultar_disponibilidade', { serviceId: SERV['Corte Masculino'].id, professionalId: PROF.bruno.id, date: segunda });
    const slots = r.disponibilidade?.slots || r.disponibilidade || [];
    const horas = slots.map((x) => (typeof x === 'string' ? x : x.time || x.horario)).filter(Boolean);
    assert.equal(horas[0], '06:00', 'abre às 06:00');
    assert.equal(horas[horas.length - 1], '20:30', 'corte de 30 min: último às 20:30');
  });

  await t.test('serviço longo não estoura o fechamento (Platinado 120 min às 19:30 é recusado)', async () => {
    const r = await agendar('Platinado / Descoloração global', { professionalId: PROF.nathy.id, date: segunda, time: '19:30' });
    const recusado = r.prep?.ok === false || r.conf?.ok === false;
    assert.ok(recusado, 'não pode marcar serviço que termina 21:30');
    const ok = await agendar('Platinado / Descoloração global', { professionalId: PROF.nathy.id, date: segunda, time: '19:00' });
    assert.notEqual(ok.prep?.ok, false, 'às 19:00 termina 21:00 e cabe');
    assert.notEqual(ok.conf?.ok, false);
  });

  await t.test('Corte Premium com o Dino: só o Dino, nunca outro barbeiro', async () => {
    const { ferramenta } = await conversa();
    const r = await ferramenta('sugerir_proximos_horarios', { serviceId: SERV['Corte Premium com o Dino (Master)'].id, professionalId: 'qualquer', fromDate: segunda, days: 2, limit: 10 });
    assert.ok((r.proximosHorarios || []).length > 0, 'há horários do Dino');
    CORTE_PREMIUM_OFERTA = (r.proximosHorarios || [])[0];
    const comBruno = await agendar('Corte Premium com o Dino (Master)', { professionalId: PROF.bruno.id, date: segunda, time: '10:00' });
    assert.ok(comBruno.prep?.ok === false || comBruno.conf?.ok === false, 'Bruno não pode fazer o Corte Premium com o Dino');
    const qualquer = await agendar('Corte Premium com o Dino (Master)', { date: segunda, time: '10:00' });
    assert.notEqual(qualquer.conf?.ok, false);
    const criado = barbearia.listarAgendamentos(IDS.empresa, {}).find((a) => String(a.clienteTelefone).endsWith(qualquer.phone.slice(-8)));
    assert.equal(criado.profissionalId, PROF.dino.id, '"qualquer" cai no Dino');
    assert.equal(Number(criado.valor), 1000);
  });

  await t.test('agenda cheia de verdade: dois clientes no mesmo horário com o mesmo barbeiro → o segundo é recusado', async () => {
    const a = await agendar('Corte Masculino', { professionalId: PROF.leo.id, date: sabado, time: '09:00' });
    assert.notEqual(a.conf?.ok, false);
    const b = await agendar('Corte Masculino', { professionalId: PROF.leo.id, date: sabado, time: '09:00' });
    assert.ok(b.prep?.ok === false || b.conf?.ok === false, 'não pode marcar em cima');
    const { ferramenta } = await conversa();
    const r = await ferramenta('consultar_disponibilidade', { serviceId: SERV['Corte Masculino'].id, professionalId: PROF.leo.id, date: sabado });
    const horas = (r.disponibilidade?.slots || r.disponibilidade || []).map((x) => (typeof x === 'string' ? x : x.time || x.horario));
    assert.ok(!horas.includes('09:00'), '09:00 do Léo some da oferta');
  });

  await t.test('combo real: Corte + Barba e Sobrancelha na mesma ida, em sequência', async () => {
    const r = await agendar('Corte + Barba', { professionalId: PROF.carlos.id, date: sabado, time: '14:00', extras: ['Sobrancelha (navalha)'] });
    assert.notEqual(r.conf?.ok, false);
    const meus = barbearia.listarAgendamentos(IDS.empresa, {}).filter((a) => String(a.clienteTelefone).endsWith(r.phone.slice(-8))).sort((x, y) => String(x.horaLocal).localeCompare(String(y.horaLocal)));
    assert.equal(meus.length, 2);
    assert.equal(meus[0].horaLocal, '14:00');
    // Grade de 30 min: o segundo serviço entra no primeiro horário da grade após o fim do combo (14:50 → 15:00).
    assert.ok(minutos(meus[1].horaLocal) >= minutos('14:50') && minutos(meus[1].horaLocal) < minutos('15:20'), `sobrancelha logo depois do combo (${meus[1].horaLocal})`);
    assert.equal(meus[1].profissionalId, PROF.carlos.id, 'mesmo barbeiro');
    assert.equal(meus.reduce((soma, a) => soma + Number(a.valor), 0), 95);
  });
});
