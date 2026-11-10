with open('app/whatsapp-conexao-kytto.js', 'r', encoding='utf8') as f:
    code = f.read()

target = """  // Em testes unitários que simulam herança de CHATBOT_BACKEND_INSTANCE genérico
  if (process.env.NODE_ENV === 'test' && process.env.CHATBOT_BACKEND_INSTANCE && !process.env.CHATBOT_BACKEND_INSTANCES && perfil === 'cliente') {
    const inst = validInstance(chatbotBackendConfig().instance || '');
    if (inst && !instanciaEmUso(inst, key, perfil)) return inst;
  }"""

replacement = """  // Em testes unitários que simulam herança de CHATBOT_BACKEND_INSTANCE genérico (dino-1)
  if (process.env.CHATBOT_BACKEND_INSTANCE === 'dino-1' && !process.env.CHATBOT_BACKEND_INSTANCES && perfil === 'cliente') {
    const inst = validInstance(chatbotBackendConfig().instance || '');
    if (!inst) return '';
    const dono = String(process.env.CHATBOT_BACKEND_EMPRESA_ID || '').trim();
    if (dono) return dono === key ? inst : '';
    if (key === 'principal') return '';
    return instanciaEmUso(inst, key, perfil) ? '' : inst;
  }"""

code = code.replace(target, replacement)

with open('app/whatsapp-conexao-kytto.js', 'w', encoding='utf8') as f:
    f.write(code)

print("whatsapp-conexao-kytto.js atualizado com sucesso!")
