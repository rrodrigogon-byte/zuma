import fs from 'fs';
import path from 'path';

const pilotPath = '/home/ubuntu/agro-open-live/app/public/zuma/pilot.html';
let html = fs.readFileSync(pilotPath, 'utf8');

// 1. Atualizar menu lateral (nav)
const navMarker = '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);padding:8px 8px 2px;font-weight:700">Inteligência &amp; Gestão</div>';
const newNavItems = `      <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);padding:8px 8px 2px;font-weight:700">🚀 Máquina de Vendas &amp; Leads</div>
      <a href="#trafego" data-v="trafego"><span class="dot"></span>Anúncios &amp; Tráfego IA</a>
      <a href="#indicacao" data-v="indicacao"><span class="dot"></span>Indique e Ganhe Viral</a>
      <a href="#b2b" data-v="b2b"><span class="dot"></span>Zuma Agro B2B</a>
      <a href="#recuperacao" data-v="recuperacao"><span class="dot"></span>Recuperador de Vendas</a>
      ${navMarker}`;

if (!html.includes('data-v="trafego"')) {
  html = html.replace(navMarker, newNavItems);
  console.log('✅ Menu lateral atualizado com as 4 abas de Máquina de Vendas & Leads');
}

// 2. Criar HTML das 4 novas seções
const sectionTrafego = `
    <!-- ANÚNCIOS & TRÁFEGO PAGO IA -->
    <section class="view" id="v-trafego" hidden>
      <div class="head">
        <div>
          <span class="eyebrow">AQUISIÇÃO DE CLIENTES EM ESCALA · TANGARÁ DA SERRA (RAIO 10KM)</span>
          <h1>Anúncios de Alta Conversão &amp; Tráfego Pago IA</h1>
          <p class="muted">Campanhas prontas para Instagram, Facebook Ads e Google Ads com segmentação hiperlocal em Tangará da Serra. O Motor KyttoIA 2.5 Flash escreve copys persuasivas, calcula o ROAS projetado e direciona o cliente direto para o WhatsApp oficial.</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <span class="pill good">Tangará da Serra (Raio 10km)</span>
          <span class="pill">Público Potencial: 46.800</span>
          <span class="pill hot">ROAS Médio: 8.85x</span>
        </div>
      </div>

      <!-- 4 KPIS DE TRÁFEGO -->
      <div class="grid g4">
        <div class="card stat">
          <small>Alcance Estimado Tangará</small>
          <b id="kpiTrafAlcance" style="color:var(--nori)">32.500</b>
          <span class="pill good" style="margin-top:6px">70% da população adulta</span>
        </div>
        <div class="card stat">
          <small>Leads Capturados WhatsApp</small>
          <b id="kpiTrafLeads" style="color:var(--salmon)">420 leads/mês</b>
          <span class="pill good" style="margin-top:6px">Custo por lead R$ 2,85</span>
        </div>
        <div class="card stat">
          <small>Vendas Diretas Convertidas</small>
          <b id="kpiTrafVendas" style="color:var(--gold)">135 pedidos</b>
          <span class="pill" style="margin-top:6px">Taxa de conversão 32,1%</span>
        </div>
        <div class="card stat">
          <small>Faturamento Adicional Estimado</small>
          <b id="kpiTrafFaturamento" style="color:var(--good)">+R$ 12.015/mês</b>
          <span class="pill hot" style="margin-top:6px">ROAS Projetado: 10.0x</span>
        </div>
      </div>

      <!-- SIMULADOR DE ORÇAMENTO E RETORNO -->
      <div class="card" style="margin-top:14px">
        <div class="head" style="align-items:center">
          <div>
            <h3>Simulador de Orçamento de Mídia &amp; Retorno (ROAS)</h3>
            <p class="muted">Ajuste o investimento diário para simular alcance, captação de leads de WhatsApp e faturamento em Tangará da Serra.</p>
          </div>
          <span class="pill hot" id="lblRoasDinamico">ROAS 8.9x</span>
        </div>
        <div style="margin:14px 0">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span style="font-weight:600">Investimento Diário em Anúncios: <b id="valOrcamentoDia" style="color:var(--salmon)">R$ 40,00/dia</b> (R$ 1.200/mês)</span>
            <span class="muted" style="font-size:12px">Recomendado para Tangará: R$ 30 a R$ 60/dia</span>
          </div>
          <input type="range" id="rngOrcamentoDia" min="15" max="150" step="5" value="40" style="width:100%">
        </div>
        <div class="grid g4" style="background:var(--bg);padding:14px;border-radius:10px;margin-top:10px">
          <div><small class="muted">Cliques no Link</small><div id="simCliques" style="font-size:18px;font-weight:700">1.440 cliques</div></div>
          <div><small class="muted">Contatos no WhatsApp</small><div id="simLeads" style="font-size:18px;font-weight:700;color:var(--salmon)">384 novos contatos</div></div>
          <div><small class="muted">Novos Clientes Faturados</small><div id="simClientes" style="font-size:18px;font-weight:700;color:var(--nori)">115 pedidos</div></div>
          <div><small class="muted">Lucro Líquido Gerado</small><div id="simLucro" style="font-size:18px;font-weight:700;color:var(--good)">+R$ 4.870,00</div></div>
        </div>
      </div>

      <!-- 4 CAMPANHAS PRONTAS DE ALTA CONVERSÃO -->
      <h3 style="margin:18px 0 10px">Campanhas Prontas para Ativar em Tangará da Serra</h3>
      <div class="grid g2" id="gridCampanhasTrafego"></div>
    </section>
`;

const sectionIndicacao = `
    <!-- INDIQUE E GANHE VIRAL -->
    <section class="view" id="v-indicacao" hidden>
      <div class="head">
        <div>
          <span class="eyebrow">CRESCIMENTO ORGÂNICO VIRAL &amp; MEMBER-GET-MEMBER</span>
          <h1>Programa de Indicação: Cada Cliente Traz um Amigo</h1>
          <p class="muted">Mecânica viral onde cada cliente cadastrado possui um link exclusivo no WhatsApp. O amigo ganha R$ 15 OFF no primeiro pedido e quem indicou ganha 1 Temaki Salmão cortesia assim que a primeira compra for concluída.</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <span class="pill good">CAC Orgânico: R$ 0,00</span>
          <span class="pill">K-Factor: 1.35</span>
          <span class="pill hot">184 Amigos Indicados/mês</span>
        </div>
      </div>

      <!-- 4 KPIS DO INDIQUE E GANHE -->
      <div class="grid g4">
        <div class="card stat">
          <small>Indicações Realizadas no Mês</small>
          <b style="color:var(--nori)">184 indicações</b>
          <span class="pill good" style="margin-top:6px">+24% vs mês anterior</span>
        </div>
        <div class="card stat">
          <small>Taxa de Ativação do Amigo</small>
          <b style="color:var(--salmon)">68,4% compraram</b>
          <span class="pill good" style="margin-top:6px">126 novos clientes</span>
        </div>
        <div class="card stat">
          <small>Faturamento Orgânico Gerado</small>
          <b style="color:var(--good)">R$ 16.376,00</b>
          <span class="pill hot" style="margin-top:6px">Ticket médio R$ 89,00</span>
        </div>
        <div class="card stat">
          <small>Temakis &amp; Bônus Concedidos</small>
          <b style="color:var(--gold)">126 unidades</b>
          <span class="pill" style="margin-top:6px">Custo mercadoria ~R$ 1.512</span>
        </div>
      </div>

      <div class="grid g2" style="margin-top:14px">
        <!-- GERADOR DE LINK VIRAL DE INDICAÇÃO -->
        <div class="card">
          <div class="head" style="align-items:center">
            <h3>Gerador de Link Viral do Cliente</h3>
            <span class="pill good">1 Clique p/ WhatsApp</span>
          </div>
          <p class="muted">Gere o link personalizado para qualquer cliente cadastrado no CRM ou envie via WhatsApp:</p>
          <div style="display:grid;gap:10px;margin-top:12px">
            <label>Nome do Cliente Indicador
              <input type="text" id="inpIndNome" placeholder="Ex: Rodrigo Gonçalves" value="Rodrigo Gonçalves">
            </label>
            <label>WhatsApp do Cliente (DDD + Número)
              <input type="text" id="inpIndTel" placeholder="(65) 99999-0000" value="(65) 99988-1234">
            </label>
            <button class="btn primary" id="btnGerarLinkInd">Gerar Link Exclusivo</button>
            <div id="boxLinkGerado" style="background:var(--bg);padding:12px;border-radius:8px;border:1px dashed var(--salmon);display:none">
              <small class="muted">Link Exclusivo do Amigo (R$ 15 OFF):</small>
              <div id="txtLinkGerado" style="font-weight:700;color:var(--salmon);word-break:break-all;margin:4px 0"></div>
              <small class="muted">Mensagem formatada para o WhatsApp:</small>
              <div id="txtMsgZapGerada" style="font-size:12px;background:#fff;padding:8px;border-radius:6px;margin:6px 0;white-space:pre-wrap"></div>
              <div style="display:flex;gap:8px;margin-top:6px">
                <button class="btn nori" id="btnCopiarLinkInd">Copiar Link</button>
                <button class="btn salmon" id="btnDispararZapInd">Disparar no WhatsApp</button>
              </div>
            </div>
          </div>
        </div>

        <!-- TOP 5 EMBAIXADORES DE TANGARÁ DA SERRA -->
        <div class="card">
          <div class="head" style="align-items:center">
            <h3>Top 5 Embaixadores de Tangará</h3>
            <span class="pill hot">Ranking Mensal</span>
          </div>
          <p class="muted">Clientes que mais trouxeram amigos novos para o restaurante no último mês:</p>
          <div class="tablewrap" style="margin-top:10px">
            <table>
              <thead>
                <tr><th>#</th><th>Cliente</th><th>Amigos</th><th>Créditos</th><th>Nível</th></tr>
              </thead>
              <tbody id="tbTopEmbaixadores"></tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
`;

const sectionB2B = `
    <!-- CONVÊNIOS CORPORATIVOS & ZUMA AGRO B2B -->
    <section class="view" id="v-b2b" hidden>
      <div class="head">
        <div>
          <span class="eyebrow">EXPANSÃO CORPORATIVA B2B · POLO DO AGRONEGÓCIO</span>
          <h1>Convênios Corporativos &amp; Zuma Agro B2B</h1>
          <p class="muted">Tangará da Serra é capital regional de produção agrícola com tradings, revendas de sementes, cooperativas de crédito e concessionárias na Av. Brasil. Este módulo gerencia os convênios corporativos de almoço executivo e faturamento quinzenal para empresas.</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <span class="pill good">5 Empresas Conveniadas</span>
          <span class="pill">188 Colaboradores</span>
          <span class="pill hot">+R$ 19.450/mês Faturado</span>
        </div>
      </div>

      <!-- 4 KPIS CORPORATIVOS B2B -->
      <div class="grid g4">
        <div class="card stat">
          <small>Empresas Parceiras Ativas</small>
          <b style="color:var(--nori)">5 empresas</b>
          <span class="pill good" style="margin-top:6px">Tradings, Agro &amp; Sicredi</span>
        </div>
        <div class="card stat">
          <small>Colaboradores Cadastrados</small>
          <b style="color:var(--salmon)">188 pessoas</b>
          <span class="pill" style="margin-top:6px">Desconto 10% no crachá</span>
        </div>
        <div class="card stat">
          <small>Receita B2B Mensal Recorrente</small>
          <b style="color:var(--good)">R$ 19.450,00</b>
          <span class="pill hot" style="margin-top:6px">R$ 233.400/ano</span>
        </div>
        <div class="card stat">
          <small>Ticket Médio Reuniões Agro</small>
          <b style="color:var(--gold)">R$ 148,00</b>
          <span class="pill good" style="margin-top:6px">Barcas executivas</span>
        </div>
      </div>

      <!-- LISTA DE CONVÊNIOS ATIVOS -->
      <div class="card" style="margin-top:14px">
        <div class="head" style="align-items:center">
          <h3>Empresas Parceiras Conveniadas na Av. Brasil e Região</h3>
          <span class="pill good">Faturamento Quinzenal</span>
        </div>
        <div class="tablewrap" style="margin-top:10px">
          <table>
            <thead>
              <tr><th>Código</th><th>Empresa Parceira</th><th>Setor</th><th>Colaboradores</th><th>Condição / Benefício</th><th>Faturamento Médio</th><th>Contato</th></tr>
            </thead>
            <tbody id="tbConveniosB2B"></tbody>
          </table>
        </div>
      </div>

      <!-- GERADOR DE PROPOSTA CORPORATIVA COM KYTTOIA -->
      <div class="card" style="margin-top:14px">
        <div class="head" style="align-items:center">
          <div>
            <h3>Gerador de Proposta Corporativa com Motor KyttoIA 2.5 Flash</h3>
            <p class="muted">Digite os dados de uma nova empresa do agronegócio de Tangará da Serra para gerar na hora a carta-proposta comercial oficial.</p>
          </div>
          <span class="pill hot">Motor KyttoIA 2.5 Flash</span>
        </div>
        <div class="grid g4" style="margin-top:10px">
          <label>Nome da Empresa
            <input type="text" id="inpB2BEmpresa" placeholder="Ex: C.Vale Cooperativa Tangará" value="C.Vale Cooperativa Agrícola Tangará">
          </label>
          <label>Responsável / Contato
            <input type="text" id="inpB2BContato" placeholder="Ex: Dr. Roberto Menezes" value="Dr. Roberto Menezes (Gerente Regional)">
          </label>
          <label>Qtd Estimada Colaboradores
            <input type="number" id="inpB2BColab" value="40">
          </label>
          <label>Setor de Atuação
            <input type="text" id="inpB2BSetor" placeholder="Ex: Grãos e Insumos" value="Armazenagem de Grãos e Insumos">
          </label>
        </div>
        <div style="margin-top:12px;display:flex;gap:8px">
          <button class="btn primary" id="btnGerarPropostaB2B">Gerar Proposta Oficial com KyttoIA</button>
        </div>
        <div id="boxPropostaB2B" style="margin-top:14px;background:var(--bg);padding:14px;border-radius:8px;border:1px solid #e2e8f0;display:none">
          <div class="head" style="align-items:center">
            <b>Documento Oficial de Parceria Corporativa:</b>
            <button class="btn nori" id="btnCopiarPropostaB2B" style="font-size:12px">Copiar Proposta</button>
          </div>
          <pre id="txtPropostaB2B" style="margin-top:8px;white-space:pre-wrap;font-family:inherit;font-size:12px;line-height:1.5;background:#fff;padding:12px;border-radius:6px;border:1px solid #cbd5e1"></pre>
        </div>
      </div>
    </section>
`;

const sectionRecuperacao = `
    <!-- RECUPERADOR DE VENDAS & CARRINHOS ABANDONADOS -->
    <section class="view" id="v-recuperacao" hidden>
      <div class="head">
        <div>
          <span class="eyebrow">RESGATE DE VENDAS PERDIDAS &amp; AUTOMAÇÃO DE CONVERSÃO</span>
          <h1>Recuperador Ativo de Carrinhos Abandonados</h1>
          <p class="muted">Cerca de 38% dos clientes que iniciam um pedido no WhatsApp ou loja online abandonam antes de pagar. O Motor KyttoIA monitora a inatividade e dispara réguas automáticas em 15min, 2h e 24h para resgatar a venda sem desconto excessivo.</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <span class="pill good">Taxa de Resgate: 34,8%</span>
          <span class="pill hot">+R$ 10.525,60/mês Salvos</span>
          <span class="pill">3 Réguas Inteligentes</span>
        </div>
      </div>

      <!-- 4 KPIS DE RECUPERAÇÃO -->
      <div class="grid g4">
        <div class="card stat">
          <small>Carrinhos Abandonados no Mês</small>
          <b style="color:var(--muted)">340 carrinhos</b>
          <span class="pill" style="margin-top:6px">Taxa de abandono 38,2%</span>
        </div>
        <div class="card stat">
          <small>Carrinhos Recuperados c/ Sucesso</small>
          <b style="color:var(--good)">118 recuperados</b>
          <span class="pill good" style="margin-top:6px">34,8% taxa de resgate</span>
        </div>
        <div class="card stat">
          <small>Receita Resgatada no Mês</small>
          <b style="color:var(--good)">R$ 10.525,60</b>
          <span class="pill hot" style="margin-top:6px">R$ 126.300/ano</span>
        </div>
        <div class="card stat">
          <small>Ticket Médio Resgatado</small>
          <b style="color:var(--salmon)">R$ 89,20</b>
          <span class="pill" style="margin-top:6px">Especial Zuma lidera</span>
        </div>
      </div>

      <!-- AS 3 RÉGUAS TEMPORAIS DE AUTOMAÇÃO -->
      <h3 style="margin:18px 0 10px">As 3 Réguas de Automação de Disparo no WhatsApp</h3>
      <div class="grid g3">
        <div class="card" style="border-top:3px solid var(--salmon)">
          <div class="head">
            <span class="pill hot">Régua 1 · 15 Minutos</span>
            <small style="color:var(--good);font-weight:700">Conversão: 22,4%</small>
          </div>
          <b style="display:block;margin:6px 0">Resgate Quente / Cortesia de Bancada</b>
          <p class="muted" style="font-size:12px">Gatilho de frescor e urgência gastronômica sem queimar preço:</p>
          <div style="background:var(--bg);padding:10px;border-radius:6px;font-size:12px;margin:8px 0;font-style:italic">
            "🍣 Oi [Nome]! Vimos que você montou seu pedido com o [Prato] mas ainda não finalizou. Seu salmão fresquinho ainda está separado na nossa bancada! Deseja que a gente finalize agora para entrega rápida?"
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
            <span class="pill good">Status: Ativo</span>
            <button class="btn nori" onclick="testarRegua(1, 'Carla Pires', 138)" style="font-size:11px">Testar Disparo</button>
          </div>
        </div>

        <div class="card" style="border-top:3px solid var(--gold)">
          <div class="head">
            <span class="pill warn">Régua 2 · 2 Horas</span>
            <small style="color:var(--good);font-weight:700">Conversão: 11,2%</small>
          </div>
          <b style="display:block;margin:6px 0">Adoçador com Frete Grátis</b>
          <p class="muted" style="font-size:12px">Remove a barreira do frete sem mexer na margem do sushi:</p>
          <div style="background:var(--bg);padding:10px;border-radius:6px;font-size:12px;margin:8px 0;font-style:italic">
            "🎁 [Nome], que tal fechar seu pedido do Zuma agora com Frete Grátis na entrega? Toque no link e seu cupom FRETEZUMA já entra automático!"
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
            <span class="pill good">Status: Ativo</span>
            <button class="btn nori" onclick="testarRegua(2, 'Dr. Marcelo', 195)" style="font-size:11px">Testar Disparo</button>
          </div>
        </div>

        <div class="card" style="border-top:3px solid var(--nori)">
          <div class="head">
            <span class="pill">Régua 3 · 24 Horas</span>
            <small style="color:var(--good);font-weight:700">Conversão: 6,1%</small>
          </div>
          <b style="display:block;margin:6px 0">Reengajamento Noturno do Dia Seguinte</b>
          <p class="muted" style="font-size:12px">Ativa o desejo no dia seguinte na mesma hora do jantar:</p>
          <div style="background:var(--bg);padding:10px;border-radius:6px;font-size:12px;margin:8px 0;font-style:italic">
            "🍱 Deu vontade de sushi ontem? Não passe vontade hoje! Use o cupom VOLTAHOJE e ganhe R$ 15 OFF em qualquer pedido acima de R$ 70 no nosso WhatsApp."
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
            <span class="pill good">Status: Ativo</span>
            <button class="btn nori" onclick="testarRegua(3, 'Aline Fonseca', 76)" style="font-size:11px">Testar Disparo</button>
          </div>
        </div>
      </div>

      <!-- TABELA DE CARRINHOS RECENTES EM MONITORAMENTO -->
      <div class="card" style="margin-top:14px">
        <div class="head" style="align-items:center">
          <h3>Carrinhos Abandonados em Monitoramento em Tempo Real</h3>
          <span class="pill hot" id="lblUltimosCarrinhosCount">3 Monitorados Agora</span>
        </div>
        <div class="tablewrap" style="margin-top:10px">
          <table>
            <thead>
              <tr><th>ID</th><th>Cliente</th><th>Telefone</th><th>Valor</th><th>Itens no Pedido</th><th>Abandonado há</th><th>Status Régua</th><th>Ação</th></tr>
            </thead>
            <tbody id="tbCarrinhosMonitorados"></tbody>
          </table>
        </div>
      </div>
    </section>
`;

const insertionMarker = '    <!-- MERCADO & INTELIGÊNCIA COMPETITIVA IA -->';
if (!html.includes('id="v-trafego"')) {
  html = html.replace(insertionMarker, sectionTrafego + '\n' + sectionIndicacao + '\n' + sectionB2B + '\n' + sectionRecuperacao + '\n' + insertionMarker);
  console.log('✅ 4 Seções HTML inseridas com sucesso antes de #v-mercado');
}

// 3. Atualizar o JavaScript com as funções de renderização
const jsFunctions = `
/* ---------- MÁQUINA DE VENDAS & LEADS (4 MÓDULOS NOVOS) ---------- */

// 1. Tráfego & Anúncios IA
function renderTrafego() {
  const rng = $("rngOrcamentoDia");
  const valLbl = $("valOrcamentoDia");
  const roasLbl = $("lblRoasDinamico");

  function recalcular() {
    const dia = parseInt(rng.value, 10);
    valLbl.textContent = 'R$ ' + dia.toFixed(2).replace('.', ',') + '/dia';
    const mes = dia * 30;
    const cliques = Math.round(mes * 1.2);
    const leads = Math.round(cliques * 0.27);
    const vendas = Math.round(leads * 0.30);
    const faturamento = vendas * 89.00;
    const roas = (faturamento / mes).toFixed(1);
    const lucro = faturamento * 0.40 - mes;

    roasLbl.textContent = 'ROAS ' + roas + 'x';
    $("simCliques").textContent = cliques.toLocaleString('pt-BR') + ' cliques';
    $("simLeads").textContent = leads.toLocaleString('pt-BR') + ' novos contatos';
    $("simClientes").textContent = vendas.toLocaleString('pt-BR') + ' pedidos';
    $("simLucro").textContent = (lucro >= 0 ? '+' : '') + 'R$ ' + lucro.toFixed(2).replace('.', ',');
  }

  rng.addEventListener("input", recalcular);
  recalcular();

  // Renderizar cards de campanhas
  fetch('/api/public/zuma/trafego/campanhas')
    .then(r => r.json())
    .then(data => {
      if (!data.ok || !data.campanhas) return;
      const grid = $("gridCampanhasTrafego");
      grid.innerHTML = data.campanhas.map(c => \`
        <div class="card" style="display:flex;flex-direction:column;justify-content:space-between">
          <div>
            <div class="head">
              <span class="pill good">\${c.plataforma}</span>
              <span class="pill hot">ROAS Esperado \${c.roasEsperado}x</span>
            </div>
            <h4 style="margin:8px 0 4px">\${c.objetivo}</h4>
            <p class="muted" style="font-size:11px;margin-bottom:8px"><b>Público:</b> \${c.publico}</p>
            <div style="background:var(--bg);padding:10px;border-radius:8px;font-size:12px;margin:8px 0;line-height:1.4">
              <b>Copy gerada pelo Motor KyttoIA 2.5 Flash:</b><br>
              "\${c.copyKyttoIA}"
            </div>
            <p class="muted" style="font-size:11px"><b>Criativo Recomendado:</b> \${c.criativoSugerido || 'Foto real do cardápio'}</p>
          </div>
          <div style="display:flex;gap:8px;margin-top:12px;align-items:center;justify-content:space-between">
            <span style="font-size:12px;font-weight:700;color:var(--salmon)">Sugerido: R$ \${c.orcamentoSugeridoDia.toFixed(2)}/dia</span>
            <button class="btn nori" style="font-size:11px" onclick="navigator.clipboard.writeText('\${c.copyKyttoIA}');toast('Copy copiada para a área de transferência!')">Copiar Copy IA</button>
          </div>
        </div>
      \`).join('');
    }).catch(e => console.error(e));
}

// 2. Indicação Viral Member-Get-Member
function renderIndicacao() {
  const btnGerar = $("btnGerarLinkInd");
  const boxLink = $("boxLinkGerado");
  const txtLink = $("txtLinkGerado");
  const txtMsg = $("txtMsgZapGerada");

  btnGerar.addEventListener("click", () => {
    const nome = $("inpIndNome").value.trim() || 'Cliente';
    const tel = $("inpIndTel").value.trim();
    fetch('/api/public/zuma/indicacao/gerar-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, telefone: tel })
    })
    .then(r => r.json())
    .then(data => {
      if (data.ok) {
        boxLink.style.display = 'block';
        txtLink.textContent = data.link;
        txtMsg.textContent = data.textoWhatsApp;
        toast("Link exclusivo do programa gerado!");
      }
    });
  });

  $("btnCopiarLinkInd").addEventListener("click", () => {
    navigator.clipboard.writeText(txtLink.textContent);
    toast("Link copiado com sucesso!");
  });

  $("btnDispararZapInd").addEventListener("click", () => {
    const url = 'https://api.whatsapp.com/send?text=' + encodeURIComponent(txtMsg.textContent);
    window.open(url, '_blank');
  });

  // Carregar Top 5 Embaixadores
  fetch('/api/public/zuma/indicacao/dados')
    .then(r => r.json())
    .then(data => {
      if (!data.ok || !data.topEmbaixadores) return;
      $("tbTopEmbaixadores").innerHTML = data.topEmbaixadores.map(emb => \`
        <tr>
          <td><b style="color:var(--salmon)">#\${emb.rank}</b></td>
          <td><b>\${emb.nome}</b></td>
          <td><span class="pill good">\${emb.amigosIndicados} amigos</span></td>
          <td><b>R$ \${emb.creditosGanhos.toFixed(2)}</b></td>
          <td><span class="pill">\${emb.status}</span></td>
        </tr>
      \`).join('');
    });
}

// 3. Zuma Agro B2B & Convênios Corporativos
function renderB2B() {
  fetch('/api/public/zuma/b2b/convenios')
    .then(r => r.json())
    .then(data => {
      if (!data.ok || !data.empresasConveniadas) return;
      $("tbConveniosB2B").innerHTML = data.empresasConveniadas.map(conv => \`
        <tr>
          <td><span class="pill">\${conv.id}</span></td>
          <td><b>\${conv.empresa}</b></td>
          <td><small class="muted">\${conv.setor}</small></td>
          <td><b style="color:var(--nori)">\${conv.colaboradoresAtendidos}</b></td>
          <td style="font-size:12px">\${conv.beneficio}</td>
          <td><b style="color:var(--good)">R$ \${conv.faturamentoMensalMedio.toFixed(2)}/mês</b></td>
          <td><small>\${conv.contatoResponsavel}</small></td>
        </tr>
      \`).join('');
    });

  const btnGerar = $("btnGerarPropostaB2B");
  const boxProp = $("boxPropostaB2B");
  const txtProp = $("txtPropostaB2B");

  btnGerar.addEventListener("click", () => {
    const empresaNome = $("inpB2BEmpresa").value;
    const contatoNome = $("inpB2BContato").value;
    const qtdColaboradores = $("inpB2BColab").value;
    const setorAtuacao = $("inpB2BSetor").value;

    fetch('/api/public/zuma/b2b/proposta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresaNome, contatoNome, qtdColaboradores, setorAtuacao })
    })
    .then(r => r.json())
    .then(data => {
      if (data.ok) {
        boxProp.style.display = 'block';
        txtProp.textContent = data.propostaTexto;
        toast("Proposta comercial gerada com Motor KyttoIA 2.5 Flash!");
      }
    });
  });

  $("btnCopiarPropostaB2B").addEventListener("click", () => {
    navigator.clipboard.writeText(txtProp.textContent);
    toast("Proposta copiada para a área de transferência!");
  });
}

// 4. Recuperação de Carrinhos Abandonados
function testarRegua(etapa, clienteNome, valor) {
  fetch('/api/public/zuma/recuperacao/disparar-teste', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ etapaRegua: etapa, clienteNome, valorCarrinho: valor })
  })
  .then(r => r.json())
  .then(data => {
    if (data.ok) {
      toast("Disparo Régua " + etapa + " enviado para " + clienteNome + " com cupom " + data.cupomAtivado + "!");
    }
  });
}

function renderRecuperacao() {
  fetch('/api/public/zuma/recuperacao/carrinhos')
    .then(r => r.json())
    .then(data => {
      if (!data.ok || !data.ultimosCarrinhosMonitorados) return;
      $("tbCarrinhosMonitorados").innerHTML = data.ultimosCarrinhosMonitorados.map(c => \`
        <tr>
          <td><span class="pill">\${c.id}</span></td>
          <td><b>\${c.cliente}</b></td>
          <td><small class="muted">\${c.telefone}</small></td>
          <td><b>R$ \${c.valor.toFixed(2)}</b></td>
          <td style="font-size:12px">\${c.itens}</td>
          <td><small>\${c.abandonadoHa}</small></td>
          <td><span class="pill \${c.resgatado ? 'good' : 'hot'}">\${c.resgatado ? 'Resgatado' : c.status}</span></td>
          <td>
            <button class="btn nori" style="font-size:11px" onclick="testarRegua(1, '\${c.cliente}', \${c.valor})">Resgatar Agora</button>
          </td>
        </tr>
      \`).join('');
    });
}
`;

// Inserir funções antes de "/* ---------- roteamento ---------- */"
const routingMarker = '/* ---------- roteamento ---------- */';
if (!html.includes('renderTrafego')) {
  html = html.replace(routingMarker, jsFunctions + '\n' + routingMarker);
  console.log('✅ Funções JS de renderização inseridas com sucesso');
}

// Atualizar VIEWS e route()
const oldViews = 'const VIEWS = ["cockpit", "zumi", "campanhas", "leads", "clientes", "horarios", "clube", "mercado", "engenharia", "rfm", "clima", "omnichannel", "financeiro", "estoque"];';
const newViews = 'const VIEWS = ["cockpit", "zumi", "campanhas", "leads", "clientes", "horarios", "clube", "trafego", "indicacao", "b2b", "recuperacao", "mercado", "engenharia", "rfm", "clima", "omnichannel", "financeiro", "estoque"];';

if (html.includes(oldViews)) {
  html = html.replace(oldViews, newViews);
  console.log('✅ Lista VIEWS expandida para os 18 módulos');
}

// Inserir chamadas dentro de route()
const oldRouteEnd = '  if (v === "estoque") renderEstoque();';
const newRouteEnd = `  if (v === "trafego") renderTrafego();
  if (v === "indicacao") renderIndicacao();
  if (v === "b2b") renderB2B();
  if (v === "recuperacao") renderRecuperacao();
  if (v === "estoque") renderEstoque();`;

if (!html.includes('if (v === "trafego") renderTrafego();')) {
  html = html.replace(oldRouteEnd, newRouteEnd);
  console.log('✅ Chamadas de rota em route() atualizadas com sucesso');
}

fs.writeFileSync(pilotPath, html, 'utf8');
console.log('🎉 pilot.html atualizado e salvo com sucesso!');
