with open('web/src/pages/admin/dino/FinanceiroEmpresa.jsx', 'r', encoding='utf8') as f:
    code = f.read()

# 1. Adicionar import
old_import = "import '../customer360.css'"
new_import = "import ConciliacaoBancariaTab from '../financeiro/ConciliacaoBancariaTab'\nimport '../customer360.css'"
code = code.replace(old_import, new_import, 1)

# 2. Adicionar botão da aba
target_btn = """            <button
              type="button"
              className={`c360-btn ${abaAnalitica === 'dre' ? 'primary' : 'ghost'}`}
              style={{ fontSize: 12, padding: '5px 10px' }}
              onClick={() => setAbaAnalitica('dre')}
            >
              📑 DRE Gerencial
            </button>"""

new_btn = """            <button
              type="button"
              className={`c360-btn ${abaAnalitica === 'dre' ? 'primary' : 'ghost'}`}
              style={{ fontSize: 12, padding: '5px 10px' }}
              onClick={() => setAbaAnalitica('dre')}
            >
              📑 DRE Gerencial
            </button>
            <button
              type="button"
              className={`c360-btn ${abaAnalitica === 'conciliacao' ? 'primary' : 'ghost'}`}
              style={{ fontSize: 12, padding: '5px 10px' }}
              onClick={() => setAbaAnalitica('conciliacao')}
            >
              🏦 Conciliação Bancária OFX
            </button>"""

code = code.replace(target_btn, new_btn, 1)

# 3. Adicionar texto explicativo
target_txt = "{abaAnalitica === 'dre' && 'Demonstrativo contábil gerencial'}"
new_txt = "{abaAnalitica === 'dre' && 'Demonstrativo contábil gerencial'}\n            {abaAnalitica === 'conciliacao' && 'Importação de extratos OFX e conciliação bancária inteligente'}"
code = code.replace(target_txt, new_txt, 1)

# 4. Renderizar a aba
target_render = """        {abaAnalitica === 'dre' && (
          <DreGerencialPanel dre={dre} mes={mesDre} onMesChange={setMesDre} onFilterCategoria={handleSelectCategoriaFiltro} />
        )}"""

new_render = """        {abaAnalitica === 'dre' && (
          <DreGerencialPanel dre={dre} mes={mesDre} onMesChange={setMesDre} onFilterCategoria={handleSelectCategoriaFiltro} />
        )}

        {abaAnalitica === 'conciliacao' && (
          <div style={{ marginTop: 12 }}>
            <ConciliacaoBancariaTab onAtualizarFinanceiro={load} />
          </div>
        )}"""

code = code.replace(target_render, new_render, 1)

with open('web/src/pages/admin/dino/FinanceiroEmpresa.jsx', 'w', encoding='utf8') as f:
    f.write(code)

print("FinanceiroEmpresa.jsx atualizado com sucesso!")
