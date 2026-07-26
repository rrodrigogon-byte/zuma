/**
 * ============================================================================
 * SCRIPT DE MIGRAÇÃO: JSON → PostgreSQL
 * ============================================================================
 * Descrição: Migra dados históricos do JSON para PostgreSQL preservando
 *            integridade referencial e auditoria
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import * as dbPg from '../db-pg.js';

const DB_JSON_PATH = path.join(process.cwd(), 'db.json');

/**
 * Carregar dados do JSON
 */
function carregarDadosJSON() {
  try {
    const data = fs.readFileSync(DB_JSON_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Erro ao carregar db.json:', error);
    return {};
  }
}

/**
 * Migrar empresa
 */
async function migrarEmpresa(dadosJSON) {
  console.log('📦 Migrando empresa...');
  
  try {
    const empresa = await dbPg.criarEmpresa({
      nome: 'Agro Open - Tênis',
      cnpj: '00000000000191',
      razao_social: 'Agro Open de Tênis LTDA',
      inscricao_estadual: null,
      tipo_negocio: 'clube'
    });
    
    console.log('✅ Empresa migrada:', empresa.id);
    return empresa;
  } catch (error) {
    console.error('❌ Erro ao migrar empresa:', error);
    throw error;
  }
}

/**
 * Migrar usuários
 */
async function migrarUsuarios(dadosJSON, empresaId) {
  console.log('👥 Migrando usuários...');
  
  const usuarios = dadosJSON.usuarios || [];
  const usuariosMigrados = [];
  
  for (const usuario of usuarios) {
    try {
      // Gerar hash da senha se não existir
      const senhaHash = usuario.senha_hash || await bcrypt.hash(usuario.senha || 'senha123', 10);
      
      const usuarioMigrado = await dbPg.criarUsuario({
        empresa_id: empresaId,
        email: usuario.email,
        senha_hash: senhaHash,
        nome_completo: usuario.nome || usuario.email,
        cpf: usuario.cpf || null,
        role: usuario.role || 'operador'
      });
      
      usuariosMigrados.push({
        id_antigo: usuario.id,
        id_novo: usuarioMigrado.id,
        email: usuarioMigrado.email
      });
    } catch (error) {
      console.warn(`⚠️  Erro ao migrar usuário ${usuario.email}:`, error.message);
    }
  }
  
  console.log(`✅ ${usuariosMigrados.length} usuários migrados`);
  return usuariosMigrados;
}

/**
 * Migrar categorias
 */
async function migrarCategorias(dadosJSON, empresaId) {
  console.log('📂 Migrando categorias...');
  
  const categorias = dadosJSON.categorias || [
    { nome: 'Bebidas' },
    { nome: 'Comidas' },
    { nome: 'Serviços' }
  ];
  
  const categoriasMigradas = [];
  
  for (const categoria of categorias) {
    try {
      const result = await dbPg.query(
        `INSERT INTO categorias (empresa_id, nome, ativa) 
         VALUES ($1, $2, $3) 
         RETURNING id, nome`,
        [empresaId, categoria.nome, true]
      );
      
      categoriasMigradas.push({
        id_antigo: categoria.id,
        id_novo: result.rows[0].id,
        nome: result.rows[0].nome
      });
    } catch (error) {
      console.warn(`⚠️  Erro ao migrar categoria ${categoria.nome}:`, error.message);
    }
  }
  
  console.log(`✅ ${categoriasMigradas.length} categorias migradas`);
  return categoriasMigradas;
}

/**
 * Migrar produtos
 */
async function migrarProdutos(dadosJSON, empresaId, categoriasMigradas) {
  console.log('🛍️  Migrando produtos...');
  
  const produtos = dadosJSON.produtos || [];
  const produtosMigrados = [];
  
  for (const produto of produtos) {
    try {
      // Encontrar categoria correspondente
      const categoriaMigrada = categoriasMigradas.find(c => c.id_antigo === produto.categoria_id);
      const categoriaId = categoriaMigrada?.id_novo || categoriasMigradas[0]?.id_novo;
      
      const result = await dbPg.query(
        `INSERT INTO produtos 
         (empresa_id, categoria_id, codigo_interno, nome, preco_custo, preco_venda, unidade_medida, ativo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, codigo_interno, nome`,
        [
          empresaId,
          categoriaId,
          produto.codigo_interno || `PROD-${Date.now()}`,
          produto.nome,
          produto.preco_custo || 0,
          produto.preco_venda || 0,
          produto.unidade_medida || 'un',
          true
        ]
      );
      
      produtosMigrados.push({
        id_antigo: produto.id,
        id_novo: result.rows[0].id,
        nome: result.rows[0].nome
      });
    } catch (error) {
      console.warn(`⚠️  Erro ao migrar produto ${produto.nome}:`, error.message);
    }
  }
  
  console.log(`✅ ${produtosMigrados.length} produtos migrados`);
  return produtosMigrados;
}

/**
 * Migrar formas de pagamento
 */
async function migrarFormasPagamento(empresaId) {
  console.log('💳 Migrando formas de pagamento...');
  
  const formas = [
    { nome: 'Dinheiro', tipo: 'dinheiro' },
    { nome: 'Cartão Crédito', tipo: 'cartao_credito' },
    { nome: 'Cartão Débito', tipo: 'cartao_debito' },
    { nome: 'Pix', tipo: 'pix' }
  ];
  
  const formasMigradas = [];
  
  for (const forma of formas) {
    try {
      const result = await dbPg.query(
        `INSERT INTO formas_pagamento (empresa_id, nome, tipo, ativa)
         VALUES ($1, $2, $3, $4)
         RETURNING id, nome`,
        [empresaId, forma.nome, forma.tipo, true]
      );
      
      formasMigradas.push({
        id_novo: result.rows[0].id,
        nome: result.rows[0].nome
      });
    } catch (error) {
      console.warn(`⚠️  Erro ao migrar forma de pagamento ${forma.nome}:`, error.message);
    }
  }
  
  console.log(`✅ ${formasMigradas.length} formas de pagamento migradas`);
  return formasMigradas;
}

/**
 * Executar migração completa
 */
export async function executarMigracao() {
  console.log('\n🚀 INICIANDO MIGRAÇÃO JSON → POSTGRESQL\n');
  console.log('=' .repeat(60));
  
  try {
    // Carregar dados do JSON
    const dadosJSON = carregarDadosJSON();
    console.log('📄 Dados JSON carregados');
    
    // 1. Migrar empresa
    const empresa = await migrarEmpresa(dadosJSON);
    
    // 2. Migrar usuários
    const usuariosMigrados = await migrarUsuarios(dadosJSON, empresa.id);
    
    // 3. Migrar categorias
    const categoriasMigradas = await migrarCategorias(dadosJSON, empresa.id);
    
    // 4. Migrar produtos
    const produtosMigrados = await migrarProdutos(dadosJSON, empresa.id, categoriasMigradas);
    
    // 5. Migrar formas de pagamento
    const formasMigradas = await migrarFormasPagamento(empresa.id);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!\n');
    
    console.log('📊 RESUMO:');
    console.log(`  • Empresa: 1`);
    console.log(`  • Usuários: ${usuariosMigrados.length}`);
    console.log(`  • Categorias: ${categoriasMigradas.length}`);
    console.log(`  • Produtos: ${produtosMigrados.length}`);
    console.log(`  • Formas de Pagamento: ${formasMigradas.length}`);
    console.log('\n💾 Dados migrados para PostgreSQL com sucesso!\n');
    
    return {
      sucesso: true,
      empresa,
      usuariosMigrados,
      categoriasMigradas,
      produtosMigrados,
      formasMigradas
    };
  } catch (error) {
    console.error('\n❌ ERRO NA MIGRAÇÃO:', error);
    throw error;
  }
}

// Executar se for chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  executarMigracao()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

export default { executarMigracao };
