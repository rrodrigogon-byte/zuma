/**
 * Service: Oficina Mecânica e Assistência Técnica
 * SetPoint Ultra — OS Digital, Checklist, Aprovação WhatsApp, Garantia
 */
import { db } from '../../core/database.js';

// ============================================================================
// VEÍCULOS
// ============================================================================

export async function cadastrarVeiculo(tenantId, dados) {
  const result = await db.query(
    `INSERT INTO oficina_veiculos
      (tenant_id, cliente_id, placa, chassi, renavam, marca, modelo,
       ano_fabricacao, ano_modelo, cor, combustivel, observacoes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (placa) DO UPDATE SET
       marca = EXCLUDED.marca, modelo = EXCLUDED.modelo,
       updated_at = NOW()
     RETURNING *`,
    [tenantId, dados.cliente_id, dados.placa?.toUpperCase(), dados.chassi,
     dados.renavam, dados.marca, dados.modelo, dados.ano_fabricacao,
     dados.ano_modelo, dados.cor, dados.combustivel, dados.observacoes]
  );
  return result.rows[0];
}

export async function buscarVeiculoPorPlaca(tenantId, placa) {
  const result = await db.query(
    `SELECT v.*, c.nome AS cliente_nome, c.telefone AS cliente_telefone,
            COUNT(os.id) AS total_os
     FROM oficina_veiculos v
     LEFT JOIN clientes c ON c.id = v.cliente_id
     LEFT JOIN oficina_ordens_servico os ON os.veiculo_id = v.id
     WHERE v.tenant_id = $1 AND v.placa = $2
     GROUP BY v.id, c.nome, c.telefone`,
    [tenantId, placa.toUpperCase()]
  );
  return result.rows[0] || null;
}

// ============================================================================
// ORDENS DE SERVIÇO
// ============================================================================

/**
 * Abrir nova OS com número sequencial automático
 */
export async function abrirOS(tenantId, dados) {
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');

    // Gerar número sequencial da OS
    const seqResult = await client.query(
      `SELECT COALESCE(MAX(CAST(REGEXP_REPLACE(numero_os, '[^0-9]', '', 'g') AS INTEGER)), 0) + 1 AS proximo
       FROM oficina_ordens_servico WHERE tenant_id = $1`,
      [tenantId]
    );
    const numeroOS = `OS${String(seqResult.rows[0].proximo).padStart(6, '0')}`;

    const osResult = await client.query(
      `INSERT INTO oficina_ordens_servico
        (tenant_id, numero_os, veiculo_id, cliente_id, mecanico_responsavel_id,
         km_entrada, data_previsao, descricao_problema, observacoes_internas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [tenantId, numeroOS, dados.veiculo_id, dados.cliente_id,
       dados.mecanico_responsavel_id, dados.km_entrada, dados.data_previsao,
       dados.descricao_problema, dados.observacoes_internas]
    );
    const os = osResult.rows[0];

    // Inserir checklist de entrada se fornecido
    if (dados.checklist && dados.checklist.length > 0) {
      for (const item of dados.checklist) {
        await client.query(
          `INSERT INTO oficina_checklist (os_id, item, status, observacao, foto_url)
           VALUES ($1,$2,$3,$4,$5)`,
          [os.id, item.item, item.status || 'ok', item.observacao, item.foto_url]
        );
      }
    }

    await client.query('COMMIT');
    return os;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Adicionar serviços e peças ao orçamento da OS
 */
export async function adicionarOrcamento(osId, tenantId, dados) {
  const { servicos = [], pecas = [] } = dados;
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');

    let totalPecas = 0;
    let totalMaoObra = 0;

    for (const s of servicos) {
      const valorTotal = s.valor_total || (s.horas_estimadas * s.valor_hora);
      await client.query(
        `INSERT INTO oficina_os_servicos
          (os_id, descricao, mecanico_id, horas_estimadas, valor_hora,
           valor_total, comissao_percentual)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [osId, s.descricao, s.mecanico_id, s.horas_estimadas,
         s.valor_hora, valorTotal, s.comissao_percentual || 0]
      );
      totalMaoObra += valorTotal;
    }

    for (const p of pecas) {
      await client.query(
        `INSERT INTO oficina_os_pecas
          (os_id, produto_id, descricao, quantidade, valor_unitario,
           numero_serie, garantia_meses)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [osId, p.produto_id, p.descricao, p.quantidade,
         p.valor_unitario, p.numero_serie, p.garantia_meses || 0]
      );
      totalPecas += p.quantidade * p.valor_unitario;
    }

    // Atualizar totais na OS
    await client.query(
      `UPDATE oficina_ordens_servico
       SET valor_pecas = $1, valor_mao_obra = $2,
           status = 'orcamento_enviado', updated_at = NOW()
       WHERE id = $3`,
      [totalPecas, totalMaoObra, osId]
    );

    await client.query('COMMIT');
    return { total_pecas: totalPecas, total_mao_obra: totalMaoObra, total: totalPecas + totalMaoObra };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Enviar orçamento para aprovação via WhatsApp
 * Retorna o link de aprovação e a mensagem formatada
 */
export async function enviarOrcamentoWhatsApp(osId, tenantId) {
  const osResult = await db.query(
    `SELECT os.*, v.placa, v.marca, v.modelo,
            c.nome AS cliente_nome, c.telefone AS cliente_telefone
     FROM oficina_ordens_servico os
     LEFT JOIN oficina_veiculos v ON v.id = os.veiculo_id
     LEFT JOIN clientes c ON c.id = os.cliente_id
     WHERE os.id = $1 AND os.tenant_id = $2`,
    [osId, tenantId]
  );
  const os = osResult.rows[0];
  if (!os) throw new Error('OS não encontrada');

  const servicos = await db.query(
    'SELECT * FROM oficina_os_servicos WHERE os_id = $1', [osId]
  );
  const pecas = await db.query(
    'SELECT * FROM oficina_os_pecas WHERE os_id = $1', [osId]
  );

  // Montar mensagem formatada para WhatsApp
  const linhasServicos = servicos.rows.map(s =>
    `  • ${s.descricao}: R$ ${Number(s.valor_total).toFixed(2)}`
  ).join('\n');
  const linhasPecas = pecas.rows.map(p =>
    `  • ${p.descricao} (${p.quantidade}x): R$ ${Number(p.valor_total).toFixed(2)}`
  ).join('\n');

  const mensagem = `🔧 *ORÇAMENTO ${os.numero_os}*\n\n` +
    `Veículo: ${os.marca} ${os.modelo} - ${os.placa}\n\n` +
    `*Serviços:*\n${linhasServicos || '  Nenhum'}\n\n` +
    `*Peças:*\n${linhasPecas || '  Nenhuma'}\n\n` +
    `*Total Mão de Obra:* R$ ${Number(os.valor_mao_obra).toFixed(2)}\n` +
    `*Total Peças:* R$ ${Number(os.valor_pecas).toFixed(2)}\n` +
    `*TOTAL GERAL:* R$ ${Number(os.valor_total).toFixed(2)}\n\n` +
    `Para APROVAR, responda *SIM*\nPara RECUSAR, responda *NÃO*`;

  // Link de aprovação (pode ser usado com Evolution API)
  const linkAprovacao = `${process.env.SERVER_URL}/api/oficina/os/${osId}/aprovar-publico`;

  return {
    telefone: os.cliente_telefone,
    mensagem,
    link_aprovacao: linkAprovacao,
    os
  };
}

/**
 * Aprovar OS (pelo cliente ou internamente)
 */
export async function aprovarOS(osId, tenantId, aprovadoPor = 'cliente') {
  const result = await db.query(
    `UPDATE oficina_ordens_servico
     SET status = 'aprovado', aprovado_em = NOW(), aprovado_por = $1, updated_at = NOW()
     WHERE id = $2 AND tenant_id = $3
     RETURNING *`,
    [aprovadoPor, osId, tenantId]
  );
  if (!result.rows[0]) throw new Error('OS não encontrada');
  return result.rows[0];
}

/**
 * Finalizar OS e registrar garantias
 */
export async function finalizarOS(osId, tenantId, dados) {
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE oficina_ordens_servico
       SET status = 'finalizado', km_saida = $1, data_saida = NOW(),
           observacoes_internas = COALESCE($2, observacoes_internas), updated_at = NOW()
       WHERE id = $3 AND tenant_id = $4`,
      [dados.km_saida, dados.observacoes, osId, tenantId]
    );

    // Registrar garantias das peças
    const pecas = await client.query(
      'SELECT * FROM oficina_os_pecas WHERE os_id = $1 AND garantia_meses > 0',
      [osId]
    );
    for (const peca of pecas.rows) {
      const dataFim = new Date();
      dataFim.setMonth(dataFim.getMonth() + peca.garantia_meses);
      await client.query(
        `INSERT INTO oficina_garantias
          (tenant_id, os_id, tipo, descricao, data_inicio, data_fim)
         VALUES ($1,$2,'peca',$3,CURRENT_DATE,$4)`,
        [tenantId, osId, peca.descricao, dataFim.toISOString().split('T')[0]]
      );
    }

    // Registrar garantia dos serviços (padrão 90 dias)
    if (dados.garantia_servico_dias) {
      const dataFimServico = new Date();
      dataFimServico.setDate(dataFimServico.getDate() + dados.garantia_servico_dias);
      await client.query(
        `INSERT INTO oficina_garantias
          (tenant_id, os_id, tipo, descricao, data_inicio, data_fim)
         VALUES ($1,$2,'servico','Garantia de serviço',CURRENT_DATE,$3)`,
        [tenantId, osId, dataFimServico.toISOString().split('T')[0]]
      );
    }

    await client.query('COMMIT');
    return { sucesso: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Listar OS com filtros
 */
export async function listarOS(tenantId, filtros = {}) {
  const params = [tenantId];
  let where = 'WHERE os.tenant_id = $1';

  if (filtros.status) { params.push(filtros.status); where += ` AND os.status = $${params.length}`; }
  if (filtros.mecanico_id) { params.push(filtros.mecanico_id); where += ` AND os.mecanico_responsavel_id = $${params.length}`; }
  if (filtros.placa) { params.push(filtros.placa.toUpperCase()); where += ` AND v.placa = $${params.length}`; }

  const result = await db.query(
    `SELECT os.*, v.placa, v.marca, v.modelo,
            c.nome AS cliente_nome, c.telefone AS cliente_telefone,
            u.nome AS mecanico_nome
     FROM oficina_ordens_servico os
     LEFT JOIN oficina_veiculos v ON v.id = os.veiculo_id
     LEFT JOIN clientes c ON c.id = os.cliente_id
     LEFT JOIN usuarios u ON u.id = os.mecanico_responsavel_id
     ${where}
     ORDER BY os.created_at DESC
     LIMIT 100`,
    params
  );
  return result.rows;
}

/**
 * Verificar garantias ativas de um veículo
 */
export async function verificarGarantias(tenantId, veiculoId) {
  const result = await db.query(
    `SELECT g.*, os.numero_os, v.placa
     FROM oficina_garantias g
     JOIN oficina_ordens_servico os ON os.id = g.os_id
     JOIN oficina_veiculos v ON v.id = os.veiculo_id
     WHERE g.tenant_id = $1 AND os.veiculo_id = $2
       AND g.data_fim >= CURRENT_DATE AND g.status = 'vigente'
     ORDER BY g.data_fim`,
    [tenantId, veiculoId]
  );
  return result.rows;
}
