import test from 'node:test';
import assert from 'node:assert/strict';
import {
  obterDadosConcreto,
  criarCargaConcreto,
  atualizarStatusCarga,
  registrarEventoViagem,
  registrarRupturaCorpoProva,
  calcularDosagemAvancada,
  criarPropostaComercial,
  atualizarStatusProposta,
  atualizarStatusVeiculoFrota,
  registrarMovimentacaoInsumoSilo,
  TRACOS_NORMATIZADOS
} from './servico.js';
import { CONCRETO_EMPRESA_ID } from '../../concreto-usina-seed.js';

test('1. Obter dados completos de concreto e mineração', async () => {
  const dados = await obterDadosConcreto(CONCRETO_EMPRESA_ID);
  assert.equal(dados.ok, true);
  assert.ok(dados.empresa, 'Deve conter empresa');
  assert.equal(dados.empresa.cnpj, '51.499.928/0001-01');
  assert.ok(dados.cargas.length >= 3, 'Deve conter cargas');
  assert.ok(dados.catalogo.length >= 10, 'Deve conter catálogo');
  assert.ok(dados.frota.length >= 7, 'Deve conter frota');
  assert.ok(dados.ensaios.length >= 2, 'Deve conter ensaios de laboratório');
  assert.ok(dados.silos.length >= 5, 'Deve conter silos e pátios da mineração');
  assert.ok(dados.propostas.length >= 1, 'Deve conter propostas comerciais');
  assert.ok(dados.kpis.volumeProgramadoHoje > 0, 'KPIs operacionais calculados');
});

test('2. Calculadora de dosagem NBR 7212 com correção de umidade da areia', () => {
  const dosagem = calcularDosagemAvancada({
    fck: 30,
    volumeM3: 8,
    umidadeAreiaPercent: 5.0, // 5% de umidade na areia
    brita: 'Brita 1'
  });

  assert.equal(dosagem.fck, 30);
  assert.equal(dosagem.volumeM3, 8);
  assert.ok(dosagem.totalCargaBetoneira.cimentoTotalKg > 0);
  assert.ok(dosagem.totalCargaBetoneira.areiaTotalKg > 0);
  assert.ok(dosagem.totalCargaBetoneira.britaTotalKg > 0);
  assert.ok(dosagem.porMetroCubico.aguaDescontadaLitros > 0, 'Deve descontar água contida na areia úmida');
  assert.ok(dosagem.porMetroCubico.aguaCorrigidaLitros < 170, 'Água de amassamento corrigida para baixo');
});

test('3. Criar nova carga de concretagem com FCK 30 e abatimento nos silos', async () => {
  const resultado = await criarCargaConcreto({
    cliente: 'Construtora Tangará Prime',
    obra: 'Residencial Boulevard · Lajes 3º Pavimento',
    endereco: 'Rua 26, nº 420, Jardim Europa, Tangará da Serra/MT',
    fck: 30,
    volumeM3: 16,
    slump: '14 ± 2 cm',
    brita: 'Brita 1',
    bomba: 'BL-01 (Bomba Lança 32m)',
    horarioAgendado: '10:00'
  }, CONCRETO_EMPRESA_ID);

  assert.equal(resultado.ok, true);
  assert.equal(resultado.carga.cliente, 'Construtora Tangará Prime');
  assert.equal(resultado.carga.volumeM3, 16);
  assert.equal(resultado.carga.viagens.length, 2, '16 m³ deve ser dividido em 2 viagens de 8 m³');
  assert.equal(resultado.carga.status, 'agendado');
  assert.ok(resultado.ensaio, 'Deve criar lote de corpos de prova automaticamente');
  assert.equal(resultado.ensaio.fckProjeto, 30);
});

test('4. Atualizar status e registrar telemetria de viagem com hora parada', async () => {
  const cargaCriada = await criarCargaConcreto({
    cliente: 'Obras & Terraplenagem MT',
    obra: 'Piso de Oficina Mecânica',
    fck: 25,
    volumeM3: 8
  }, CONCRETO_EMPRESA_ID);

  const cargaId = cargaCriada.carga.id;

  // Registrar saída da usina
  const ev1 = await registrarEventoViagem(cargaId, 0, 'saida_usina', '08:00');
  assert.equal(ev1.carga.status, 'em_transito');
  assert.equal(ev1.viagem.saida, '08:00');

  // Registrar chegada na obra
  const ev2 = await registrarEventoViagem(cargaId, 0, 'chegada_obra', '08:25');
  assert.equal(ev2.carga.status, 'na_obra');

  // Registrar fim de descarga após 90 minutos (30 min excedentes sobre a franquia de 60 min)
  const ev3 = await registrarEventoViagem(cargaId, 0, 'fim_descarga', '09:55');
  assert.equal(ev3.viagem.tempoEsperaMin, 90);
  assert.ok(ev3.viagem.horaParadaCobranca > 0, 'Deve cobrar hora parada pelo atraso da obra');

  // Atualizar status geral
  const st = await atualizarStatusCarga(cargaId, 'concluido', 'Obra concretada com sucesso');
  assert.equal(st.carga.status, 'concluido');
});

test('5. Laboratório tecnológico: romper corpo de prova aos 7 e 28 dias', async () => {
  const ensaioCriado = await criarCargaConcreto({
    cliente: 'Engenharia Civil Tangará',
    obra: 'Pilares Casa Alphaville',
    fck: 30,
    volumeM3: 8
  }, CONCRETO_EMPRESA_ID);

  const loteId = ensaioCriado.ensaio.id;

  // Rompimento aos 7 dias (meta ~80%)
  const r7 = await registrarRupturaCorpoProva(loteId, 'CP-1', 7, 25.5, 200.2);
  assert.equal(r7.cp.tensaoMpa, 25.5);
  assert.equal(r7.ensaio.status, 'em_ensaio');

  // Rompimento aos 28 dias (CP-3 e CP-4) atingindo FCK de projeto
  await registrarRupturaCorpoProva(loteId, 'CP-3', 28, 33.5, 263.1);
  const r28 = await registrarRupturaCorpoProva(loteId, 'CP-4', 28, 34.1, 267.8);

  assert.equal(r28.ensaio.status, 'aprovado', 'Concreto aprovado pois fck >= 30 MPa');
  assert.equal(r28.ensaio.laudoAprovado, true);
  assert.ok(r28.ensaio.fckEstimado28d >= 30);
});

test('6. Criar proposta comercial de concretagem com cálculo de bombeamento', async () => {
  const prop = await criarPropostaComercial({
    cliente: 'Agropecuária Tangará S/A',
    contato: 'Dr. Fernando',
    telefone: '(65) 99988-1234',
    obra: 'Fundações de Silo de Grãos',
    fck: 35,
    volumeM3: 30,
    tipoBomba: 'Bomba Lança 32m',
    freteKm: 150.00
  }, CONCRETO_EMPRESA_ID);

  assert.equal(prop.ok, true);
  assert.equal(prop.proposta.fck, 35);
  assert.equal(prop.proposta.volumeM3, 30);
  assert.ok(prop.proposta.totalProposta > 14000);
  assert.equal(prop.proposta.status, 'enviada');

  const atualizada = await atualizarStatusProposta(prop.proposta.id, 'aprovada');
  assert.equal(atualizada.proposta.status, 'aprovada');
});

test('7. Telemetria e frota: atualizar status de betoneira e caminhão bomba', async () => {
  const f = await atualizarStatusVeiculoFrota('BT-03', 'carregando', 4200, 'Valdemir Oliveira');
  assert.equal(f.ok, true);
  assert.equal(f.veiculo.status, 'carregando');
  assert.equal(f.veiculo.horimetro, 4200);
});

test('8. Estoque industrial: movimentar insumo no Silo Convicta 96t e pátio mineração', async () => {
  const m1 = await registrarMovimentacaoInsumoSilo('SILO-01', 'entrada', 15.0, 'Recebimento Carreta Votorantim');
  assert.equal(m1.ok, true);
  assert.ok(m1.silo.estoqueAtualTon > 70);

  const m2 = await registrarMovimentacaoInsumoSilo('PAT-AREIA-MED', 'saida', 20.0, 'Consumo usina batelada');
  assert.equal(m2.ok, true);
  assert.ok(m2.silo.estoqueAtualM3 > 0);
});
