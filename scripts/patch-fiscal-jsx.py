with open('web/src/pages/admin/fiscal/Fiscal.jsx', 'r', encoding='utf8') as f:
    code = f.read()

# 1. Imports
imports = """import IcmsStTab from './IcmsStTab'
import MdeTab from './MdeTab'
import BoletosTab from './BoletosTab'
"""

if 'IcmsStTab' not in code:
    code = code.replace("import ClassificacaoFiscal from './ClassificacaoFiscal'", "import ClassificacaoFiscal from './ClassificacaoFiscal'\n" + imports)

# 2. ABAS
old_abas = "['sped', 'SPED'], ['contador', 'Fechamento Contábil']]"
new_abas = "['sped', 'SPED'], ['contador', 'Fechamento Contábil'], ['icms_st', 'ICMS-ST (MT)'], ['mde', 'Manifestação (MD-e)'], ['boletos', 'Boletos & Pix Híbrido']]"
code = code.replace(old_abas, new_abas)

# 3. Renderização
old_render = "{aba === 'contador' && <Contador toast={toast} />}"
new_render = """{aba === 'contador' && <Contador toast={toast} />}
    {aba === 'icms_st' && <IcmsStTab toast={toast} />}
    {aba === 'mde' && <MdeTab toast={toast} />}
    {aba === 'boletos' && <BoletosTab toast={toast} />}"""
code = code.replace(old_render, new_render)

with open('web/src/pages/admin/fiscal/Fiscal.jsx', 'w', encoding='utf8') as f:
    f.write(code)

print('Fiscal.jsx atualizado com sucesso!')
