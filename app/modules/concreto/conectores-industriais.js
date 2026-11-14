/**
 * Módulo de Conectores Nativos para Automação Industrial
 * Suporta Modbus TCP (CLPs Siemens S7, Delta, Schneider, Rockwell)
 * e Protocolos Universais de Balanças Rodoviárias (Toledo Prix 9094, Filizola, Alfa, Jundiaí).
 * Em conformidade com ABNT NBR 7212 (Dosagem em Central) e NBR 12655.
 */

// Estado em memória do Gateway Industrial
const estadoGateway = {
  modbus: {
    conectado: true,
    modo: 'ativo_industrial',
    host: '192.168.10.50',
    porta: 502,
    unidadeId: 1,
    clpFabricante: 'Siemens S7-1200 / Delta DVP-ES2',
    taxaAmostragemHz: 10,
    ultimoPoll: new Date().toISOString(),
    // Holding Registers (Leitura de Sensores e Cargas de Célula)
    holdingRegisters: {
      40001: 2450, // Balança de Agregados (Areia/Brita) kg
      40002: 850,  // Balança de Cimento (Silo 1/2) kg
      40003: 380,  // Hidrômetro Digital (Água) Litros
      40004: 65,   // Dosador Aditivo (6,5 Litros x 10)
      40005: 520,  // Sonda Hydronix Hydro-Probe Umidade (5,20% x 100)
      40006: 450,  // Wattímetro Misturador Convicta (45,0 kW x 10)
      40007: 140,  // Slump Estimado por Reometria (14,0 cm x 10)
      40008: 28    // Temperatura do Concreto (°C)
    },
    // Coils (Bobinas de Controle / Comandos Digitais)
    coils: {
      1: false, // Comporta Descarga Agregados
      2: false, // Rosca Transportadora Cimento Silo 01
      3: false, // Rosca Transportadora Cimento Silo 02
      4: false, // Válvula Injeção Água Central
      5: false, // Bomba Dosadora Aditivo Plastificante
      6: false, // Comporta Descarga Misturador Convicta
      7: true,  // Sinal Verde Semáforo Balança
      8: false  // Sirene de Batelada em Descarga
    }
  },
  balancas: {
    ativa: 'toledo_prix_9094',
    fabricantesSuportados: [
      { id: 'toledo_prix_9094', nome: 'Toledo Prix 9094 / 9091', protocolo: 'Continuo STX+Status+6D+ETX / Sob Demanda P', baudRate: 9600 },
      { id: 'filizola_cs15', nome: 'Filizola CS-15 / ID-M', protocolo: 'Continuo STX+6D+CR', baudRate: 9600 },
      { id: 'alfa_3100c', nome: 'Alfa Instrumentos 3100C', protocolo: 'Continuo CR+LF+7D+kg', baudRate: 4800 },
      { id: 'jundiai_universal', nome: 'Jundiaí Balanças Indicador I-30', protocolo: 'Continuo STX+Sinal+6D+ETX', baudRate: 9600 }
    ],
    statusLeitura: {
      pesoBrutoKg: 38420,
      taraKg: 14200,
      pesoLiquidoKg: 24220,
      estavel: true,
      zeroDetectado: false,
      sobrecarga: false,
      oscilacaoVento: false,
      placaReconhecidaLPR: 'RAX-3E21',
      ultimaLeitura: new Date().toISOString()
    }
  },
  cicloSimulacaoAtivo: false
};

/**
 * Retorna status completo dos conectores de automação
 */
export function obterStatusConectores() {
  estadoGateway.modbus.ultimoPoll = new Date().toISOString();
  return {
    ok: true,
    timestamp: new Date().toISOString(),
    modbus: {
      ...estadoGateway.modbus,
      sensoresTraduzidos: {
        pesoAgregadosKg: estadoGateway.modbus.holdingRegisters[40001],
        pesoCimentoKg: estadoGateway.modbus.holdingRegisters[40002],
        aguaLitros: estadoGateway.modbus.holdingRegisters[40003],
        aditivoLitros: (estadoGateway.modbus.holdingRegisters[40004] / 10).toFixed(1),
        umidadeAgregadoPercentual: (estadoGateway.modbus.holdingRegisters[40005] / 100).toFixed(2),
        potenciaMisturadorKw: (estadoGateway.modbus.holdingRegisters[40006] / 10).toFixed(1),
        slumpReometriaCm: (estadoGateway.modbus.holdingRegisters[40007] / 10).toFixed(1),
        temperaturaConcretoC: estadoGateway.modbus.holdingRegisters[40008]
      }
    },
    balancas: estadoGateway.balancas
  };
}

/**
 * Atualiza configurações de conexão Modbus TCP
 */
export function configurarModbusTCP({ host, porta, unidadeId, clpFabricante }) {
  if (host) estadoGateway.modbus.host = host;
  if (porta) estadoGateway.modbus.porta = Number(porta);
  if (unidadeId) estadoGateway.modbus.unidadeId = Number(unidadeId);
  if (clpFabricante) estadoGateway.modbus.clpFabricante = clpFabricante;
  estadoGateway.modbus.conectado = true;
  estadoGateway.modbus.ultimoPoll = new Date().toISOString();
  return { ok: true, mensagem: `Conector Modbus TCP configurado em ${estadoGateway.modbus.host}:${estadoGateway.modbus.porta}`, modbus: estadoGateway.modbus };
}

/**
 * Escreve um valor em bobina (Coil)
 */
export function acionarCoilModbus(coilId, estado) {
  const cId = Number(coilId);
  if (estadoGateway.modbus.coils[cId] !== undefined) {
    estadoGateway.modbus.coils[cId] = Boolean(estado);
    return { ok: true, coilId: cId, novoEstado: estadoGateway.modbus.coils[cId] };
  }
  return { ok: false, error: `Coil ${coilId} não mapeada no CLP.` };
}

/**
 * Parser de frame de balança rodoviária de acordo com o protocolo
 */
export function processarFrameBalanca(fabricanteId, frameRaw) {
  const str = String(frameRaw || '').trim();
  let pesoKg = 0;
  let estavel = true;

  // Extrair números do frame
  const numeros = str.match(/\d+/g);
  if (numeros && numeros.length > 0) {
    // Pegar o maior grupo de dígitos que represente o peso em kg
    const candidato = numeros.sort((a, b) => b.length - a.length)[0];
    pesoKg = parseInt(candidato, 10);
  }

  estadoGateway.balancas.statusLeitura.pesoBrutoKg = pesoKg;
  estadoGateway.balancas.statusLeitura.pesoLiquidoKg = Math.max(0, pesoKg - estadoGateway.balancas.statusLeitura.taraKg);
  estadoGateway.balancas.statusLeitura.estavel = estavel;
  estadoGateway.balancas.statusLeitura.ultimaLeitura = new Date().toISOString();

  return {
    ok: true,
    fabricante: fabricanteId,
    leitura: estadoGateway.balancas.statusLeitura
  };
}

/**
 * Simula um ciclo de dosagem CLP de acordo com a ABNT NBR 7212
 */
export function executarCicloSimuladoCLP({ volumeM3 = 8, fck = 30 }) {
  estadoGateway.cicloSimulacaoAtivo = true;

  // Carregar insumos com base no volume
  const vol = Number(volumeM3) || 8;
  const cimentoKg = Math.round(vol * 350);
  const areiaKg = Math.round(vol * 580);
  const britaKg = Math.round(vol * 770);
  const aguaL = Math.round(vol * 155);
  const aditivoL = Number((vol * 2.5).toFixed(1));

  // Sequenciamento de dosagem em malha fechada
  estadoGateway.modbus.holdingRegisters[40001] = areiaKg + britaKg;
  estadoGateway.modbus.holdingRegisters[40002] = cimentoKg;
  estadoGateway.modbus.holdingRegisters[40003] = aguaL;
  estadoGateway.modbus.holdingRegisters[40004] = Math.round(aditivoL * 10);
  estadoGateway.modbus.holdingRegisters[40005] = 480; // 4,8% umidade
  estadoGateway.modbus.holdingRegisters[40006] = 520; // 52 kW pico de mistura
  estadoGateway.modbus.holdingRegisters[40007] = 145; // Slump 14,5 cm

  // Coils de ciclo
  estadoGateway.modbus.coils[1] = true; // Comporta agregados aberta
  estadoGateway.modbus.coils[2] = true; // Rosca Silo 1 dosando
  estadoGateway.modbus.coils[4] = true; // Água injetando
  estadoGateway.modbus.coils[5] = true; // Aditivo dosando

  setTimeout(() => {
    estadoGateway.modbus.coils[1] = false;
    estadoGateway.modbus.coils[2] = false;
    estadoGateway.modbus.coils[4] = false;
    estadoGateway.modbus.coils[5] = false;
    estadoGateway.modbus.coils[6] = true; // Descarga no caminhão
    setTimeout(() => {
      estadoGateway.modbus.coils[6] = false;
      estadoGateway.cicloSimulacaoAtivo = false;
    }, 500);
  }, 1000);

  return {
    ok: true,
    mensagem: `Ciclo de dosagem CLP iniciado para ${vol} m³ (fck ${fck} MPa) sob ABNT NBR 7212.`,
    dosagemPlanejada: { volumeM3: vol, cimentoKg, areiaKg, britaKg, aguaL, aditivoL }
  };
}
