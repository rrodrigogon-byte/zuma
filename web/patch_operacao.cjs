const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/BarbeariaERP.jsx', 'utf8');

const datePicker = `
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--card)', padding: '12px 20px', borderRadius: 12, border: '1px solid var(--line)', marginBottom: 5 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>Data da Operação:</span>
          <strong style={{ fontSize: 16 }}>{fmtDateOnly(dataSelecionada)}</strong>
          <input
            aria-label="Escolher data operacional"
            type="date"
            value={dataSelecionada}
            onChange={(event) =>
              event.target.value && setDataSelecionada(event.target.value)
            }
            style={{ ...styles.compactDate, marginLeft: 10 }}
          />
        </div>
`;

code = code.replace(
  '<div style={{ display: "grid", gap: 20 }}>\n        <BarbeariaComandasAbertas',
  '<div style={{ display: "grid", gap: 20 }}>\n' + datePicker + '        <BarbeariaComandasAbertas'
);

fs.writeFileSync('src/pages/admin/BarbeariaERP.jsx', code);
