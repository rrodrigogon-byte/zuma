with open('app/core/commerce-routes.js', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Ajustar canClaim na rota /whatsapp-ai/sessions
antigo_claim = '''      let canClaim = false;
      try {
        await requirePermission(req, 'settings.write');
        canClaim = true;
      } catch (error) {
        if (error?.code !== 'PERMISSION_DENIED') throw error;
      }'''

novo_claim = '''      let canClaim = false;
      const ehOperador = req.user?.role === 'operador' || req.user?.perfil === 'operador';
      if (ehOperador) {
        canClaim = true;
      } else {
        try {
          await requirePermission(req, 'settings.write');
          canClaim = true;
        } catch (error) {
          if (error?.code !== 'PERMISSION_DENIED') throw error;
        }
      }'''

if antigo_claim in c:
    c = c.replace(antigo_claim, novo_claim)
    print('canClaim atualizado com sucesso!')
else:
    print('Aviso: antigo_claim não encontrado')

# 2. Ajustar rotas de claim, release, messages e close
antigo_actions = '''  router.post('/whatsapp-ai/sessions/:id/claim', async (req, res) => {
    try {
      const context = await withWhatsappLoja(await requirePermission(req, 'settings.write'));
      const tipoCanal = whatsappTipoCanal(req);
      res.json(await claimWhatsappAiHandoff({ ...context, tipoCanal }, req.params.id));
    } catch (error) { jsonError(res, error); }
  });
  router.post('/whatsapp-ai/sessions/:id/release', async (req, res) => {
    try {
      const context = await withWhatsappLoja(await requirePermission(req, 'settings.write'));
      const tipoCanal = whatsappTipoCanal(req);
      res.json(await releaseWhatsappAiHandoff({ ...context, tipoCanal }, req.params.id, { retomar: req.body?.retomar !== false }));
    } catch (error) { jsonError(res, error); }
  });
  // Painel da conversa: histórico completo (cliente, T-Rex e equipe) e resposta do atendente.
  router.get('/whatsapp-ai/sessions/:id/messages', async (req, res) => {
    try {
      const context = await withWhatsappLoja(await requirePermission(req, 'reports.read'));
      const tipoCanal = whatsappTipoCanal(req);
      res.set('Cache-Control', 'no-store');
      res.json(await getWhatsappAiConversation({ ...context, tipoCanal }, req.params.id, { limit: req.query.limit }));
    } catch (error) { jsonError(res, error); }
  });
  router.post('/whatsapp-ai/sessions/:id/messages', async (req, res) => {
    try {
      const context = await withWhatsappLoja(await requirePermission(req, 'settings.write'));
      const tipoCanal = whatsappTipoCanal(req);
      res.json(await sendWhatsappAiStaffMessage({ ...context, tipoCanal, usuarioNome: req.user?.nome || '' }, req.params.id, req.body || {}));
    } catch (error) { jsonError(res, error); }
  });
  router.post('/whatsapp-ai/sessions/:id/close', async (req, res) => {
    try {
      const context = await withWhatsappLoja(await requirePermission(req, 'settings.write'));
      const tipoCanal = whatsappTipoCanal(req);
      res.json(await closeWhatsappAiHandoff({ ...context, tipoCanal }, req.params.id));
    } catch (error) { jsonError(res, error); }
  });'''

novo_actions = '''  router.post('/whatsapp-ai/sessions/:id/claim', async (req, res) => {
    try {
      const isOp = req.user?.role === 'operador' || req.user?.perfil === 'operador';
      const context = await withWhatsappLoja(await requirePermission(req, isOp ? 'customers.write' : 'settings.write'));
      const tipoCanal = whatsappTipoCanal(req);
      res.json(await claimWhatsappAiHandoff({ ...context, tipoCanal }, req.params.id));
    } catch (error) { jsonError(res, error); }
  });
  router.post('/whatsapp-ai/sessions/:id/release', async (req, res) => {
    try {
      const isOp = req.user?.role === 'operador' || req.user?.perfil === 'operador';
      const context = await withWhatsappLoja(await requirePermission(req, isOp ? 'customers.write' : 'settings.write'));
      const tipoCanal = whatsappTipoCanal(req);
      res.json(await releaseWhatsappAiHandoff({ ...context, tipoCanal }, req.params.id, { retomar: req.body?.retomar !== false }));
    } catch (error) { jsonError(res, error); }
  });
  // Painel da conversa: histórico completo (cliente, T-Rex e equipe) e resposta do atendente.
  router.get('/whatsapp-ai/sessions/:id/messages', async (req, res) => {
    try {
      const isOp = req.user?.role === 'operador' || req.user?.perfil === 'operador';
      const context = await withWhatsappLoja(await requirePermission(req, isOp ? 'customers.read' : 'reports.read'));
      const tipoCanal = whatsappTipoCanal(req);
      res.set('Cache-Control', 'no-store');
      res.json(await getWhatsappAiConversation({ ...context, tipoCanal }, req.params.id, { limit: req.query.limit }));
    } catch (error) { jsonError(res, error); }
  });
  router.post('/whatsapp-ai/sessions/:id/messages', async (req, res) => {
    try {
      const isOp = req.user?.role === 'operador' || req.user?.perfil === 'operador';
      const context = await withWhatsappLoja(await requirePermission(req, isOp ? 'customers.write' : 'settings.write'));
      const tipoCanal = whatsappTipoCanal(req);
      res.json(await sendWhatsappAiStaffMessage({ ...context, tipoCanal, usuarioNome: req.user?.nome || '' }, req.params.id, req.body || {}));
    } catch (error) { jsonError(res, error); }
  });
  router.post('/whatsapp-ai/sessions/:id/close', async (req, res) => {
    try {
      const isOp = req.user?.role === 'operador' || req.user?.perfil === 'operador';
      const context = await withWhatsappLoja(await requirePermission(req, isOp ? 'customers.write' : 'settings.write'));
      const tipoCanal = whatsappTipoCanal(req);
      res.json(await closeWhatsappAiHandoff({ ...context, tipoCanal }, req.params.id));
    } catch (error) { jsonError(res, error); }
  });'''

if antigo_actions in c:
    c = c.replace(antigo_actions, novo_actions)
    print('Ações da Fila do WhatsApp atualizadas com sucesso para operador!')
else:
    print('Aviso: antigo_actions não encontrado')

with open('app/core/commerce-routes.js', 'w', encoding='utf-8') as f:
    f.write(c)
