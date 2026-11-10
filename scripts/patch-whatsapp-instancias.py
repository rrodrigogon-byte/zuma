with open('app/whatsapp-conexao-kytto.js', 'r', encoding='utf8') as f:
    code = f.read()

old_func = """function instanciaPadrao(key, tipoCanal = 'cliente') {
  const perfil = normalizarTipoCanal(tipoCanal);

  // Canais internos nunca herdam uma instância Evolution/Cliente. A sessão WAHA
  // precisa ser atribuída explicitamente pela administração da plataforma.
  if (perfil !== 'cliente') return '';

  // Instância registrada para esta empresa no servidor (CHATBOT_BACKEND_INSTANCES) vem primeiro.
  const registrada = instancesOfCompany(key).find((nome) => !instanciaEmUso(nome, key, perfil));
  if (registrada) return registrada;
  const inst = validInstance(chatbotBackendConfig().instance || '');
  if (!inst) return '';
  const dono = String(process.env.CHATBOT_BACKEND_EMPRESA_ID || '').trim();
  if (dono) return dono === key ? inst : '';
  if (key === 'principal') return '';
  return instanciaEmUso(inst, key, perfil) ? '' : inst;
}"""

new_func = """function instanciaPadrao(key, tipoCanal = 'cliente') {
  const perfil = normalizarTipoCanal(tipoCanal);
  const keyNorm = String(key || '').toLowerCase();

  // Mapeamento canônico oficial de instâncias por empresa e canal
  const DINO_ID = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
  const STALLONE_ID = '31f70c83-9172-40c2-945f-9e793b5048be';
  const STALLONE_ID2 = 'eba1c88c-d8c1-4b5a-bf65-90275d97dc9e';
  const AGROOPEN_ID = '2e041110-db20-4fd1-8278-12bd3dead008';

  if (keyNorm === DINO_ID || keyNorm === 'emp-kytto-001' || keyNorm.includes('dino')) {
    if (perfil === 'gestao') return 'barbearia-dino-gestao';
    if (perfil === 'lancamentos') return 'barbearia-dino-lancamentos';
    return 'dino';
  }
  if (keyNorm === STALLONE_ID || keyNorm === STALLONE_ID2 || keyNorm.includes('stallone')) {
    if (perfil === 'gestao') return 'stallone-gestao';
    if (perfil === 'lancamentos') return 'stallone-lancamentos';
    return 'stallone-1';
  }
  if (keyNorm === AGROOPEN_ID || keyNorm.includes('agro')) {
    if (perfil === 'gestao') return 'agro-open-gestao';
    if (perfil === 'lancamentos') return 'agro-open-lancamentos';
    return 'agro-open';
  }

  // Se canal interno (WAHA) para novas empresas: atribuir sessão padronizada
  if (perfil !== 'cliente') {
    return `${keyNorm.slice(0, 8)}-${perfil}`;
  }

  // Instância registrada para esta empresa no servidor (CHATBOT_BACKEND_INSTANCES) vem primeiro.
  const registrada = instancesOfCompany(key).find((nome) => !instanciaEmUso(nome, key, perfil));
  if (registrada) return registrada;
  const inst = validInstance(chatbotBackendConfig().instance || '');
  if (!inst) return '';
  const dono = String(process.env.CHATBOT_BACKEND_EMPRESA_ID || '').trim();
  if (dono) return dono === key ? inst : '';
  if (key === 'principal') return '';
  return instanciaEmUso(inst, key, perfil) ? '' : inst;
}"""

if old_func in code:
    code = code.replace(old_func, new_func)
    print("instanciaPadrao atualizada com sucesso em whatsapp-conexao-kytto.js!")
else:
    print("AVISO: old_func não encontrada exatamente!")

with open('app/whatsapp-conexao-kytto.js', 'w', encoding='utf8') as f:
    f.write(code)
