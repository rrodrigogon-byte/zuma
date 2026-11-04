import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const DOCS_DIR = '/home/ubuntu/agro-open/docs';
const PRINTS_DIR = path.join(DOCS_DIR, 'prints-barbeiro');
const PDF_PATH = path.join(DOCS_DIR, 'MANUAL-DO-BARBEIRO-DINO-KYTTO.pdf');

function toBase64(filePath) {
  if (!fs.existsSync(filePath)) return '';
  const ext = path.extname(filePath).replace('.', '');
  const data = fs.readFileSync(filePath).toString('base64');
  return `data:image/${ext === 'svg' ? 'svg+xml' : ext};base64,${data}`;
}

const logoDino = toBase64('/home/ubuntu/agro-open/docs/manual-keyuser/logos/dino-logo.png') || toBase64('/home/ubuntu/agro-open/web/public/brand/dino-logo.png');
const logoKytto = toBase64('/home/ubuntu/agro-open/docs/kytto-logo.png');

const printLogin = toBase64(path.join(PRINTS_DIR, '01b_login_preenchido.png'));
const printAgenda = toBase64(path.join(PRINTS_DIR, '02_agenda_do_barbeiro.png'));
const printGanhos = toBase64(path.join(PRINTS_DIR, '03_ganhos_comissoes.png'));
const printMetas = toBase64(path.join(PRINTS_DIR, '04_metas_bonificacoes.png'));
const printClientes = toBase64(path.join(PRINTS_DIR, '05_clientes_historico.png'));
const printLink = toBase64(path.join(PRINTS_DIR, '06_meu_link_agendamento.png'));
const printMensagemEditavel = toBase64(path.join(PRINTS_DIR, '09_mensagem_personalizada_editavel.png'));

const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Manual do Barbeiro — Barbearia Dino & Kytto</title>
  <style>
    @page {
      size: A4;
      margin: 20mm 15mm 20mm 15mm;
      @bottom-right {
        content: counter(page);
      }
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      line-height: 1.55;
      font-size: 13.5px;
      margin: 0;
      padding: 0;
      background: #fff;
    }
    .page-break {
      page-break-before: always;
    }
    .avoid-break {
      page-break-inside: avoid;
    }

    /* CAPA */
    .capa {
      height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 40px 20px;
      page-break-after: always;
      text-align: center;
    }
    .capa-logos {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 50px;
    }
    .capa-logos img {
      max-height: 60px;
      object-fit: contain;
    }
    .capa-centro {
      margin: auto 0;
    }
    .badge-oficial {
      display: inline-block;
      background: #eef2ff;
      color: #4338ca;
      font-weight: 700;
      font-size: 12px;
      padding: 6px 16px;
      border-radius: 20px;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 24px;
      border: 1px solid #c7d2fe;
    }
    .capa h1 {
      font-size: 32px;
      font-weight: 900;
      color: #0f172a;
      line-height: 1.2;
      margin: 0 0 16px 0;
      letter-spacing: -0.5px;
    }
    .capa h2 {
      font-size: 18px;
      font-weight: 600;
      color: #475569;
      margin: 0 0 24px 0;
    }
    .capa-desc {
      font-size: 15px;
      color: #64748b;
      max-width: 540px;
      margin: 0 auto 30px auto;
      line-height: 1.6;
    }
    .capa-rodape {
      border-top: 1px solid #e2e8f0;
      padding-top: 20px;
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: #94a3b8;
      text-align: left;
    }

    /* SEÇÕES E TIPOGRAFIA */
    h2.secao-titulo {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 8px;
      margin-top: 24px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    h3.subsecao-titulo {
      font-size: 16px;
      font-weight: 700;
      color: #1e293b;
      margin-top: 18px;
      margin-bottom: 10px;
    }
    p {
      margin: 0 0 12px 0;
      color: #334155;
    }
    ul, ol {
      margin: 0 0 14px 0;
      padding-left: 22px;
      color: #334155;
    }
    li {
      margin-bottom: 6px;
    }

    /* BOXES E DESTAQUES */
    .box-info {
      background: #f8fafc;
      border-left: 4px solid #6366f1;
      padding: 14px 18px;
      border-radius: 0 10px 10px 0;
      margin: 16px 0;
      font-size: 13px;
    }
    .box-alerta {
      background: #fefce8;
      border-left: 4px solid #eab308;
      padding: 14px 18px;
      border-radius: 0 10px 10px 0;
      margin: 16px 0;
      font-size: 13px;
    }
    .box-sucesso {
      background: #f0fdf4;
      border-left: 4px solid #22c55e;
      padding: 14px 18px;
      border-radius: 0 10px 10px 0;
      margin: 16px 0;
      font-size: 13px;
    }

    /* TABELAS */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 12.5px;
    }
    th {
      background: #0f172a;
      color: #fff;
      font-weight: 700;
      padding: 10px 12px;
      text-align: left;
      border: 1px solid #0f172a;
    }
    td {
      padding: 9px 12px;
      border: 1px solid #e2e8f0;
      color: #334155;
    }
    tr:nth-child(even) {
      background: #f8fafc;
    }

    /* LAYOUT DE TELA COM PRINT DO CELULAR */
    .print-grid {
      display: flex;
      gap: 20px;
      align-items: flex-start;
      margin: 20px 0;
    }
    .print-texto {
      flex: 1;
    }
    .mockup-phone {
      width: 250px;
      flex-shrink: 0;
      background: #0f172a;
      padding: 6px;
      border-radius: 28px;
      box-shadow: 0 15px 35px rgba(0,0,0,0.25);
      border: 3px solid #334155;
      text-align: center;
    }
    .mockup-phone img {
      width: 100%;
      border-radius: 22px;
      display: block;
    }
    .mockup-caption {
      font-size: 11px;
      color: #64748b;
      margin-top: 6px;
      font-weight: 600;
    }

    .header-fixo {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 6px;
      margin-bottom: 15px;
      font-size: 10.5px;
      color: #94a3b8;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  </style>
</head>
<body>

  <!-- CAPA -->
  <div class="capa">
    <div class="capa-logos">
      ${logoDino ? `<img src="${logoDino}" alt="Barbearia Dino" />` : '<div style="font-size:20px;font-weight:900;">BARBEARIA DINO</div>'}
      ${logoKytto ? `<img src="${logoKytto}" alt="Kytto" />` : '<div style="font-size:20px;font-weight:900;color:#6366f1;">KYTTO</div>'}
    </div>

    <div class="capa-centro">
      <span class="badge-oficial">Manual Oficial de Treinamento e Operação</span>
      <h1>MANUAL DO APLICATIVO DO BARBEIRO</h1>
      <h2>Barbearia Dino & Plataforma Kytto SetPoint Ultra</h2>
      <p class="capa-desc">
        Guia prático e ilustrado com telas mobile para operação da agenda na bancada, controle de comissões transparentes, acompanhamento de metas progressivas, histórico de clientes e agendamento online.
      </p>
    </div>

    <div class="capa-rodape">
      <div>
        <strong>Unidade:</strong> Barbearia Dino (Cuiabá - MT)<br>
        <strong>Plataforma:</strong> Kytto Gestão Barbearia ERP
      </div>
      <div style="text-align: right;">
        <strong>Versão:</strong> 2.5 (Novembro/2026)<br>
        <strong>Homologação:</strong> Equipe de Barbeiros & Gestão
      </div>
    </div>
  </div>

  <!-- PÁGINA 1: VISÃO GERAL E LOGIN -->
  <div class="header-fixo">
    <span>Barbearia Dino · Manual do Barbeiro</span>
    <span>Acesso e Login Rápido</span>
  </div>

  <h2 class="secao-titulo">1. Acesso ao Aplicativo e Senha de Toda a Equipe</h2>
  
  <p>
    O <strong>App do Barbeiro</strong> foi desenvolvido para ser utilizado diretamente no smartphone de cada profissional, garantindo total agilidade entre um corte e outro. Ele pode ser acessado de qualquer navegador moderno e instalado na tela de início do celular com aparência de aplicativo nativo.
  </p>

  <div class="box-info">
    <strong>📱 Links Oficiais de Acesso no Celular:</strong><br>
    Link Principal: <a href="https://kytto.com.br/barbeiro/dino" style="color:#4338ca;font-weight:700;">https://kytto.com.br/barbeiro/dino</a><br>
    Link Alternativo: <a href="https://setpoint.kytto.com.br/barbeiro/dino" style="color:#4338ca;font-weight:700;">https://setpoint.kytto.com.br/barbeiro/dino</a>
  </div>

  <div class="print-grid avoid-break">
    <div class="print-texto">
      <h3 class="subsecao-titulo">Como Entrar com 1 Toque (Atalhos Rápidos)</h3>
      <p>
        Para que o barbeiro não precise digitar e-mails longos no celular, a tela de login possui botões com o nome de cada membro da equipe:
      </p>
      <ol>
        <li>Abra o link do aplicativo no seu celular.</li>
        <li>Toque diretamente no <strong>botão com o seu nome</strong> (ex: <code>💈 Bruno</code>, <code>💈 Dino</code>, <code>💈 David</code>, etc.).</li>
        <li>O campo de usuário será preenchido automaticamente com seu identificador.</li>
        <li>A senha padrão de acesso para todos os barbeiros é <strong>123456</strong>.</li>
        <li>Toque em <strong>"Entrar no App"</strong>. Pronto! Sua agenda abre imediatamente.</li>
      </ol>
      <div class="box-sucesso">
        <strong>🔑 Senha Unificada da Equipe:</strong> <code>123456</code><br>
        Todos os profissionais da barbearia utilizam essa senha inicial.
      </div>
    </div>
    <div class="mockup-phone">
      <img src="${printLogin}" alt="Tela de Login" />
      <div class="mockup-caption">Figura 1 — Tela de Login com atalhos rápidos e senha 123456</div>
    </div>
  </div>

  <h3 class="subsecao-titulo avoid-break">Credenciais Oficiais de Acesso da Equipe Dino</h3>
  <table class="avoid-break">
    <thead>
      <tr>
        <th>Profissional</th>
        <th>Usuário Rápido</th>
        <th>E-mail Cadastrado</th>
        <th>Senha Padrão</th>
        <th>Perfil</th>
      </tr>
    </thead>
    <tbody>
      <tr><td><strong>Dino (Guilherme)</strong></td><td><code>dino</code></td><td>dino@barbeariadino.com.br</td><td><strong>123456</strong></td><td>Gestor / Master</td></tr>
      <tr><td><strong>Bruno</strong></td><td><code>bruno</code></td><td>bruno@barbeariadino.com.br</td><td><strong>123456</strong></td><td>Barbeiro</td></tr>
      <tr><td><strong>David</strong></td><td><code>david</code></td><td>david@barbeariadino.com.br</td><td><strong>123456</strong></td><td>Barbeiro</td></tr>
      <tr><td><strong>Natani (Naty)</strong></td><td><code>natani</code> ou <code>naty</code></td><td>natani@barbeariadino.com.br</td><td><strong>123456</strong></td><td>Hair Stylist</td></tr>
      <tr><td><strong>Ester (Steffany)</strong></td><td><code>ester</code></td><td>ester@barbeariadino.com.br</td><td><strong>123456</strong></td><td>Barbeira / Estética</td></tr>
      <tr><td><strong>João</strong></td><td><code>joao</code></td><td>joao@barbeariadino.com.br</td><td><strong>123456</strong></td><td>Barbeiro</td></tr>
      <tr><td><strong>Amanda</strong></td><td><code>amanda</code></td><td>amanda@barbeariadino.com.br</td><td><strong>123456</strong></td><td>Barbeira / Estética</td></tr>
      <tr><td><strong>Jhenyffer</strong></td><td><code>jhenyffer</code></td><td>jhenyffer@barbeariadino.com.br</td><td><strong>123456</strong></td><td>Atendimento / Caixa</td></tr>
    </tbody>
  </table>

  <!-- PÁGINA 2: ABA AGENDA -->
  <div class="page-break"></div>
  <div class="header-fixo">
    <span>Barbearia Dino · Manual do Barbeiro</span>
    <span>Operação da Agenda Diária</span>
  </div>

  <h2 class="secao-titulo">2. Aba 📅 Agenda: Operação na Cadeira</h2>

  <p>
    A aba <strong>Agenda</strong> é a área principal de trabalho do barbeiro. Ela foi desenhada para que com apenas um olhar o profissional saiba quem é o próximo cliente, o serviço agendado e quanto tempo resta.
  </p>

  <div class="print-grid avoid-break">
    <div class="print-texto">
      <h3 class="subsecao-titulo">Fluxo de Atendimento no Dia a Dia</h3>
      <ul>
        <li>
          <strong>Card de Próximo Agendamento:</strong> Mostra em destaque o horário exato (ex: <code>09:00</code>), o nome do cliente (ex: <code>José Belarmino</code>), o procedimento (ex: <code>Selagem · 60 min · R$ 120,00</code>).
        </li>
        <li>
          <strong>▶ Iniciar Atendimento:</strong> Ao chamar o cliente para a cadeira, dê um toque neste botão. O sistema avisa o caixa que o atendimento começou e inicia o contador.
        </li>
        <li>
          <strong>💬 WhatsApp:</strong> Permite chamar o cliente no WhatsApp com um único toque para confirmar chegada ou avisar que a bancada está livre.
        </li>
        <li>
          <strong>Indicadores em Tempo Real:</strong> Mostra quantos clientes foram atendidos (<code>0/7</code>), faturamento previsto do dia (<code>R$ 700,01</code>) e comissões acumuladas.
        </li>
      </ul>

      <h3 class="subsecao-titulo">Ações Rápidas do Rodapé:</h3>
      <ul>
        <li><strong><code>+ Encaixe</code>:</strong> Para lançar na hora clientes sem horário marcado.</li>
        <li><strong><code>+ Venda</code>:</strong> Lança pomadas, óleos ou perfumes na comanda do cliente.</li>
        <li><strong><code>🔒 Bloquear</code>:</strong> Trava um intervalo na sua grade para almoço ou intervalo.</li>
      </ul>
    </div>
    <div class="mockup-phone">
      <img src="${printAgenda}" alt="Aba Agenda" />
      <div class="mockup-caption">Figura 2 — Aba Agenda com Próximo Agendamento e Ações</div>
    </div>
  </div>

  <!-- PÁGINA 3: ABA GANHOS E COMISSÕES -->
  <div class="page-break"></div>
  <div class="header-fixo">
    <span>Barbearia Dino · Manual do Barbeiro</span>
    <span>Comissões e Transparência Financeira</span>
  </div>

  <h2 class="secao-titulo">3. Aba 💰 Ganhos: Comissões e Repasses Transparentes</h2>

  <p>
    Nesta aba, o barbeiro acompanha centavo por centavo o valor líquido gerado no dia, semana e mês, com <strong>separação total entre comissão de serviços e comissão de produtos</strong>.
  </p>

  <div class="print-grid avoid-break">
    <div class="print-texto">
      <h3 class="subsecao-titulo">Detalhamento dos Indicadores de Ganho</h3>
      <ul>
        <li>
          <strong>Comissão Líquida Confirmada:</strong> O valor líquido exato que o barbeiro tem a receber sobre as comandas já pagas e fechadas.
        </li>
        <li>
          <strong>Previsão com a Agenda de Hoje:</strong> Projeção de quanto o barbeiro irá faturar no dia se todos os agendamentos forem concluídos.
        </li>
        <li>
          <strong>Serviços (ex: 50% ou 40%):</strong> Total bruto de cortes e procedimentos e o valor da comissão correspondente.
        </li>
        <li>
          <strong>Produtos (10%):</strong> Comissão separada exclusiva sobre a venda de cosméticos (pomadas, balms, shampoos).
        </li>
        <li>
          <strong>Simulador Interativo:</strong> Barra deslizante que mostra quanto o barbeiro ganha a mais no mês oferecendo serviços extras (barba, sobrancelha, hidratação) e produtos de revenda.
        </li>
      </ul>

      <div class="box-info">
        <strong>Extratos e Recibos:</strong> O barbeiro pode tocar em <em>Extrato & Recibos</em> para auditar todas as comandas onde seu nome foi lançado.
      </div>
    </div>
    <div class="mockup-phone">
      <img src="${printGanhos}" alt="Aba Ganhos" />
      <div class="mockup-caption">Figura 3 — Aba Ganhos com apuração em tempo real e simulador</div>
    </div>
  </div>

  <!-- PÁGINA 4: ABA METAS E BONIFICAÇÕES -->
  <div class="page-break"></div>
  <div class="header-fixo">
    <span>Barbearia Dino · Manual do Barbeiro</span>
    <span>Central de Metas e Roleta de Prêmios</span>
  </div>

  <h2 class="secao-titulo">4. Aba 🎯 Metas: Bonificação Progressiva e Roleta</h2>

  <p>
    A Barbearia Dino adota o sistema de <strong>Metas & Bonificações Progressivas</strong>, onde quanto mais o profissional produz, maior é a sua porcentagem de comissão e suas recompensas.
  </p>

  <div class="print-grid avoid-break">
    <div class="print-texto">
      <h3 class="subsecao-titulo">Escada Progressiva de Comissões</h3>
      <p>A comissão aumenta automaticamente conforme as faixas de faturamento:</p>
      <ul>
        <li><strong>Faixa Base:</strong> 40% de comissão sobre serviços.</li>
        <li><strong>1ª Meta Atingida:</strong> 40% + 5% = <strong>45% de comissão</strong>.</li>
        <li><strong>2ª Meta Atingida:</strong> 40% + 7% = <strong>47% de comissão</strong>.</li>
        <li><strong>3ª Meta Atingida:</strong> 40% + 10% = <strong>50% de comissão</strong>.</li>
      </ul>

      <h3 class="subsecao-titulo">Metas Diárias e Roleta de Prêmios:</h3>
      <ul>
        <li>
          <strong>Meta Diária de Extras:</strong> Ao realizar a cota de serviços extras no dia (barba, sobrancelha, pigmentação), o barbeiro ganha giros na Roleta de Prêmios.
        </li>
        <li>
          <strong>Meta Diária de Produtos:</strong> Vender a quantidade estipulada de pomadas e perfumes libera prêmios imediatos.
        </li>
        <li>
          <strong>Ranking da Equipe:</strong> Mostra a posição do profissional em relação ao time, estimulando a competição saudável.
        </li>
      </ul>
    </div>
    <div class="mockup-phone">
      <img src="${printMetas}" alt="Aba Metas" />
      <div class="mockup-caption">Figura 4 — Central de Metas, Bonificação e Roleta</div>
    </div>
  </div>

  <!-- PÁGINA 5: ABA CLIENTES E MEU LINK -->
  <div class="page-break"></div>
  <div class="header-fixo">
    <span>Barbearia Dino · Manual do Barbeiro</span>
    <span>Carteira de Clientes e Agendamento Online</span>
  </div>

  <h2 class="secao-titulo">5. Abas 👥 Clientes e 🔗 Meu Link de Agendamento</h2>

  <div class="print-grid avoid-break">
    <div class="print-texto">
      <h3 class="subsecao-titulo">Gestão da Carteira de Clientes (Aba 👥)</h3>
      <p>
        O barbeiro tem acesso direto a todos os clientes que já atendeu na história da barbearia (ex: 230 clientes na carteira do Bruno):
      </p>
      <ul>
        <li><strong>Em Dia (&le; 15 dias):</strong> Clientes que cortaram recentemente.</li>
        <li><strong>Hora de Voltar (16 a 30 dias):</strong> O sistema avisa que está no momento ideal de mandar uma mensagem.</li>
        <li><strong>Sumidos (+30 dias):</strong> Clientes que precisam de resgate.</li>
        <li><strong>Disparo com Edição Livre:</strong> O barbeiro pode escolher um modelo (Lembrete, Vaga VIP, Combo) ou <strong>editar a mensagem livremente na caixa de texto</strong> para falar no seu tom de amigo com o cliente!</li>
        <li><strong>Privacidade Garantida:</strong> O número pessoal do cliente é mantido em sigilo, saindo pelo WhatsApp corporativo oficial da Barbearia Dino (65 99917-2020).</li>
        <li><strong>Ficha 360°:</strong> Mostra histórico de visitas e valor total gasto (LTV).</li>
      </ul>
    </div>
    <div class="mockup-phone">
      <img src="${printMensagemEditavel}" alt="Edição de Mensagem no WhatsApp" />
      <div class="mockup-caption">Figura 5 — Edição de Mensagem Personalizada no App</div>
    </div>
  </div>

  <div class="print-grid avoid-break" style="margin-top: 30px;">
    <div class="print-texto">
      <h3 class="subsecao-titulo">Meu Link de Agendamento Online (Aba 🔗)</h3>
      <p>
        Cada barbeiro possui seu próprio link para divulgar aos seus clientes no Instagram e WhatsApp:
      </p>
      <ul>
        <li><strong>Link Direto:</strong> <code>https://kytto.com.br/agendar/dino/bruno</code></li>
        <li><strong>Copiar Texto para a Bio:</strong> Texto pronto para colocar no perfil do Instagram com chamada para ação.</li>
        <li><strong>Copiar Texto para Stories:</strong> Mensagem rápida de horários vagos da semana pronta para postar nos Stories.</li>
        <li><strong>QR Code de Bancada:</strong> O cliente aponta a câmera do celular no espelho e já agenda o próximo corte na hora!</li>
      </ul>
      <div class="box-sucesso">
        <strong>Segurança Total:</strong> Ao abrir seu link, o cliente vê apenas horários Livres ou Ocupados. Ele <strong>nunca visualiza</strong> dados de outros clientes, valores faturados ou anotações internas.
      </div>
    </div>
    <div class="mockup-phone">
      <img src="${printLink}" alt="Aba Meu Link" />
      <div class="mockup-caption">Figura 6 — Link Pessoal e QR Code para Instagram e Bancada</div>
    </div>
  </div>

  <!-- PÁGINA 6: TERMO DE HOMOLOGAÇÃO -->
  <div class="page-break"></div>
  <div class="header-fixo">
    <span>Barbearia Dino · Manual do Barbeiro</span>
    <span>Termo de Ciência e Homologação</span>
  </div>

  <h2 class="secao-titulo">6. Termo de Ciência e Homologação da Equipe</h2>

  <p>
    Declaro que recebi o treinamento e o presente <strong>Manual Operacional do Aplicativo do Barbeiro</strong> da Barbearia Dino & Plataforma Kytto. Estou ciente das minhas credenciais de login (usuário e senha padrão <strong>123456</strong>), das regras de apuração das comissões separadas de serviços e produtos, e das metas diárias e mensais para bonificação progressiva.
  </p>

  <div style="margin-top: 40px;">
    <table style="width: 100%; border: none;">
      <tbody>
        <tr style="background: transparent;">
          <td style="width: 50%; border: none; padding: 25px 20px; text-align: center; vertical-align: bottom;">
            ____________________________________________________<br>
            <strong style="font-size: 13px;">Guilherme Cunha Martins (Dino)</strong><br>
            <span style="font-size: 11px; color: #64748b;">Fundador & Diretor Geral · Barbearia Dino</span>
          </td>
          <td style="width: 50%; border: none; padding: 25px 20px; text-align: center; vertical-align: bottom;">
            ____________________________________________________<br>
            <strong style="font-size: 13px;">Jhenyffer Andrade</strong><br>
            <span style="font-size: 11px; color: #64748b;">Gestão Operacional, Atendimento & Caixa</span>
          </td>
        </tr>
        <tr style="background: transparent;">
          <td style="width: 50%; border: none; padding: 35px 20px; text-align: center; vertical-align: bottom;">
            ____________________________________________________<br>
            <strong style="font-size: 13px;">Assinatura do Profissional / Barbeiro</strong><br>
            <span style="font-size: 11px; color: #64748b;">Nome Legível: _____________________________</span>
          </td>
          <td style="width: 50%; border: none; padding: 35px 20px; text-align: center; vertical-align: bottom;">
            <div style="font-size: 12px; color: #64748b; line-height: 1.8;">
              <strong>Data da Homologação:</strong> _____ / _____ / 2026<br>
              <strong>Cidade:</strong> Cuiabá — MT<br>
              <strong>Status:</strong> ✅ Capacitado e Apto para Operação
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="box-info" style="margin-top: 50px; text-align: center;">
    <strong>Suporte Técnico e Dúvidas Operacionais Kytto:</strong><br>
    Acesse a Central de Ajuda no próprio aplicativo através do botão <strong>⭐ Perfil</strong> ou contate a recepção da barbearia.
  </div>

</body>
</html>
`;

async function gerarPdf() {
  console.log('Iniciando Puppeteer para gerar PDF diagramado...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

  await page.pdf({
    path: PDF_PATH,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '15mm',
      bottom: '15mm',
      left: '12mm',
      right: '12mm'
    }
  });

  console.log('PDF gerado com sucesso em:', PDF_PATH);
  await browser.close();
}

gerarPdf().catch(err => {
  console.error('Erro na geracao do PDF:', err);
  process.exit(1);
});
