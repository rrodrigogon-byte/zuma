# Ativar a resposta em voz do T-Rex (Dino)

O T-Rex responde em **áudio gravado** quando o cliente fala por áudio ou pede resposta em áudio
("manda um áudio"). Sem qualquer um dos passos abaixo, ele continua respondendo em texto — nada quebra.

## 1. Google Cloud (conta rodrigo.goncalves@uisa.com.br)
1. Console → projeto escolhido para o Kytto → **APIs e serviços → Biblioteca → Cloud Text-to-Speech API → Ativar**.
2. **APIs e serviços → Credenciais → Criar credenciais → Chave de API**.
3. Na chave: **Restrições de API → Restringir chave → Cloud Text-to-Speech API**. Salvar.
   (Sem restrição de aplicativo: o Render não tem IP fixo.)
4. Custo: vozes Neural2 ~US$ 16 por 1 milhão de caracteres (1 milhão grátis por mês nas vozes WaveNet/Neural2).

## 2. Backend do WhatsApp (chatbot-backend-nestjs da Dino)
Subir a rota `POST /api/v1/whats-app/send-audio` de `integracoes/chatbot-backend-whatsapp-extras`
(mesmo módulo da figurinha; testes em `whatsapp-extras.spec.ts`). Contrato:

```
POST /api/v1/whats-app/send-audio
{ "instanceName": "dino", "chat_id": "5565999990001",
  "audio": { "base64": "<OGG/Opus>", "mimetype": "audio/ogg; codecs=opus" } }
→ 200 { "success": true, "messageId": "..." }
```

## 3. Render (serviço setpoint) → Environment
| Variável | Valor |
|---|---|
| `GOOGLE_TTS_API_KEY` | a chave do passo 1 |
| `CHATBOT_BACKEND_AUDIO_PATH` | `/send-audio` |
| `GOOGLE_TTS_VOICE` (opcional) | `pt-BR-Neural2-B` (padrão, masculina) ou outra voz pt-BR |
| `GOOGLE_TTS_RATE` (opcional) | `1.08` (padrão) |

Salvar faz o deploy. A partir daí, cliente que mandar áudio recebe a resposta em voz.

## Como conferir
Mande um áudio para o número do T-Rex. A resposta chega como áudio gravado. Se a chave ou a rota
falharem, o log mostra `[WhatsApp AI] áudio da resposta falhou, enviando texto` e o cliente recebe texto.
