# Manual Operacional & Técnico: Aplicativo PWA e APK de Assinatura Digital e Coleta de Fotos em Campo
## Serrano Concreto Usinado & Mineração LTDA · Grupo Palatare Participações S/A
### Plataforma Kytto ERP Industrial · Conformidade Normativa ABNT NBR 7212, NBR 12655 e NBR 8953

---

### 1. Visão Geral e Arquitetura da Solução

O recebimento de concreto usinado em canteiro de obras exige rastreabilidade rigorosa de consistência, tempo de transporte e integridade documental. Historicamente, os canhotos físicos em papel sofriam com perdas, rasuras, umidade da obra e ausência de comprovação visual sobre as condições reais em que o caminhão betoneira descarregou na forma ou bomba lanceira.

Para solucionar esse desafio e garantir segurança jurídica total para a usina e para as construtoras clientes, foi desenvolvida uma solução móvel de campo híbrida composta por:
1. **Aplicativo Web Progressivo (PWA)** acessível diretamente nos navegadores móveis em `https://kytto.com.br/concreto/app` e instalável na tela inicial com um toque, operando em modo standalone em qualquer smartphone (Android e iOS).
2. **Pacote APK Android Nativo (`Serrano-Concreto-Campo.apk`)** disponível para download direto em `https://kytto.com.br/api/public/concreto/download-apk`, permitindo instalação facilitada em smartphones corporativos da frota e aparelhos dos motoristas da Serrano.
3. **Módulo de Gestão no ERP Industrial** em `https://kytto.com.br/admin/concreto?secao=app-campo-assinatura`, permitindo que os operadores de balança, despachantes e laboratoristas acompanhem em tempo real o status de cada carga, gerem QR Codes individuais por viagem e visualizem os canhotos digitais com fotos e assinaturas.

---

### 2. Fluxo Operacional de Entrega e Validação em Campo

O ciclo operacional foi projetado para exigir zero atrito da equipe de campo e garantir conformidade com as normas ABNT:

#### Passo 1: Expedição na Usina e Geração do QR Code
Antes de a betoneira deixar a balança rodoviária 80t Toledo na Rodovia MT-358 km 08 em Tangará da Serra/MT, o operador da expedição pode apontar para a tela do ERP e exibir o QR Code exclusivo da carga. Ao escanear o QR Code com a câmera do celular, o motorista abre o app de campo já posicionado na carga correta, sem precisar digitar senhas complexas.

#### Passo 2: Monitoramento do Cronômetro de Pega NBR 7212
O aplicativo exibe o tempo transcorrido desde a adição de água na central dosadora até a chegada na obra. Conforme determina o item 5.4 da ABNT NBR 7212, o concreto deve ser totalmente descarregado em no máximo 150 minutos (2 horas e meia) a contar da primeira adição de água. O app alerta visualmente caso a viagem se aproxime desse limite operacional.

#### Passo 3: Coleta Obrigatória de Imagens de Validação
O aplicativo solicita a captura de duas fotografias em alta resolução diretamente pelo smartphone:
- **Foto do Slump Test (Tronco de Cone):** Registro visual do ensaio de abatimento realizado in-situ, confirmando se o concreto atende à consistência especificada no pedido (ex: 14 ± 2 cm).
- **Foto da Descarga na Forma / Bomba Lança:** Registro visual do lançamento da massa na estrutura (lajes, vigas, pilares ou piso industrial), comprovando que a usina entregou o produto no local e horário acordados.
- **Foto Opcional do Fiscal ou Comprovante Físico:** Quando a construtora exigir carimbo ou protocolo complementar de engenharia.

Todas as imagens recebem marca d'água digital com timestamp preciso e coordenadas geográficas da obra.

#### Passo 4: Registro Técnico e Isenção por Adição de Água
O recebedor ou motorista informa o abatimento medido (slump em centímetros) e o volume conferido (m³). Caso o cliente solicite a adição extemporânea de água na obra, o aplicativo aciona a chave normativa NBR 12655: o usuário deve informar a litragem adicionada e o app registra no canhoto o termo de isenção de responsabilidade técnica da Serrano sobre a resistência Fck final.

#### Passo 5: Assinatura Touch e Georreferenciamento GPS
O engenheiro residente, mestre de obras ou fiscal responsável assina diretamente na tela sensível ao toque (touch screen) do smartphone. Durante a assinatura, o aplicativo captura automaticamente a latitude, longitude e raio de precisão do GPS (`navigator.geolocation`), vinculando a assinatura à localização física exata do canteiro.

#### Passo 6: Emissão do Canhoto Digital e Envio por WhatsApp
Ao confirmar, o sistema gera o código de autenticidade no padrão `SERRANO-NBR7212-[HEX]` e calcula a chave criptográfica SHA-256. Instantaneamente, um botão dedicado permite disparar o canhoto oficial via WhatsApp para o telefone do engenheiro da construtora com o link do comprovante timbrado.

---

### 3. Especificação das Rotas de API e Endpoints

A integração do aplicativo de campo com o servidor Kytto opera através de rotas públicas protegidas por tokens de carga e chaves de validação:

| Método | Rota Pública | Descrição e Finalidade |
|---|---|---|
| `GET` | `/concreto/app` | Interface PWA móvel responsiva para smartphones e tablets de campo |
| `GET` | `/concreto/assinatura/:cargaId` | Acesso direto ao formulário de assinatura de uma carga específica |
| `GET` | `/manifest-concreto.json` | Manifesto PWA com ícones e tema corporativo da Serrano |
| `GET` | `/api/public/concreto/download-apk` | Download direto do instalador `Serrano-Concreto-Campo.apk` |
| `GET` | `/api/public/concreto/cargas-ativas` | Relação de cargas e betoneiras em trânsito no dia |
| `GET` | `/api/public/concreto/cargas/:id` | Detalhes técnicos da carga (traço, cliente, obra e motorista) |
| `POST` | `/api/public/concreto/cargas/:id/assinar-pwa` | Registro da assinatura touch, fotos, GPS e conferência |
| `POST` | `/api/public/concreto/cargas/:id/upload-foto` | Upload seguro e armazenamento de imagens de campo |
| `GET` | `/api/public/concreto/cargas/:id/canhoto-digital-html` | Romaneio timbrado NBR 7212 em HTML/PDF com fotos e assinatura |

---

### 4. Guia de Instalação do APK Android e PWA

#### Modo 1: Instalação PWA (Progressive Web App)
1. No navegador do smartphone (Chrome, Safari ou Edge), acesse `https://kytto.com.br/concreto/app`.
2. Toque no botão superior **"Instalar PWA"** ou abra as opções do navegador e selecione **"Adicionar à Tela Inicial"** ou **"Instalar Aplicativo"**.
3. O ícone da **Serrano Concreto** será adicionado à grade de aplicativos do celular, abrindo em tela cheia e sem barra de navegação, com acesso rápido à câmera e ao GPS.

#### Modo 2: Instalação via APK Android Nativo
1. Acesse o botão **"Baixar APK Android"** no topo da página ou utilize o link direto `https://kytto.com.br/api/public/concreto/download-apk`.
2. Ao concluir o download do arquivo `Serrano-Concreto-Campo.apk`, toque na notificação para abrir o instalador.
3. Caso solicitado pelo sistema Android, autorize a instalação de fontes confiáveis.
4. O app nativo será instalado no smartphone com permissões de armazenamento, câmera de alta resolução e geolocalização precisa.

---

### 5. Benefícios Operacionais e Jurídicos para a Serrano Concreto

- **Eliminação de Glosas e Contestação de Volume:** As fotografias anexas ao canhoto eletrônico comprovam que o caminhão descarregou o volume integral contratado.
- **Garantia de Qualidade Tecnológica:** O registro fotográfico do tronco de cone afasta dúvidas sobre a plasticidade e dosagem entregues na obra.
- **Proteção Jurídica contra Adição Indevida de Água:** O termo legal com registro de litragem anula discussões caso corpos de prova futuros apresentem desvios por excesso de água adicionada no canteiro.
- **Agilidade no Faturamento:** As notas fiscais e medições quinzenais podem ser emitidas imediatamente após a conclusão da descarga, sem aguardar o retorno físico dos canhotos de papel para a usina.
- **Transparência e Satisfação do Cliente:** O envio imediato do comprovante digital via WhatsApp estabelece um padrão de excelência corporativa para grandes construtoras e obras industriais do agronegócio no Mato Grosso.
