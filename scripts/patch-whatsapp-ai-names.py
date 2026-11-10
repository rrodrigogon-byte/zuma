with open('app/core/whatsapp-ai.js', 'r', encoding='utf8') as f:
    c = f.read()

# 1. Imports
import_target = "import { encontrarClientePorTelefone } from '../dino-clientes-vinculo.js';"
import_replacement = """import { encontrarClientePorTelefone } from '../dino-clientes-vinculo.js';
import { cleanCustomerDisplayName } from './whatsapp-ai-normalize.js';
import * as barbearia from '../barbearia-erp-kytto.js';

export function resolverNomeCliente(empresaId, telefone, fallbackName = '') {
  let nomeLimpo = cleanCustomerDisplayName(fallbackName);
  if (nomeLimpo) return nomeLimpo;

  // 1. Tenta encontrar no cadastro de clientes persistido
  try {
    const cli = encontrarClientePorTelefone(empresaId, telefone);
    if (cli?.nome) {
      nomeLimpo = cleanCustomerDisplayName(cli.nome);
      if (nomeLimpo) return nomeLimpo;
    }
  } catch {}

  // 2. Tenta nos agendamentos da barbearia pelo telefone
  try {
    const agendamentos = barbearia.listarAgendamentos(empresaId, { telefone });
    if (Array.isArray(agendamentos)) {
      for (const ag of agendamentos) {
        if (ag.clienteNome) {
          nomeLimpo = cleanCustomerDisplayName(ag.clienteNome);
          if (nomeLimpo) return nomeLimpo;
        }
      }
    }
  } catch {}

  return '';
}"""

if import_target in c:
    c = c.replace(import_target, import_replacement, 1)
    print('Imports e resolverNomeCliente adicionados com sucesso!')
else:
    print('import_target nao encontrado!')

# 2. Ajuste em customerContextFor
cust_target = """  const conhecidos = [
    `Nome: ${cliente.nome}`,
    cliente.aniversario ? `Aniversário: ${cliente.aniversario}` : null,"""

cust_replacement = """  const nomeExibicao = resolverNomeCliente(toolContext.empresaId, toolContext.phone, cliente.nome);
  const conhecidos = [
    nomeExibicao ? `Nome: ${nomeExibicao}` : 'Nome: (trate cordialmente por meu irmão ou amigo)',
    cliente.aniversario ? `Aniversário: ${cliente.aniversario}` : null,"""

if cust_target in c:
    c = c.replace(cust_target, cust_replacement, 1)
    print('customerContextFor atualizado com sucesso!')
else:
    print('cust_target nao encontrado!')

# 3. Ajuste em context.customerName na montagem de context
ctx_target = "    customerName: session.nome || message.name,"
ctx_replacement = "    customerName: resolverNomeCliente(task.empresa_id, session.telefone, session.nome || message.name),"

if ctx_target in c:
    c = c.replace(ctx_target, ctx_replacement, 1)
    print('context.customerName atualizado com sucesso!')
else:
    print('ctx_target nao encontrado!')

with open('app/core/whatsapp-ai.js', 'w', encoding='utf8') as f:
    f.write(c)
print('app/core/whatsapp-ai.js salvo com sucesso!')
