with open('app/core/whatsapp-ai.js', 'r', encoding='utf8') as f:
    c = f.read()

target = "/^(confirmo|confirmado|confirmada|"
replacement = "/^(confirmo|confirmando|confirmado|confirmada|"

assert target in c, "target regex não encontrada em whatsapp-ai.js!"
c = c.replace(target, replacement, 1)

with open('app/core/whatsapp-ai.js', 'w', encoding='utf8') as f:
    f.write(c)

print("confirmando adicionado a presenceConfirmIntent com sucesso!")
