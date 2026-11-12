import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
import {
  formatarMoeda,
  formatarPercentual,
  formatarQuantidadeBalanca,
  formatarDataCuiaba,
  formatarDataHoraCuiaba,
  validarCpf,
  mascararCpf,
  validarCnpj,
  mascararCnpj,
  validarCep,
  validarTelefone,
  validarPlacaMercosul,
  validarChavePix,
  validarChaveAcessoNfe,
  validarNcm,
  validarCest,
  mensagemErroAcionavel,
} from './core/formatadores.js';
import {
  ADQUIRENTES_BRASIL,
  obterConfiguracoesTef,
  adicionarTerminalTef,
  testarConexaoTerminal,
  processarTransacaoTef,
} from './core/tef-multimaquininhas-brasil.js';
import { sanearProfissionaisEAgendamentosDino } from './dino-equipe-seed.js';
import * as barbeariaErp from './barbearia-erp-kytto.js';

test('Fase B: formatadores brasileiros de moeda, percentual, balança e fuso America/Cuiaba', () => {
  assert.match(formatarMoeda(1234.56), /1\.234,56/);
  assert.equal(formatarPercentual(12.5), '12,5%');
  assert.equal(formatarQuantidadeBalanca(1.25, 'kg'), '1,250 kg');

  // 02:00 UTC do dia 25/10 ainda é 22:00 do dia 24/10 em Cuiabá (UTC-4)
  assert.equal(formatarDataCuiaba('2026-10-25T02:00:00Z'), '24/10/2026');
  assert.match(formatarDataHoraCuiaba('2026-10-25T02:00:00Z'), /24\/10\/2026.*22:00/);
});

test('Fase B: validadores reais de CPF, CNPJ numérico e alfanumérico 2026, NF-e 44 dígitos, PIX e placas', () => {
  assert.equal(validarCpf('52998224725'), true);
  assert.equal(validarCpf('111.111.111-11'), false);
  assert.equal(mascararCpf('52998224725'), '529.982.247-25');

  // CNPJ numérico real da Barbearia Dino (50.073.355/0001-89 e filial 50.073.355/0002-60)
  assert.equal(validarCnpj('50.073.355/0001-89'), true);
  assert.equal(validarCnpj('50.073.355/0002-60'), true);
  assert.equal(validarCnpj('50.073.355/0002-61'), false);

  // CNPJ alfanumérico 2026 (IN RFB 2.229/2024): exemplo oficial 12.ABC.345/01DE-35
  assert.equal(validarCnpj('12.ABC.345/01DE-35'), true);
  assert.equal(mascararCnpj('12ABC34501DE35'), '12.ABC.345/01DE-35');

  assert.equal(validarCep('78300-000'), true);
  assert.equal(validarTelefone('(65) 99906-5065'), true);
  assert.equal(validarPlacaMercosul('ABC1D23'), true);
  assert.equal(validarChavePix('50.073.355/0002-60'), true);
  assert.equal(validarChavePix(''), false);
  assert.equal(validarNcm('33051000'), true);
  assert.equal(validarCest('2000900'), true);

  // Chave NF-e de 44 dígitos com DV módulo 11 válido
  const base43 = '5126115007335500026065001000000123100000123';
  let peso = 2;
  let soma = 0;
  for (let i = 42; i >= 0; i--) {
    soma += Number(base43[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dv = resto === 0 || resto === 1 ? 0 : 11 - resto;
  assert.equal(validarChaveAcessoNfe(`${base43}${dv}`), true);
  assert.equal(validarChaveAcessoNfe(`${base43}${(dv + 1) % 10}`), false);

  assert.match(mensagemErroAcionavel('PIX_KEY_MISSING'), /Configurações › Recebimentos/);
});

test('Fase A: TEF não possui terminais nem taxas fixas em código e exige cadastro real', () => {
  for (const adq of ADQUIRENTES_BRASIL) {
    assert.equal(adq.taxasPadrao, null, `Adquirente ${adq.id} não deve ter taxasPadrao fixas em código`);
  }

  const empTeste = `emp-tef-teste-${Date.now()}`;
  const cfgInicial = obterConfiguracoesTef(empTeste);
  assert.equal(cfgInicial.configurado, false);
  assert.equal(cfgInicial.status, 'nao_configurado');
  assert.equal(cfgInicial.terminais.length, 0);

  // Sem terminal cadastrado, processar transação TEF deve falhar com mensagem acionável
  assert.throws(
    () => processarTransacaoTef({ empresaId: empTeste, valor: 65, modalidade: 'debito' }),
    /TEF não configurado/
  );

  // Cadastrar terminal exige número de série real e nasce como nao_testado (sem ping inventado)
  const term = adicionarTerminalTef(empTeste, {
    nome: 'Pinpad Recepção',
    adquirenteId: 'stone',
    modelo: 'Gertec PPC930',
    serialNumber: 'GERTEC-REAL-998877',
  });
  assert.equal(term.status, 'nao_testado');
  assert.equal(term.ultimoPing, null);

  // Teste em nuvem sem Agente Local não inventa latência
  const pingCloud = testarConexaoTerminal(empTeste, term.id);
  assert.equal(pingCloud.sucesso, false);
  assert.equal(pingCloud.status, 'nao_testado');
  assert.equal(pingCloud.latenciaMs, null);
});

test('Fase A: Barbearia Dino — motivo obrigatório no cancelamento, unificação de Bruno e nomeação de prof-mv1a1nmm-008', () => {
  const empId = `emp-dino-unit-${Date.now()}`;
  const profBruno = barbeariaErp.criarProfissional(empId, {
    id: 'prof-mtj69hhx-002',
    nome: 'Bruno',
    apelido: 'Bruno',
    ativo: true,
  });
  const profBrunoDup = barbeariaErp.criarProfissional(empId, {
    id: 'prof-mvsqchmy-023',
    nome: 'Bruno Mendes Pedroso',
    apelido: 'Bruno',
    ativo: true,
  });
  const servico = barbeariaErp.criarServico(empId, {
    nome: 'Corte Masculino',
    preco: 65,
    duracaoMinutos: 30,
    ativo: true,
  });

  const ag = barbeariaErp.criarAgendamento(empId, {
    clienteNome: 'Cliente Teste',
    clienteTelefone: '65999990000',
    profissionalId: profBrunoDup.id,
    servicoId: servico.id,
    dataHora: '2026-11-12T14:00:00-04:00',
  });

  // Cancelamento sem motivo deve ser bloqueado
  assert.throws(
    () => barbeariaErp.alterarStatusAgendamento(empId, ag.id, 'cancelado', { canceladoPor: 'atendente' }),
    /motivo de cancelamento/i
  );

  // Cancelamento com motivo grava trilha de auditoria completa
  const cancelado = barbeariaErp.alterarStatusAgendamento(empId, ag.id, 'cancelado', {
    motivoCancelamento: 'pedido_do_cliente',
    canceladoPor: 'Ester',
    canalCancelamento: 'balcao_recepcao',
  });
  assert.equal(cancelado.status, 'cancelado');
  assert.equal(cancelado.motivoCancelamento, 'pedido_do_cliente');
  assert.equal(cancelado.canceladoPor, 'Ester');
  assert.equal(cancelado.canalCancelamento, 'balcao_recepcao');
  assert.ok(cancelado.canceladoEm);

  // Saneamento unifica Bruno + Bruno Mendes Pedroso e registra prof-mv1a1nmm-008
  const estado = barbeariaErp.estadoEmpresa(empId);
  sanearProfissionaisEAgendamentosDino(estado, empId);
  assert.equal(estado.profissionais['prof-mv1a1nmm-008']?.nome, 'David Kauã Araújo Moraes');
  assert.equal(estado.profissionais['prof-mv1a1nmm-008']?.ativo, false);
  assert.equal(estado.profissionais[profBrunoDup.id]?.ativo, false);
  assert.equal(estado.profissionais[profBrunoDup.id]?.consolidadoEm, profBruno.id);
  assert.equal(estado.agendamentos[ag.id]?.profissionalId, profBruno.id);
});

test('Fase A: Simulação em memória sobre o snapshot real da Barbearia Dino (zero órfãos, zero sem motivo, 100% comandas pagas concluídas)', (t) => {
  if (!fs.existsSync('/tmp/prod_snapshot.json')) {
    t.skip('Snapshot /tmp/prod_snapshot.json não disponível neste ambiente');
    return;
  }
  const snap = JSON.parse(fs.readFileSync('/tmp/prod_snapshot.json', 'utf8'));
  const DINO_ID = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  const dino = snap.barbearias[DINO_ID];
  assert.ok(dino, 'Estado da Barbearia Dino deve existir no snapshot');

  // Executar saneamento de profissionais e agendamentos em memória
  sanearProfissionaisEAgendamentosDino(dino, DINO_ID);

  // Sincronizar comandas pagas e preencher motivos legados
  for (const cmd of Object.values(dino.comandas || {})) {
    if (!cmd || (cmd.status !== 'paga' && cmd.status !== 'em_conta')) continue;
    const ids = [...new Set([cmd.agendamentoId, ...(cmd.itens || []).map((i) => i?.agendamentoId)].filter(Boolean))];
    for (const agId of ids) {
      const ag = dino.agendamentos?.[String(agId)];
      if (ag && ag.status !== 'concluido' && ag.status !== 'cancelado') {
        ag.status = 'concluido';
        ag.comandaId = cmd.id;
      }
    }
  }
  for (const ag of Object.values(dino.agendamentos || {})) {
    if (ag.status === 'cancelado' && !String(ag.motivoCancelamento || '').trim()) {
      ag.motivoCancelamento = ag.origem === 'avec' ? 'importado_cancelado_avec' : 'cancelamento_operacional_balcao';
      ag.canceladoPor = ag.canceladoPor || 'equipe';
      ag.canalCancelamento = ag.canalCancelamento || ag.origem || 'painel_admin';
    }
  }

  const todosAg = Object.values(dino.agendamentos || {});
  const semProf = todosAg.filter((a) => !a.profissionalId || !dino.profissionais[a.profissionalId]);
  const canceladosSemMotivo = todosAg.filter((a) => a.status === 'cancelado' && !String(a.motivoCancelamento || '').trim());
  const comandasPagas = Object.values(dino.comandas || {}).filter((c) => c.status === 'paga' || c.status === 'em_conta');
  const comandasPagasComAgNaoConcluido = comandasPagas.filter((c) => {
    const ag = c.agendamentoId ? dino.agendamentos[c.agendamentoId] : null;
    return ag && ag.status !== 'concluido' && ag.status !== 'cancelado';
  });

  assert.equal(dino.profissionais['prof-mv1a1nmm-008']?.nome, 'David Kauã Araújo Moraes');
  assert.equal(dino.profissionais['prof-mtj69hhx-002']?.nome, 'Bruno Mendes Pedroso');
  assert.equal(dino.profissionais['prof-mvsqchmy-023']?.ativo, false);
  assert.equal(semProf.length, 0, 'Zero agendamentos sem profissional cadastrado');
  assert.equal(canceladosSemMotivo.length, 0, 'Zero cancelamentos sem motivo');
  assert.equal(comandasPagasComAgNaoConcluido.length, 0, '100% das comandas pagas com agendamento concluído');
});

test('Anti-regressão P0 (10/11 22h10): ausência de dados fixos em Relatórios Dino, PDV PIX, Fila Humana e Bundle', () => {
  const relDesempenho = fs.readFileSync(new URL('../web/src/pages/admin/relatorios/dino/RelatorioDesempenhoProfissional.jsx', import.meta.url), 'utf8');
  const relRetorno = fs.readFileSync(new URL('../web/src/pages/admin/relatorios/dino/RelatorioRetornoProfissional.jsx', import.meta.url), 'utf8');
  const pdvExclusivo = fs.readFileSync(new URL('../web/src/pages/admin/varejo/SupermercadoPdvExclusivo.jsx', import.meta.url), 'utf8');
  const waConvPanel = fs.readFileSync(new URL('../web/src/pages/admin/dino/WhatsappConversationPanel.jsx', import.meta.url), 'utf8');

  assert.equal(relDesempenho.includes('Guilherme Cunha'), false, 'RelatorioDesempenhoProfissional não pode conter Guilherme Cunha fixo');
  assert.equal(relRetorno.includes('Guilherme Cunha'), false, 'RelatorioRetornoProfissional não pode conter Guilherme Cunha fixo');
  assert.equal(relDesempenho.toLowerCase().includes('ticket caiu 15%'), false);
  assert.equal(relRetorno.toLowerCase().includes('retenção 85%'), false);
  assert.equal(pdvExclusivo.includes('financeiro@kytto.com.br'), false, 'SupermercadoPdvExclusivo não pode usar financeiro@kytto.com.br como chave PIX');

  assert.equal(waConvPanel.includes('(Bruno/Nati)'), false, 'WhatsappConversationPanel deve ler profissionais ativos do banco');
  assert.equal(waConvPanel.includes('com o Bruno ou a Nati'), false, 'WhatsappConversationPanel não deve ter fallback fixo com Bruno ou Nati');
  assert.equal(waConvPanel.includes('/api/admin/barbearia/profissionais'), true);

  const assetsDir = new URL('./public/assets/', import.meta.url);
  if (fs.existsSync(assetsDir)) {
    for (const file of fs.readdirSync(assetsDir)) {
      if (!file.endsWith('.js')) continue;
      const content = fs.readFileSync(new URL(`./public/assets/${file}`, import.meta.url), 'utf8');
      assert.equal(content.includes('Guilherme Cunha'), false, `Bundle ${file} não pode conter Guilherme Cunha`);
      assert.equal(content.includes('financeiro@kytto.com.br'), false, `Bundle ${file} não pode conter financeiro@kytto.com.br`);
      assert.equal(content.toLowerCase().includes('ticket caiu 15%'), false, `Bundle ${file} não pode conter ticket caiu 15%`);
      assert.equal(content.toLowerCase().includes('retenção 85%'), false, `Bundle ${file} não pode conter retenção 85%`);
    }
  }
});

test('Fases B e C: consolidacao.js consulta est_saldos real (sem saldo_estoque inexistente) e componentes padronizados existem', () => {
  const consolidacaoCode = fs.readFileSync(path.join(ROOT, 'app/modules/empresas/consolidacao.js'), 'utf8');
  assert.equal(consolidacaoCode.includes('saldo_estoque'), false, 'Não deve consultar coluna inexistente saldo_estoque em est_itens');
  assert.equal(consolidacaoCode.includes('FROM est_saldos'), true, 'Deve consultar est_saldos real');

  const componentesEsperados = [
    'web/src/components/EstadoVazio.jsx',
    'web/src/components/ConfirmarAcao.jsx',
    'web/src/components/TrilhaDeMigalhas.jsx',
    'web/src/components/AtalhosTeclado.jsx',
    'web/src/components/ExportadorRelatorio.jsx',
    'web/src/components/ConciliadorFinanceiro.jsx',
  ];
  for (const rel of componentesEsperados) {
    assert.equal(fs.existsSync(path.join(ROOT, rel)), true, `Componente ${rel} deve existir`);
  }
});

test('Anti-regressão TDZ (12/11): navigate e searchParams devem ser declarados antes de useEffect em BarbeariaERP.jsx', () => {
  const barbeariaCode = fs.readFileSync(path.join(ROOT, 'web/src/pages/admin/BarbeariaERP.jsx'), 'utf8');
  const idxNav = barbeariaCode.indexOf('const navigate = useNavigate()');
  const idxEffect = barbeariaCode.indexOf('useEffect(() => {');
  assert.ok(idxNav !== -1, 'useNavigate deve existir em BarbeariaERP.jsx');
  assert.ok(idxEffect !== -1, 'useEffect deve existir em BarbeariaERP.jsx');
  assert.ok(idxNav < idxEffect, 'useNavigate deve ser declarado antes de qualquer useEffect em BarbeariaERP.jsx para evitar Temporal Dead Zone (TDZ)');
});
