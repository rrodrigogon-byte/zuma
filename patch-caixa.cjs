const fs = require('fs');
let code = fs.readFileSync('/home/ubuntu/agro-open/web/src/pages/admin/BarbeariaOperacaoPanel.jsx', 'utf8');

const oldFormCaixaState = "const [formCaixa, setFormCaixa] = useState({ numeroCaixa: 1, valorAbertura: '', observacao: '' })";
const newFormCaixaState = "const [formCaixa, setFormCaixa] = useState({ numeroCaixa: 1, valorAbertura: '', observacao: '', dataAbertura: '' })";
code = code.replace(oldFormCaixaState, newFormCaixaState);

const oldAbrirCaixa = `  function abrirCaixa(event) {
    event.preventDefault()
    if (!window.confirm(\`Confirmar abertura do caixa \${formCaixa.numeroCaixa} para \${fmtDateOnly(data)}?\`)) return
    onOpenCaixa({ ...formCaixa, numeroCaixa: Number(formCaixa.numeroCaixa), valorAbertura: Number(formCaixa.valorAbertura || 0), dataOperacao: \`\${data}T12:00:00.000Z\`, confirmado: true })
  }`;

const newAbrirCaixa = `  function abrirCaixa(event) {
    event.preventDefault()
    if (!window.confirm(\`Confirmar abertura do caixa \${formCaixa.numeroCaixa}?\`)) return
    let customDate = \`\${data}T12:00:00.000Z\`;
    if (formCaixa.dataAbertura) {
      customDate = new Date(formCaixa.dataAbertura).toISOString();
    }
    onOpenCaixa({ ...formCaixa, numeroCaixa: Number(formCaixa.numeroCaixa), valorAbertura: Number(formCaixa.valorAbertura || 0), dataOperacao: customDate, abertoEm: formCaixa.dataAbertura ? customDate : undefined, confirmado: true })
  }`;
code = code.replace(oldAbrirCaixa, newAbrirCaixa);

const oldFormCaixaUI = `<form onSubmit={abrirCaixa} style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <label><span style={{ display: 'block', color: 'var(--muted)', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Número do caixa</span><input type="number" min="1" value={formCaixa.numeroCaixa} onChange={(event) => setFormCaixa((atual) => ({ ...atual, numeroCaixa: event.target.value }))} style={inputStyle} /></label>
        <label><span style={{ display: 'block', color: 'var(--muted)', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Fundo de abertura (R$)</span><input type="number" min="0" step="0.01" value={formCaixa.valorAbertura} onChange={(event) => setFormCaixa((atual) => ({ ...atual, valorAbertura: event.target.value }))} style={inputStyle} /></label>
        <label><span style={{ display: 'block', color: 'var(--muted)', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Observação</span><input value={formCaixa.observacao} onChange={(event) => setFormCaixa((atual) => ({ ...atual, observacao: event.target.value }))} style={inputStyle} placeholder="Ex.: turno da manhã" /></label>
        <button type="submit" disabled={salvando} style={{ ...primary, gridColumn: '1 / -1' }}>Confirmar abertura</button>
      </form>`;

const newFormCaixaUI = `<form onSubmit={abrirCaixa} style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <label><span style={{ display: 'block', color: 'var(--muted)', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Número do caixa</span><input type="number" min="1" value={formCaixa.numeroCaixa} onChange={(event) => setFormCaixa((atual) => ({ ...atual, numeroCaixa: event.target.value }))} style={inputStyle} /></label>
        <label><span style={{ display: 'block', color: 'var(--muted)', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Fundo de abertura (R$)</span><input type="number" min="0" step="0.01" value={formCaixa.valorAbertura} onChange={(event) => setFormCaixa((atual) => ({ ...atual, valorAbertura: event.target.value }))} style={inputStyle} /></label>
        <label><span style={{ display: 'block', color: 'var(--muted)', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Data/Hora de abertura</span><input type="datetime-local" value={formCaixa.dataAbertura} onChange={(event) => setFormCaixa((atual) => ({ ...atual, dataAbertura: event.target.value }))} style={inputStyle} /></label>
        <label><span style={{ display: 'block', color: 'var(--muted)', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Observação</span><input value={formCaixa.observacao} onChange={(event) => setFormCaixa((atual) => ({ ...atual, observacao: event.target.value }))} style={inputStyle} placeholder="Ex.: turno da manhã" /></label>
        <button type="submit" disabled={salvando} style={{ ...primary, gridColumn: '1 / -1' }}>Confirmar abertura</button>
      </form>`;

code = code.replace(oldFormCaixaUI, newFormCaixaUI);
fs.writeFileSync('/home/ubuntu/agro-open/web/src/pages/admin/BarbeariaOperacaoPanel.jsx', code, 'utf8');
console.log('Patched Caixa');
