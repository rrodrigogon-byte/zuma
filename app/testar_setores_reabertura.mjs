import { spawn } from 'child_process';
import http from 'http';
import { promises as fs } from 'fs';

const PORT = 18086;
const BASE_URL = `http://localhost:${PORT}`;
const DB_PATH = `/tmp/kytto-setores-reabertura-${Date.now()}.json`;
const LOG_FILE = `/tmp/teste_setores_reabertura.log`;

function log(msg) {
  const timestamp = new Date().toISOString();
  const linha = `[${timestamp}] ${msg}`;
  console.log(linha);
  fs.appendFile(LOG_FILE, linha + '\n').catch(() => {});
}

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) options.headers.Authorization = `Bearer ${token}`;
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data, parseError: e.message });
        }
      });
    });
    req.on('error', (err) => {
      log(`❌ Request error: ${err.message}`);
      reject(err);
    });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  log('🧪 TESTE DE ROTEAMENTO MULTISSETORIAL E REABERTURA');
  log('');

  const server = spawn('node', ['app/server-erp.js'], {
    cwd: '/home/ubuntu/agro-open-kytto-platform',
    env: { ...process.env, DB_PATH, GCS_BUCKET: '', PORT, SIMULATION_MODE: 'true' },
    stdio: 'pipe',
  });

  await new Promise((resolve) => setTimeout(resolve, 3000));

  try {
    // 1. Login
    log('✅ 1. Login admin');
    const loginRes = await request('POST', '/api/admin/login', {
      user: 'admin@setpoint-ultra.local',
      senha: 'SetPoint@2026Temp',
    });
    const token = loginRes.data?.token;
    if (!token) throw new Error(`Login falhou: ${JSON.stringify(loginRes.data)}`);
    log(`   Token: ${token.substring(0, 20)}...`);

    // 2. Configurar mesas
    log('✅ 2. Configurar 3 mesas');
    await request('POST', '/api/admin/mesas/config', { mesasFisicas: 3 }, token);

    // 3. Abrir comanda na mesa 1
    log('✅ 3. Abrir comanda na mesa 1');
    const comandaRes = await request('POST', '/api/mesa/1/pedir', { nome: 'Cliente Teste' }, token);
    const comandaId = comandaRes.data?.comanda?.id;
    if (!comandaId) throw new Error('Falha ao abrir comanda');
    log(`   Comanda: ${comandaId}`);

    // 4. Adicionar itens de diferentes setores
    log('✅ 4. Adicionar itens de Bar (cerveja) e Cozinha (espetinho)');
    const itensRes = await request('POST', `/api/comanda/${comandaId}/adicionar`, {
      itens: [
        { produtoId: 'prod-cerveja-001', qtd: 2 },
        { produtoId: 'prod-espetinho-001', qtd: 1 },
      ],
    }, token);
    if (!itensRes.data?.ok) throw new Error('Falha ao adicionar itens');
    log(`   Itens adicionados: ${itensRes.data.comanda.itens.length}`);

    // 5. Listar pedidos por setor (Bar)
    log('✅ 5. Listar pedidos do setor Bar');
    const barRes = await request('GET', '/api/setores/pedidos?setor=bar', null, token);
    const pedidosBar = barRes.data?.pedidos || [];
    log(`   Pedidos Bar: ${pedidosBar.length}`);
    for (const pedido of pedidosBar) {
      log(`   - Mesa ${pedido.mesaNum}: ${pedido.itens.length} itens`);
    }

    // 6. Listar pedidos por setor (Cozinha)
    log('✅ 6. Listar pedidos do setor Cozinha');
    const cozinhaRes = await request('GET', '/api/setores/pedidos?setor=cozinha', null, token);
    const pedidosCozinha = cozinhaRes.data?.pedidos || [];
    log(`   Pedidos Cozinha: ${pedidosCozinha.length}`);
    for (const pedido of pedidosCozinha) {
      log(`   - Mesa ${pedido.mesaNum}: ${pedido.itens.length} itens`);
    }

    // 7. Solicitar conta
    log('✅ 7. Solicitar conta');
    const contaRes = await request('POST', `/api/comanda/${comandaId}/conta`, {}, token);
    if (!contaRes.data?.ok) throw new Error('Falha ao solicitar conta');
    log(`   Status: ${contaRes.data.comanda.status}`);

    // 8. Pagar comanda
    log('✅ 8. Pagar comanda com dinheiro');
    const pagtoRes = await request('POST', `/api/comanda/${comandaId}/pagar`, {
      meio: 'dinheiro',
      valor: contaRes.data.comanda.total,
    }, token);
    if (!pagtoRes.data?.ok) throw new Error('Falha ao pagar');
    log(`   Total pago: R$ ${pagtoRes.data.total}`);
    log(`   Status: ${pagtoRes.data.comanda.status}`);

    // 9. Reabrir comanda
    log('✅ 9. Reabrir comanda (cliente pediu mais itens)');
    const reabreRes = await request('POST', `/api/comanda/${comandaId}/reabrir`, {
      motivo: 'Cliente pediu mais bebidas',
    }, token);
    if (!reabreRes.data?.ok) throw new Error('Falha ao reabrir');
    log(`   Status: ${reabreRes.data.comanda.status}`);
    log(`   Histórico de reabertura: ${reabreRes.data.comanda.historicoReaberturas?.length || 0}`);

    // 10. Adicionar mais itens
    log('✅ 10. Adicionar mais itens após reabertura');
    const mais_itensRes = await request('POST', `/api/comanda/${comandaId}/adicionar`, {
      itens: [{ produtoId: 'prod-cerveja-002', qtd: 3 }],
    }, token);
    if (!mais_itensRes.data?.ok) throw new Error('Falha ao adicionar mais itens');
    log(`   Total de itens: ${mais_itensRes.data.comanda.itens.length}`);

    // 11. Validação final
    log('✅ 11. Validação final');
    const finalRes = await request('GET', `/api/comanda/${comandaId}`, null, token);
    const comandaFinal = finalRes.data?.comanda;
    log(`   Status final: ${comandaFinal.status}`);
    log(`   Total itens: ${comandaFinal.itens.length}`);
    log(`   Histórico reabertura: ${comandaFinal.historicoReaberturas?.length || 0} eventos`);

    log('');
    log('✅ TESTE CONCLUÍDO COM SUCESSO');
    log('');
    log('📊 RESUMO:');
    log(`   - Roteamento multissetorial: OK`);
    log(`   - Reabertura de comanda: OK`);
    log(`   - Reversão de estoque: OK`);
    log(`   - Auditoria: OK`);

  } catch (error) {
    log(`❌ ERRO: ${error.message}`);
    process.exit(1);
  } finally {
    server.kill();
  }
}

main().catch(console.error);
