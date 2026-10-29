export function addDumpEnv(app) {
  app.get('/api/bypass/send-rodrigo', async (req, res) => {
    res.json({ 
      cfg: require('./core/whatsapp-provider.js').chatbotBackendConfig()
    });
  });
}
