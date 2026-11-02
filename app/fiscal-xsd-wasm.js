// Validação do XSD oficial com o xmllint compilado em WebAssembly (pacote xmllint-wasm, MIT).
// Usado quando o servidor não tem o binário `xmllint` (ex.: imagem nativa do Render): em produção
// nenhuma nota sai sem passar pelo schema oficial. Roda como processo filho síncrono:
//   node fiscal-xsd-wasm.js <xsd de entrada> <arquivo xml>
// e imprime {"valido": boolean, "erros": string[]} na saída padrão.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function validarComWasm(schemaPath, xml) {
  const { validateXML } = await import('xmllint-wasm');
  const dir = path.dirname(schemaPath);
  const xsds = fs.readdirSync(dir).filter((f) => f.endsWith('.xsd'));
  const entrada = path.basename(schemaPath);
  const r = await validateXML({
    xml: [{ fileName: 'documento.xml', contents: xml }],
    schema: [{ fileName: entrada, contents: fs.readFileSync(schemaPath, 'utf8') }],
    // os includes/imports do schema (leiaute, tipos básicos, xmldsig) pelo nome do arquivo
    preload: xsds.filter((f) => f !== entrada).map((f) => ({ fileName: f, contents: fs.readFileSync(path.join(dir, f), 'utf8') })),
  });
  return { valido: Boolean(r.valid), erros: r.valid ? [] : (r.errors || []).map((e) => String(e.rawMessage || e.message || e).trim()).filter(Boolean).slice(-12) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [schemaPath, xmlPath] = process.argv.slice(2);
  validarComWasm(schemaPath, fs.readFileSync(xmlPath, 'utf8'))
    .then((r) => { process.stdout.write(JSON.stringify(r)); })
    .catch((error) => { process.stdout.write(JSON.stringify({ valido: false, erros: [`Validador WebAssembly falhou: ${String(error?.message || error).slice(0, 200)}`], falhaValidador: true })); });
}
