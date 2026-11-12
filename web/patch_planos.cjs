const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/BarbeariaPlanosAssinaturasPanel.jsx', 'utf8');
code = code.replace(
  "onExcluirPlano && onExcluirPlano(plano)\n                      }: Adiciona botão de excluir e corrige limites de preço para planos)",
  "onExcluirPlano && onExcluirPlano(plano)\n                      }"
);
fs.writeFileSync('src/pages/admin/BarbeariaPlanosAssinaturasPanel.jsx', code);
