# Dino Equipe — app Android (Play Store)

App nativo Android do profissional, gerado a partir do app da equipe que já roda em
`https://dino.kytto.com.br/barbeiro/dino` (Trusted Web Activity). Abre em tela cheia,
recebe notificações e se atualiza sozinho a cada deploy, sem nova versão na loja.

## O que precisa uma única vez

1. **Chave de assinatura** (guarde em lugar seguro; perder a chave impede atualizar o app):
   `keytool -genkeypair -v -keystore dino-equipe.keystore -alias dino-equipe -keyalg RSA -keysize 2048 -validity 10000`
2. **Segredos no GitHub** (Settings → Secrets and variables → Actions):
   - `DINO_EQUIPE_KEYSTORE_B64`: o arquivo `.keystore` em base64 (`base64 -i dino-equipe.keystore`)
   - `DINO_EQUIPE_KEYSTORE_PASSWORD` e `DINO_EQUIPE_KEY_PASSWORD`: as senhas da chave
3. **Variáveis no Render** (serviço `setpoint`), para o Android confiar no site:
   - `ANDROID_TWA_PACKAGE=br.com.kytto.dinoequipe`
   - `ANDROID_TWA_SHA256=<impressão SHA-256 do certificado>` — `keytool -list -v -keystore dino-equipe.keystore -alias dino-equipe`
     (se usar a assinatura do Google Play, some também a impressão que o Play Console mostra, separadas por vírgula)
   Confira em `https://dino.kytto.com.br/.well-known/assetlinks.json`.

## Gerar o app

GitHub → Actions → **Dino Equipe Android** → Run workflow. O arquivo `.aab` (Play Store) e o
`.apk` (instalação direta para teste) ficam como artefatos da execução.

## Publicar

Play Console → criar app "Dino Equipe" → Teste interno → enviar o `.aab`. Para o iPhone, o app
continua instalável pelo Safari (Compartilhar → Adicionar à Tela de Início); a App Store exige
conta Apple Developer.
