#!/usr/bin/env python3

with open('app/modules/empresas/servico.js', 'r', encoding='utf8') as f:
    code = f.read()

# 1. Adicionar import no topo
import_novo = """import {
  TEMPLATES_NEGOCIO,
  provisionarCatalogoSegmento,
  provisionarAdminCompleto,
  provisionarIntegracoesIniciais
} from './onboarding-templates.js';
"""

if "import { TEMPLATES_NEGOCIO" not in code:
    code = import_novo + code
    print("Import adicionado no topo de servico.js")

# 2. Atualizar criarEmpresa
old_criar_bloco = """    // Criar unidade Matriz por padrão se não existir
    if (dados.criarLojaMatriz !== false) {
      const lojaId = crypto.randomUUID();
      const codigoMatriz = `${nomeFantasia.slice(0, 8).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'EMP'}-MATRIZ`;
      await db.query(
        `INSERT INTO lojas (
          id, empresa_id, codigo, nome, cnpj, inscricao_estadual, inscricao_municipal,
          telefone, email, endereco_logradouro, endereco_numero, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep, ativa
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, true
        ) ON CONFLICT (empresa_id, codigo) DO NOTHING`,
        [
          lojaId, novoId, codigoMatriz, `${nomeFantasia} · Matriz`, cnpjNormalizadoDoc,
          ie, im, tel, email, logradouro, numero, bairro, cidade, estado, cep
        ]
      );
    }
  } catch (err) {
    console.warn('[empresas] Não foi possível persistir no PostgreSQL, salvando no Datastore JSON:', err.message);
  }

  // 2. Persistir no Datastore JSON Kytto para compatibilidade com todos os módulos
  try {
    const estadoJson = getDb();
    estadoJson.cadastrosMestresKytto ||= {};
    estadoJson.cadastrosMestresKytto.empresas ||= {};
    estadoJson.cadastrosMestresKytto.empresas[novoId] = {
      id: novoId,
      nome: razaoSocial,
      nomeFantasia,
      cnpj: formatarCnpj(cnpjNormalizadoDoc),
      cnpjNormalizado: cnpjNormalizadoDoc,
      inscricaoEstadual: ie || '',
      inscricaoMunicipal: im || '',
      tipoNegocio,
      endereco: [logradouro, numero, complemento, bairro, cidade ? `${cidade}/${estado}` : '', cep ? `CEP ${cep}` : ''].filter(Boolean).join(', '),
      telefone: tel || '',
      email: email || '',
      website: website || '',
      ativa: true,
      permitirEstoqueNegativo: dados.permitirEstoqueNegativo !== false,
      criadaEm: new Date().toISOString(),
      atualizadaEm: new Date().toISOString(),
    };
    saveDb();
  } catch (e) {
    console.warn('[empresas] Erro ao salvar no Datastore JSON:', e.message);
  }

  // 3. Criar Administrador Inicial se fornecido
  if (dados.administrador?.email && dados.administrador?.senhaInicial) {
    const admNome = String(dados.administrador.nome || 'Administrador').trim();
    const admEmail = String(dados.administrador.email).trim().toLowerCase();
    const admSenha = String(dados.administrador.senhaInicial).trim();
    if (admSenha.length >= 6) {
      const senhaHash = bcrypt.hashSync(admSenha, 10);
      try {
        const userId = crypto.randomUUID();
        await db.query(
          `INSERT INTO usuarios (id, empresa_id, nome, email, senha_hash, role, ativo)
           VALUES ($1, $2, $3, $4, $5, 'admin', true)
           ON CONFLICT (empresa_id, email) DO UPDATE SET senha_hash = EXCLUDED.senha_hash, ativo = true`,
          [userId, novoId, admNome, admEmail, senhaHash]
        );
      } catch (e) {
        console.warn('[empresas] Erro ao cadastrar administrador inicial no PG:', e.message);
      }
    }
  }"""

new_criar_bloco = """    // Criar unidade Matriz por padrão se não existir
    let lojaMatrizId = null;
    if (dados.criarLojaMatriz !== false) {
      lojaMatrizId = crypto.randomUUID();
      const codigoMatriz = `${nomeFantasia.slice(0, 8).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'EMP'}-MATRIZ`;
      await db.query(
        `INSERT INTO lojas (
          id, empresa_id, codigo, nome, cnpj, inscricao_estadual, inscricao_municipal,
          telefone, email, endereco_logradouro, endereco_numero, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep, ativa
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, true
        ) ON CONFLICT (empresa_id, codigo) DO NOTHING`,
        [
          lojaMatrizId, novoId, codigoMatriz, `${nomeFantasia} · Matriz`, cnpjNormalizadoDoc,
          ie, im, tel, email, logradouro, numero, bairro, cidade, estado, cep
        ]
      );
    }
  } catch (err) {
    console.warn('[empresas] Não foi possível persistir no PostgreSQL, salvando no Datastore JSON:', err.message);
  }

  // 2. Persistir no Datastore JSON Kytto para compatibilidade com todos os módulos
  try {
    const estadoJson = getDb();
    estadoJson.cadastrosMestresKytto ||= {};
    estadoJson.cadastrosMestresKytto.empresas ||= {};
    estadoJson.cadastrosMestresKytto.empresas[novoId] = {
      id: novoId,
      nome: razaoSocial,
      nomeFantasia,
      cnpj: formatarCnpj(cnpjNormalizadoDoc),
      cnpjNormalizado: cnpjNormalizadoDoc,
      inscricaoEstadual: ie || '',
      inscricaoMunicipal: im || '',
      tipoNegocio,
      endereco: [logradouro, numero, complemento, bairro, cidade ? `${cidade}/${estado}` : '', cep ? `CEP ${cep}` : ''].filter(Boolean).join(', '),
      telefone: tel || '',
      email: email || '',
      website: website || '',
      ativa: true,
      permitirEstoqueNegativo: dados.permitirEstoqueNegativo !== false,
      criadaEm: new Date().toISOString(),
      atualizadaEm: new Date().toISOString(),
    };
    saveDb();
  } catch (e) {
    console.warn('[empresas] Erro ao salvar no Datastore JSON:', e.message);
  }

  // 3. Provisionamento de Administrador Inicial com Membership & Acesso Total
  let adminCriado = null;
  if (dados.administrador?.email || dados.criarAdminAutomatico === true) {
    try {
      adminCriado = await provisionarAdminCompleto(db, novoId, dados.administrador || {}, nomeFantasia);
    } catch (e) {
      console.warn('[empresas] Erro ao provisionar administrador completo:', e.message);
    }
  }

  // 4. Provisionar Integrações (Storefront Virtual e Parâmetros Fiscais)
  try {
    await provisionarIntegracoesIniciais(db, novoId, lojaMatrizId, {
      nome: nomeFantasia,
      nomeFantasia,
      razaoSocial,
      cnpj: cnpjNormalizadoDoc,
      inscricaoEstadual: ie,
      inscricaoMunicipal: im,
      telefone: tel,
      email,
      enderecoLogradouro: logradouro,
      enderecoNumero: numero,
      enderecoCidade: cidade,
      enderecoEstado: estado
    });
  } catch (e) {
    console.warn('[empresas] Erro ao provisionar integrações iniciais:', e.message);
  }

  // 5. Auto-provisionar Catálogo do Segmento / Template
  let catalogoProvisionado = null;
  if (dados.autoProvisionarCatalogo !== false) {
    try {
      catalogoProvisionado = provisionarCatalogoSegmento(novoId, tipoNegocio, lojaMatrizId);
    } catch (e) {
      console.warn('[empresas] Erro ao provisionar catálogo do segmento:', e.message);
    }
  }"""

if old_criar_bloco in code:
    code = code.replace(old_criar_bloco, new_criar_bloco, 1)
    print("criarEmpresa atualizado com auto-provisionamento!")
else:
    print("AVISO: old_criar_bloco não encontrado exatamente")

# 3. Adicionar adminCriado e catalogoProvisionado no DTO de retorno
old_dto = """  const dto = registroCriado
    ? empresaDto(registroCriado, 1)
    : {
        id: novoId,
        nome: nomeFantasia,
        nomeFantasia,
        razaoSocial,
        cnpj: formatarCnpj(cnpjNormalizadoDoc),
        cnpjNormalizado: cnpjNormalizadoDoc,
        inscricaoEstadual: ie || '',
        inscricaoMunicipal: im || '',
        tipoNegocio,
        telefone: tel || '',
        email: email || '',
        website: website || '',
        ativa: true,
        permitirEstoqueNegativo: dados.permitirEstoqueNegativo !== false,
        totalLojas: 1,
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      };"""

new_dto = """  const dto = registroCriado
    ? empresaDto(registroCriado, 1)
    : {
        id: novoId,
        nome: nomeFantasia,
        nomeFantasia,
        razaoSocial,
        cnpj: formatarCnpj(cnpjNormalizadoDoc),
        cnpjNormalizado: cnpjNormalizadoDoc,
        inscricaoEstadual: ie || '',
        inscricaoMunicipal: im || '',
        tipoNegocio,
        telefone: tel || '',
        email: email || '',
        website: website || '',
        ativa: true,
        permitirEstoqueNegativo: dados.permitirEstoqueNegativo !== false,
        totalLojas: 1,
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      };

  if (adminCriado) dto.administrador = adminCriado;
  if (catalogoProvisionado) dto.catalogoInicial = catalogoProvisionado;"""

if old_dto in code:
    code = code.replace(old_dto, new_dto, 1)
    print("DTO atualizado com administrador e catalogoInicial!")

# 4. Exportar utilitários no final
export_bloco = """
export {
  TEMPLATES_NEGOCIO,
  provisionarCatalogoSegmento,
  provisionarAdminCompleto,
  provisionarIntegracoesIniciais
};
"""
if "export {" not in code or "TEMPLATES_NEGOCIO" not in code:
    code += export_bloco
    print("Exportações de templates adicionadas em servico.js")

with open('app/modules/empresas/servico.js', 'w', encoding='utf8') as f:
    f.write(code)

print("app/modules/empresas/servico.js atualizado com sucesso!")
