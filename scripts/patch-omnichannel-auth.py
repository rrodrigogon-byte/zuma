# 1. Patch omnichannel.js
with open('app/routes/omnichannel.js', 'r', encoding='utf8') as f:
    code = f.read()

old_get_canais = """router.get('/canais', autorizar(...ROLES_GESTAO), async (req, res) => {
  try {
    const resultado = await dbPg.query(
      `SELECT id, codigo_publico, provedor, nome, status, modo_operacao, cabecalho_assinatura,
              algoritmo_assinatura, credencial_referencia, configuracao, ultimo_evento_em,
              ultima_sincronizacao_em, ultimo_erro, data_criacao, data_atualizacao
         FROM canais_integracao
        WHERE empresa_id = $1 AND loja_id = $2
        ORDER BY nome`,
      [req.empresaId, req.lojaId],
    );"""

new_get_canais = """router.get('/canais', autorizar(...ROLES_GESTAO), async (req, res) => {
  try {
    const params = [req.empresaId];
    let sql = `SELECT id, codigo_publico, provedor, nome, status, modo_operacao, cabecalho_assinatura,
              algoritmo_assinatura, credencial_referencia, configuracao, ultimo_evento_em,
              ultima_sincronizacao_em, ultimo_erro, data_criacao, data_atualizacao
         FROM canais_integracao
        WHERE empresa_id = $1`;
    if (req.lojaId) {
      params.push(req.lojaId);
      sql += ` AND (loja_id = $2 OR loja_id IS NULL)`;
    }
    sql += ` ORDER BY nome`;
    const resultado = await dbPg.query(sql, params);"""

if old_get_canais in code:
    code = code.replace(old_get_canais, new_get_canais)
    print("omnichannel.js atualizado!")
else:
    print("AVISO: old_get_canais não encontrada exatamente em omnichannel.js")

with open('app/routes/omnichannel.js', 'w', encoding='utf8') as f:
    f.write(code)

# 2. Patch auth.js
with open('app/routes/auth.js', 'r', encoding='utf8') as f:
    auth_code = f.read()

old_empresa_line = """    const decoded = jwt.verify(token, JWT_SECRET);
    const empresaId = decoded.empresa_id || decoded.empresaId || req.headers['x-empresa-id'] || 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';"""

new_empresa_line = """    const decoded = jwt.verify(token, JWT_SECRET);
    const userIdent = String(decoded.email || decoded.username || decoded.login || '').trim().toLowerCase();
    const isAdminGlobal = (decoded.platformAdmin === true || decoded.mainAdmin === true) && (
      userIdent.includes('rodrigo.goncalves') || userIdent.includes('rrodrigogon') || userIdent === 'admin'
    );
    const isSilvester = userIdent.includes('silvest') || userIdent.includes('stallone');
    const isDino = userIdent.includes('dino') || userIdent.includes('guicunha');

    const requestedEmpresa = String(req.headers['x-empresa-id'] || '').trim();
    let empresaId = decoded.empresa_id || decoded.empresaId || '';

    if (isAdminGlobal) {
      empresaId = requestedEmpresa || empresaId || 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
    } else if (isSilvester) {
      const allowedSilvester = ['31f70c83-9172-40c2-945f-9e793b5048be', 'eba1c88c-d8c1-4b5a-bf65-90275d97dc9e', '2e041110-db20-4fd1-8278-12bd3dead008'];
      if (requestedEmpresa && allowedSilvester.includes(requestedEmpresa)) {
        empresaId = requestedEmpresa;
      } else if (!allowedSilvester.includes(empresaId)) {
        empresaId = '31f70c83-9172-40c2-945f-9e793b5048be';
      }
    } else if (isDino) {
      empresaId = 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
    } else {
      empresaId = empresaId || requestedEmpresa || 'd0d0ac01-8e50-4b61-8c79-de4aaa916da6';
    }"""

if old_empresa_line in auth_code:
    auth_code = auth_code.replace(old_empresa_line, new_empresa_line)
    print("auth.js atualizado!")
else:
    print("AVISO: old_empresa_line não encontrada exatamente em auth.js")

with open('app/routes/auth.js', 'w', encoding='utf8') as f:
    f.write(auth_code)
