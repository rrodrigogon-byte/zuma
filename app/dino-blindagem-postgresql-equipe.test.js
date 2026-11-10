import test from 'node:test';
import assert from 'node:assert/strict';
import { inicializarBloqueiosEquipe } from './core/barbearia-bloqueios-sync.js';
import { sincronizarTenantsEquipes } from './tenant-provisioning.js';
import { provisionarEquipeDino, PROFISSIONAIS_DINO_OFICIAIS, PROFISSIONAIS_DINO_DESLIGADOS, DINO_EMPRESA_CANONICA } from './dino-equipe-seed.js';
import * as barbeariaErpKytto from './barbearia-erp-kytto.js';

test('Blindagem Absoluta do PostgreSQL: Prevenção de Ressuscitação de Ex-Funcionários e Garantia do Bruno Mendes Ativo', async (t) => {
  // Mock do pool PostgreSQL para auditoria de queries executadas no boot
  const queriesExecutadas = [];
  const mockCommerceDb = {
    query: async (sql, params = []) => {
      queriesExecutadas.push({ sql, params });
      return { rows: [] };
    }
  };

  await t.test('1. tenant-provisioning não desativa Bruno Mendes Pedroso', async () => {
    await sincronizarTenantsEquipes(mockCommerceDb);
    
    // Verifica se nenhuma query desativa bruno@barbeariadino.com.br
    const queryDesligaBruno = queriesExecutadas.find(q => 
      q.sql.includes('UPDATE usuarios SET ativo = false') && 
      Array.isArray(q.params?.[0]) && 
      q.params[0].includes('bruno@barbeariadino.com.br')
    );
    assert.equal(Boolean(queryDesligaBruno), false, 'Bruno Mendes NUNCA deve ser desativado pelo seed');
  });

  await t.test('2. barbearia-bloqueios-sync ativa apenas equipe titular e inativa ex-colaboradores no PostgreSQL', async () => {
    // Lê o conteúdo do arquivo barbearia-bloqueios-sync.js para garantir ausência dos IDs desligados no array ativo
    const fs = await import('fs');
    const codigoSync = fs.readFileSync('app/core/barbearia-bloqueios-sync.js', 'utf8');

    // Amanda, David e João Victor não podem estar no array equipeAtivaOficial com ativo: true
    assert.ok(!codigoSync.includes("{ id: '4dc6960f-f7e9-4847-a1fd-7f111ab1000a', role: 'barbeiro' }"), 'Amanda não deve ser reativada no boot');
    assert.ok(!codigoSync.includes("{ id: 'c5f9ba2f-365f-4ada-9087-78d3ce4815d3', role: 'barbeiro' }"), 'David não deve ser reativado no boot');
    assert.ok(!codigoSync.includes("{ id: '6856accc-e854-4a78-aa7a-40c722669943', role: 'barbeiro' }"), 'João Victor não deve ser reativado no boot');

    // Bruno Mendes Pedroso DEVE estar no array de ativos
    assert.ok(codigoSync.includes("{ id: '16212c5f-9d9c-4831-a669-92ec6c5f352c', role: 'barbeiro' }"), 'Bruno Mendes DEVE estar ativo no boot');
  });

  await t.test('3. Execução do provisionamento preserva horários e mantém desligados fora da agenda', () => {
    provisionarEquipeDino();
    const profsAtivos = barbeariaErpKytto.listarProfissionais(DINO_EMPRESA_CANONICA, { incluirInativos: false });
    const nomes = profsAtivos.map(p => p.nome.toLowerCase());

    assert.ok(nomes.some(n => n.includes('bruno') && !n.includes('bruno rafael')), 'Bruno Mendes DEVE estar ativo no ERP');
    assert.ok(!nomes.some(n => n.includes('david kauã')), 'David NÃO deve estar ativo');
    assert.ok(!nomes.some(n => n.includes('amanda gabrielly')), 'Amanda NÃO deve estar ativa');
    assert.ok(!nomes.some(n => n.includes('joão victor')), 'João Victor NÃO deve estar ativo');
  });
});
