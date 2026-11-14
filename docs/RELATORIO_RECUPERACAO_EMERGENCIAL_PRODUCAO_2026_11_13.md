# RELATÓRIO TÉCNICO DE GESTÃO DE INCIDENTE & RECUPERAÇÃO EMERGENCIAL EM PRODUÇÃO

**Data e Hora do Incidente:** 13 de Novembro de 2026 – 15:30 às 16:05 (Horário de Cuiabá/MT)  
**Ambiente Afetado:** Produção (PRD) — [https://kytto.com.br/](https://kytto.com.br/) e [https://setpoint.kytto.com.br/](https://setpoint.kytto.com.br/)  
**Severidade:** P0 (Crítica — Interrupção da rota raiz e desvio indevido de tráfego)  
**Status do Incidente:** **100% RESOLVIDO & EM OPERAÇÃO NORMAL (HTTP 200 OK)**  
**Responsável Técnico:** Rodrigo Ribeiro / Equipe de Engenharia Kytto & SetPoint  

---

## 1. Sumário Executivo

Na tarde do dia 13/11/2026, foi identificado um comportamento anômalo crítico em que o acesso ao domínio principal `https://kytto.com.br/` apresentava a interface da **"Torre de Controle"** (módulo industrial de pesagem rodoviária 80t Toledo Prix da Serrano Concreto), impedindo que os usuários acessassem a Landing Page institucional, o Portal de Login e os demais sistemas da plataforma (ERP Barbearia Dino, Financeiro, Pizzaria Palatare, Varejo e Concreto).

Foi acionado imediatamente o protocolo de emergência P0. O diagnóstico apontou como causas raízes:
1. **Contaminação de Cache do Service Worker PWA:** O Service Worker legado interceptava a rota raiz `'/'` com estratégia de cache offline e armazenou estáticos HTML secundários gerados em commits industriais.
2. **Ausência de Headers Rígidos Anti-Cache em HTMLs:** Os arquivos `.html` estáticos e o próprio Service Worker não possuíam cabeçalhos `Cache-Control: no-store, no-cache, must-revalidate` explícitos nas respostas do Express.js, fazendo com que navegadores e o proxy da CDN mantivessem versões cacheadas.
3. **Falta de Redirecionamento Contextual para Usuários Autenticados:** Ao acessar a rota raiz, usuários com sessão ativa no navegador não eram roteados de forma determinística para o painel de seu perfil (`/admin`, `/pdv` ou `/meu-painel`).

Todas as causas raízes foram sanadas através de engenharia definitiva, purga forçada de cache (Service Worker v12 com ciclo `skipWaiting` e `clients.claim`), proteção de rota e recompilação completa dos bundles de produção. A normalidade de 100% dos serviços foi restabelecida e auditada em produção.

---

## 2. Diagnóstico & Causa Raiz Detalhada

### 2.1. Contaminação no Service Worker PWA (`service-worker.js` e `sw.js`)
O Service Worker instalado nos navegadores dos usuários escutava o evento `fetch` e continha rotinas de cache genéricas para requisições de navegação (`event.request.mode === 'navigate'`). Durante o deploy do módulo da Serrano Concreto, o arquivo `torre-pesagem.html` foi carregado em requisições de teste e acabou registrado como cache offline do shell da aplicação. Como o Service Worker intercepta o navegador antes mesmo da requisição chegar à rede, qualquer recarregamento da home (`/`) servia o HTML da balança do cache local.

### 2.2. Cabeçalhos HTTP de Cache Estático no Express (`app/server.js`)
O middleware `setStaticCacheHeaders` atribuía cache padrão para arquivos na raiz pública. Sem `no-store, no-cache` explícito para `index.html`, `torre-pesagem.html` e `service-worker.js`, o navegador não validava se havia uma versão mais recente na origem.

### 2.3. Resiliência do Health Check de Produção (`/health`)
O endpoint `/health` executava verificações síncronas pesadas em múltiplas tabelas do banco relacional de telemetria. Durante oscilações momentâneas de conexão (como reciclagem de memória do banco), o endpoint retornava 503, levando o balanceador de carga do Render a emitir 502 Bad Gateway transitório.

---

## 3. Ações Corretivas Implementadas & Blindagem

### 3.1. Purga Total de Caches no Service Worker (Versão v12)
Foi implementada uma nova versão canônica do Service Worker (`kytto-pwa-v12-recovery-purge`) em `web/public/service-worker.js` e `app/public/service-worker.js`:
- **Exclusão de Caches Legados:** Na ativação (`activate`), todos os caches de versões anteriores (`kytto-pwa-*`) são deletados sumariamente (`caches.delete()`).
- **Assunção Imediata de Controle:** Uso obrigatório de `self.skipWaiting()` na instalação e `clients.claim()` na ativação, forçando todos os navegadores com abas abertas a assumirem o novo Service Worker sem necessidade de fechar o browser.
- **Isolamento Rígido de Arquivos HTML:** Regra estrita determinando que NENHUM arquivo `.html` secundário (como `torre-pesagem.html`) possa ser armazenado no cache shell.
- **Estratégia Network-First com Purga Dinâmica:** Requisições de navegação sempre buscam a rede primeiro (`network-first`). Se o status retornado for 200, valida a rota antes de qualquer cache.

### 3.2. Script Preventivo no Boot do Frontend (`web/src/main.jsx`)
Adicionada rotina de saneamento executada antes do React montar o DOM:
```javascript
// Purga preventiva de Service Workers antigos se houver desvio de rota
if ('caches' in window) {
  caches.keys().then(names => {
    names.forEach(name => {
      if (name.includes('kytto-pwa') && !name.includes('v12')) {
        caches.delete(name);
      }
    });
  });
}
```

### 3.3. Roteamento Inteligente na Rota Raiz (`web/src/App.jsx`)
A função `EntradaPrincipal` foi aprimorada:
- Usuários autenticados no ERP são redirecionados automaticamente para `/admin`, `/pdv` ou `/meu-painel`.
- O subdomínio `setpoint.kytto.com.br` direciona diretamente para a tela de Login/Admin da plataforma.
- A rota raiz pública `kytto.com.br/` renderiza exclusivamente a Landing Page institucional oficial.

### 3.4. Headers HTTP Anti-Cache no Servidor (`app/server.js`)
Configurados cabeçalhos de controle estrito:
```javascript
if (fileName === 'index.html' || fileName.endsWith('.html') || fileName.includes('service-worker')) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}
```

### 3.5. Isolamento e Meta Tags na Torre de Pesagem (`torre-pesagem.html`)
Adicionadas tags no cabeçalho de `torre-pesagem.html`:
```html
<meta name="robots" content="noindex, nofollow">
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
<meta http-equiv="Pragma" content="no-cache">
<meta http-equiv="Expires" content="0">
```
Acessível exclusivamente via URL direta ou aba específica do ERP da ConcretoUsina (`/admin/concreto`).

---

## 4. Validação e Evidências em Produção

Após o deploy live bem-sucedido no Render (serviço `setpoint`, commit `dc07ba7ddf` integrado com `8f80800a1`), todos os testes foram executados com ferramentas de inspeção HTTP e navegador Chromium headless real:

| Rota / Endpoint | Status HTTP | Comportamento Observado |
|---|---|---|
| `https://kytto.com.br/` | **HTTP/2 200 OK** | Landing Page institucional Kytto ("O negócio sobe quando a operação aprende") |
| `https://kytto.com.br/health` | **HTTP/2 200 OK** | Sistema 100% pronto (`status: "ready"`, persistência e workers ativos) |
| `https://kytto.com.br/login` | **HTTP/2 200 OK** | Tela oficial de autenticação Kytto (Acesso Plataforma / Portal do Cliente) |
| `https://kytto.com.br/admin` | **HTTP/2 200 OK** | Roteamento seguro: login para visitantes e painel para credenciados |
| `https://kytto.com.br/agendar/dino` | **HTTP/2 200 OK** | Agendamento online da Barbearia Dino com catálogo de cortes e barbas |
| `https://kytto.com.br/sorteios/dino` | **HTTP/2 200 OK** | Portal público de Sorteios da Barbearia Dino com apuração criptográfica SHA-256 |
| `https://kytto.com.br/torre-pesagem.html` | **HTTP/2 200 OK** | Módulo de pesagem 80t devidamente isolado sem interceptar outras páginas |

Todos os 138 testes automatizados da suíte (`npm run test:fast`) foram executados com 100% de sucesso (138 aprovados, 0 falhas).

---

## 5. Instruções para Usuários e Clientes Finais

Como o Service Worker v12 já possui lógica de auto-atualização forçada (`skipWaiting` e `clients.claim`), a grande maioria dos navegadores atualizará de forma transparente no próximo acesso.

Caso algum usuário ainda visualize a tela antiga devido a cache agressivo no navegador local dele, a orientação é:
1. Pressionar **`Ctrl + F5`** (ou **`Cmd + Shift + R`** no Mac) na página inicial para forçar recarregamento limpo.
2. Ou fechar a aba e abrir novamente em **[https://kytto.com.br/](https://kytto.com.br/)**.

**Conclusão:** O incidente está completamente mitigado, os sistemas estão estáveis, seguros e operando com alta performance em produção.
