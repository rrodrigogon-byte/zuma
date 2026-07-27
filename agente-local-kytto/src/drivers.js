import fs from 'fs/promises';
import net from 'net';
import path from 'path';

const ESC = '\x1B';
const GS = '\x1D';

function textoSeguro(valor) {
  return String(valor ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
    .slice(0, 2000);
}

function alinhar(texto, tamanho = 42, alinhamento = 'esquerda') {
  const conteudo = textoSeguro(texto);
  if (conteudo.length >= tamanho) return conteudo.slice(0, tamanho);
  if (alinhamento === 'direita') return conteudo.padStart(tamanho, ' ');
  if (alinhamento === 'centro') {
    const esquerda = Math.floor((tamanho - conteudo.length) / 2);
    return `${' '.repeat(esquerda)}${conteudo}`.padEnd(tamanho, ' ');
  }
  return conteudo;
}

export function renderizarCupom(conteudo = {}, largura = 42) {
  if (conteudo.raw_escpos_base64) {
    return Buffer.from(conteudo.raw_escpos_base64, 'base64');
  }

  const linhas = [];
  if (conteudo.titulo) linhas.push(alinhar(conteudo.titulo, largura, 'centro'));
  if (conteudo.subtitulo) linhas.push(alinhar(conteudo.subtitulo, largura, 'centro'));
  linhas.push('-'.repeat(largura));

  for (const linha of Array.isArray(conteudo.linhas) ? conteudo.linhas : []) {
    if (typeof linha === 'string') {
      linhas.push(textoSeguro(linha));
      continue;
    }
    if (linha?.esquerda !== undefined || linha?.direita !== undefined) {
      const esquerda = textoSeguro(linha.esquerda);
      const direita = textoSeguro(linha.direita);
      const espacos = Math.max(1, largura - esquerda.length - direita.length);
      linhas.push(`${esquerda}${' '.repeat(espacos)}${direita}`);
      continue;
    }
    if (linha?.texto) linhas.push(alinhar(linha.texto, largura, linha.alinhamento || 'esquerda'));
  }

  if (conteudo.total) {
    linhas.push('-'.repeat(largura));
    linhas.push(alinhar(conteudo.total, largura, 'direita'));
  }
  if (conteudo.rodape) {
    linhas.push('-'.repeat(largura));
    linhas.push(alinhar(conteudo.rodape, largura, 'centro'));
  }

  // Inicializa, imprime em UTF-8 onde a impressora suportar e corta o papel.
  return Buffer.concat([
    Buffer.from(`${ESC}@${ESC}a\x01`, 'binary'),
    Buffer.from(`${linhas.join('\n')}\n\n\n`, 'utf8'),
    Buffer.from(`${GS}V\x00`, 'binary'),
  ]);
}

function enviarTcp({ host, port, timeoutMs = 5000 }, dados) {
  return new Promise((resolve, reject) => {
    if (!host || !Number.isInteger(Number(port))) return reject(new Error('Impressora de rede requer host e porta válidos'));
    const socket = net.createConnection({ host, port: Number(port) });
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error('Tempo esgotado ao comunicar com o periférico'));
    }, timeoutMs);
    socket.once('error', (erro) => {
      clearTimeout(timeout);
      reject(erro);
    });
    socket.once('connect', () => {
      socket.write(dados, (erro) => {
        if (erro) {
          clearTimeout(timeout);
          socket.destroy();
          return reject(erro);
        }
        socket.end(() => {
          clearTimeout(timeout);
          resolve();
        });
      });
    });
  });
}

async function salvarDiagnostico(diretorio, nome, conteudo) {
  await fs.mkdir(diretorio, { recursive: true });
  const arquivo = path.join(diretorio, `${Date.now()}-${nome}.txt`);
  await fs.writeFile(arquivo, conteudo, 'utf8');
  return arquivo;
}

export async function imprimir({ dispositivo = {}, conteudo, diretorioDiagnostico }) {
  const dados = renderizarCupom(conteudo, Number(dispositivo?.configuracoes?.largura_colunas) || 42);
  const config = dispositivo?.configuracoes || {};
  const modo = config.modo || (dispositivo.endereco_conexao ? 'rede' : 'diagnostico');

  if (modo === 'rede') {
    await enviarTcp({
      host: config.host || dispositivo.endereco_conexao,
      port: Number(config.porta || 9100),
      timeoutMs: Number(config.timeout_ms || 5000),
    }, dados);
    return { modo, bytes: dados.length };
  }

  // Modo de diagnóstico é intencional: permite validar a fila sem disparar em
  // um dispositivo físico durante homologação.
  const arquivo = await salvarDiagnostico(diretorioDiagnostico, 'impressao', dados.toString('utf8'));
  return { modo: 'diagnostico', arquivo, bytes: dados.length };
}

export async function abrirGaveta({ dispositivo = {}, diretorioDiagnostico }) {
  const config = dispositivo?.configuracoes || {};
  const pulso = Buffer.from(`${ESC}p\x00\x19\xFA`, 'binary');
  const modo = config.modo || (dispositivo.endereco_conexao ? 'rede' : 'diagnostico');
  if (modo === 'rede') {
    await enviarTcp({ host: config.host || dispositivo.endereco_conexao, port: Number(config.porta || 9100) }, pulso);
    return { modo: 'rede' };
  }
  const arquivo = await salvarDiagnostico(diretorioDiagnostico, 'gaveta', 'Solicitação de abertura de gaveta');
  return { modo: 'diagnostico', arquivo };
}

export function criarDriverBalanca(config = {}) {
  // A integração serial/USB é específica do fabricante e deve ser instalada
  // apenas no equipamento da loja. O endpoint mantém um contrato estável e
  // permite integrar um adaptador certificado posteriormente.
  return {
    async lerPeso() {
      if (Number.isFinite(Number(config.peso_simulado_kg))) {
        return { peso_kg: Number(config.peso_simulado_kg), estavel: true, origem: 'simulado' };
      }
      throw new Error('Balança sem adaptador configurado. Configure o driver homologado no agente local.');
    },
  };
}
