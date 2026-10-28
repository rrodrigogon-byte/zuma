const fs = require('fs');
const file = '/home/ubuntu/agro-open/web/src/pages/admin/relatorios/dino/RelatorioDinamico.jsx';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes("import { apiFetch }")) {
  code = code.replace("import { todosRelatorios }", "import { apiFetch } from '../../../../lib/api';\nimport { todosRelatorios }");
}

const mockReplaceStr = `
  const [loading, setLoading] = useState(true);
  const [historicoData, setHistoricoData] = useState([]);
  
  useEffect(() => {
    if (!relatorio) return;
    setLoading(true);
    // Fetch generic history
    apiFetch(\`/api/admin/barbearia/historico?de=\${dataAnaliseInicio}&ate=\${dataAnaliseFim}&limite=5000\`)
      .then(res => {
        if (res.ok) setHistoricoData(res.itens || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [relatorio, dataAnaliseInicio, dataAnaliseFim]);

  if (!relatorio) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Carregando relatório...</div>;
  }

  // Mapear histórico baseado na categoria
  let mockData = [];
  if (historicoData.length > 0) {
    if (relatorio.categoria === 'Clientes') {
      mockData = historicoData.map(item => [
        item.clienteNome || 'Desconhecido',
        item.clienteTelefone || '-',
        '-',
        new Date(item.dataAgenda || item.dataOriginal || item.dataHora).toLocaleDateString('pt-BR'),
        'R$ ' + Number(item.valor || 0).toFixed(2),
        'Ver'
      ]);
    } else if (relatorio.categoria === 'Financeiro' || relatorio.categoria === 'Caixas') {
      mockData = historicoData.map(item => [
        new Date(item.dataAgenda || item.dataOriginal || item.dataHora).toLocaleDateString('pt-BR'),
        item.id.slice(0,8),
        item.servicoNome || 'Serviço',
        'R$ ' + Number(item.valor || 0).toFixed(2),
        '-',
        item.status
      ]);
    } else if (relatorio.categoria === 'Profissionais') {
      mockData = historicoData.map(item => [
        item.profissionalNome || 'Desconhecido',
        item.servicoNome || '-',
        '-',
        '-',
        'R$ ' + Number(item.valor || 0).toFixed(2),
        'Ver'
      ]);
    } else {
      mockData = historicoData.map(item => [
        item.id.slice(0,8),
        new Date(item.dataAgenda || item.dataOriginal || item.dataHora).toLocaleDateString('pt-BR'),
        item.servicoNome || '-',
        'R$ ' + Number(item.valor || 0).toFixed(2),
        item.status,
        'Ver'
      ]);
    }
  } else if (!loading) {
    mockData = [['Nenhum dado encontrado para o período', '-', '-', '-', '-', '-']];
  }
`;

code = code.replace(/if \(\!relatorio\) \{[\s\S]*?Carregando relatório\.\.\.<\/div>;\n  \}/, mockReplaceStr);
code = code.replace(/\/\/ Gera dados mockados[\s\S]*?\}\);/, "");

fs.writeFileSync(file, code, 'utf8');
console.log('Patched');
