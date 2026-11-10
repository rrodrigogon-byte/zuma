with open('app/core/nfse-nacional.js', 'r', encoding='utf8') as f:
    c = f.read()

c = c.replace("export const VERSAO_DPS = '1.01';", "export const VERSAO_DPS = '1.00';")
c = c.replace("<serie>${Number(cfg.serie)}</serie>", "<serie>${String(cfg.serie || '1').padStart(5, '0')}</serie>")

with open('app/core/nfse-nacional.js', 'w', encoding='utf8') as f:
    f.write(c)

print('app/core/nfse-nacional.js atualizado com sucesso!')
