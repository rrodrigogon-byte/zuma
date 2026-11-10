with open('app/core/perfis-acesso.js', 'r', encoding='utf-8') as f:
    c = f.read()

antigo = '''export function restricaoDePermissao(req, permissao) {
  const perfil = perfilDoUsuario(req?.user)
  if (perfil !== 'operador' && perfil !== 'profissional') return null
  if (perfil === 'profissional') return MENSAGEM_PERFIL.profissional
  const codigo = String(permissao || '')
  if (OPERADOR_PERMISSOES_LIVRES.has(codigo)) return null
  const metodo = String(req?.method || '').toUpperCase()
  const caminho = String(req?.originalUrl || req?.url || '').split('?')[0].replace(/\/+$/, '')
  const regra = (OPERADOR_DINHEIRO[codigo] || []).find(([m, re, corpo]) => m === metodo && re.test(caminho) && (!corpo || corpo(req?.body)))
  return regra ? null : MENSAGEM_PERFIL.operador
}'''

novo = '''const OPERADOR_WHATSAPP_ROTAS = [
  /^\/api\/admin\/commerce\/whatsapp-ai(?:\/.*)?$/,
  /^\/api\/admin\/barbearia\/whatsapp-conexao(?:\/.*)?$/,
  /^\/api\/admin\/dino\/whatsapp-atendimento(?:\/.*)?$/,
  /^\/api\/admin\/whatsapp(?:\/.*)?$/,
]

export function restricaoDePermissao(req, permissao) {
  const perfil = perfilDoUsuario(req?.user)
  if (perfil !== 'operador' && perfil !== 'profissional') return null
  if (perfil === 'profissional') return MENSAGEM_PERFIL.profissional
  const caminho = String(req?.originalUrl || req?.url || '').split('?')[0].replace(/\/+$/, '')
  // O operador de balcão tem acesso pleno ao atendimento ao vivo na Fila do WhatsApp
  if (OPERADOR_WHATSAPP_ROTAS.some(re => re.test(caminho))) return null
  const codigo = String(permissao || '')
  if (OPERADOR_PERMISSOES_LIVRES.has(codigo)) return null
  const metodo = String(req?.method || '').toUpperCase()
  const regra = (OPERADOR_DINHEIRO[codigo] || []).find(([m, re, corpo]) => m === metodo && re.test(caminho) && (!corpo || corpo(req?.body)))
  return regra ? null : MENSAGEM_PERFIL.operador
}'''

if antigo in c:
    c = c.replace(antigo, novo)
    print('perfis-acesso.js atualizado com sucesso!')
else:
    print('Erro: antigo não encontrado em perfis-acesso.js')

with open('app/core/perfis-acesso.js', 'w', encoding='utf-8') as f:
    f.write(c)
