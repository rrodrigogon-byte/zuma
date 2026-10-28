const fs = require('fs');
let code = fs.readFileSync('/home/ubuntu/agro-open/web/src/pages/admin/relatorios/dino/RelatoriosDinoIndex.jsx', 'utf8');

const banner = `
      <div style={{ ...styles.filtersCard, background: 'var(--card2)', borderLeft: '4px solid var(--accent)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Sparkles size={16} color="var(--accent)" /> Gestão de Desempenho Inteligente</h3>
        <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted)' }}>Compare entregas diárias/mensais por profissional, veja novas retenções, acompanhe as metas e receba recomendações geradas pela IA Dino T-Rex para aumentar o faturamento.</p>
        <Link to="/admin/relatorios/dino/gestao-avancada" style={{ ...styles.btnPrimary, marginTop: '8px' }}>Acessar Painel IA</Link>
      </div>
`;

if (!code.includes("gestao-avancada")) {
  code = code.replace("<div style={styles.filtersCard}>", banner + "\n      <div style={styles.filtersCard}>");
  fs.writeFileSync('/home/ubuntu/agro-open/web/src/pages/admin/relatorios/dino/RelatoriosDinoIndex.jsx', code, 'utf8');
  console.log('RelatoriosDinoIndex.jsx patched successfully');
}
