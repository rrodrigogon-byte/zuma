const fs = require('fs');
let code = fs.readFileSync('/home/ubuntu/agro-open/web/src/pages/admin/BarbeariaERP.jsx', 'utf8');

const funcsToAdd = `
  async function removerItemComanda(comandaId, itemId) {
    if (!window.confirm('Tem certeza que deseja remover este item da comanda?')) return;
    try {
      const resposta = await api.delete(\`/api/admin/barbearia/comandas/\${comandaId}/itens/\${itemId}\`);
      toast('Item removido com sucesso.', 'success');
      setModal(m => m?.tipo === 'comanda' ? { ...m, comanda: resposta.comanda || resposta } : m);
      await carregar();
    } catch (e) {
      toast(e.message || 'Erro ao remover item.', 'error');
    }
  }

  async function alterarValorItemComanda(comandaId, itemId, valorAtual) {
    const novoValorStr = window.prompt('Informe o novo valor para este item (ex: 50.00):', valorAtual);
    if (novoValorStr === null) return;
    const novoValor = parseFloat(novoValorStr.replace(',', '.'));
    if (isNaN(novoValor) || novoValor < 0) return toast('Valor inválido.', 'error');
    try {
      const resposta = await api.patch(\`/api/admin/barbearia/comandas/\${comandaId}/itens/\${itemId}\`, { valor: novoValor, precoUnitario: novoValor, preco: novoValor });
      toast('Item atualizado com sucesso.', 'success');
      setModal(m => m?.tipo === 'comanda' ? { ...m, comanda: resposta.comanda || resposta } : m);
      await carregar();
    } catch (e) {
      toast(e.message || 'Erro ao atualizar item.', 'error');
    }
  }
`;

const oldItemRow = `</small></div><strong>{item.coberturaPlano ? <span style={{ color: '#2e9e7b' }}>Plano · <s style={{ color: 'var(--muted)', fontWeight: 400 }}>{moeda(item.coberturaPlano.valorAbatido)}</s></span> : moeda(item.subtotal ?? Number(item.precoUnitario || item.preco || 0) * Number(item.quantidade || item.qtd || 1))}</strong></div>)}</div>}`;

const newItemRow = `</small></div>
<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
  <strong>{item.coberturaPlano ? <span style={{ color: '#2e9e7b' }}>Plano · <s style={{ color: 'var(--muted)', fontWeight: 400 }}>{moeda(item.coberturaPlano.valorAbatido)}</s></span> : moeda(item.subtotal ?? Number(item.precoUnitario || item.preco || 0) * Number(item.quantidade || item.qtd || 1))}</strong>
  {podeEditar && !item.coberturaPlano && (
    <button type="button" style={{ ...styles.small, padding: '2px 6px', fontSize: 11 }} onClick={() => alterarValorItemComanda(comanda.id, item.id || \`\${item.tipo}-\${indice}\`, item.precoUnitario || item.preco || 0)}>✏️</button>
  )}
  {podeEditar && (
    <button type="button" style={{ ...styles.small, padding: '2px 6px', fontSize: 11, color: '#ef4444' }} onClick={() => removerItemComanda(comanda.id, item.id || \`\${item.tipo}-\${indice}\`)}>×</button>
  )}
</div>
</div>)}</div>}`;

code = code.replace(`</small></div><strong>{item.coberturaPlano ? <span style={{ color: '#2e9e7b' }}>Plano · <s style={{ color: 'var(--muted)', fontWeight: 400 }}>{moeda(item.coberturaPlano.valorAbatido)}</s></span> : moeda(item.subtotal ?? Number(item.precoUnitario || item.preco || 0) * Number(item.quantidade || item.qtd || 1))}</strong></div>)}</div>}`, newItemRow);
code = code.replace(`  async function abrirComanda(comanda)`, funcsToAdd + `\n  async function abrirComanda(comanda)`);

fs.writeFileSync('/home/ubuntu/agro-open/web/src/pages/admin/BarbeariaERP.jsx', code, 'utf8');
console.log('Patched BarbeariaERP.jsx items');
