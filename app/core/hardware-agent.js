/**
 * Agente Local de Hardware — SetPoint Ultra
 * Gerencia impressoras térmicas, balanças, leitores de código de barras e TEF
 * Roda como processo Node.js local na máquina do cliente (porta 7474)
 * Comunicação: WebSocket bidirecional com o servidor central
 */

import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import net from 'net';
import os from 'os';
import fs from 'fs';
import path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURAÇÃO DO AGENTE
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG_FILE = path.join(os.homedir(), '.setpoint-agent.json');

function carregarConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return {
      porta_http: 7474,
      impressoras: [],
      balancas: [],
      sat: null,
      tef: null,
      terminal_id: `TERM-${os.hostname()}-${Date.now()}`,
    };
  }
}

const config = carregarConfig();

// ─────────────────────────────────────────────────────────────────────────────
// IMPRESSORA TÉRMICA — ESC/POS
// ─────────────────────────────────────────────────────────────────────────────

const ESC = 0x1B;
const GS  = 0x1D;

const ESCPOS = {
  INIT:          Buffer.from([ESC, 0x40]),
  ALIGN_LEFT:    Buffer.from([ESC, 0x61, 0x00]),
  ALIGN_CENTER:  Buffer.from([ESC, 0x61, 0x01]),
  ALIGN_RIGHT:   Buffer.from([ESC, 0x61, 0x02]),
  BOLD_ON:       Buffer.from([ESC, 0x45, 0x01]),
  BOLD_OFF:      Buffer.from([ESC, 0x45, 0x00]),
  DOUBLE_HEIGHT: Buffer.from([ESC, 0x21, 0x10]),
  NORMAL_SIZE:   Buffer.from([ESC, 0x21, 0x00]),
  CUT_FULL:      Buffer.from([GS, 0x56, 0x00]),
  CUT_PARTIAL:   Buffer.from([GS, 0x56, 0x01]),
  LINE_FEED:     Buffer.from([0x0A]),
  OPEN_DRAWER:   Buffer.from([ESC, 0x70, 0x00, 0x19, 0xFA]),
};

export class ImpressoraTermica {
  constructor(cfg) {
    this.tipo     = cfg.tipo || 'usb'; // usb, serial, rede
    this.endereco = cfg.endereco;       // /dev/usb/lp0 | COM1 | 192.168.1.100:9100
    this.colunas  = cfg.colunas || 48;
    this.conexao  = null;
  }

  async conectar() {
    if (this.tipo === 'rede') {
      const [host, porta] = this.endereco.split(':');
      return new Promise((resolve, reject) => {
        this.conexao = net.createConnection({ host, port: parseInt(porta) || 9100 }, () => resolve(true));
        this.conexao.on('error', reject);
      });
    }
    // USB/Serial: usar fs.createWriteStream
    this.conexao = fs.createWriteStream(this.endereco, { flags: 'a' });
    return true;
  }

  async imprimir(buffers) {
    if (!this.conexao) await this.conectar();
    const dados = Buffer.concat([ESCPOS.INIT, ...buffers, ESCPOS.CUT_PARTIAL]);
    return new Promise((resolve, reject) => {
      if (this.tipo === 'rede') {
        this.conexao.write(dados, (err) => err ? reject(err) : resolve(true));
      } else {
        this.conexao.write(dados, (err) => err ? reject(err) : resolve(true));
      }
    });
  }

  // Formatar linha com largura fixa
  linha(texto, alinhamento = 'esquerda') {
    const pad = this.colunas;
    let linha;
    if (alinhamento === 'centro') {
      const espacos = Math.max(0, Math.floor((pad - texto.length) / 2));
      linha = ' '.repeat(espacos) + texto;
    } else if (alinhamento === 'direita') {
      linha = texto.padStart(pad);
    } else {
      linha = texto.padEnd(pad);
    }
    return Buffer.from(linha.substring(0, pad) + '\n', 'latin1');
  }

  // Linha com dois campos: esquerda e direita
  linhaDupla(esq, dir) {
    const total = this.colunas;
    const espaco = total - esq.length - dir.length;
    const texto = esq + ' '.repeat(Math.max(1, espaco)) + dir;
    return Buffer.from(texto.substring(0, total) + '\n', 'latin1');
  }

  separador(char = '-') {
    return Buffer.from(char.repeat(this.colunas) + '\n', 'latin1');
  }

  // Imprimir cupom não-fiscal (pré-venda, orçamento, comanda)
  async imprimirCupomNaoFiscal(dados) {
    const buffers = [
      ESCPOS.ALIGN_CENTER,
      ESCPOS.BOLD_ON,
      ESCPOS.DOUBLE_HEIGHT,
      Buffer.from((dados.nome_empresa || 'EMPRESA').substring(0, 24) + '\n', 'latin1'),
      ESCPOS.NORMAL_SIZE,
      ESCPOS.BOLD_OFF,
      Buffer.from((dados.endereco || '').substring(0, 48) + '\n', 'latin1'),
      Buffer.from((dados.telefone || '').substring(0, 48) + '\n', 'latin1'),
      this.separador('='),
      ESCPOS.ALIGN_LEFT,
      Buffer.from(`Cupom: ${dados.numero || ''}\n`, 'latin1'),
      Buffer.from(`Data:  ${new Date().toLocaleString('pt-BR')}\n`, 'latin1'),
      Buffer.from(`Oper.: ${dados.operador || ''}\n`, 'latin1'),
      this.separador(),
    ];

    for (const item of (dados.itens || [])) {
      buffers.push(Buffer.from(`${item.descricao.substring(0, 28)}\n`, 'latin1'));
      buffers.push(this.linhaDupla(
        `  ${Number(item.quantidade).toFixed(3)} x ${Number(item.valor_unitario).toFixed(2)}`,
        `R$ ${Number(item.valor_total).toFixed(2)}`
      ));
    }

    buffers.push(
      this.separador(),
      ESCPOS.BOLD_ON,
      this.linhaDupla('TOTAL', `R$ ${Number(dados.total).toFixed(2)}`),
      ESCPOS.BOLD_OFF,
    );

    if (dados.pagamentos) {
      for (const pag of dados.pagamentos) {
        buffers.push(this.linhaDupla(pag.forma, `R$ ${Number(pag.valor).toFixed(2)}`));
      }
      if (dados.troco > 0) {
        buffers.push(this.linhaDupla('TROCO', `R$ ${Number(dados.troco).toFixed(2)}`));
      }
    }

    buffers.push(
      this.separador('='),
      ESCPOS.ALIGN_CENTER,
      Buffer.from('Obrigado pela preferencia!\n', 'latin1'),
      Buffer.from((dados.mensagem_rodape || '').substring(0, 48) + '\n', 'latin1'),
      ESCPOS.LINE_FEED,
      ESCPOS.LINE_FEED,
    );

    return this.imprimir(buffers);
  }

  // Abrir gaveta de dinheiro
  async abrirGaveta() {
    return this.imprimir([ESCPOS.OPEN_DRAWER]);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BALANÇA SERIAL — Protocolo Toledo / Filizola / Urano
// ─────────────────────────────────────────────────────────────────────────────

export class BalancaSerial {
  constructor(cfg) {
    this.porta    = cfg.porta;   // COM1, /dev/ttyUSB0
    this.baud     = cfg.baud || 9600;
    this.protocolo = cfg.protocolo || 'toledo'; // toledo, filizola, urano
    this.serial   = null;
    this.parser   = null;
    this.callbacks = [];
  }

  async conectar() {
    this.serial = new SerialPort({ path: this.porta, baudRate: this.baud });
    this.parser = this.serial.pipe(new ReadlineParser({ delimiter: '\r\n' }));
    this.parser.on('data', (linha) => this._processarLeitura(linha));
    return new Promise((resolve, reject) => {
      this.serial.on('open', resolve);
      this.serial.on('error', reject);
    });
  }

  _processarLeitura(linha) {
    let peso = null;
    if (this.protocolo === 'toledo') {
      // Toledo: "P+000.500kg" ou "S+000.500kg"
      const match = linha.match(/[PS][+-](\d{3}\.\d{3})kg/i);
      if (match) peso = parseFloat(match[1]);
    } else if (this.protocolo === 'filizola') {
      // Filizola: "00500" (gramas)
      const match = linha.match(/(\d{5})/);
      if (match) peso = parseInt(match[1]) / 1000;
    } else if (this.protocolo === 'urano') {
      // Urano: "0.500"
      const match = linha.match(/(\d+\.\d+)/);
      if (match) peso = parseFloat(match[1]);
    }

    if (peso !== null) {
      this.callbacks.forEach(cb => cb({ peso, estavel: !linha.includes('M'), raw: linha }));
    }
  }

  onLeitura(callback) {
    this.callbacks.push(callback);
  }

  async lerPeso() {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(null), 3000);
      this.onLeitura((leitura) => {
        if (leitura.estavel) {
          clearTimeout(timeout);
          resolve(leitura.peso);
        }
      });
      // Enviar comando de leitura (Toledo)
      if (this.serial?.isOpen) this.serial.write('\x05');
    });
  }

  // Decodificar código EAN-13 de balança (iniciado por 2)
  static decodificarEanBalanca(ean13) {
    if (!ean13 || ean13.length !== 13 || !ean13.startsWith('2')) return null;
    const plu    = ean13.substring(1, 6);
    const valor  = parseInt(ean13.substring(6, 11)) / 100;
    const tipo   = ean13.substring(5, 6); // 0=preço embutido, 1=peso embutido
    return { plu, tipo: tipo === '0' ? 'preco' : 'peso', valor };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SAT / MFE — Comunicação via DLL/SO
// ─────────────────────────────────────────────────────────────────────────────

export class SatMfe {
  constructor(cfg) {
    this.tipo    = cfg.tipo || 'sat'; // sat, mfe
    this.codigo  = cfg.codigo_ativacao;
    this.cnpj    = cfg.cnpj;
    this.assinatura = cfg.assinatura_ac;
    // Em produção: carregar DLL via ffi-napi ou chamar executável wrapper
    this.modo    = cfg.modo || 'simulado';
  }

  async enviarDadosVenda(xmlCfe) {
    if (this.modo === 'simulado') {
      // Retorno simulado para desenvolvimento
      return {
        sucesso: true,
        numero_sessao: Math.floor(Math.random() * 999999),
        chave_cfe: '35' + new Date().toISOString().replace(/\D/g,'').substring(0,12) + this.cnpj + '59001' + String(Math.floor(Math.random()*999999999)).padStart(9,'0'),
        xml_cfe_sat: xmlCfe,
        data_emissao: new Date().toISOString(),
      };
    }
    // Produção: chamar wrapper do SAT
    // const { execFileSync } = await import('child_process');
    // const resultado = execFileSync('./sat-wrapper', ['enviar', xmlCfe]);
    // return JSON.parse(resultado.toString());
    throw new Error('SAT em modo produção não configurado');
  }

  async cancelarUltimaVenda(chave_cfe, codigo_ativacao) {
    if (this.modo === 'simulado') {
      return { sucesso: true, chave_cancelamento: chave_cfe + '00' };
    }
    throw new Error('SAT em modo produção não configurado');
  }

  async consultarStatusSat() {
    return { online: true, versao: '2.09.00', tipo: this.tipo };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVIDOR HTTP/WebSocket DO AGENTE LOCAL
// ─────────────────────────────────────────────────────────────────────────────

export function iniciarAgente(configOverride = {}) {
  const cfg = { ...config, ...configOverride };
  const server = createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    if (req.url === '/health') {
      res.end(JSON.stringify({ ok: true, terminal_id: cfg.terminal_id, versao: '3.0.0' }));
    } else if (req.url === '/config') {
      res.end(JSON.stringify({ impressoras: cfg.impressoras, balancas: cfg.balancas }));
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ erro: 'Rota não encontrada' }));
    }
  });

  const wss = new WebSocketServer({ server });
  const impressoras = new Map();
  const balancas    = new Map();

  // Inicializar dispositivos configurados
  for (const impCfg of (cfg.impressoras || [])) {
    impressoras.set(impCfg.id, new ImpressoraTermica(impCfg));
  }
  for (const balCfg of (cfg.balancas || [])) {
    const bal = new BalancaSerial(balCfg);
    balancas.set(balCfg.id, bal);
    bal.conectar().catch(err => console.warn(`Balança ${balCfg.id}: ${err.message}`));
  }

  wss.on('connection', (ws) => {
    ws.on('message', async (msg) => {
      let req;
      try { req = JSON.parse(msg); } catch { return; }

      let resposta;
      try {
        switch (req.acao) {
          case 'imprimir_cupom': {
            const imp = impressoras.get(req.impressora_id || cfg.impressoras?.[0]?.id);
            if (!imp) throw new Error('Impressora não encontrada');
            await imp.imprimirCupomNaoFiscal(req.dados);
            resposta = { ok: true };
            break;
          }
          case 'abrir_gaveta': {
            const imp = impressoras.get(req.impressora_id || cfg.impressoras?.[0]?.id);
            if (!imp) throw new Error('Impressora não encontrada');
            await imp.abrirGaveta();
            resposta = { ok: true };
            break;
          }
          case 'ler_peso': {
            const bal = balancas.get(req.balanca_id || cfg.balancas?.[0]?.id);
            if (!bal) throw new Error('Balança não encontrada');
            const peso = await bal.lerPeso();
            resposta = { ok: true, peso };
            break;
          }
          case 'decodificar_ean_balanca': {
            const resultado = BalancaSerial.decodificarEanBalanca(req.ean);
            resposta = { ok: true, ...resultado };
            break;
          }
          case 'listar_portas_serial': {
            const portas = await SerialPort.list();
            resposta = { ok: true, portas: portas.map(p => ({ path: p.path, descricao: p.friendlyName || p.manufacturer })) };
            break;
          }
          case 'status': {
            resposta = {
              ok: true,
              terminal_id: cfg.terminal_id,
              impressoras: [...impressoras.keys()],
              balancas: [...balancas.keys()],
              plataforma: os.platform(),
              hostname: os.hostname(),
            };
            break;
          }
          default:
            resposta = { ok: false, erro: `Ação desconhecida: ${req.acao}` };
        }
      } catch (err) {
        resposta = { ok: false, erro: err.message };
      }

      ws.send(JSON.stringify({ id: req.id, ...resposta }));
    });
  });

  server.listen(cfg.porta_http || 7474, '127.0.0.1', () => {
    console.log(`[SetPoint Agent] Rodando em http://127.0.0.1:${cfg.porta_http || 7474}`);
  });

  return { server, wss, impressoras, balancas };
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIENTE DO AGENTE (usado pelo front-end via WebSocket)
// ─────────────────────────────────────────────────────────────────────────────

export class AgenteClient {
  constructor(url = 'ws://127.0.0.1:7474') {
    this.url      = url;
    this.ws       = null;
    this.pendentes = new Map();
    this.idSeq    = 0;
  }

  async conectar() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      this.ws.onopen  = () => resolve(true);
      this.ws.onerror = reject;
      this.ws.onmessage = (evt) => {
        const resp = JSON.parse(evt.data);
        const cb   = this.pendentes.get(resp.id);
        if (cb) { this.pendentes.delete(resp.id); cb(resp); }
      };
    });
  }

  async enviar(acao, dados = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) await this.conectar();
    const id = ++this.idSeq;
    return new Promise((resolve) => {
      this.pendentes.set(id, resolve);
      this.ws.send(JSON.stringify({ id, acao, ...dados }));
      setTimeout(() => { this.pendentes.delete(id); resolve({ ok: false, erro: 'Timeout' }); }, 5000);
    });
  }

  imprimirCupom(dados, impressora_id) { return this.enviar('imprimir_cupom', { dados, impressora_id }); }
  abrirGaveta(impressora_id)          { return this.enviar('abrir_gaveta', { impressora_id }); }
  lerPeso(balanca_id)                 { return this.enviar('ler_peso', { balanca_id }); }
  decodificarEan(ean)                 { return this.enviar('decodificar_ean_balanca', { ean }); }
  status()                            { return this.enviar('status'); }
}
