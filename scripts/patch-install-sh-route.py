with open('app/server.js', 'r', encoding='utf8') as f:
    code = f.read()

target = "app.get('/health', async (req, res) => {"

replacement = """app.get('/install.sh', (req, res) => {
  const installScriptPath = path.resolve(__dirname, '../bin/kytto-install-onpremise.sh');
  if (fs.existsSync(installScriptPath)) {
    res.type('text/x-sh; charset=utf-8');
    return res.sendFile(installScriptPath);
  }
  return res.status(404).send('#!/bin/bash\\necho "Script de instalacao nao encontrado."\\nexit 1\\n');
});

app.get('/health', async (req, res) => {"""

if '/install.sh' not in code:
    code = code.replace(target, replacement, 1)
    with open('app/server.js', 'w', encoding='utf8') as f:
        f.write(code)
    print('app/server.js atualizado com rota /install.sh com sucesso!')
else:
    print('Rota /install.sh ja existe em app/server.js')
