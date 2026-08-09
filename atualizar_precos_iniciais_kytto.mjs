const base = process.env.KYTTO_BASE_URL || 'https://setpoint-ultra-nedqnqyahq-rj.a.run.app';
const usuario = process.env.KYTTO_ADMIN_USER || 'admin@setpoint-ultra.local';
const senha = process.env.KYTTO_ADMIN_PASSWORD;
if (!senha) throw new Error('Defina KYTTO_ADMIN_PASSWORD antes de executar este script.');

function precoInicial(item) {
  const nome = String(item.nome || '').toLowerCase();
  const embalagem = String(item.embalagem || '').toLowerCase();
  const subcategoria = String(item.subcategoria || '').toLowerCase();

  if (item.cat === 'Espetinhos') {
    if (/(bacon|medalhão|queijo coalho)/.test(nome)) return 16.90;
    if (/pão de alho/.test(nome)) return 10.90;
    if (/legumes/.test(nome)) return 12.90;
    return 14.90;
  }
  if (subcategoria === 'chopes') {
    if (/brahma/.test(nome)) return 8.90;
    if (/amstel/.test(nome)) return 10.90;
    if (/heineken/.test(nome)) return 12.90;
    if (/ipa/.test(nome)) return 14.90;
    return 11.90;
  }
  if (subcategoria === 'águas') return /com gás/.test(nome) ? 5.50 : 4.50;
  if (subcategoria === 'energéticos') return /monster/.test(nome) ? 15.90 : 12.90;
  if (subcategoria === 'hidratação') return 9.90;
  if (subcategoria === 'sucos e chás') return /matte/.test(nome) ? 8.90 : 7.90;
  if (subcategoria === 'refrigerantes') {
    if (/600 ml/.test(embalagem)) return 8.90;
    if (/500 ml/.test(embalagem)) return 8.90;
    return 6.90;
  }
  if (subcategoria === 'cervejas') {
    if (/garrafa 600/.test(embalagem)) {
      return /(heineken|amstel|original)/.test(nome) ? 22.90 : 16.90;
    }
    if (/lata 350/.test(embalagem)) {
      return /(heineken|spaten|brahma duplo malte|petra|amstel)/.test(nome) ? 9.90 : 7.90;
    }
    if (/long neck/.test(embalagem)) {
      return /(hoegaarden|baden|colorado|wäls|lagunitas|blue moon|black princess|therezópolis|praya)/.test(nome) ? 17.90 : 12.90;
    }
    return 10.90;
  }
  return 9.90;
}

async function requisitar(caminho, opcoes = {}) {
  const resposta = await fetch(`${base}${caminho}`, opcoes);
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(`${opcoes.method || 'GET'} ${caminho}: HTTP ${resposta.status} — ${dados.erro || dados.error || JSON.stringify(dados)}`);
  return dados;
}

const login = await requisitar('/api/admin/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: usuario, senha }),
});
const token = login.token;
if (!token) throw new Error('Login administrativo não retornou token.');
const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
const catalogo = await requisitar('/api/admin/cardapio', { headers: { Authorization: `Bearer ${token}` } });

const resumo = { total: catalogo.length, atualizados: 0, porFaixa: {} };
for (const item of catalogo) {
  const preco = precoInicial(item);
  const atualizado = await requisitar(`/api/admin/cardapio/${encodeURIComponent(item.id)}`, {
    method: 'PATCH', headers,
    body: JSON.stringify({ preco, indisponivel: false, precoPendente: false }),
  });
  if (Number(atualizado.item?.preco) !== preco || atualizado.item?.indisponivel === true) {
    throw new Error(`Falha ao confirmar ${item.nome}.`);
  }
  resumo.atualizados += 1;
  resumo.porFaixa[preco.toFixed(2)] = (resumo.porFaixa[preco.toFixed(2)] || 0) + 1;
}

const operacional = await requisitar('/api/cardapio', { headers: { Authorization: `Bearer ${token}` } });
const pendentes = operacional.filter((item) => Number(item.preco) <= 0 || item.indisponivel === true || item.precoPendente === true);
if (operacional.length !== catalogo.length || pendentes.length) {
  throw new Error(`Validação final falhou: operacional=${operacional.length}, pendentes=${pendentes.length}.`);
}
console.log(JSON.stringify({ ok: true, ...resumo, operacional: operacional.length, pendentes: pendentes.length }, null, 2));
