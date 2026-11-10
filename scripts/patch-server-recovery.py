with open('app/server.js', 'r', encoding='utf-8') as f:
    c = f.read()

# Substituir o bloco da rota /assets
idx_start = c.find("app.use('/assets', (req, res) => {")
if idx_start > 0:
    idx_end = c.find("app.use(express.static(publicDir,", idx_start)
    if idx_end > 0:
        bloco_antigo = c[idx_start:idx_end]
        novo_bloco = """app.use('/assets', (req, res) => {
  const assetsDir = path.join(publicDir, 'assets');
  const requestedFile = path.basename(req.path || '');
  if (!requestedFile || requestedFile.includes('..')) {
    return res.status(404).json({ error: 'asset not found', code: 'STATIC_ASSET_NOT_FOUND' });
  }
  // Auto-recovery transparente para chunks dinâmicos entre revisões:
  // Se o hash específico mudou, serve o arquivo correspondente diretamente (200 OK sem 302)
  // para nunca falhar imports dinâmicos do ECMAScript no navegador.
  const dotIndex = requestedFile.lastIndexOf('.');
  if (dotIndex > 0) {
    const ext = requestedFile.slice(dotIndex + 1);
    const nameWithoutExt = requestedFile.slice(0, dotIndex);
    const lastHyphen = nameWithoutExt.lastIndexOf('-');
    const basePrefix = lastHyphen > 0 ? nameWithoutExt.slice(0, lastHyphen) : nameWithoutExt;
    try {
      const files = fs.readdirSync(assetsDir);
      const candidato = files
        .filter(f => f.startsWith(`${basePrefix}-`) && f.endsWith(`.${ext}`))
        .sort((a, b) => {
          const sA = fs.statSync(path.join(assetsDir, a)).mtimeMs;
          const sB = fs.statSync(path.join(assetsDir, b)).mtimeMs;
          return sB - sA;
        })[0];
      if (candidato) {
        const filePath = path.join(assetsDir, candidato);
        res.setHeader('Content-Type', ext === 'css' ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return res.sendFile(filePath);
      }
    } catch (_) {}
  }
  return res.status(404).json({ error: 'asset not found', code: 'STATIC_ASSET_NOT_FOUND' });
});
"""
        c = c[:idx_start] + novo_bloco + c[idx_end:]
        print('Bloco /assets substituído com sucesso por entrega direta 200 OK!')

with open('app/server.js', 'w', encoding='utf-8') as f:
    f.write(c)
