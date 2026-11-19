import fs from 'fs';

const indexPath = '/home/ubuntu/agro-open-live/app/public/zuma/index.html';
let html = fs.readFileSync(indexPath, 'utf8');

// 1. Inserir botões de aba no sub-navbar
const navMarker = `<button onclick="switchTab('gestor-dre')" id="tab-btn-gestor-dre" class="tab-btn px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 whitespace-nowrap text-zuma-muted hover:text-white">
          <span>📊</span><span>Dashboard +250%</span>
        </button>`;

const newNavButtons = `${navMarker}
        <button onclick="switchTab('indique-ganhe')" id="tab-btn-indique-ganhe" class="tab-btn px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 whitespace-nowrap text-zuma-muted hover:text-white">
          <span>🎁</span><span>Indique &amp; Ganhe R$ 15</span>
        </button>
        <button onclick="switchTab('ofertas-vip')" id="tab-btn-ofertas-vip" class="tab-btn px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 whitespace-nowrap text-zuma-muted hover:text-white">
          <span>📢</span><span>Ofertas &amp; Cupons VIP</span>
        </button>
        <button onclick="switchTab('zuma-agro')" id="tab-btn-zuma-agro" class="tab-btn px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 whitespace-nowrap text-zuma-muted hover:text-white">
          <span>🌾</span><span>Zuma Agro B2B</span>
        </button>`;

if (!html.includes('id="tab-btn-indique-ganhe"')) {
  html = html.replace(navMarker, newNavButtons);
  console.log('✅ Botões de abas adicionados no sub-navbar');
}

// 2. Seções de conteúdo
const sectionsContent = `
    <!-- ================= ABA INDIQUE E GANHE (MEMBER GET MEMBER) ================= -->
    <section id="tab-indique-ganhe" class="tab-content hidden space-y-6">
      <div class="bg-gradient-to-r from-zuma-surface via-zuma-card to-zuma-surface p-6 sm:p-8 rounded-2xl border border-zuma-border relative overflow-hidden">
        <div class="max-w-3xl space-y-4">
          <div class="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <span>🎁</span><span>Programa Viral Zuma</span>
          </div>
          <h2 class="text-2xl sm:text-3xl font-black text-white">Indique um Amigo em Tangará e Ganhe 1 Temaki Completo!</h2>
          <p class="text-sm text-zuma-muted">Seu amigo ganha <strong class="text-white">R$ 15,00 de desconto</strong> no primeiro pedido pelo WhatsApp ou web, e você ganha <strong class="text-emerald-400">1 Temaki Salmão cortesia</strong> assim que o pedido dele for entregue!</p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Gerador de Cupom / Link -->
        <div class="bg-zuma-surface p-6 rounded-2xl border border-zuma-border space-y-4">
          <h3 class="text-base font-bold text-white flex items-center space-x-2">
            <span>🚀</span><span>Gere seu Link de Indicação</span>
          </h3>
          <p class="text-xs text-zuma-muted">Digite seu nome e receba na hora sua mensagem personalizada pronta para compartilhar com seus amigos de Tangará:</p>
          <div class="space-y-3">
            <div>
              <label class="block text-[11px] font-bold uppercase text-zuma-muted mb-1">Seu Nome</label>
              <input type="text" id="store-ind-nome" placeholder="Ex: Rodrigo Gonçalves" value="Rodrigo" class="w-full bg-zuma-card border border-zuma-border rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-zuma-salmon">
            </div>
            <button onclick="gerarLinkIndicacaoStore()" class="w-full py-3 bg-gradient-to-r from-zuma-salmon to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold rounded-xl text-xs shadow-lg transition-all flex items-center justify-center space-x-2">
              <span>⚡</span><span>Gerar Link e Mensagem de WhatsApp</span>
            </button>
          </div>

          <div id="store-ind-resultado" class="hidden space-y-3 p-4 bg-zuma-card rounded-xl border border-zuma-salmon/30">
            <div class="text-xs font-bold text-white">Seu Link Exclusivo:</div>
            <div id="store-ind-link" class="text-xs font-mono text-zuma-salmon break-all bg-zuma-surface p-2.5 rounded-lg border border-zuma-border"></div>
            <div class="flex space-x-2 pt-2">
              <button onclick="copiarLinkStore()" class="flex-1 py-2 bg-zuma-surface border border-zuma-border text-white hover:border-zuma-salmon rounded-lg text-xs font-bold">
                📋 Copiar Link
              </button>
              <button onclick="dispararWhatsAppStore()" class="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1">
                <span>💬</span><span>Compartilhar</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Como Funciona em 3 Passos -->
        <div class="bg-zuma-surface p-6 rounded-2xl border border-zuma-border space-y-4">
          <h3 class="text-base font-bold text-white flex items-center space-x-2">
            <span>✨</span><span>Como Funciona o Programa</span>
          </h3>
          <div class="space-y-4">
            <div class="flex items-start space-x-3">
              <span class="w-7 h-7 rounded-full bg-zuma-salmon/20 text-zuma-salmon font-black text-xs flex items-center justify-center shrink-0">1</span>
              <div>
                <b class="text-white text-xs block">Você envia o link para amigos</b>
                <p class="text-xs text-zuma-muted">Mande nos grupos de amigos, família ou trabalho em Tangará da Serra.</p>
              </div>
            </div>
            <div class="flex items-start space-x-3">
              <span class="w-7 h-7 rounded-full bg-zuma-gold/20 text-zuma-gold font-black text-xs flex items-center justify-center shrink-0">2</span>
              <div>
                <b class="text-white text-xs block">Seu amigo ganha R$ 15,00 OFF</b>
                <p class="text-xs text-zuma-muted">Desconto imediato no primeiro pedido acima de R$ 60,00.</p>
              </div>
            </div>
            <div class="flex items-start space-x-3">
              <span class="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 font-black text-xs flex items-center justify-center shrink-0">3</span>
              <div>
                <b class="text-white text-xs block">Você ganha 1 Temaki Completo Grátis!</b>
                <p class="text-xs text-zuma-muted">O Zumi envia seu cupom cortesia no WhatsApp assim que a entrega for feita.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ================= ABA OFERTAS & CUPONS VIP ================= -->
    <section id="tab-ofertas-vip" class="tab-content hidden space-y-6">
      <div class="bg-gradient-to-r from-zuma-surface via-zuma-card to-zuma-surface p-6 sm:p-8 rounded-2xl border border-zuma-border">
        <div class="max-w-3xl space-y-2">
          <span class="px-3 py-1 rounded-full bg-zuma-salmon/20 text-zuma-salmon text-xs font-bold uppercase tracking-wider">🔥 Descontos do Dia</span>
          <h2 class="text-2xl sm:text-3xl font-black text-white">Cupons Ativos &amp; Ofertas Relâmpago</h2>
          <p class="text-sm text-zuma-muted">Aproveite os cupons gerados pelo Motor KyttoIA 2.5 Flash para pedir pelo melhor preço de Tangará da Serra:</p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="bg-zuma-surface p-5 rounded-2xl border border-zuma-salmon/40 space-y-3 relative overflow-hidden">
          <div class="absolute top-2 right-2 px-2 py-0.5 bg-zuma-salmon text-white text-[10px] font-black rounded-full">PRIMEIRA COMPRA</div>
          <h4 class="text-base font-bold text-white">R$ 15,00 OFF no 1º Pedido</h4>
          <p class="text-xs text-zuma-muted">Válido para qualquer combinado ou pedido acima de R$ 60,00 no delivery ou salão.</p>
          <div class="bg-zuma-card p-3 rounded-xl border border-dashed border-zuma-border flex items-center justify-between">
            <span class="font-mono font-bold text-zuma-salmon text-sm">ZUMAPRIMAVERA15</span>
            <button onclick="copiarCupom('ZUMAPRIMAVERA15')" class="text-xs text-white bg-zuma-border px-2 py-1 rounded hover:bg-zuma-salmon">Copiar</button>
          </div>
        </div>

        <div class="bg-zuma-surface p-5 rounded-2xl border border-emerald-500/40 space-y-3 relative overflow-hidden">
          <div class="absolute top-2 right-2 px-2 py-0.5 bg-emerald-600 text-white text-[10px] font-black rounded-full">SEG A QUA</div>
          <h4 class="text-base font-bold text-white">Frete Grátis Tangará</h4>
          <p class="text-xs text-zuma-muted">Frete grátis em toda a cidade para pedidos acima de R$ 80,00 de segunda a quarta-feira.</p>
          <div class="bg-zuma-card p-3 rounded-xl border border-dashed border-zuma-border flex items-center justify-between">
            <span class="font-mono font-bold text-emerald-400 text-sm">FRETEZUMA</span>
            <button onclick="copiarCupom('FRETEZUMA')" class="text-xs text-white bg-zuma-border px-2 py-1 rounded hover:bg-emerald-600">Copiar</button>
          </div>
        </div>

        <div class="bg-zuma-surface p-5 rounded-2xl border border-zuma-gold/40 space-y-3 relative overflow-hidden">
          <div class="absolute top-2 right-2 px-2 py-0.5 bg-zuma-gold text-black text-[10px] font-black rounded-full">RODÍZIO / SALÃO</div>
          <h4 class="text-base font-bold text-white">10% OFF no Deck Climatizado</h4>
          <p class="text-xs text-zuma-muted">Ganhe 10% de desconto na consumação presencial no Deck da Av. Brasil 1605 S.</p>
          <div class="bg-zuma-card p-3 rounded-xl border border-dashed border-zuma-border flex items-center justify-between">
            <span class="font-mono font-bold text-zuma-gold text-sm">ZUMADECK10</span>
            <button onclick="copiarCupom('ZUMADECK10')" class="text-xs text-white bg-zuma-border px-2 py-1 rounded hover:bg-zuma-gold hover:text-black">Copiar</button>
          </div>
        </div>
      </div>
    </section>

    <!-- ================= ABA ZUMA AGRO B2B (CORPORATIVO) ================= -->
    <section id="tab-zuma-agro" class="tab-content hidden space-y-6">
      <div class="bg-gradient-to-r from-zuma-surface via-zuma-card to-zuma-surface p-6 sm:p-8 rounded-2xl border border-zuma-border">
        <div class="max-w-3xl space-y-3">
          <span class="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider">🌾 Almoço Executivo &amp; Diretoria</span>
          <h2 class="text-2xl sm:text-3xl font-black text-white">Zuma Agro &amp; Convênios Corporativos</h2>
          <p class="text-sm text-zuma-muted">Condições exclusivas para empresas, tradings, cooperativas de crédito e revendas de Tangará da Serra. Almoço executivo servido em até 12 minutos ou faturado quinzenalmente para reuniões.</p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="bg-zuma-surface p-6 rounded-2xl border border-zuma-border space-y-4">
          <h3 class="text-base font-bold text-white">🏢 Solicitar Convênio para sua Empresa</h3>
          <p class="text-xs text-zuma-muted">Preencha o formulário e receba a proposta corporativa gerada pelo Motor KyttoIA no seu WhatsApp em minutos:</p>
          <div class="space-y-3">
            <div>
              <label class="block text-[11px] font-bold uppercase text-zuma-muted mb-1">Nome da Empresa</label>
              <input type="text" id="store-b2b-empresa" placeholder="Ex: Revenda Agro Tangará" class="w-full bg-zuma-card border border-zuma-border rounded-xl px-4 py-2 text-xs text-white">
            </div>
            <div>
              <label class="block text-[11px] font-bold uppercase text-zuma-muted mb-1">Seu Nome / Cargo</label>
              <input type="text" id="store-b2b-contato" placeholder="Ex: João Silva (Diretor)" class="w-full bg-zuma-card border border-zuma-border rounded-xl px-4 py-2 text-xs text-white">
            </div>
            <div>
              <label class="block text-[11px] font-bold uppercase text-zuma-muted mb-1">WhatsApp para Contato</label>
              <input type="text" id="store-b2b-tel" placeholder="(65) 99999-0000" class="w-full bg-zuma-card border border-zuma-border rounded-xl px-4 py-2 text-xs text-white">
            </div>
            <button onclick="enviarSolicitacaoB2BStore()" class="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-md">
              ⚡ Solicitar Convênio Corporativo
            </button>
          </div>
        </div>

        <div class="bg-zuma-surface p-6 rounded-2xl border border-zuma-border space-y-4">
          <h3 class="text-base font-bold text-white">💼 Benefícios Corporativos Ativos</h3>
          <ul class="space-y-3 text-xs text-zuma-muted">
            <li class="flex items-start space-x-2">
              <span class="text-emerald-400 font-bold">✔</span>
              <span><strong>10% de Desconto Corporativo:</strong> Válido para todos os funcionários no almoço presencial ou delivery.</span>
            </li>
            <li class="flex items-start space-x-2">
              <span class="text-emerald-400 font-bold">✔</span>
              <span><strong>Faturamento Quinzenal:</strong> Comanda unificada da diretoria com fechamento em boleto ou PIX quinzenal e NF-e.</span>
            </li>
            <li class="flex items-start space-x-2">
              <span class="text-emerald-400 font-bold">✔</span>
              <span><strong>Reserva Prioritária no Deck:</strong> Mesas reservadas para recepção de produtores rurais e clientes VIP do agro.</span>
            </li>
            <li class="flex items-start space-x-2">
              <span class="text-emerald-400 font-bold">✔</span>
              <span><strong>Entrega Expressa em 20 Minutos:</strong> Pedidos corporativos de almoço têm prioridade máxima na cozinha KDS.</span>
            </li>
          </ul>
        </div>
      </div>
    </section>
`;

const sectionMarker = '    </section>\n  </main>';
if (!html.includes('id="tab-indique-ganhe"')) {
  html = html.replace(sectionMarker, '    </section>\n' + sectionsContent + '\n  </main>');
  console.log('✅ Seções de conteúdo das 3 abas adicionadas com sucesso');
}

// 3. Funções JavaScript interativas para essas abas no final do script
const jsStoreFunctions = `
    // Funções das Novas Abas de Vendas e Leads
    function gerarLinkIndicacaoStore() {
      const nome = document.getElementById('store-ind-nome').value.trim() || 'Amigo';
      fetch('/api/public/zuma/indicacao/gerar-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome })
      })
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          document.getElementById('store-ind-resultado').classList.remove('hidden');
          document.getElementById('store-ind-link').textContent = data.link;
          window._msgZapIndicacao = data.textoWhatsApp;
          mostrarNotificacao('Link gerado com sucesso!');
        }
      });
    }

    function copiarLinkStore() {
      const link = document.getElementById('store-ind-link').textContent;
      navigator.clipboard.writeText(link);
      mostrarNotificacao('Link de indicação copiado!');
    }

    function dispararWhatsAppStore() {
      if (window._msgZapIndicacao) {
        window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(window._msgZapIndicacao), '_blank');
      }
    }

    function copiarCupom(cupom) {
      navigator.clipboard.writeText(cupom);
      mostrarNotificacao('Cupom ' + cupom + ' copiado!');
    }

    function enviarSolicitacaoB2BStore() {
      const emp = document.getElementById('store-b2b-empresa').value;
      const cont = document.getElementById('store-b2b-contato').value;
      const tel = document.getElementById('store-b2b-tel').value;
      if (!emp) { alert('Por favor, informe o nome da empresa.'); return; }
      mostrarNotificacao('Solicitação corporativa enviada para o Zuma Agro!');
      setTimeout(() => {
        alert('Obrigado! A equipe de convênios do Zuma entrará em contato via WhatsApp (' + (tel || 'informado') + ') com a proposta comercial oficial.');
      }, 500);
    }
`;

if (!html.includes('gerarLinkIndicacaoStore')) {
  html = html.replace('// Navegação entre Abas', jsStoreFunctions + '\n    // Navegação entre Abas');
  console.log('✅ Funções JS das abas de vendas inseridas com sucesso');
}

fs.writeFileSync(indexPath, html, 'utf8');
console.log('🎉 index.html atualizado com sucesso!');
