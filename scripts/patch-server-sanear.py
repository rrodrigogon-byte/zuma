caminho = 'app/server.js'
with open(caminho, 'r', encoding='utf8') as f:
    conteudo = f.read()

antigo = "app.get('/api/admin/barbearia/configuracoes', (req, res) => res.json({ ok: true, configuracao: barbeariaErpKytto.obterConfiguracao(legacyEmpresaId(req)) }));"

novo = """app.post('/api/admin/barbearia/sanear-confirmacoes', (req, res) => {
  try {
    const empresaId = legacyEmpresaId(req);
    const resultado = barbeariaErpKytto.sanearConfirmacoesDino(empresaId);
    res.json({ ok: true, empresaId, ...resultado, mensagem: 'Agendamentos saneados e prazos destravados com sucesso.' });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});
app.get('/api/admin/barbearia/configuracoes', (req, res) => res.json({ ok: true, configuracao: barbeariaErpKytto.obterConfiguracao(legacyEmpresaId(req)) }));"""

if antigo in conteudo:
    conteudo = conteudo.replace(antigo, novo)
    with open(caminho, 'w', encoding='utf8') as f:
        f.write(conteudo)
    print("app/server.js atualizado com rota sanear-confirmacoes!")
else:
    print("Aviso: trecho nao encontrado em app/server.js")
