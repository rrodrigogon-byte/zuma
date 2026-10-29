import * as wp from './core/whatsapp-provider.js';
export function addDumpEnv(app) {
  app.get('/api/bypass/send-rodrigo', async (req, res) => {
    res.json({ 
      cfg: wp.chatbotBackendConfig()
    });
  });
}
