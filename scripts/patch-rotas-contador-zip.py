with open('app/modules/fiscal/rotas.js', 'r', encoding='utf8') as f:
    code = f.read()

target = "  router.get('/contador/pacote', rota('payments.read', ({ req, empresaId, lojaRestrita }) => contador.exportarPacoteContador(db, empresaId, {"

novo_trecho = """  router.get('/contador/zip', async (req, res) => {
    try {
      const { empresaId, lojaRestrita = null } = await escopoDaRequisicao(req, 'payments.read');
      const arq = await contador.gerarPacoteContabilZipBuffer(db, empresaId, {
        competencia: req.query.competencia || null,
        inicio: req.query.inicio || null,
        fim: req.query.fim || null,
        lojaId: req.query.lojaId || null,
        lojaRestrita,
      });
      res.set('Cache-Control', 'private, no-store');
      res.type('application/zip').attachment(arq.nomeArquivo).send(arq.buffer);
    } catch (error) { responderErro(res, error); }
  });

  router.post('/documentos/:id/enviar-whatsapp', rota('payments.write', async ({ req, empresaId, lojaRestrita }) => {
    const doc = await svc.obterDocumento(db, empresaId, req.params.id, { lojaRestrita });
    const telefone = req.body?.telefone || doc.dados?.destinatario?.telefone || doc.dados?.clienteTelefone;
    if (!telefone) throw new ErroDominio('VALIDATION_ERROR', 'Telefone de destino é obrigatório', 400);
    const linkDanfe = `https://kytto.com.br/api/admin/fiscal/documentos/${doc.id}/danfe`;
    const mensagem = `📄 *Comprovante Fiscal Eletrônico - ${doc.modelo === '55' ? 'NF-e' : 'NFC-e'}*\\n\\n` +
      `Olá! Segue o comprovante da sua compra/atendimento:\\n` +
      `• *Número:* ${doc.numero} (Série ${doc.serie})\\n` +
      `• *Valor Total:* R$ ${Number(doc.valor_total || 0).toFixed(2).replace('.', ',')}\\n` +
      `• *Chave de Acesso:* ${doc.chave || doc.chave_acesso || 'Disponível no link'}\\n\\n` +
      `🔗 *Acesse o seu DANFE oficial da SEFAZ:*\\n${linkDanfe}\\n\\n` +
      `Agradecemos a sua preferência!`;
    return {
      ok: true,
      documentoId: doc.id,
      telefone,
      mensagemFormatada: mensagem,
      linkDanfe,
      status: 'pronto_para_envio',
    };
  }));

  router.get('/contador/pacote', rota('payments.read', ({ req, empresaId, lojaRestrita }) => contador.exportarPacoteContador(db, empresaId, {"""

if '/contador/zip' not in code:
    code = code.replace(target, novo_trecho)
    with open('app/modules/fiscal/rotas.js', 'w', encoding='utf8') as f:
        f.write(code)
    print('rotas.js atualizado com /contador/zip e /enviar-whatsapp com sucesso!')
else:
    print('Rotas ja existem em rotas.js!')
