with open('app/routes/automacoes-routes.js', 'r', encoding='utf8') as f:
    code = f.read()

# Import
old_import = "import { consolidarResumoDiario, enviarBriefingGestao, formatarMensagemBriefingGestao } from '../core/automacao-resumo-gestao.js';"
new_import = "import { consolidarResumoDiario, enviarBriefingGestao, formatarMensagemBriefingGestao, consolidarBriefingMatinalEquipe, formatarMensagemBriefingMatinal, enviarBriefingMatinalEquipe } from '../core/automacao-resumo-gestao.js';"
code = code.replace(old_import, new_import, 1)

# Nova automação na lista
nova_def = """  {
    id: 'briefing_matinal_equipe',
    nome: 'Briefing Matinal da Equipe & Metas do Dia (WhatsApp)',
    descricao: 'Consolida às 08:00 a escala do dia, clientes agendados, horários vagos para encaixe e foco em metas por profissional.',
    segmentos: ['barbearia', 'beleza', 'saude', 'esporte'],
    icone: 'sun',
    padraoAtivo: true,
    intervalo: 'Diariamente às 08:00'
  },
"""
target_def = "  {\n    id: 'briefing_fechamento_gestao',"
code = code.replace(target_def, nova_def + target_def, 1)

# Handler no POST /:id/executar
target_exec = """      if (automacaoId === 'briefing_fechamento_gestao') {
        const resultado = await enviarBriefingGestao(empresaId, req.body?.data || null, req.body?.telefone || null);
        return res.json({ ok: true, automacaoId, resultado });
      }"""

new_exec = """      if (automacaoId === 'briefing_fechamento_gestao') {
        const resultado = await enviarBriefingGestao(empresaId, req.body?.data || null, req.body?.telefone || null);
        return res.json({ ok: true, automacaoId, resultado });
      }

      if (automacaoId === 'briefing_matinal_equipe') {
        const resultado = await enviarBriefingMatinalEquipe(empresaId, req.body?.data || null, req.body?.telefone || null);
        return res.json({ ok: true, automacaoId, resultado });
      }"""

code = code.replace(target_exec, new_exec, 1)

with open('app/routes/automacoes-routes.js', 'w', encoding='utf8') as f:
    f.write(code)

print("automacoes-routes.js atualizado com sucesso!")
