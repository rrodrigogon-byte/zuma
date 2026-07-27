/**
 * Módulo SPED — SetPoint Ultra · P8 do KYTTO ERP
 * Geração de SPED Fiscal (EFD ICMS/IPI), SPED Contribuições (EFD PIS/COFINS),
 * ECF (Escrituração Contábil Fiscal), SINTEGRA e obrigações acessórias MT
 */

import { db } from '../../core/database.js';

// ─────────────────────────────────────────────────────────────────────────────
// SPED FISCAL — EFD ICMS/IPI (Leiaute 17)
// ─────────────────────────────────────────────────────────────────────────────

export async function gerarSpedFiscal(tenantId, mes, ano) {
  const pool = db.getPool();
  const dataInicio = `${ano}-${String(mes).padStart(2,'0')}-01`;
  const dataFim    = new Date(ano, mes, 0).toISOString().substring(0,10);

  const empresa = await pool.query('SELECT * FROM empresas WHERE id = $1', [tenantId]);
  const emp = empresa.rows[0];
  if (!emp) throw new Error('Empresa não encontrada');

  const linhas = [];

  // ── BLOCO 0 ──────────────────────────────────────────────────────────────
  linhas.push(`|0000|017|0|${dataInicio.replace(/-/g,'')}|${dataFim.replace(/-/g,'')}|${emp.razao_social}|${emp.cnpj?.replace(/\D/g,'')}|${emp.uf || 'MT'}|${emp.inscricao_estadual?.replace(/\D/g,'')}|${emp.im || ''}|${emp.suframa || ''}|${emp.perfil_sped || 'A'}|${emp.atividade_sped || '0'}|`);
  linhas.push(`|0001|0|`);

  // Dados do contribuinte
  linhas.push(`|0005|${emp.nome_fantasia || emp.razao_social}|${emp.cep?.replace(/\D/g,'')}|${emp.endereco_logradouro}|${emp.endereco_numero}|${emp.endereco_complemento || ''}|${emp.endereco_bairro}|${emp.telefone?.replace(/\D/g,'')}|${emp.fax || ''}|${emp.email}|`);

  // Tabela de municípios
  linhas.push(`|0150|${tenantId.substring(0,6)}|${emp.razao_social}|${emp.cnpj?.replace(/\D/g,'')}|${emp.uf || 'MT'}|${emp.inscricao_estadual?.replace(/\D/g,'')}|${emp.endereco_logradouro}, ${emp.endereco_numero}|${emp.endereco_bairro}|${emp.endereco_cidade}|${emp.cep?.replace(/\D/g,'')}|`);

  // Produtos
  const produtos = await pool.query(
    `SELECT DISTINCT p.id, p.codigo_barras, p.nome, p.ncm, p.cest, p.unidade,
            pf.aliquota_icms, pf.cst_icms, pf.aliquota_pis, pf.aliquota_cofins
     FROM produtos p
     LEFT JOIN produto_fiscal pf ON pf.produto_id = p.id AND pf.empresa_id = $1
     WHERE p.empresa_id = $1`,
    [tenantId]
  );
  for (const p of produtos.rows) {
    linhas.push(`|0200|${p.codigo_barras || p.id.substring(0,14)}|${p.nome?.substring(0,60)}|${p.unidade || 'UN'}|${p.ncm?.replace(/\D/g,'') || ''}|${p.cest?.replace(/\D/g,'') || ''}|${p.cst_icms || '102'}|`);
  }

  linhas.push(`|0990|${linhas.filter(l => l.startsWith('|0')).length + 1}|`);

  // ── BLOCO C — Documentos Fiscais ─────────────────────────────────────────
  linhas.push(`|C001|0|`);

  const notas = await pool.query(
    `SELECT df.*, c.cpf_cnpj as dest_cpf_cnpj, c.razao_social as dest_nome,
            c.inscricao_estadual as dest_ie, c.uf as dest_uf
     FROM documento_fiscal df
     LEFT JOIN clientes c ON c.id = df.destinatario_id
     WHERE df.empresa_id = $1
       AND df.data_emissao BETWEEN $2 AND $3
       AND df.status = 'autorizada'
       AND df.tipo IN ('nfe','nfce')
     ORDER BY df.data_emissao, df.numero`,
    [tenantId, dataInicio, dataFim]
  );

  for (const nf of notas.rows) {
    const chave = nf.chave_acesso || '';
    linhas.push(`|C100|1|1|${nf.dest_cpf_cnpj?.replace(/\D/g,'') || ''}|${nf.tipo === 'nfce' ? '65' : '55'}|${nf.serie || '1'}|${nf.numero}|${nf.data_emissao?.toISOString().substring(0,10).replace(/-/g,'')}||${Number(nf.valor_total || 0).toFixed(2)}|${Number(nf.valor_total || 0).toFixed(2)}|${Number(nf.base_calculo_icms || 0).toFixed(2)}|${Number(nf.valor_icms || 0).toFixed(2)}|0|0|${Number(nf.valor_pis || 0).toFixed(2)}|${Number(nf.valor_cofins || 0).toFixed(2)}|${chave}|`);

    // Itens da nota
    const itens = await pool.query(
      `SELECT di.*, p.ncm, p.codigo_barras, p.nome as prod_nome, p.unidade,
              pf.cst_icms, pf.aliquota_icms, pf.aliquota_pis, pf.aliquota_cofins
       FROM itens_documento_fiscal di
       JOIN produtos p ON p.id = di.produto_id
       LEFT JOIN produto_fiscal pf ON pf.produto_id = p.id AND pf.empresa_id = $1
       WHERE di.documento_id = $2`,
      [tenantId, nf.id]
    );

    for (let i = 0; i < itens.rows.length; i++) {
      const it = itens.rows[i];
      linhas.push(`|C170|${i+1}|${it.codigo_barras || it.produto_id.substring(0,14)}|${it.prod_nome?.substring(0,60)}|${Number(it.quantidade).toFixed(4)}|${it.unidade || 'UN'}|${Number(it.valor_unitario).toFixed(10)}|${Number(it.valor_total).toFixed(2)}|${it.cst_icms || '102'}|${Number(it.base_icms || 0).toFixed(2)}|${Number(it.aliquota_icms || 0).toFixed(2)}|${Number(it.valor_icms || 0).toFixed(2)}|${it.ncm?.replace(/\D/g,'') || ''}|${Number(it.valor_pis || 0).toFixed(2)}|${Number(it.valor_cofins || 0).toFixed(2)}|`);
    }
  }

  linhas.push(`|C990|${linhas.filter(l => l.startsWith('|C')).length + 1}|`);

  // ── BLOCO E — Apuração ICMS ───────────────────────────────────────────────
  linhas.push(`|E001|0|`);
  linhas.push(`|E100|${dataInicio.replace(/-/g,'')}|${dataFim.replace(/-/g,'')}|`);

  const apuracao = await pool.query(
    `SELECT
       COALESCE(SUM(base_calculo_icms), 0) as base_total,
       COALESCE(SUM(valor_icms), 0) as icms_total
     FROM documento_fiscal
     WHERE empresa_id = $1 AND data_emissao BETWEEN $2 AND $3 AND status = 'autorizada'`,
    [tenantId, dataInicio, dataFim]
  );
  const apr = apuracao.rows[0];
  linhas.push(`|E110|${Number(apr.base_total).toFixed(2)}|0|0|${Number(apr.icms_total).toFixed(2)}|0|0|0|0|0|${Number(apr.icms_total).toFixed(2)}|0|0|0|0|0|0|0|0|0|0|`);
  linhas.push(`|E990|${linhas.filter(l => l.startsWith('|E')).length + 1}|`);

  // ── BLOCO H — Inventário ──────────────────────────────────────────────────
  linhas.push(`|H001|0|`);
  linhas.push(`|H005|${dataFim.replace(/-/g,'')}|0|02|`);

  const estoque = await pool.query(
    `SELECT p.codigo_barras, p.nome, p.unidade, p.ncm,
            COALESCE(SUM(e.quantidade), 0) as qtd, p.custo_medio
     FROM produtos p
     LEFT JOIN estoque e ON e.produto_id = p.id AND e.empresa_id = p.empresa_id
     WHERE p.empresa_id = $1
     GROUP BY p.id`,
    [tenantId]
  );
  for (const e of estoque.rows) {
    const valor = Number(e.qtd) * Number(e.custo_medio || 0);
    linhas.push(`|H010|${e.codigo_barras || e.id?.substring(0,14)}|${e.unidade || 'UN'}|${Number(e.qtd).toFixed(3)}|${Number(e.custo_medio || 0).toFixed(2)}|${valor.toFixed(2)}|${e.ncm?.replace(/\D/g,'') || ''}|`);
  }
  linhas.push(`|H990|${linhas.filter(l => l.startsWith('|H')).length + 1}|`);

  // ── BLOCO 9 — Controle e Encerramento ────────────────────────────────────
  linhas.push(`|9001|0|`);
  linhas.push(`|9900|0000|${linhas.filter(l => l.startsWith('|0')).length}|`);
  linhas.push(`|9900|C100|${notas.rows.length}|`);
  linhas.push(`|9990|4|`);
  linhas.push(`|9999|${linhas.length + 1}|`);

  return linhas.join('\r\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// SPED CONTRIBUIÇÕES — EFD PIS/COFINS (Leiaute 6)
// ─────────────────────────────────────────────────────────────────────────────

export async function gerarSpedContribuicoes(tenantId, mes, ano) {
  const pool = db.getPool();
  const dataInicio = `${ano}-${String(mes).padStart(2,'0')}-01`;
  const dataFim    = new Date(ano, mes, 0).toISOString().substring(0,10);

  const empresa = await pool.query('SELECT * FROM empresas WHERE id = $1', [tenantId]);
  const emp = empresa.rows[0];

  const linhas = [];
  linhas.push(`|0000|006|0|${dataInicio.replace(/-/g,'')}|${dataFim.replace(/-/g,'')}|${emp.razao_social}|${emp.cnpj?.replace(/\D/g,'')}|${emp.uf || 'MT'}|${emp.inscricao_estadual?.replace(/\D/g,'')}|${emp.regime_tributario || '1'}|${emp.regime_tributario === '1' ? '1' : '0'}|`);
  linhas.push(`|0001|0|`);
  linhas.push(`|0990|3|`);

  // Bloco A — Serviços (NFS-e)
  linhas.push(`|A001|0|`);
  linhas.push(`|A990|2|`);

  // Bloco C — Documentos de Saída (NF-e/NFC-e)
  linhas.push(`|C001|0|`);
  const notas = await pool.query(
    `SELECT df.*, COALESCE(SUM(di.valor_pis), 0) as total_pis, COALESCE(SUM(di.valor_cofins), 0) as total_cofins
     FROM documento_fiscal df
     LEFT JOIN itens_documento_fiscal di ON di.documento_id = df.id
     WHERE df.empresa_id = $1 AND df.data_emissao BETWEEN $2 AND $3 AND df.status = 'autorizada'
     GROUP BY df.id ORDER BY df.data_emissao`,
    [tenantId, dataInicio, dataFim]
  );
  for (const nf of notas.rows) {
    linhas.push(`|C100|1|1||${nf.tipo === 'nfce' ? '65' : '55'}|${nf.serie || '1'}|${nf.numero}|${nf.chave_acesso || ''}|${nf.data_emissao?.toISOString().substring(0,10).replace(/-/g,'')}|${Number(nf.valor_total || 0).toFixed(2)}|${Number(nf.total_pis).toFixed(2)}|${Number(nf.total_cofins).toFixed(2)}|`);
  }
  linhas.push(`|C990|${linhas.filter(l => l.startsWith('|C')).length + 1}|`);

  // Bloco M — Apuração PIS/COFINS
  linhas.push(`|M001|0|`);
  const apuracao = await pool.query(
    `SELECT COALESCE(SUM(di.valor_pis), 0) as pis_total, COALESCE(SUM(di.valor_cofins), 0) as cofins_total
     FROM itens_documento_fiscal di
     JOIN documento_fiscal df ON df.id = di.documento_id
     WHERE df.empresa_id = $1 AND df.data_emissao BETWEEN $2 AND $3 AND df.status = 'autorizada'`,
    [tenantId, dataInicio, dataFim]
  );
  const apr = apuracao.rows[0];
  linhas.push(`|M200|${Number(apr.pis_total).toFixed(2)}|0|0|${Number(apr.pis_total).toFixed(2)}|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|`);
  linhas.push(`|M600|${Number(apr.cofins_total).toFixed(2)}|0|0|${Number(apr.cofins_total).toFixed(2)}|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|0|`);
  linhas.push(`|M990|4|`);

  linhas.push(`|9001|0|`);
  linhas.push(`|9900|0000|3|`);
  linhas.push(`|9990|3|`);
  linhas.push(`|9999|${linhas.length + 1}|`);

  return linhas.join('\r\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// SINTEGRA — Convênio ICMS 57/95
// ─────────────────────────────────────────────────────────────────────────────

export async function gerarSintegra(tenantId, mes, ano) {
  const pool = db.getPool();
  const dataInicio = `${ano}-${String(mes).padStart(2,'0')}-01`;
  const dataFim    = new Date(ano, mes, 0).toISOString().substring(0,10);

  const empresa = await pool.query('SELECT * FROM empresas WHERE id = $1', [tenantId]);
  const emp = empresa.rows[0];

  const linhas = [];
  const pad = (v, n, c = ' ', dir = 'right') => {
    const s = String(v || '');
    return dir === 'right' ? s.padEnd(n, c).substring(0, n) : s.padStart(n, c).substring(s.length > n ? s.length - n : 0);
  };

  // Registro tipo 10 — Mestre do Estabelecimento
  linhas.push(`10${pad(emp.cnpj?.replace(/\D/g,''), 14, '0', 'left')}${pad(emp.inscricao_estadual?.replace(/\D/g,''), 14)}${pad(emp.razao_social, 35)}${pad(emp.endereco_cidade, 30)}${pad(emp.uf, 2)}${pad(emp.fax?.replace(/\D/g,''), 10)}${dataInicio.replace(/-/g,'').substring(0,6)}${dataFim.replace(/-/g,'').substring(0,8)}${pad('1', 1)}${pad('3', 1)}${pad('1', 1)}`);

  // Registro tipo 11 — Dados Complementares
  linhas.push(`11${pad(emp.endereco_logradouro + ', ' + emp.endereco_numero, 34)}${pad(emp.endereco_numero, 5)}${pad(emp.endereco_complemento, 22)}${pad(emp.endereco_bairro, 15)}${pad(emp.cep?.replace(/\D/g,''), 8)}${pad(emp.nome_responsavel || emp.razao_social, 28)}${pad(emp.telefone?.replace(/\D/g,''), 12)}${pad('0', 2)}`);

  // Registros tipo 50 — Notas Fiscais
  const notas = await pool.query(
    `SELECT df.*, c.cpf_cnpj as dest_cnpj, c.inscricao_estadual as dest_ie, c.uf as dest_uf
     FROM documento_fiscal df
     LEFT JOIN clientes c ON c.id = df.destinatario_id
     WHERE df.empresa_id = $1 AND df.data_emissao BETWEEN $2 AND $3 AND df.status = 'autorizada'
     ORDER BY df.data_emissao`,
    [tenantId, dataInicio, dataFim]
  );
  for (const nf of notas.rows) {
    linhas.push(`50${pad(nf.dest_cnpj?.replace(/\D/g,'') || '0'.repeat(14), 14)}${pad(nf.dest_ie?.replace(/\D/g,'') || 'ISENTO', 14)}${nf.data_emissao?.toISOString().substring(0,10).replace(/-/g,'')}${pad(nf.dest_uf || emp.uf, 2)}${pad(nf.serie || '1', 3)}${pad(nf.numero, 6, '0', 'left')}${pad('1', 1)}${pad(nf.tipo === 'nfce' ? '2' : '1', 1)}${pad(Number(nf.valor_total || 0).toFixed(2).replace('.',''), 13, '0', 'left')}${pad(Number(nf.base_calculo_icms || 0).toFixed(2).replace('.',''), 13, '0', 'left')}${pad(Number(nf.valor_icms || 0).toFixed(2).replace('.',''), 13, '0', 'left')}${pad('0'.repeat(13), 13)}${pad('0'.repeat(13), 13)}${pad('0'.repeat(13), 13)}${pad('1', 1)}${pad('', 1)}`);
  }

  // Registro tipo 90 — Totalização
  linhas.push(`90${pad(emp.cnpj?.replace(/\D/g,''), 14, '0', 'left')}${pad(emp.inscricao_estadual?.replace(/\D/g,''), 14)}${pad('10', 2)}${pad('1', 8, '0', 'left')}${pad('11', 2)}${pad('1', 8, '0', 'left')}${pad('50', 2)}${pad(notas.rows.length, 8, '0', 'left')}${pad('90', 2)}${pad('1', 8, '0', 'left')}${pad(linhas.length + 1, 8, '0', 'left')}`);

  return linhas.join('\r\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// CALENDÁRIO DE OBRIGAÇÕES ACESSÓRIAS
// ─────────────────────────────────────────────────────────────────────────────

export async function calendarioObrigacoes(tenantId, ano) {
  const pool = db.getPool();
  const empresa = await pool.query('SELECT regime_tributario FROM empresas WHERE id = $1', [tenantId]);
  const regime = empresa.rows[0]?.regime_tributario || '1'; // 1=Simples, 2=Presumido, 3=Real

  const obrigacoes = [];
  for (let mes = 1; mes <= 12; mes++) {
    const mesStr = String(mes).padStart(2,'0');
    const mesNome = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][mes-1];

    // Todos os regimes
    obrigacoes.push({ mes, mesNome, obrigacao: 'SPED Fiscal', prazo: `${ano}-${mesStr}-20`, tipo: 'mensal', regime: 'todos' });
    obrigacoes.push({ mes, mesNome, obrigacao: 'GIA-ICMS', prazo: `${ano}-${mesStr}-20`, tipo: 'mensal', regime: 'todos' });

    if (regime === '1') {
      obrigacoes.push({ mes, mesNome, obrigacao: 'DAS Simples Nacional', prazo: `${ano}-${mesStr}-20`, tipo: 'mensal', regime: 'simples' });
      if (mes === 1) obrigacoes.push({ mes, mesNome, obrigacao: 'DEFIS', prazo: `${ano}-${mesStr}-31`, tipo: 'anual', regime: 'simples' });
    }
    if (regime === '2' || regime === '3') {
      obrigacoes.push({ mes, mesNome, obrigacao: 'DCTF', prazo: `${ano}-${mesStr}-25`, tipo: 'mensal', regime: 'presumido/real' });
      obrigacoes.push({ mes, mesNome, obrigacao: 'SPED Contribuições', prazo: `${ano}-${mesStr}-20`, tipo: 'mensal', regime: 'presumido/real' });
    }
    if ([3, 6, 9, 12].includes(mes)) {
      obrigacoes.push({ mes, mesNome, obrigacao: 'SINTEGRA', prazo: `${ano}-${mesStr}-25`, tipo: 'trimestral', regime: 'todos' });
    }
    if (mes === 12) {
      obrigacoes.push({ mes, mesNome, obrigacao: 'ECF', prazo: `${ano}-${mesStr}-31`, tipo: 'anual', regime: 'presumido/real' });
      obrigacoes.push({ mes, mesNome, obrigacao: 'ECD', prazo: `${ano}-${mesStr}-31`, tipo: 'anual', regime: 'presumido/real' });
    }
  }

  return obrigacoes.filter(o => o.regime === 'todos' || o.regime.includes(regime === '1' ? 'simples' : regime === '2' ? 'presumido' : 'real'));
}
