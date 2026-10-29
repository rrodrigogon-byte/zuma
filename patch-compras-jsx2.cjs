const fs = require('fs');
let code = fs.readFileSync('/home/ubuntu/agro-open/web/src/pages/admin/Compras.jsx', 'utf8');

const extraLogic = `
  const [sincronizandoSEFAZ, setSincronizandoSEFAZ] = useState(false);

  const handleSincronizarSefaz = async () => {
    setSincronizandoSEFAZ(true);
    toast('Conectando ao webservice da SEFAZ Nacional... isso pode levar alguns segundos.', 'info');
    try {
      const res = await api.post('/api/v1/compras/sincronizar-sefaz');
      if (res.sucesso) {
        toast(\`Sincronização concluída! \${res.result.mensagem}\`, 'success');
        carregar();
      } else {
        toast(res.erro || 'Falha ao sincronizar com SEFAZ.', 'error');
      }
    } catch (err) {
      toast(err.message || 'Erro ao comunicar com o servidor.', 'error');
    } finally {
      setSincronizandoSEFAZ(false);
    }
  };
`;

code = code.replace("const handleImportNF = async (e) => {", extraLogic + "\n  const handleImportNF = async (e) => {");

const btnHtml = `
            <button className="btn-secondary" onClick={handleSincronizarSefaz} disabled={sincronizandoSEFAZ || importandoIA} style={{ marginLeft: 8 }}>
              {sincronizandoSEFAZ ? 'Buscando NFs na SEFAZ...' : 'Sincronizar NF-e (A1)'}
            </button>
`;

code = code.replace("</button>\n            <button className=\"btn-primary\"", "</button>\n" + btnHtml + "            <button className=\"btn-primary\"");

fs.writeFileSync('/home/ubuntu/agro-open/web/src/pages/admin/Compras.jsx', code);
console.log('Compras.jsx atualizado com botao da SEFAZ.');
