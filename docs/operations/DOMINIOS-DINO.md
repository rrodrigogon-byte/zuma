# Domínios próprios da Dino

| Domínio | O que abre |
|---|---|
| `dinobarbearia.com.br` (e `www.`) | Agendamento online (`/agendar/dino`); também servem `/minha/dino`, `/barbeiro/dino` e `/avaliar/dino` |
| `dinoperfumaria.com.br` (e `www.`) | Loja da Dino (`/perfumaria/dino`) e checkout (`/checkout/dino`) |
| `dino.kytto.com.br` | Continua no ar: pagamentos (InfinitePay) e links antigos apontam para ele |

## Ativação (uma vez)

1. **Render** → serviço `setpoint` → Settings → Custom Domains → *Add Custom Domain*:
   `dinobarbearia.com.br` e `dinoperfumaria.com.br` (o Render cria o `www.` com redirecionamento).
2. **registro.br** → cada domínio → *DNS* → *Editar zona* (mantenha registros de e-mail/MX existentes):
   - `@` tipo **A** → `216.24.57.1`
   - `www` tipo **CNAME** → `setpoint-tm5n.onrender.com`
3. Volte ao Render e clique em *Verify* nos dois domínios; aguarde o certificado ("Certificate issued").
4. Com o certificado emitido, defina no Environment do `setpoint`:
   `DINO_PUBLIC_URL=https://dinobarbearia.com.br` — os links de avaliação e agendamento enviados
   pelo WhatsApp passam a usar o domínio da barbearia.

O código só reconhece estes nomes exatos (lista em `web/src/lib/dominios-dino.js` e
`DOMINIOS_OFICIAIS_DINO` em `app/core/barbershop-appointment-notifications.js`).
