/**
 * Service: Barbearia e Salão de Beleza (EXPANDIDO)
 * SetPoint Ultra — Agendamento Online, Rateio, Pacotes/Assinaturas, Comanda
 */
import { db } from '../../core/database.js';

// ============================================================================
// PROFISSIONAIS
// ============================================================================

export async function listarProfissionais(tenantId) {
  const result = await db.query(
    `SELECT p.*,
            COUNT(a.id) FILTER (WHERE DATE(a.data_hora) = CURRENT_DATE) AS agendamentos_hoje
     FROM barbearia_profissionais p
     LEFT JOIN agendamentos a ON a.profissional_id = p.id AND a.status NOT IN ('cancelado')
     WHERE p.tenant_id = $1 AND p.ativo = TRUE
     GROUP BY p.id
     ORDER BY p.nome`,
    [tenantId]
  );
  return result.rows;
}

export async function criarProfissional(tenantId, dados) {
  const result = await db.query(
    `INSERT INTO barbearia_profissionais
      (tenant_id, nome, telefone, email, tipo, percentual_comissao,
       percentual_comissao_produto, desconta_taxa_maquininha, foto_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [tenantId, dados.nome, dados.telefone, dados.email,
     dados.tipo || 'parceiro', dados.percentual_comissao || 50,
     dados.percentual_comissao_produto || 30,
     dados.desconta_taxa_maquininha !== false, dados.foto_url]
  );
  return result.rows[0];
}

// ============================================================================
// AGENDA ONLINE
// ============================================================================

/**
 * Verificar horários disponíveis para um profissional em uma data
 */
export async function verificarDisponibilidade(tenantId, profissionalId, data) {
  // Buscar agendamentos existentes do dia
  const agendamentos = await db.query(
    `SELECT data_hora, duracao_minutos
     FROM agendamentos
     WHERE tenant_id = $1 AND profissional_id = $2
       AND DATE(data_hora) = $3
       AND status NOT IN ('cancelado')
     ORDER BY data_hora`,
    [tenantId, profissionalId, data]
  );

  // Gerar slots de 30 min das 08:00 às 20:00
  const slots = [];
  const horaInicio = 8;
  const horaFim = 20;
  const intervaloMin = 30;

  for (let h = horaInicio; h < horaFim; h++) {
    for (let m = 0; m < 60; m += intervaloMin) {
      const slotHora = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
      const slotDate = new Date(`${data}T${slotHora}:00`);

      // Verificar se o slot está ocupado
      const ocupado = agendamentos.rows.some(ag => {
        const agInicio = new Date(ag.data_hora);
        const agFim = new Date(agInicio.getTime() + ag.duracao_minutos * 60000);
        return slotDate >= agInicio && slotDate < agFim;
      });

      slots.push({ hora: slotHora, disponivel: !ocupado });
    }
  }

  return slots;
}

/**
 * Criar agendamento (pode vir do link público ou do sistema)
 */
export async function criarAgendamento(tenantId, dados) {
  // Verificar conflito de horário
  const conflito = await db.query(
    `SELECT id FROM agendamentos
     WHERE tenant_id = $1 AND profissional_id = $2
       AND status NOT IN ('cancelado')
       AND data_hora < $3::timestamptz + ($4 || ' minutes')::interval
       AND data_hora + (duracao_minutos || ' minutes')::interval > $3::timestamptz`,
    [tenantId, dados.profissional_id, dados.data_hora, dados.duracao_minutos || 60]
  );

  if (conflito.rows.length > 0) {
    throw new Error('Horário indisponível. Por favor, escolha outro horário.');
  }

  const result = await db.query(
    `INSERT INTO agendamentos
      (tenant_id, profissional_id, cliente_id, servico_id,
       data_hora, duracao_minutos, valor, status, observacoes, origem)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'agendado',$8,$9)
     RETURNING *`,
    [tenantId, dados.profissional_id, dados.cliente_id, dados.servico_id,
     dados.data_hora, dados.duracao_minutos || 60, dados.valor,
     dados.observacoes, dados.origem || 'sistema']
  );
  return result.rows[0];
}

/**
 * Gerar link público de agendamento online
 */
export async function gerarLinkAgendamento(tenantId) {
  const result = await db.query(
    'SELECT slug FROM estabelecimentos WHERE id = $1',
    [tenantId]
  );
  const slug = result.rows[0]?.slug || tenantId;
  return `${process.env.SERVER_URL}/agendar/${slug}`;
}

// ============================================================================
// RATEIO (SPLIT DE PAGAMENTO)
// ============================================================================

/**
 * Calcular rateio de um atendimento finalizado
 * Retorna quanto vai para o profissional e quanto fica para o salão
 */
export async function calcularRateio(tenantId, agendamentoId, formaPagamento = 'cartao') {
  const agResult = await db.query(
    `SELECT a.*, p.percentual_comissao, p.percentual_comissao_produto,
            p.desconta_taxa_maquininha, p.nome AS profissional_nome
     FROM agendamentos a
     JOIN barbearia_profissionais p ON p.id = a.profissional_id
     WHERE a.id = $1 AND a.tenant_id = $2`,
    [agendamentoId, tenantId]
  );
  const ag = agResult.rows[0];
  if (!ag) throw new Error('Agendamento não encontrado');

  const valorBruto = Number(ag.valor);

  // Taxa da maquininha por forma de pagamento
  const taxas = { cartao: 0.0249, debito: 0.0149, pix: 0.0089, dinheiro: 0 };
  const taxaMaquininha = ag.desconta_taxa_maquininha ? valorBruto * (taxas[formaPagamento] || 0) : 0;
  const taxaFixa = formaPagamento !== 'dinheiro' && ag.desconta_taxa_maquininha ? 0.39 : 0;
  const totalTaxa = taxaMaquininha + taxaFixa;

  const baseCalculo = ag.desconta_taxa_maquininha ? valorBruto - totalTaxa : valorBruto;
  const valorProfissional = Number((baseCalculo * ag.percentual_comissao / 100).toFixed(2));
  const valorSalao = Number((valorBruto - valorProfissional - totalTaxa).toFixed(2));

  return {
    valor_bruto: valorBruto,
    taxa_maquininha: Number(totalTaxa.toFixed(2)),
    percentual_profissional: ag.percentual_comissao,
    valor_profissional: valorProfissional,
    valor_salao: valorSalao,
    profissional_nome: ag.profissional_nome,
    forma_pagamento: formaPagamento
  };
}

/**
 * Gerar extrato de repasse para um profissional no período
 */
export async function gerarExtratoRepasse(tenantId, profissionalId, dataInicio, dataFim) {
  const result = await db.query(
    `SELECT
       a.id, a.data_hora, a.valor AS valor_bruto,
       s.nome AS servico_nome,
       a.cliente_nome,
       a.forma_pagamento,
       a.valor_profissional,
       a.valor_taxa
     FROM agendamentos a
     LEFT JOIN servicos s ON s.id = a.servico_id
     -- LEFT JOIN clientes c
     WHERE a.tenant_id = $1
       AND a.profissional_id = $2
       AND a.status = 'finalizado'
       AND a.data_hora BETWEEN $3 AND $4
     ORDER BY a.data_hora`,
    [tenantId, profissionalId, dataInicio, dataFim]
  );

  const atendimentos = result.rows;
  const totalBruto = atendimentos.reduce((s, a) => s + Number(a.valor_bruto), 0);
  const totalProfissional = atendimentos.reduce((s, a) => s + Number(a.valor_profissional || 0), 0);

  return {
    profissional_id: profissionalId,
    periodo: { inicio: dataInicio, fim: dataFim },
    total_atendimentos: atendimentos.length,
    total_bruto: Number(totalBruto.toFixed(2)),
    total_repasse: Number(totalProfissional.toFixed(2)),
    atendimentos
  };
}

/**
 * Fechar rateio do período e marcar como pago
 */
export async function fecharRateio(tenantId, profissionalId, dataInicio, dataFim) {
  const extrato = await gerarExtratoRepasse(tenantId, profissionalId, dataInicio, dataFim);

  const result = await db.query(
    `INSERT INTO barbearia_rateios
      (tenant_id, profissional_id, periodo_inicio, periodo_fim,
       total_servicos, valor_bruto, valor_liquido, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'pendente')
     RETURNING *`,
    [tenantId, profissionalId, dataInicio, dataFim,
     extrato.total_atendimentos, extrato.total_bruto, extrato.total_repasse]
  );
  return { ...result.rows[0], extrato };
}

export async function pagarRateio(rateioId, tenantId) {
  const result = await db.query(
    `UPDATE barbearia_rateios
     SET status = 'pago', data_pagamento = CURRENT_DATE
     WHERE id = $1 AND tenant_id = $2
     RETURNING *`,
    [rateioId, tenantId]
  );
  return result.rows[0];
}

// ============================================================================
// PACOTES E ASSINATURAS
// ============================================================================

export async function criarPacote(tenantId, dados) {
  const result = await db.query(
    `INSERT INTO barbearia_pacotes
      (tenant_id, nome, descricao, valor_mensal, limite_utilizacoes, servicos_incluidos)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [tenantId, dados.nome, dados.descricao, dados.valor_mensal,
     dados.limite_utilizacoes, JSON.stringify(dados.servicos_incluidos || [])]
  );
  return result.rows[0];
}

export async function assinarPacote(tenantId, dados) {
  // Calcular próximo vencimento (30 dias)
  const proximoVencimento = new Date();
  proximoVencimento.setDate(proximoVencimento.getDate() + 30);

  const result = await db.query(
    `INSERT INTO barbearia_assinaturas
      (tenant_id, cliente_id, pacote_id, data_inicio, proximo_vencimento, gateway_subscription_id)
     VALUES ($1,$2,$3,CURRENT_DATE,$4,$5)
     RETURNING *`,
    [tenantId, dados.cliente_id, dados.pacote_id,
     proximoVencimento.toISOString().split('T')[0],
     dados.gateway_subscription_id]
  );
  return result.rows[0];
}

export async function verificarAssinatura(tenantId, clienteId) {
  const result = await db.query(
    `SELECT a.*, p.nome AS pacote_nome, p.limite_utilizacoes,
            p.servicos_incluidos, p.valor_mensal
     FROM barbearia_assinaturas a
     JOIN barbearia_pacotes p ON p.id = a.pacote_id
     WHERE a.tenant_id = $1 AND a.cliente_id = $2
       AND a.status = 'ativa'
       AND (a.data_fim IS NULL OR a.data_fim >= CURRENT_DATE)
     ORDER BY a.created_at DESC
     LIMIT 1`,
    [tenantId, clienteId]
  );
  return result.rows[0] || null;
}

export async function registrarUtilizacaoAssinatura(assinaturaId) {
  const result = await db.query(
    `UPDATE barbearia_assinaturas
     SET utilizacoes_mes = utilizacoes_mes + 1
     WHERE id = $1
     RETURNING *`,
    [assinaturaId]
  );
  const assinatura = result.rows[0];
  if (assinatura.limite_utilizacoes && assinatura.utilizacoes_mes > assinatura.limite_utilizacoes) {
    throw new Error(`Limite de ${assinatura.limite_utilizacoes} utilizações do pacote atingido este mês`);
  }
  return assinatura;
}

/**
 * Resetar utilizações mensais (executar no início de cada mês via cron)
 */
export async function resetarUtilizacoesMensais(tenantId) {
  await db.query(
    `UPDATE barbearia_assinaturas SET utilizacoes_mes = 0
     WHERE tenant_id = $1 AND status = 'ativa'`,
    [tenantId]
  );
}
