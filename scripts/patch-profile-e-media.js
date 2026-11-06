import fs from 'node:fs';

// 1. Atualizar whatsapp-ai-profile.js
let profileCode = fs.readFileSync('app/core/whatsapp-ai-profile.js', 'utf8');

if (!profileCode.includes("import { encontrarClientePorTelefone }")) {
  profileCode = "import { encontrarClientePorTelefone } from '../dino-clientes-vinculo.js';\n" + profileCode;
}

const antigoBarbershopProfile = `async function barbershopProfile(empresaId, phone) {
  try {
    const result = await db.queryRead(
      \`SELECT nome, total_visitas, ultima_visita, preferencias
         FROM clientes_barbearia
        WHERE empresa_id = $1 AND ativo = true
          AND \${phoneMatchKeySql('telefone')} = \${phoneMatchKeySql('$2')}
        LIMIT 2\`,
      [empresaId, phone],
    );
    return result.rows;
  } catch (error) {
    if (error?.code === '42P01') return [];
    throw error;
  }
}`;

const novoBarbershopProfile = `async function barbershopProfile(empresaId, phone) {
  // 1. Prioriza o cadastro oficial de clientes da barbearia Dino no ERP Kytto
  try {
    const cliente = encontrarClientePorTelefone(empresaId, phone);
    if (cliente && cliente.nome) {
      return [{
        nome: cliente.nome,
        total_visitas: Number(cliente.totalVisitas || cliente.totalAtendimentos || 0),
        ultima_visita: cliente.ultimaVisita || cliente.atualizadoEm || null,
        preferencias: cliente.preferencias || cliente.observacoes || '',
      }];
    }
  } catch (_) {}

  // 2. Consulta a tabela clientes oficial do Postgres (com colunas reais)
  try {
    const result = await db.queryRead(
      \`SELECT nome,
              COALESCE(tags->>'total_visitas', '0')::int AS total_visitas,
              criado_em AS ultima_visita,
              COALESCE(tags->>'preferencias', '') AS preferencias
         FROM clientes
        WHERE empresa_id = $1 AND ativo = true
          AND \${phoneMatchKeySql('telefone')} = \${phoneMatchKeySql('$2')}
        LIMIT 2\`,
      [empresaId, phone],
    );
    return result.rows || [];
  } catch (_) {
    return [];
  }
}`;

if (profileCode.includes(antigoBarbershopProfile)) {
  profileCode = profileCode.replace(antigoBarbershopProfile, novoBarbershopProfile);
  fs.writeFileSync('app/core/whatsapp-ai-profile.js', profileCode, 'utf8');
  console.log('whatsapp-ai-profile.js atualizado com sucesso!');
} else {
  console.log('AVISO: antigoBarbershopProfile não encontrado exatamente em whatsapp-ai-profile.js');
}

// 2. Limpar logs desnecessários de locateInboundMedia em whatsapp-ai-media.js
let mediaCode = fs.readFileSync('app/core/whatsapp-ai-media.js', 'utf8');
const log1 = "  console.log('[locateInboundMedia] item keys:', Object.keys(item).join(', '), 'id:', item.whatsappMessageId, item.id, item._id);\n";
const log2 = "  console.log('[locateInboundMedia] found URL:', url);\n";

if (mediaCode.includes(log1)) {
  mediaCode = mediaCode.replace(log1, '');
}
if (mediaCode.includes(log2)) {
  mediaCode = mediaCode.replace(log2, '');
}
fs.writeFileSync('app/core/whatsapp-ai-media.js', mediaCode, 'utf8');
console.log('whatsapp-ai-media.js limpo com sucesso!');
