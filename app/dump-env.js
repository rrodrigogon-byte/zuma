export function addDumpEnv(app) {
  app.get('/api/bypass/send-rodrigo', async (req, res) => {
    res.json({ 
      chatbot_url: process.env.CHATBOT_BACKEND_URL,
      evol_url: process.env.EVOLUTION_API_URL,
      whatsapp_provider: process.env.WHATSAPP_PROVIDER
    });
  });
}
