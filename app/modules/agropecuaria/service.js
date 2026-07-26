/**
 * Service: Agropecuária, Petshop e Clínica Veterinária
 * SetPoint Ultra — Receituário Agronômico/Veterinário, Prontuário, Fracionamento, Vacinas
 */
import { db } from '../../core/database.js';

// ============================================================================
// RECEITUÁRIO AGRONÔMICO E VETERINÁRIO
// ============================================================================

/**
 * Emitir receituário com número sequencial
 */
export async function emitirReceituario(tenantId, dados) {
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');

    // Número sequencial por tipo
    const seqResult = await client.query(
      `SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(numero_receita, '[^0-9]', '', 'g') AS INTEGER)), 0) + 1 AS proximo
       FROM agro_receituarios WHERE tenant_id = $1 AND tipo = $2`,
      [tenantId, dados.tipo]
    );
    const prefixo = dados.tipo === 'agronomico' ? 'RA' : 'RV';
    const numero = `${prefixo}${new Date().getFullYear()}${String(seqResult.rows[0].proximo).padStart(6, '0')}`;

    const recResult = await client.query(
      `INSERT INTO agro_receituarios
        (tenant_id, numero_receita, tipo, profissional_nome, profissional_registro,
         cliente_nome, cliente_cpf_cnpj, propriedade, validade_dias, observacoes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [tenantId, numero, dados.tipo, dados.profissional_nome, dados.profissional_registro,
       dados.cliente_nome, dados.cliente_cpf_cnpj, dados.propriedade,
       dados.validade_dias || 30, dados.observacoes]
    );
    const rec = recResult.rows[0];

    // Inserir itens da receita
    for (const item of (dados.itens || [])) {
      await client.query(
        `INSERT INTO agro_receituario_itens
          (receituario_id, produto_id, produto_nome, dosagem, quantidade, unidade, modo_uso)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [rec.id, item.produto_id, item.produto_nome, item.dosagem,
         item.quantidade, item.unidade, item.modo_uso]
      );
    }

    await client.query('COMMIT');
    return rec;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Vincular receituário a uma venda (obrigatório para produtos controlados)
 */
export async function vincularReceituarioVenda(receituarioId, vendaId) {
  const result = await db.query(
    `UPDATE agro_receituarios SET status = 'utilizado' WHERE id = $1 RETURNING *`,
    [receituarioId]
  );
  return result.rows[0];
}

/**
 * Relatório de receituários para fiscalização (INDEA/MAPA)
 */
export async function relatorioReceituarios(tenantId, dataInicio, dataFim, tipo) {
  const result = await db.query(
    `SELECT r.*, json_agg(json_build_object(
       'produto', ri.produto_nome, 'quantidade', ri.quantidade, 'unidade', ri.unidade
     )) AS itens
     FROM agro_receituarios r
     LEFT JOIN agro_receituario_itens ri ON ri.receituario_id = r.id
     WHERE r.tenant_id = $1
       AND r.data_emissao BETWEEN $2 AND $3
       AND ($4::text IS NULL OR r.tipo = $4)
     GROUP BY r.id
     ORDER BY r.data_emissao DESC`,
    [tenantId, dataInicio, dataFim, tipo || null]
  );
  return result.rows;
}

// ============================================================================
// FRACIONAMENTO DE PRODUTOS
// ============================================================================

/**
 * Fracionar produto (ex: saco 50kg → venda por kg)
 * Registra a entrada do produto inteiro e configura venda fracionada
 */
export async function configurarFracionamento(tenantId, dados) {
  const { produto_origem_id, produto_destino_id, fator_conversao, unidade_origem, unidade_destino } = dados;

  // Verificar se já existe configuração
  const existing = await db.query(
    `SELECT id FROM produto_fracionamentos
     WHERE tenant_id = $1 AND produto_origem_id = $2`,
    [tenantId, produto_origem_id]
  );

  if (existing.rows.length > 0) {
    const result = await db.query(
      `UPDATE produto_fracionamentos
       SET fator_conversao = $1, produto_destino_id = $2, updated_at = NOW()
       WHERE tenant_id = $3 AND produto_origem_id = $4
       RETURNING *`,
      [fator_conversao, produto_destino_id, tenantId, produto_origem_id]
    );
    return result.rows[0];
  }

  const result = await db.query(
    `INSERT INTO produto_fracionamentos
      (tenant_id, produto_origem_id, produto_destino_id, fator_conversao, unidade_origem, unidade_destino)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [tenantId, produto_origem_id, produto_destino_id, fator_conversao, unidade_origem, unidade_destino]
  );
  return result.rows[0];
}

// ============================================================================
// PETS E PRONTUÁRIOS
// ============================================================================

export async function cadastrarPet(tenantId, dados) {
  const result = await db.query(
    `INSERT INTO petshop_pets
      (tenant_id, cliente_id, nome, especie, raca, sexo, data_nascimento,
       peso_kg, cor_pelagem, microchip, castrado, foto_url, observacoes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
    [tenantId, dados.cliente_id, dados.nome, dados.especie, dados.raca,
     dados.sexo || 'nao_informado', dados.data_nascimento, dados.peso_kg,
     dados.cor_pelagem, dados.microchip, dados.castrado || false,
     dados.foto_url, dados.observacoes]
  );
  return result.rows[0];
}

export async function atualizarPet(petId, tenantId, dados) {
  const result = await db.query(
    `UPDATE petshop_pets
     SET nome=$1, especie=$2, raca=$3, sexo=$4, data_nascimento=$5,
         peso_kg=$6, cor_pelagem=$7, microchip=$8, castrado=$9,
         foto_url=$10, observacoes=$11, updated_at=NOW()
     WHERE id=$12 AND tenant_id=$13
     RETURNING *`,
    [dados.nome, dados.especie, dados.raca, dados.sexo, dados.data_nascimento,
     dados.peso_kg, dados.cor_pelagem, dados.microchip, dados.castrado,
     dados.foto_url, dados.observacoes, petId, tenantId]
  );
  return result.rows[0];
}

export async function listarPetsPorCliente(tenantId, clienteId) {
  const result = await db.query(
    `SELECT p.*,
            (SELECT COUNT(*) FROM petshop_prontuarios pr WHERE pr.pet_id = p.id) AS total_consultas,
            (SELECT MAX(pr.data_atendimento) FROM petshop_prontuarios pr WHERE pr.pet_id = p.id) AS ultima_consulta
     FROM petshop_pets p
     WHERE p.tenant_id = $1 AND p.cliente_id = $2
     ORDER BY p.nome`,
    [tenantId, clienteId]
  );
  return result.rows;
}

/**
 * Registrar atendimento no prontuário
 */
export async function registrarAtendimento(tenantId, petId, dados) {
  const result = await db.query(
    `INSERT INTO petshop_prontuarios
      (pet_id, tenant_id, tipo, data_atendimento, veterinario_nome,
       peso_na_consulta, temperatura, diagnostico, prescricao, observacoes, proxima_consulta)
     VALUES ($1,$2,$3,NOW(),$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [petId, tenantId, dados.tipo, dados.veterinario_nome, dados.peso_na_consulta,
     dados.temperatura, dados.diagnostico, dados.prescricao, dados.observacoes,
     dados.proxima_consulta]
  );

  // Atualizar peso atual do pet
  if (dados.peso_na_consulta) {
    await db.query(
      'UPDATE petshop_pets SET peso_kg = $1, updated_at = NOW() WHERE id = $2',
      [dados.peso_na_consulta, petId]
    );
  }

  return result.rows[0];
}

export async function obterProntuario(tenantId, petId) {
  const pet = await db.query(
    `SELECT p.*, c.nome AS tutor_nome, c.telefone AS tutor_telefone
     FROM petshop_pets p
     LEFT JOIN clientes c ON c.id = p.cliente_id
     WHERE p.id = $1 AND p.tenant_id = $2`,
    [petId, tenantId]
  );
  if (!pet.rows[0]) throw new Error('Pet não encontrado');

  const atendimentos = await db.query(
    `SELECT * FROM petshop_prontuarios WHERE pet_id = $1 ORDER BY data_atendimento DESC`,
    [petId]
  );
  const vacinas = await db.query(
    `SELECT * FROM petshop_vacinas WHERE pet_id = $1 ORDER BY data_aplicacao DESC`,
    [petId]
  );
  const agendamentos = await db.query(
    `SELECT * FROM petshop_agendamentos WHERE pet_id = $1 AND data_hora >= NOW() ORDER BY data_hora`,
    [petId]
  );

  return {
    pet: pet.rows[0],
    atendimentos: atendimentos.rows,
    vacinas: vacinas.rows,
    proximos_agendamentos: agendamentos.rows
  };
}

// ============================================================================
// VACINAS E ALERTAS
// ============================================================================

export async function registrarVacina(tenantId, petId, dados) {
  const result = await db.query(
    `INSERT INTO petshop_vacinas
      (pet_id, tenant_id, nome_vacina, fabricante, lote, data_aplicacao,
       data_reforco, veterinario_nome)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [petId, tenantId, dados.nome_vacina, dados.fabricante, dados.lote,
     dados.data_aplicacao, dados.data_reforco, dados.veterinario_nome]
  );
  return result.rows[0];
}

/**
 * Buscar vacinas com reforço próximo para enviar alertas via WhatsApp
 */
export async function buscarVacinasReforcoProximo(tenantId, diasAntecedencia = 15) {
  const result = await db.query(
    `SELECT v.*, p.nome AS pet_nome, p.especie,
            c.nome AS tutor_nome, c.telefone AS tutor_telefone
     FROM petshop_vacinas v
     JOIN petshop_pets p ON p.id = v.pet_id
     LEFT JOIN clientes c ON c.id = p.cliente_id
     WHERE p.tenant_id = $1
       AND v.data_reforco IS NOT NULL
       AND v.data_reforco BETWEEN CURRENT_DATE AND CURRENT_DATE + $2
       AND v.notificacao_enviada = FALSE
     ORDER BY v.data_reforco`,
    [tenantId, diasAntecedencia]
  );
  return result.rows;
}

export async function marcarNotificacaoEnviada(vacinaId) {
  await db.query(
    'UPDATE petshop_vacinas SET notificacao_enviada = TRUE WHERE id = $1',
    [vacinaId]
  );
}

// ============================================================================
// AGENDAMENTOS PETSHOP
// ============================================================================

export async function agendarServico(tenantId, dados) {
  const result = await db.query(
    `INSERT INTO petshop_agendamentos
      (tenant_id, pet_id, profissional_id, tipo_servico, data_hora,
       duracao_minutos, valor, observacoes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [tenantId, dados.pet_id, dados.profissional_id, dados.tipo_servico,
     dados.data_hora, dados.duracao_minutos || 60, dados.valor, dados.observacoes]
  );
  return result.rows[0];
}

export async function listarAgendamentosHoje(tenantId) {
  const result = await db.query(
    `SELECT a.*, p.nome AS pet_nome, p.especie, p.raca,
            c.nome AS tutor_nome, c.telefone AS tutor_telefone
     FROM petshop_agendamentos a
     JOIN petshop_pets p ON p.id = a.pet_id
     LEFT JOIN clientes c ON c.id = p.cliente_id
     WHERE a.tenant_id = $1
       AND DATE(a.data_hora) = CURRENT_DATE
     ORDER BY a.data_hora`,
    [tenantId]
  );
  return result.rows;
}
