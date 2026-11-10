import os

with open('app/modules/fiscal/contador.js', 'r', encoding='utf8') as f:
    code = f.read()

novo_codigo = '''
import zlib from 'zlib';

// Tabela CRC32 padrao IEEE 802.3
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
  CRC_TABLE[i] = c;
}

export function montarZipBuffer(arquivos) {
  // arquivos: [ { nome: 'caminho/arquivo.ext', conteudo: Buffer ou string } ]
  const partes = [];
  const registrosDiretorioCentral = [];
  let offset = 0;

  for (const arq of arquivos) {
    const nomeBuf = Buffer.from(arq.nome, 'utf8');
    const dadosBuf = Buffer.isBuffer(arq.conteudo) ? arq.conteudo : Buffer.from(String(arq.conteudo || ''), 'utf8');
    const comprimido = zlib.deflateRawSync(dadosBuf);
    
    let crc = 0 ^ (-1);
    for (let i = 0; i < dadosBuf.length; i++) {
      crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ dadosBuf[i]) & 0xFF];
    }
    crc = (crc ^ (-1)) >>> 0;

    // Header local PK\\x03\\x04
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4); // versao necessaria
    localHeader.writeUInt16LE(0, 6);  // flags
    localHeader.writeUInt16LE(8, 8);  // compressao deflate
    localHeader.writeUInt16LE(0, 10); // hora mod
    localHeader.writeUInt16LE(0, 12); // data mod
    localHeader.writeUInt32LE(crc, 14); // crc32
    localHeader.writeUInt32LE(comprimido.length, 18); // comp size
    localHeader.writeUInt32LE(dadosBuf.length, 22);   // uncomp size
    localHeader.writeUInt16LE(nomeBuf.length, 26);    // nome length
    localHeader.writeUInt16LE(0, 28);                 // extra field length

    partes.push(localHeader, nomeBuf, comprimido);

    // Diretorio central PK\\x01\\x02
    const cdEntry = Buffer.alloc(46);
    cdEntry.writeUInt32LE(0x02014b50, 0);
    cdEntry.writeUInt16LE(20, 4); // versao feita por
    cdEntry.writeUInt16LE(20, 6); // versao necessaria
    cdEntry.writeUInt16LE(0, 8);  // flags
    cdEntry.writeUInt16LE(8, 10); // compressao deflate
    cdEntry.writeUInt16LE(0, 12); // hora
    cdEntry.writeUInt16LE(0, 14); // data
    cdEntry.writeUInt32LE(crc, 16);
    cdEntry.writeUInt32LE(comprimido.length, 20);
    cdEntry.writeUInt32LE(dadosBuf.length, 24);
    cdEntry.writeUInt16LE(nomeBuf.length, 28);
    cdEntry.writeUInt16LE(0, 30); // extra
    cdEntry.writeUInt16LE(0, 32); // comment
    cdEntry.writeUInt16LE(0, 34); // disk num
    cdEntry.writeUInt16LE(0, 36); // internal attr
    cdEntry.writeUInt32LE(0, 38); // external attr
    cdEntry.writeUInt32LE(offset, 42); // offset local header

    registrosDiretorioCentral.push(cdEntry, nomeBuf);
    offset += localHeader.length + nomeBuf.length + comprimido.length;
  }

  const offsetCD = offset;
  let tamanhoCD = 0;
  for (const p of registrosDiretorioCentral) tamanhoCD += p.length;

  // Fim do diretorio central PK\\x05\\x06
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4); // disk num
  endRecord.writeUInt16LE(0, 6); // disk cd
  endRecord.writeUInt16LE(arquivos.length, 8);  // entries on disk
  endRecord.writeUInt16LE(arquivos.length, 10); // total entries
  endRecord.writeUInt32LE(tamanhoCD, 12);       // cd size
  endRecord.writeUInt32LE(offsetCD, 16);        // cd offset
  endRecord.writeUInt16LE(0, 20);               // comment len

  return Buffer.concat([...partes, ...registrosDiretorioCentral, endRecord]);
}

/**
 * Gera arquivo ZIP completo contendo todos os XMLs de notas fiscais,
 * os relatorios contabeis e os arquivos de SPED Fiscal / Contribuicoes.
 */
export async function gerarPacoteContabilZipBuffer(db, empresaId, opcoes = {}) {
  const { periodo, emit } = await carregarDadosPeriodo(db, empresaId, opcoes);
  const cnpj = soDigitos(emit?.cnpj || '00000000000000');
  const comp = periodo.competencia;

  const [pacote, spedFiscal, spedContr] = await Promise.all([
    exportarPacoteContador(db, empresaId, opcoes),
    gerarSpedFiscalTxt(db, empresaId, opcoes).catch(() => null),
    gerarSpedContribuicoesTxt(db, empresaId, opcoes).catch(() => null),
  ]);

  const arquivosNoZip = [];

  // 1. Adicionar CSV sintetico
  arquivosNoZip.push({
    nome: `RELATORIO-CONTABIL-${cnpj}-${comp}.csv`,
    conteudo: pacote.csvContabil,
  });

  // 2. Adicionar Resumo JSON
  arquivosNoZip.push({
    nome: `RESUMO-CONTABIL-${cnpj}-${comp}.json`,
    conteudo: JSON.stringify(pacote.resumo, null, 2),
  });

  // 3. Adicionar SPED Fiscal se houver
  if (spedFiscal?.conteudo) {
    arquivosNoZip.push({
      nome: spedFiscal.nomeArquivo || `SPED-FISCAL-${cnpj}-${comp}.txt`,
      conteudo: spedFiscal.conteudo,
    });
  }

  // 4. Adicionar SPED Contribuicoes se houver
  if (spedContr?.conteudo) {
    arquivosNoZip.push({
      nome: spedContr.nomeArquivo || `SPED-CONTRIBUICOES-${cnpj}-${comp}.txt`,
      conteudo: spedContr.conteudo,
    });
  }

  // 5. Adicionar todos os XMLs na pasta xml/
  for (const itemXml of pacote.arquivosXml) {
    if (itemXml.xml) {
      arquivosNoZip.push({
        nome: `xml/${itemXml.nomeArquivo}`,
        conteudo: itemXml.xml,
      });
    }
  }

  const zipBuffer = montarZipBuffer(arquivosNoZip);
  return {
    nomeArquivo: `PACOTE-FISCAL-${cnpj}-${comp}.zip`,
    buffer: zipBuffer,
    totalArquivos: arquivosNoZip.length,
    totalXmls: pacote.arquivosXml.length,
  };
}
'''

if 'gerarPacoteContabilZipBuffer' not in code:
    code = code + '\n' + novo_codigo
    with open('app/modules/fiscal/contador.js', 'w', encoding='utf8') as f:
        f.write(code)
    print('contador.js atualizado com sucesso!')
else:
    print('Funcao ja existe!')
