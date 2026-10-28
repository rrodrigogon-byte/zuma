const { createWhatsappAiToolExecutor } = require('./app/core/whatsapp-ai-tools.js');
async function run() {
  const executor = createWhatsappAiToolExecutor({
    empresaId: 'emp-kytto-001',
    lojaId: 'dino-web-estoque',
    sessionId: 'session-id',
    phone: '5565999999999',
    capabilities: { appointments: true, storeQueries: true }
  });
  
  try {
    const res = await executor('listar_servicos', {});
    console.log("Servicos:", res);
  } catch (e) {
    console.error(e);
  }
  process.exit();
}
run();
