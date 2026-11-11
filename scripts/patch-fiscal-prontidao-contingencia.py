with open('app/modules/fiscal/servico.js', 'r', encoding='utf-8') as f:
    c = f.read()

alvo_update_cont = """    const passo = await transacao(db, async (q) => {
      const doc = (await q(`UPDATE fis_documentos SET status = 'enviando', atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2 AND tp_emis = '9'
                              AND (status = 'contingencia' OR (status = 'enviando' AND atualizado_em < $3)) RETURNING *`, [empresa, id, new Date(agora.getTime() - ENVIANDO_MAX_MS)])).rows[0];
      if (!doc) return null; // outra rotina pegou
      const emit = (await q('SELECT * FROM fis_emitentes WHERE empresa_id = $1 AND id = $2', [empresa, doc.emitente_id])).rows[0];
      return { doc, emit, material: await materialAtivo(q, empresa, env, agora) };
    });"""

novo_update_cont = """    const passo = await transacao(db, async (q) => {
      let doc = (await q(`UPDATE fis_documentos SET status = 'enviando', atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2 AND tp_emis = '9'
                              AND (status = 'contingencia' OR (status = 'enviando' AND atualizado_em < $3) OR (status = 'rejeitado' AND mensagens::text LIKE '%"402"%')) RETURNING *`, [empresa, id, new Date(agora.getTime() - ENVIANDO_MAX_MS)])).rows[0];
      if (!doc) return null; // outra rotina pegou
      const emit = (await q('SELECT * FROM fis_emitentes WHERE empresa_id = $1 AND id = $2', [empresa, doc.emitente_id])).rows[0];
      const material = await materialAtivo(q, empresa, env, agora);
      if (doc.xml_assinado && /[^\\x09\\x0A\\x0D\\x20-\\x7E]/.test(doc.xml_assinado) && Array.isArray(doc.dados?.itens) && doc.dados.itens.length) {
        try {
          const xJustLimpa = String(doc.contingencia_justificativa || JUSTIFICATIVA_CONTINGENCIA).normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/[^\\x20-\\x7E]/g, '').trim();
          const montado = montarNfe({
            doc, emit, itens: doc.dados.itens, pagamentos: doc.dados.pagamentos || [], material, env, agora,
            destinatario: doc.dados.destinatario || null, empresa, contingencia: { justificativa: xJustLimpa },
            tributos: doc.dados.tributos || null, indPres: doc.dados.indPres || '1', operacao: doc.dados.operacao || null
          });
          const dadosNovos = { ...(doc.dados || {}), dhEmi: montado.dhEmi };
          doc = (await q(
            `UPDATE fis_documentos SET chave = $3, xml_assinado = $4, contingencia_justificativa = $5, dados = $6, atualizado_em = CURRENT_TIMESTAMP WHERE empresa_id = $1 AND id = $2 RETURNING *`,
            [empresa, doc.id, montado.chave, montado.xmlAssinado, xJustLimpa, JSON.stringify(dadosNovos)]
          )).rows[0] || doc;
        } catch (errRemontar) {
          console.warn('[fiscal] Aviso ao remontar XML de contingência sem acentos:', errRemontar?.message);
        }
      }
      return { doc, emit, material };
    });"""

if alvo_update_cont in c:
    c = c.replace(alvo_update_cont, novo_update_cont, 1)
    with open('app/modules/fiscal/servico.js', 'w', encoding='utf-8') as f:
        f.write(c)
    print("transmitirContingencias atualizado com remontagem XML ASCII!")
else:
    print("Bloco nao encontrado")
