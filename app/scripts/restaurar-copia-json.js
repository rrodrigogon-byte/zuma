// Recuperação de desastre do banco JSON a partir das cópias guardadas no PostgreSQL.
// Use quando o servidor não sobe ou o disco foi perdido. Com o servidor no ar, prefira
// a rota POST /api/admin/platform/protecao-dados/restaurar (guarda o estado atual antes).
//
//   node app/scripts/restaurar-copia-json.js --listar
//   node app/scripts/restaurar-copia-json.js --id 123 --saida /tmp/restauracao.json
//
// Este script NUNCA sobrescreve o banco em uso: ele grava a cópia conferida (hash +
// JSON válido) no arquivo de saída. Para colocar no ar: pare o serviço, mova o arquivo
// para o DB_PATH e suba de novo. Não imprime conteúdo do banco, só metadados.
import fs from 'fs';
import path from 'path';
import { getPool } from '../core/database.js';
import { criarProtecaoDados } from '../protecao-dados-kytto.js';

const args = process.argv.slice(2);
const valor = (nome) => { const i = args.indexOf(nome); return i >= 0 ? args[i + 1] : undefined; };
const protecao = criarProtecaoDados({ getPool, caminhoBanco: () => process.env.DB_PATH || '' });

try {
  if (args.includes('--listar')) {
    const copias = await protecao.listarCopias({ limite: valor('--limite') || 50 });
    for (const c of copias) console.log(`${c.id}\t${new Date(c.criado_em).toISOString()}\t${c.tipo}\t${c.bytes_original} bytes\t${c.verificado_em ? 'conferida' : 'NÃO conferida'}\t${c.sha256}`);
    if (!copias.length) console.log('Nenhuma cópia encontrada.');
  } else if (valor('--id')) {
    const saida = path.resolve(valor('--saida') || `restauracao-${valor('--id')}.json`);
    if (process.env.DB_PATH && saida === path.resolve(process.env.DB_PATH)) throw new Error('a saída não pode ser o banco em uso (DB_PATH)');
    if (fs.existsSync(saida)) throw new Error('o arquivo de saída já existe; escolha outro nome');
    const conteudo = await protecao.lerCopia(valor('--id'));
    fs.writeFileSync(saida, conteudo, { mode: 0o600 });
    console.log(`Cópia ${valor('--id')} conferida e gravada em ${saida} (${conteudo.length} bytes).`);
  } else {
    console.log('Uso: --listar [--limite N] | --id N [--saida arquivo.json]');
  }
} catch (error) {
  console.error(`Falha: ${error?.message || error}`);
  process.exitCode = 1;
} finally {
  await getPool().end().catch(() => {});
}
