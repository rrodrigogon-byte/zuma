import { db as pgDb } from './database.js';
import * as barbeariaErpKytto from '../barbearia-erp-kytto.js';

const EMPRESA_DINO_ID = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
const LOJA_DINO_ID = 'ab049a75-6e2e-4cc9-abbc-6fd11cdda1d8';

// Mapeamento de IDs da base JSON (prof-xxx) para UUIDs da tabela usuarios no PostgreSQL
export const MAPA_PROF_UUID = {
  'prof-mtj67o7r-001': '5bd0e8d9-a6a0-4fc9-a9cb-ce350188bd20', // Guilherme Cunha Martins (Dino)
  'prof-mtj69hhx-002': '16212c5f-9d9c-4831-a669-92ec6c5f352c', // Bruno Mendes Pedroso
  'prof-mv1bx3sc-011': '6bec50bd-4e22-4aa0-8da5-a54439caf0bf', // Natani Minanis Dobler (Nati)
  'prof-mvsqchn0-025': '4dc6960f-f7e9-4847-a1fd-7f111ab1000a', // Amanda Gabrielly
  'prof-mvsqchmy-024': 'c5f9ba2f-365f-4ada-9087-78d3ce4815d3', // David Kauã
  'prof-mv1a1o0o-010': '5751b262-44fb-4554-9802-8ea3c9d2d517', // Steffany Marielly (Ester)
  'prof-mvodph1o-036': '6856accc-e854-4a78-aa7a-40c722669943', // João Victor Domingos
};

export function obterUuidProfissional(profissionalId) {
  if (!profissionalId) return null;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profissionalId)) {
    return profissionalId;
  }
  return MAPA_PROF_UUID[profissionalId] || null;
}

/**
 * Sincroniza um bloqueio recém-criado ou atualizado no PostgreSQL (agendamentos_bloqueios).
 */
export async function sincronizarBloqueioNoPostgres(empresaId, bloqueio) {
  if (!empresaId || !bloqueio) return null;
  try {
    const profUuid = obterUuidProfissional(bloqueio.profissionalId);
    const lojaId = bloqueio.lojaId || LOJA_DINO_ID;

    // Se tiver profissional específico, insere para ele. Se não tiver (unidade toda), insere para cada barbeiro ativo.
    const alvos = profUuid ? [profUuid] : Object.values(MAPA_PROF_UUID);

    for (const usuarioProfissionalId of alvos) {
      await pgDb.query(
        `INSERT INTO agendamentos_bloqueios 
          (empresa_id, loja_id, usuario_profissional_id, data_inicio, data_fim, motivo, descricao, ativo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT DO NOTHING`,
        [
          empresaId,
          lojaId,
          usuarioProfissionalId,
          new Date(bloqueio.inicio).toISOString().slice(0, 19).replace('T', ' '),
          new Date(bloqueio.fim).toISOString().slice(0, 19).replace('T', ' '),
          bloqueio.titulo || 'Bloqueio de agenda',
          bloqueio.motivo || bloqueio.descricao || 'Bloqueio administrativo',
          bloqueio.ativo !== false,
        ]
      ).catch((err) => console.warn('[bloqueios-sync] Erro ao sincronizar bloqueio no PG:', err.message));
    }
  } catch (erro) {
    console.warn('[bloqueios-sync] Falha geral ao sincronizar bloqueio:', erro.message);
  }
}

/**
 * Desativa um bloqueio no PostgreSQL por data e profissional.
 */
export async function desativarBloqueioNoPostgres(empresaId, bloqueio) {
  if (!empresaId || !bloqueio) return null;
  try {
    const profUuid = obterUuidProfissional(bloqueio.profissionalId);
    const inicioStr = new Date(bloqueio.inicio).toISOString().slice(0, 19).replace('T', ' ');
    const fimStr = new Date(bloqueio.fim).toISOString().slice(0, 19).replace('T', ' ');

    let sql = `UPDATE agendamentos_bloqueios SET ativo = false WHERE empresa_id = $1 AND data_inicio = $2 AND data_fim = $3`;
    const params = [empresaId, inicioStr, fimStr];

    if (profUuid) {
      sql += ` AND usuario_profissional_id = $4`;
      params.push(profUuid);
    }

    await pgDb.query(sql, params).catch((err) => console.warn('[bloqueios-sync] Erro ao desativar no PG:', err.message));
  } catch (erro) {
    console.warn('[bloqueios-sync] Falha ao desativar bloqueio:', erro.message);
  }
}

/**
 * Rotina executada no boot do servidor:
 * 1. Garante que os barbeiros estejam na tabela `usuarios_lojas` para que a query do PostgreSQL os reconheça.
 * 2. Garante que Segunda (09/11/2026) e Terça (10/11/2026) do Dino estejam 100% bloqueadas no ERP e no PostgreSQL.
 */
export async function inicializarBloqueiosEquipe() {
  try {
    // 1. Vincular EXCLUSIVAMENTE os barbeiros e equipe oficiais titulares
    const equipeAtivaOficial = [
      { id: '5bd0e8d9-a6a0-4fc9-a9cb-ce350188bd20', role: 'barbeiro' }, // Dino (Guilherme)
      { id: '16212c5f-9d9c-4831-a669-92ec6c5f352c', role: 'barbeiro' }, // Bruno Mendes Pedroso
      { id: '6bec50bd-4e22-4aa0-8da5-a54439caf0bf', role: 'barbeiro' }, // Nati (Natani)
      { id: '5751b262-44fb-4554-9802-8ea3c9d2d517', role: 'operador' }, // Ster (Steffany)
    ];

    for (const b of equipeAtivaOficial) {
      await pgDb.query(
        `INSERT INTO usuarios_lojas (usuario_id, loja_id, role_loja, ativo, permissoes)
         VALUES ($1, $2, $3, true, '{}')
         ON CONFLICT (usuario_id, loja_id) DO UPDATE SET role_loja = EXCLUDED.role_loja, ativo = true`,
        [b.id, LOJA_DINO_ID, b.role]
      ).catch(() => null);
    }

    // 1.1 INATIVAÇÃO MANDATÓRIA DE EX-COLABORADORES DESLIGADOS NO POSTGRESQL
    const exFuncionariosIds = [
      '4dc6960f-f7e9-4847-a1fd-7f111ab1000a', // Amanda
      'c5f9ba2f-365f-4ada-9087-78d3ce4815d3', // David
      '6856accc-e854-4a78-aa7a-40c722669943', // João Victor
    ];
    await pgDb.query(
      `UPDATE usuarios_lojas SET ativo = false WHERE usuario_id = ANY($1::uuid[]) AND loja_id = $2`,
      [exFuncionariosIds, LOJA_DINO_ID]
    ).catch(() => null);
    await pgDb.query(
      `UPDATE usuarios SET ativo = false WHERE id = ANY($1::uuid[])`,
      [exFuncionariosIds]
    ).catch(() => null);
    await pgDb.query(
      `UPDATE commerce_memberships SET ativo = false WHERE usuario_id = ANY($1::uuid[])`,
      [exFuncionariosIds]
    ).catch(() => null);

    // 2. Bloquear Segunda (09/11/2026) e Terça (10/11/2026) do Dino no ERP e no PostgreSQL
    const diasAusenciaDino = ['2026-11-09', '2026-11-10'];
    const dinoUuid = MAPA_PROF_UUID['prof-mtj67o7r-001'];

    for (const dia of diasAusenciaDino) {
      // 00:00 às 23:59 em Cuiabá (UTC-4) -> 04:00Z até 03:59Z do dia seguinte
      const inicioIso = `${dia}T04:00:00.000Z`;
      const fimIso = `${dia}T23:59:59.000Z`;

      // 2.1 Salva no JSON DB da barbearia se ainda não existir
      const bloqueiosExistentes = barbeariaErpKytto.listarBloqueios(EMPRESA_DINO_ID, { data: dia, profissionalId: 'prof-mtj67o7r-001' });
      const jaBloqueadoErp = bloqueiosExistentes.some((blk) => blk.profissionalId === 'prof-mtj67o7r-001' && blk.ativo !== false);

      if (!jaBloqueadoErp) {
        barbeariaErpKytto.criarBloqueio(EMPRESA_DINO_ID, {
          titulo: 'Ausência / Viagem Dino',
          motivo: 'Dino não atenderá nesta data (agenda bloqueada)',
          inicio: inicioIso,
          fim: fimIso,
          profissionalId: 'prof-mtj67o7r-001',
          lojaId: LOJA_DINO_ID,
        });
        console.log(`[bloqueios-sync] Bloqueio do Dino criado no ERP para ${dia}`);
      }

      // 2.2 Salva no PostgreSQL agendamentos_bloqueios
      await pgDb.query(
        `INSERT INTO agendamentos_bloqueios
          (empresa_id, loja_id, usuario_profissional_id, data_inicio, data_fim, motivo, descricao, ativo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)
         ON CONFLICT DO NOTHING`,
        [
          EMPRESA_DINO_ID,
          LOJA_DINO_ID,
          dinoUuid,
          `${dia} 00:00:00`,
          `${dia} 23:59:59`,
          'Ausência / Viagem Dino',
          'Dino não atenderá nesta data (agenda bloqueada)',
        ]
      ).catch((err) => console.warn('[bloqueios-sync] Erro ao inserir bloqueio no PG:', err.message));
    }

    // 3. Bloquear Terça (17/11/2026) e Quarta (18/11/2026) da Nati (Viagem) no ERP e no PostgreSQL
    const diasAusenciaNati = ['2026-11-17', '2026-11-18'];
    const natiUuid = MAPA_PROF_UUID['prof-mtj67o7r-003'] || '6bec50bd-4e22-4aa0-8da5-a54439caf0bf';
    const natiIdErp = 'prof-mtj67o7r-003';

    for (const dia of diasAusenciaNati) {
      const inicioIso = `${dia}T04:00:00.000Z`;
      const fimIso = `${dia}T23:59:59.000Z`;

      const bloqueiosExistentes = barbeariaErpKytto.listarBloqueios(EMPRESA_DINO_ID, { data: dia, profissionalId: natiIdErp });
      const jaBloqueadoErp = bloqueiosExistentes.some((blk) => blk.profissionalId === natiIdErp && blk.ativo !== false);

      if (!jaBloqueadoErp) {
        barbeariaErpKytto.criarBloqueio(EMPRESA_DINO_ID, {
          titulo: 'Viagem / Ausência',
          motivo: 'Nati em viagem (dias 17 e 18/11) - agenda fechada',
          inicio: inicioIso,
          fim: fimIso,
          profissionalId: natiIdErp,
          lojaId: LOJA_DINO_ID,
        });
        console.log(`[bloqueios-sync] Bloqueio da Nati criado no ERP para ${dia}`);
      }

      await pgDb.query(
        `INSERT INTO agendamentos_bloqueios
          (empresa_id, loja_id, usuario_profissional_id, data_inicio, data_fim, motivo, descricao, ativo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)
         ON CONFLICT DO NOTHING`,
        [
          EMPRESA_DINO_ID,
          LOJA_DINO_ID,
          natiUuid,
          `${dia} 00:00:00`,
          `${dia} 23:59:59`,
          'Viagem / Ausência Nati',
          'Nati não atenderá nesta data (em viagem)',
        ]
      ).catch((err) => console.warn('[bloqueios-sync] Erro ao inserir bloqueio Nati no PG:', err.message));
    }

    console.log('[bloqueios-sync] Inicialização e bloqueio de agenda de Dino concluídos.');
  } catch (erro) {
    console.warn('[bloqueios-sync] Aviso na inicialização de bloqueios:', erro.message);
  }
}
