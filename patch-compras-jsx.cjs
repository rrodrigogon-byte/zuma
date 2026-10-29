const fs = require('fs');
let code = fs.readFileSync('/home/ubuntu/agro-open/web/src/pages/admin/Compras.jsx', 'utf8');

// Adiciona import do useRef
if (!code.includes('useRef')) {
  code = code.replace("import { useState, useEffect, useCallback } from 'react'", "import { useState, useEffect, useCallback, useRef } from 'react'");
}

// Adiciona estado de IA
const extraState = `
  const [importandoIA, setImportandoIA] = useState(false)
  const fileInputRef = useRef(null)

  const handleImportNF = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImportandoIA(true);
    toast('Analisando a Nota Fiscal com Inteligência Artificial... isso pode levar alguns segundos.', 'info');
    
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Data = reader.result.split(',')[1];
        const isXml = file.name.toLowerCase().endsWith('.xml');
        
        try {
          const res = await api.post('/api/v1/compras/importar-nf', {
            base64: base64Data,
            mimeType: file.type || 'application/octet-stream',
            isXml
          });
          
          if (res.sucesso) {
            toast(\`Nota Fiscal importada! \${res.result.itensImportados} itens registrados e lançados no estoque.\`, 'success');
            carregar();
          } else {
            toast(res.erro || 'Falha ao processar nota.', 'error');
          }
        } catch (err) {
          toast(err.message || 'Erro ao comunicar com a IA.', 'error');
        } finally {
          setImportandoIA(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
    } catch (err) {
      toast('Falha ao ler arquivo', 'error');
      setImportandoIA(false);
    }
  }
`;

code = code.replace("useEffect(() => { carregar() }, [carregar])", extraState + "\n  useEffect(() => { carregar() }, [carregar])");

// Adiciona botão na tab de Pedidos
const btnHtml = `
            <input type="file" accept=".xml, .pdf, image/*" style={{ display: 'none' }} ref={fileInputRef} onChange={handleImportNF} />
            <button className="btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={importandoIA}>
              {importandoIA ? 'Analisando NF...' : 'Importar NF (XML/PDF/Img)'}
            </button>
`;

code = code.replace('<button className="btn-primary" onClick={() => {', btnHtml + '\n            <button className="btn-primary" onClick={() => {');

fs.writeFileSync('/home/ubuntu/agro-open/web/src/pages/admin/Compras.jsx', code);
console.log('Compras.jsx atualizado com botão de importar NF.');
