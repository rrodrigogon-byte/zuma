import { readFileSync, writeFileSync } from 'fs';
import crypto from 'crypto';
import bcrypt from 'bcrypt';

const DB_PATH = process.env.DB_PATH || '/tmp/db_producao.json';

console.log(`📖 Carregando banco de dados de ${DB_PATH}...`);
const dbContent = readFileSync(DB_PATH, 'utf-8');
const db = JSON.parse(dbContent);

// Garantir estrutura de usuários
db.usuarios ||= {};
db.cadastrosMestresKytto ||= {};
db.cadastrosMestresKytto.usuarios ||= {};
db.cadastrosMestresKytto.empresas ||= {};
db.cadastrosMestresKytto.funcionarios ||= {};
db.clientesKytto ||= {};

console.log('');
console.log('=== RESTAURAÇÃO DE USUÁRIO ADMINISTRATIVO ===');
console.log('');

// Criar usuário rrodrigogon@gmail.com com acesso completo
const usuarioId = `usr-${crypto.randomBytes(6).toString('hex')}`;
const senhaHash = bcrypt.hashSync('#080581Verdao', 12);

const novoUsuario = {
  id: usuarioId,
  empresaId: 'emp-kytto-001',
  empresasAcessiveis: ['emp-kytto-001'],
  nome: 'Rodrigo Gonçalves',
  email: 'rrodrigogon@gmail.com',
  telefone: '',
  roles: ['administrador'],
  ativo: true,
  funcionarioId: '',
  platformAdmin: true,
  senhaHash,
  criadoEm: new Date().toISOString(),
  atualizadoEm: new Date().toISOString(),
  tipoUsuario: 'administrador',
  perfis: ['administrador'],
  role: 'administrador',
  permissoes: {
    dashboard: ['ler', 'criar', 'editar', 'excluir'],
    cardapio: ['ler', 'criar', 'editar', 'excluir'],
    estoque: ['ler', 'criar', 'editar', 'excluir'],
    mesas: ['ler', 'criar', 'editar', 'excluir'],
    clientes: ['ler', 'criar', 'editar', 'excluir'],
    contas_receber: ['ler', 'criar', 'editar', 'excluir'],
    pagamentos: ['ler', 'criar', 'editar', 'excluir'],
    pdv: ['ler', 'criar', 'editar', 'excluir'],
    cozinha: ['ler', 'criar', 'editar', 'excluir'],
    relatorios: ['ler', 'criar', 'editar', 'excluir'],
    fiscal: ['ler', 'criar', 'editar', 'excluir'],
    usuarios: ['ler', 'criar', 'editar', 'excluir'],
    fechamento: ['ler', 'criar', 'editar', 'excluir'],
    canais_delivery: ['ler', 'criar', 'editar', 'excluir'],
    setores: ['ler', 'criar', 'editar', 'excluir'],
    financeiro: ['ler', 'criar', 'editar', 'excluir'],
  },
  permissoesExtras: {},
};

// Adicionar ao banco
db.cadastrosMestresKytto.usuarios[usuarioId] = novoUsuario;
db.usuarios[usuarioId] = novoUsuario;

console.log('✅ Usuário administrativo criado:');
console.log(`   Email: ${novoUsuario.email}`);
console.log(`   Senha: #080581Verdao`);
console.log(`   ID: ${usuarioId}`);
console.log(`   Acesso: Plataforma Admin + Todas as empresas`);
console.log(`   Permissões: Todas (18 módulos)`);
console.log('');

// Criar alguns clientes de exemplo para garantir persistência
console.log('✅ Criando clientes de exemplo para teste de persistência:');
const empresas = Object.keys(db.cadastrosMestresKytto.empresas || {});
for (const empresaId of empresas) {
  db.clientesKytto[empresaId] ||= {};
  const clientesExistentes = Object.keys(db.clientesKytto[empresaId]).length;
  
  if (clientesExistentes === 0 || clientesExistentes === 1) {
    // Adicionar cliente de exemplo
    const clienteId = `cli-${crypto.randomBytes(6).toString('hex')}`;
    db.clientesKytto[empresaId][clienteId] = {
      id: clienteId,
      empresaId,
      nome: 'Cliente Exemplo',
      tipo: 'pf',
      cpfCnpj: '12345678901',
      email: 'cliente@exemplo.com.br',
      telefone: '11999999999',
      endereco: 'Rua Exemplo, 123',
      limiteCreditoMensal: 1000,
      diasVencimento: 30,
      observacao: 'Cliente de exemplo para testes',
      status: 'ativo',
      saldoDevedor: 0,
      scoreCredito: 100,
      risco: 'baixo',
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      padrao: false,
    };
    console.log(`   - Empresa ${empresaId}: Cliente Exemplo criado`);
  }
}

console.log('');
console.log('✅ Salvando banco de dados atualizado...');
writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
console.log(`   ✅ Salvo em ${DB_PATH}`);
console.log('');
console.log('=== RESTAURAÇÃO CONCLUÍDA ===');
console.log('');
console.log('📋 Resumo:');
console.log(`   - Usuários mestres: ${Object.keys(db.cadastrosMestresKytto.usuarios).length}`);
console.log(`   - Usuários admin: ${Object.keys(db.usuarios).length}`);
console.log(`   - Clientes cadastrados: ${Object.keys(db.clientesKytto).reduce((sum, k) => sum + Object.keys(db.clientesKytto[k]).length, 0)}`);
console.log('');
console.log('🔐 Credenciais de acesso:');
console.log('   Email: rrodrigogon@gmail.com');
console.log('   Senha: #080581Verdao');
