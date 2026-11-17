// ==========================================================================
// KYTTO — UNIFICAÇÃO E GESTÃO AVANÇADA DE CLIENTES (BARBEARIA DINO)
// Permite mesclar cadastros duplicados (por telefone com/sem 55, CPF ou manual),
// consolidar histórico de atendimentos, comandas, assinaturas, contas a receber
// e garantir a integridade do valor vitalício do cliente.
// ==========================================================================
import { db, save } from './db.js';
import * as clientesKytto from './clientes-contas-kytto.js';

const EQUIVALENCIAS_DINO = new Set([
  'd0d0ac01-8e50-4b61-8c79-de4aaa916da6',
  'emp-kytto-001',
  'dino',
]);

export function empresasEquivalentes(empresaId) {
  const chave = String(empresaId || '');
  if (EQUIVALENCIAS_DINO.has(chave)) return Array.from(EQUIVALENCIAS_DINO);
  return [chave];
}

export function normalizarTelefoneBR(telefone) {
  if (!telefone) return '';
  let limpo = String(telefone).replace(/\D/g, '');
  if ((limpo.length === 12 || limpo.length === 13) && limpo.startsWith('55')) {
    limpo = limpo.slice(2);
  }
  return limpo;
}

/**
 * Localiza cliente em empresas equivalentes
 */
export function buscarClientePorId(empresaId, clienteId) {
  const root = db();
  const empresas = empresasEquivalentes(empresaId);
  for (const emp of empresas) {
    const cli = root.clientesKytto?.empresas?.[emp]?.clientes?.[clienteId];
    if (cli) return { cliente: cli, empresaEncontrada: emp };
  }
  return null;
}

/**
 * Unifica múltiplos clientes em um único cadastro canônico (Master)
 */
export function unificarClientes(empresaId, principalId, secundarioIds = [], opcoes = {}) {
  const root = db();
  const empresas = empresasEquivalentes(empresaId);

  const buscaMaster = buscarClientePorId(empresaId, principalId);
  if (!buscaMaster) {
    throw new Error(`Cliente principal ${principalId} não encontrado.`);
  }
  const principal = buscaMaster.cliente;
  const idsSecundarios = (Array.isArray(secundarioIds) ? secundarioIds : [secundarioIds])
    .map(String)
    .filter((id) => id && id !== String(principalId));

  if (idsSecundarios.length === 0) {
    return { ok: true, principal, unificados: 0 };
  }

  // Normaliza telefone do principal
  if (principal.telefone) {
    principal.telefone = normalizarTelefoneBR(principal.telefone);
  }

  let totalComandasMigradas = 0;
  let totalAgendamentosMigrados = 0;
  let totalAssinaturasMigradas = 0;
  let totalHistoricoMigrado = 0;

  for (const secId of idsSecundarios) {
    const buscaSec = buscarClientePorId(empresaId, secId);
    if (!buscaSec) continue;
    const secundario = buscaSec.cliente;

    // Mescla dados complementares se faltar no principal
    if (!principal.email && secundario.email) principal.email = secundario.email;
    if (!principal.cpfCnpj && secundario.cpfCnpj) principal.cpfCnpj = secundario.cpfCnpj;
    if (!principal.cpf && secundario.cpf) principal.cpf = secundario.cpf;
    if (!principal.dataNascimento && secundario.dataNascimento) principal.dataNascimento = secundario.dataNascimento;
    if (!principal.aniversario && secundario.aniversario) principal.aniversario = secundario.aniversario;
    if (!principal.endereco && secundario.endereco) principal.endereco = secundario.endereco;
    if (!principal.barbeiroId && secundario.barbeiroId) {
      principal.barbeiroId = secundario.barbeiroId;
      principal.barbeiroNome = secundario.barbeiroNome;
    }
    if (secundario.observacao && !principal.observacao?.includes(secundario.observacao)) {
      principal.observacao = [principal.observacao, `[Histórico mesclado]: ${secundario.observacao}`].filter(Boolean).join(' | ');
    }

    // Atualiza referências em todas as empresas equivalentes da barbearia
    for (const emp of empresas) {
      const barbearia = root.barbearias?.[emp] || {};

      // 1. Agendamentos
      for (const ag of Object.values(barbearia.agendamentos || {})) {
        if (ag.clienteId === secId) {
          ag.clienteId = principalId;
          ag.clienteNome = principal.nome;
          ag.clienteTelefone = principal.telefone;
          totalAgendamentosMigrados++;
        }
      }

      // 2. Comandas
      for (const cmd of Object.values(barbearia.comandas || {})) {
        if (cmd.clienteId === secId) {
          cmd.clienteId = principalId;
          cmd.clienteNome = principal.nome;
          cmd.clienteTelefone = principal.telefone;
          totalComandasMigradas++;
        }
      }

      // 3. Assinaturas de Planos / Pacotes
      for (const ass of Object.values(barbearia.assinaturas || {})) {
        if (ass.clienteId === secId) {
          ass.clienteId = principalId;
          ass.clienteNome = principal.nome;
          ass.clienteTelefone = principal.telefone;
          totalAssinaturasMigradas++;
        }
      }

      // 4. Histórico de Atendimentos importados
      for (const h of Object.values(barbearia.historicoAtendimentos || {})) {
        if (h.clienteId === secId) {
          h.clienteId = principalId;
          h.clienteNome = principal.nome;
          h.clienteTelefone = principal.telefone;
          totalHistoricoMigrado++;
        }
      }

      // 5. Vendas de Revenda
      for (const v of Object.values(barbearia.vendasRevenda || {})) {
        if (v.clienteId === secId) {
          v.clienteId = principalId;
          v.clienteNome = principal.nome;
          v.clienteTelefone = principal.telefone;
        }
      }

      // 6. Contas a Receber
      const contas = root.clientesKytto?.empresas?.[emp]?.contasReceber || [];
      for (const c of contas) {
        if (c.clienteId === secId) {
          c.clienteId = principalId;
          c.clienteNome = principal.nome;
          c.clienteTelefone = principal.telefone;
        }
      }
    }

    // Marca secundário como mesclado
    secundario.status = 'mesclado';
    secundario.mescladoPara = principalId;
    secundario.mescladoEm = new Date().toISOString();
    secundario.atualizadoEm = new Date().toISOString();
  }

  principal.atualizadoEm = new Date().toISOString();
  save();

  return {
    ok: true,
    principal,
    unificados: idsSecundarios.length,
    metricasMigradas: {
      comandas: totalComandasMigradas,
      agendamentos: totalAgendamentosMigrados,
      assinaturas: totalAssinaturasMigradas,
      historicoAtendimentos: totalHistoricoMigrado,
    },
  };
}

/**
 * Localiza todos os grupos de clientes duplicados por telefone normalizado
 */
export function listarDuplicados(empresaId) {
  const root = db();
  const empresas = empresasEquivalentes(empresaId);
  const gruposPorTel = new Map();

  for (const emp of empresas) {
    const cliStore = root.clientesKytto?.empresas?.[emp]?.clientes || {};
    for (const cli of Object.values(cliStore)) {
      if (cli.status === 'deletado' || cli.status === 'mesclado') continue;
      const telNorm = normalizarTelefoneBR(cli.telefone);
      if (!telNorm || telNorm.length < 8) continue;
      if (!gruposPorTel.has(telNorm)) gruposPorTel.set(telNorm, []);
      const lista = gruposPorTel.get(telNorm);
      if (!lista.some((c) => c.id === cli.id)) {
        lista.push(cli);
      }
    }
  }

  const duplicados = [];
  for (const [tel, clientes] of gruposPorTel.entries()) {
    if (clientes.length > 1) {
      // Ordena elegendo o melhor candidato a principal:
      // 1º: Nome que não seja padrão ("Cliente Avec")
      // 2º: Maior quantidade de dados cadastrais preenchidos
      // 3º: Mais antigo
      const ordenados = [...clientes].sort((a, b) => {
        const aNomeOk = a.nome && !a.nome.startsWith('Cliente Avec') && !a.nome.startsWith('Cel:');
        const bNomeOk = b.nome && !b.nome.startsWith('Cliente Avec') && !b.nome.startsWith('Cel:');
        if (aNomeOk && !bNomeOk) return -1;
        if (!aNomeOk && bNomeOk) return 1;
        return (a.criadoEm || '').localeCompare(b.criadoEm || '');
      });

      duplicados.push({
        telefone: tel,
        total: clientes.length,
        sugestaoPrincipal: ordenados[0],
        secundarios: ordenados.slice(1),
      });
    }
  }

  return duplicados;
}

/**
 * Executa unificação automática de todos os duplicados detectados por telefone
 */
export function autoUnificarTodosDuplicados(empresaId) {
  const duplicados = listarDuplicados(empresaId);
  const resultados = [];
  for (const g of duplicados) {
    try {
      const res = unificarClientes(
        empresaId,
        g.sugestaoPrincipal.id,
        g.secundarios.map((s) => s.id),
        { auto: true }
      );
      resultados.push({
        telefone: g.telefone,
        principalId: g.sugestaoPrincipal.id,
        principalNome: g.sugestaoPrincipal.nome,
        mescladosQtd: g.secundarios.length,
        sucesso: true,
      });
    } catch (e) {
      resultados.push({
        telefone: g.telefone,
        erro: e.message,
        sucesso: false,
      });
    }
  }
  return {
    ok: true,
    totalGrupos: duplicados.length,
    processados: resultados,
  };
}

/**
 * Exclusão lógica e segura de cliente (inativação)
 */
export function excluirClienteBarbearia(empresaId, clienteId, { motivo = 'Exclusão solicitada pelo usuário' } = {}) {
  const root = db();
  const busca = buscarClientePorId(empresaId, clienteId);
  if (!busca) {
    throw new Error(`Cliente ${clienteId} não encontrado.`);
  }
  const cliente = busca.cliente;
  cliente.status = 'deletado';
  cliente.deletadoEm = new Date().toISOString();
  cliente.motivoDelecao = String(motivo || '').slice(0, 200);
  cliente.atualizadoEm = new Date().toISOString();
  save();
  return { ok: true, clienteId, status: 'deletado' };
}
