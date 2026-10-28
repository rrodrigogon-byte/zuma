const fs = require('fs');
let code = fs.readFileSync('/home/ubuntu/agro-open/web/src/pages/admin/BarbeariaOperacaoPanel.jsx', 'utf8');

const oldState = `const [formMovimento, setFormMovimento] = useState({ tipo: 'suprimento', valor: '', descricao: '' })
  const [formFechamento, setFormFechamento] = useState({ valorInformado: '', observacao: '' })`;

const newState = `const [formMovimento, setFormMovimento] = useState({ tipo: 'suprimento', valor: '', descricao: '', dataMovimento: '' })
  const [formFechamento, setFormFechamento] = useState({ valorInformado: '', observacao: '', dataFechamento: '' })`;

code = code.replace(oldState, newState);

const oldRegMov = `  function registrarMovimento(event) {
    event.preventDefault()
    if (!caixaAberto) return
    if (!window.confirm(\`Confirmar \${formMovimento.tipo === 'sangria' ? 'sangria' : 'suprimento'} de \${moeda(formMovimento.valor)}?\`)) return
    onMove(caixaAberto, { ...formMovimento, valor: Number(formMovimento.valor || 0), confirmado: true })
    setFormMovimento({ tipo: 'suprimento', valor: '', descricao: '' })
  }`;

const newRegMov = `  function registrarMovimento(event) {
    event.preventDefault()
    if (!caixaAberto) return
    if (!window.confirm(\`Confirmar \${formMovimento.tipo === 'sangria' ? 'sangria' : 'suprimento'} de \${moeda(formMovimento.valor)}?\`)) return
    let customDate = undefined;
    if (formMovimento.dataMovimento) {
      customDate = new Date(formMovimento.dataMovimento).toISOString();
    }
    onMove(caixaAberto, { ...formMovimento, valor: Number(formMovimento.valor || 0), criadoEm: customDate, confirmado: true })
    setFormMovimento({ tipo: 'suprimento', valor: '', descricao: '', dataMovimento: '' })
  }`;

code = code.replace(oldRegMov, newRegMov);

const oldFech = `  function fecharCaixa(event) {
    event.preventDefault()
    if (!caixaAberto) return
    const valor = Number(formFechamento.valorInformado || 0)
    if (!window.confirm(\`Confirmar fechamento do caixa \${caixaAberto.numeroCaixa} com valor contado de \${moeda(valor)}?\`)) return
    onClose(caixaAberto, { ...formFechamento, valorInformado: valor, confirmado: true })
  }`;

const newFech = `  function fecharCaixa(event) {
    event.preventDefault()
    if (!caixaAberto) return
    const valor = Number(formFechamento.valorInformado || 0)
    if (!window.confirm(\`Confirmar fechamento do caixa \${caixaAberto.numeroCaixa} com valor contado de \${moeda(valor)}?\`)) return
    let customDate = undefined;
    if (formFechamento.dataFechamento) {
      customDate = new Date(formFechamento.dataFechamento).toISOString();
    }
    onClose(caixaAberto, { ...formFechamento, valorInformado: valor, fechadoEm: customDate, confirmado: true })
  }`;

code = code.replace(oldFech, newFech);

const oldFormMovUI = `<label><span style={labelStyle}>Descrição</span><input required value={formMovimento.descricao} onChange={(event) => setFormMovimento((atual) => ({ ...atual, descricao: event.target.value }))} style={inputStyle} placeholder="Motivo do movimento" /></label>`;
const newFormMovUI = `<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label><span style={labelStyle}>Descrição</span><input required value={formMovimento.descricao} onChange={(event) => setFormMovimento((atual) => ({ ...atual, descricao: event.target.value }))} style={inputStyle} placeholder="Motivo do movimento" /></label>
            <label><span style={labelStyle}>Data/Hora</span><input type="datetime-local" value={formMovimento.dataMovimento} onChange={(event) => setFormMovimento((atual) => ({ ...atual, dataMovimento: event.target.value }))} style={inputStyle} /></label>
          </div>`;

code = code.replace(oldFormMovUI, newFormMovUI);

const oldFormFechUI = `<label><span style={labelStyle}>Observação</span><input value={formFechamento.observacao} onChange={(event) => setFormFechamento((atual) => ({ ...atual, observacao: event.target.value }))} style={inputStyle} /></label>`;
const newFormFechUI = `<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label><span style={labelStyle}>Observação</span><input value={formFechamento.observacao} onChange={(event) => setFormFechamento((atual) => ({ ...atual, observacao: event.target.value }))} style={inputStyle} /></label>
            <label><span style={labelStyle}>Data/Hora</span><input type="datetime-local" value={formFechamento.dataFechamento} onChange={(event) => setFormFechamento((atual) => ({ ...atual, dataFechamento: event.target.value }))} style={inputStyle} /></label>
          </div>`;

code = code.replace(oldFormFechUI, newFormFechUI);

fs.writeFileSync('/home/ubuntu/agro-open/web/src/pages/admin/BarbeariaOperacaoPanel.jsx', code, 'utf8');
console.log('Patched');
