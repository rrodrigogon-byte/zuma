# App do barbeiro (Dino Equipe) e PWA no iPhone e no Android

O app da equipe fica em `https://dino.kytto.com.br/barbeiro/dino`. É uma página do próprio sistema que pode ser instalada na Tela de Início do celular (PWA). Nada vai para a App Store ou para a Play Store; não há loja de aplicativos envolvida.

## O que o profissional faz no app

- **Agenda do dia:** vê só a própria agenda (ontem, hoje, amanhã ou qualquer data), com o próximo cliente em destaque e os bloqueios do dia.
- **Atendimento:**
  - confirmar, iniciar, concluir, marcar "não veio" ou cancelar;
  - ao concluir, o pagamento continua sendo recebido no caixa;
  - ligar ou chamar o cliente no WhatsApp com um toque.
- **Encaixe:** cria um atendimento na hora, com a opção "Já vou atender agora".
- **Bloquear horário:** almoço, pausa, compromisso ou folga. Os clientes não conseguem agendar nesse intervalo.
- **Comissão:** do dia e do mês, com as mesmas regras da tela de Comissões.
- **Avisos no celular:** agendamento novo, remarcado ou cancelado.
- **Sem internet:** mostra a última agenda carregada, com o aviso "Sem internet". As ações voltam quando a conexão volta.

A gestão (admin, organizador ou gerente) usa o mesmo app e escolhe qualquer profissional na lista. No admin, o botão **App do barbeiro** fica ao lado de "Atender agora".

## Ligar cada profissional ao login

1. Crie um login para o profissional com o perfil **equipe** (`staff`), usando o e-mail dele.
2. Em **Catálogo e equipe → Profissionais**, edite o profissional. No campo **E-mail do login (Modo barbeiro)**, coloque **o mesmo e-mail**.
3. Pronto: ao entrar em `/barbeiro/dino`, ele vê a própria agenda.

Sem o vínculo, o app mostra a orientação "peça à gestão para colocar o seu e-mail…". Um profissional nunca vê a agenda de outro, mesmo que tente pela URL.

## Instalar no celular

| Aparelho | Como instalar |
|---|---|
| Android (Chrome, Edge, Samsung Internet) | Abra o link e toque em **Instalar app** no cartão da página. Se o cartão não aparecer, use o menu ⋮ → **Instalar app**. |
| iPhone e iPad (Safari) | Abra o link, toque em **Compartilhar** → **Adicionar à Tela de Início** → **Adicionar**. |

Depois de instalado, o app abre em tela cheia, com:
- ícone **Dino Equipe**;
- tela de abertura da Dino;
- barra de status escura;
- conteúdo respeitando o notch.

O app do cliente (`/minha/dino`) também ganhou ícone de iPhone, tela de abertura, ícone adaptável do Android e o passo a passo de instalação no iPhone.

## Ligar os avisos no celular (push)

Os avisos usam o padrão Web Push e precisam de um par de chaves VAPID. A chave privada é um segredo: ela fica só no Render.

1. Gere as chaves num computador com Node, uma vez só:

   ```
   npx web-push generate-vapid-keys
   ```

2. No Render, serviço `setpoint`, aba Environment, acrescente as três variáveis:

   | Variável | Valor |
   |---|---|
   | `VAPID_PUBLIC_KEY` | a chave pública gerada |
   | `VAPID_PRIVATE_KEY` | a chave privada gerada (segredo) |
   | `VAPID_SUBJECT` | `mailto:` + o e-mail de contato da Dino |

3. No app, cada profissional toca em **Ligar avisos** e depois em **Enviar teste**. A gestão pode escolher **Ligar para toda a equipe**.

Limites:
- **iPhone:** os avisos só funcionam com o app **instalado na Tela de Início**, no iOS 16.4 ou mais novo. No Safari comum, o app avisa que é preciso instalar.
- **Bloqueio:** se o profissional bloquear as notificações, ele precisa liberar nas configurações do aparelho.
- **Sem as chaves VAPID:** o cartão mostra "ainda não foram ligados pela administração" e nada é enviado.

Segurança e privacidade:
- **Conteúdo:** o aviso leva o primeiro nome do cliente, o horário e o serviço, nunca o telefone, e vai cifrado de ponta a ponta.
- **Destino:** o servidor só envia para os serviços oficiais de push (Google, Apple, Mozilla, Microsoft).
- **Assinaturas:** as expiradas são apagadas sozinhas, com limite de 6 aparelhos por login.
- **Agenda guardada para uso sem internet:** fica só no aparelho, separada por login, e é apagada ao tocar em **Sair** ou quando a sessão expira.

## Admin no celular

O painel administrativo continua funcionando no celular:
- as grades se ajustam à largura da tela, sem rolagem lateral da página;
- as tabelas largas rolam dentro do próprio quadro;
- o conteúdo começa abaixo do botão de menu.

Para o dia a dia do profissional, prefira o app do barbeiro, feito para o celular.
