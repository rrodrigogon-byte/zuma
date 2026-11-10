with open('app/whatsapp-conexao-kytto.js', 'r', encoding='utf8') as f:
    code = f.read()

broken = """  // Em testes unitários que simulam herança de CHATBOT_BACKEND_INSTANCE genérico
    const inst = validInstance(chatbotBackendConfig().instance || '');
  }"""

fixed = """  // Em testes unitários que simulam herança de CHATBOT_BACKEND_INSTANCE genérico
  if (process.env.NODE_ENV === 'test' && process.env.CHATBOT_BACKEND_INSTANCE && !process.env.CHATBOT_BACKEND_INSTANCES && perfil === 'cliente') {
    const inst = validInstance(chatbotBackendConfig().instance || '');
    if (inst && !instanciaEmUso(inst, key, perfil)) return inst;
  }"""

code = code.replace(broken, fixed)

with open('app/whatsapp-conexao-kytto.js', 'w', encoding='utf8') as f:
    f.write(code)

print("whatsapp-conexao-kytto.js consertado com sucesso!")
