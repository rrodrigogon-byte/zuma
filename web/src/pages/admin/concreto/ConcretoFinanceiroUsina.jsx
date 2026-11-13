import React, { useState, useMemo } from 'react';
import { useToast } from '../../../hooks/useToast';

export default function ConcretoFinanceiroUsina({ cargas = [] }) {
  const { toast } = useToast();
  const [subAba, setSubAba] = useState('receber'); // 'receber' | 'pagar' | 'fluxo' | 'dre' | 'breakeven' | 'cashpooling'
  const [filtroStatusReceber, setFiltroStatusReceber] = useState('todos');
  const [filtroStatusPagar, setFiltroStatusPagar] = useState('todos');
  const [busca, setBusca] = useState('');

  // Modais
  const [modalNovaMedicao, setModalNovaMedicao] = useState(false);
  const [modalNovoPagar, setModalNovoPagar] = useState(false);
  const [modalBoletoAberto, setModalBoletoAberto] = useState(null);
  const [modalCashPooling, setModalCashPooling] = useState(false);

  // Estados de simulação de Break-even
  const [simulacaoVolumeM3, setSimulacaoVolumeM3] = useState(1830);
  const [simulacaoPrecoMedio, setSimulacaoPrecoMedio] = useState(464.50);
  const [simulacaoCustoCimento, setSimulacaoCustoCimento] = useState(148000);

  // Dados de Contas a Receber (Medições de Obras das Construtoras)
  const [contasReceber, setContasReceber] = useState([
    {
      id: 'REC-2026-101',
      cliente: 'Construtora MT Horizon Ltda',
      cnpj: '28.910.420/0001-90',
      obra: 'Edifício Residencial Ilhas do Lago · Lajes 4º e 5º Pav.',
      dataEmissao: '01/11/2026',
      vencimento: '25/11/2026',
      volumeM3: 160.0,
      fck: 'FCK 30 MPa',
      valorBruto: 74400.00,
      retencaoTecnicaPercent: 5.0,
      valorRetencao: 3720.00,
      valorLiquido: 70680.00,
      status: 'aberto',
      forma: 'Boleto 28 DDL com Pix',
      banco: 'Sicredi (748)',
      linhaDigitavel: '74891.12513 00001.234567 89012.345678 1 987600007068000',
      pixCopiaCola: '00020126580014br.gov.bcb.pix0136serrano-receber-101@serranoconcreto.com.br520400005303986540770680.005802BR5925SERRANO CONCRETO USINADO6016TANGARA DA SERRA62070503***6304D89A',
      laudoNbr5739: 'Aprovado (31,4 MPa aos 28 dias)',
      historicoCargas: ['crg-1001', 'crg-1002']
    },
    {
      id: 'REC-2026-102',
      cliente: 'Engenharia Tangará & Obras Ltda',
      cnpj: '19.824.110/0001-44',
      obra: 'Residencial Serra Dourada · Baldrames e Pilares',
      dataEmissao: '03/11/2026',
      vencimento: '28/11/2026',
      volumeM3: 135.0,
      fck: 'FCK 25 MPa',
      valorBruto: 62800.00,
      retencaoTecnicaPercent: 5.0,
      valorRetencao: 3140.00,
      valorLiquido: 59660.00,
      status: 'aberto',
      forma: 'Boleto 28 DDL com Pix',
      banco: 'Banco do Brasil (001)',
      linhaDigitavel: '00190.00009 01234.567800 12345.678901 2 988000005966000',
      pixCopiaCola: '00020126580014br.gov.bcb.pix0136serrano-receber-102@serranoconcreto.com.br520400005303986540759660.005802BR5925SERRANO CONCRETO USINADO6016TANGARA DA SERRA62070503***6304C14B',
      laudoNbr5739: 'Aprovado (26,8 MPa aos 28 dias)',
      historicoCargas: ['crg-1003']
    },
    {
      id: 'REC-2026-103',
      cliente: 'AgroConstruções Parecis S/A',
      cnpj: '08.112.987/0001-32',
      obra: 'Armazém Grãos Silos MT · Piso Industrial 35 MPa',
      dataEmissao: '05/11/2026',
      vencimento: '05/12/2026',
      volumeM3: 210.0,
      fck: 'FCK 35 MPa',
      valorBruto: 98600.00,
      retencaoTecnicaPercent: 10.0,
      valorRetencao: 9860.00,
      valorLiquido: 88740.00,
      status: 'em_medicao',
      forma: 'Fatura Quinquenal de Concretagem',
      banco: 'Sicredi (748)',
      linhaDigitavel: '74891.12513 00002.345678 90123.456789 3 989000008874000',
      pixCopiaCola: '00020126580014br.gov.bcb.pix0136serrano-receber-103@serranoconcreto.com.br520400005303986540788740.005802BR5925SERRANO CONCRETO USINADO6016TANGARA DA SERRA62070503***6304E55C',
      laudoNbr5739: 'Em cura 14 dias (29,2 MPa)',
      historicoCargas: ['crg-1004']
    },
    {
      id: 'REC-2026-104',
      cliente: 'Construtora Alvorada Tangará',
      cnpj: '14.520.890/0001-18',
      obra: 'Galpão Logístico Rodovia MT-358 km 08',
      dataEmissao: '20/10/2026',
      vencimento: '10/11/2026',
      volumeM3: 98.0,
      fck: 'FCK 25 MPa',
      valorBruto: 45200.00,
      retencaoTecnicaPercent: 0,
      valorRetencao: 0.00,
      valorLiquido: 45200.00,
      status: 'pago',
      forma: 'Pix Jurídico Instantâneo',
      banco: 'Sicredi (748)',
      dataPagamento: '10/11/2026',
      laudoNbr5739: 'Aprovado (27,1 MPa aos 28 dias)',
      historicoCargas: []
    },
    {
      id: 'REC-2026-105',
      cliente: 'Pavimentação & Terraplanagem MT',
      cnpj: '22.410.778/0001-09',
      obra: 'Pátio de Carretas Distrito Industrial',
      dataEmissao: '25/10/2026',
      vencimento: '15/11/2026',
      volumeM3: 82.0,
      fck: 'FCK 30 MPa',
      valorBruto: 38500.00,
      retencaoTecnicaPercent: 5.0,
      valorRetencao: 1925.00,
      valorLiquido: 36575.00,
      status: 'atrasado',
      forma: 'Boleto 21 DDL',
      banco: 'Banco do Brasil (001)',
      linhaDigitavel: '00190.00009 01234.987654 32109.876543 4 986000003657500',
      pixCopiaCola: '00020126580014br.gov.bcb.pix0136serrano-receber-105@serranoconcreto.com.br520400005303986540736575.005802BR5925SERRANO CONCRETO USINADO6016TANGARA DA SERRA62070503***6304F22D',
      laudoNbr5739: 'Aprovado (32,0 MPa aos 28 dias)',
      historicoCargas: []
    },
    {
      id: 'REC-2026-106',
      cliente: 'Loteamento Tangará Park',
      cnpj: '31.905.211/0001-65',
      obra: 'Meio-fio e Sarjetas Setor Norte',
      dataEmissao: '18/10/2026',
      vencimento: '08/11/2026',
      volumeM3: 52.0,
      fck: 'FCK 20 MPa',
      valorBruto: 23300.00,
      retencaoTecnicaPercent: 0,
      valorRetencao: 0.00,
      valorLiquido: 23300.00,
      status: 'pago',
      forma: 'TED / Pix',
      banco: 'Sicredi (748)',
      dataPagamento: '08/11/2026',
      laudoNbr5739: 'Aprovado (22,4 MPa aos 28 dias)',
      historicoCargas: []
    }
  ]);

  // Dados de Contas a Pagar (Fornecedores de Insumos da Usina de Concreto)
  const [contasPagar, setContasPagar] = useState([
    {
      id: 'PAG-2026-201',
      fornecedor: 'Votorantim Cimentos S/A (Cimento MT)',
      cnpj: '01.637.311/0001-90',
      categoria: 'Cimento a Granel CP II-F-32',
      nfEntrada: 'NF-e 184.920',
      vencimento: '22/11/2026',
      valor: 74000.00,
      status: 'aberto',
      forma: 'Boleto Bancário Bradesco',
      detalhes: '2 carretas silo de 30 toneladas cada (60.000 kg cimento)'
    },
    {
      id: 'PAG-2026-202',
      fornecedor: 'Pedreira & Mineração Parecis Ltda',
      cnpj: '12.890.412/0001-34',
      categoria: 'Agregados Graúdos (Brita 0 e Brita 1)',
      nfEntrada: 'NF-e 45.120',
      vencimento: '25/11/2026',
      valor: 54200.00,
      status: 'aberto',
      forma: 'Boleto 28 DDL',
      detalhes: '450 toneladas de brita basáltica para traço estrutural'
    },
    {
      id: 'PAG-2026-203',
      fornecedor: 'Areial Rio Sepotuba Mineração',
      cnpj: '07.320.119/0001-08',
      categoria: 'Areia Média Lavada de Rio',
      nfEntrada: 'NF-e 38.990',
      vencimento: '26/11/2026',
      valor: 32200.00,
      status: 'aberto',
      forma: 'Boleto Bancário',
      detalhes: '380 toneladas de areia lavada desaguada'
    },
    {
      id: 'PAG-2026-204',
      fornecedor: 'Master Builders Solutions (BASF Concreto)',
      cnpj: '60.706.477/0001-92',
      categoria: 'Aditivos Químicos Plastificantes',
      nfEntrada: 'NF-e 91.020',
      vencimento: '30/11/2026',
      valor: 19800.00,
      status: 'aberto',
      forma: 'Boleto Santander',
      detalhes: '2 containers IBC 1.000L de MasterRheobuild 1000'
    },
    {
      id: 'PAG-2026-205',
      fornecedor: 'Auto Posto Pioneiro de Tangará Ltda',
      cnpj: '03.890.112/0001-77',
      categoria: 'Óleo Diesel S10 (Frota Betoneiras & Pás)',
      nfEntrada: 'NF-e 112.450',
      vencimento: '15/11/2026',
      valor: 42500.00,
      status: 'pago',
      forma: 'Débito Automático Conta Jurídica',
      detalhes: 'Abastecimento quinzenal da frota própria de 5 betoneiras e 2 bombas'
    },
    {
      id: 'PAG-2026-206',
      fornecedor: 'Folha de Pagamento Usina & Encargos FGTS/INSS',
      cnpj: '53.798.485/0001-77',
      categoria: 'Recursos Humanos & Equipe Técnica',
      nfEntrada: 'Folha Mensal',
      vencimento: '05/12/2026',
      valor: 68200.00,
      status: 'aberto',
      forma: 'Crédito em Conta Sicredi',
      detalhes: 'Operador de central dosadora, laboratorista NBR, 5 motoristas e mecânico'
    },
    {
      id: 'PAG-2026-207',
      fornecedor: 'Energisa Mato Grosso Distribuidora S/A',
      cnpj: '03.467.321/0001-99',
      categoria: 'Energia Elétrica Trifásica Usina 380V',
      nfEntrada: 'Conta Luz 202611',
      vencimento: '10/11/2026',
      valor: 14300.00,
      status: 'pago',
      forma: 'Débito em Conta',
      detalhes: 'Alimentação dos motores dosadoras, esteiras e compressores da central'
    },
    {
      id: 'PAG-2026-208',
      fornecedor: 'Oficina Hidráulica Tangará Diesel',
      cnpj: '18.290.441/0001-52',
      categoria: 'Manutenção Preventiva e Tambores de Betoneira',
      nfEntrada: 'NFS-e 4.891',
      vencimento: '18/11/2026',
      valor: 12600.00,
      status: 'aberto',
      forma: 'Boleto 14 DDL',
      detalhes: 'Revisão hidráulica redutor de giro Sauer-Danfoss da Betoneira BT-02'
    }
  ]);

  // Form de Nova Medição
  const [formMedicao, setFormMedicao] = useState({
    cliente: 'Construtora MT Horizon Ltda',
    cnpj: '28.910.420/0001-90',
    obra: 'Edifício Residencial Ilhas do Lago · Lajes 6º Pav.',
    fck: 'FCK 30 MPa',
    volumeM3: 80.0,
    precoM3: 465.00,
    taxaBomba: 1800.00,
    retencaoTecnicaPercent: 5.0,
    prazoDias: 28,
    banco: 'Sicredi (748)'
  });

  // Form de Novo Título a Pagar
  const [formPagar, setFormPagar] = useState({
    fornecedor: '',
    categoria: 'Cimento a Granel',
    nfEntrada: '',
    vencimento: '',
    valor: '',
    detalhes: ''
  });

  // KPIs Totais Calculados
  const totalReceberAberto = useMemo(() => {
    return contasReceber
      .filter(c => c.status === 'aberto' || c.status === 'em_medicao' || c.status === 'atrasado')
      .reduce((acc, c) => acc + c.valorLiquido, 0);
  }, [contasReceber]);

  const totalRecebidoMes = useMemo(() => {
    return contasReceber
      .filter(c => c.status === 'pago')
      .reduce((acc, c) => acc + c.valorLiquido, 0);
  }, [contasReceber]);

  const totalPagarAberto = useMemo(() => {
    return contasPagar
      .filter(c => c.status === 'aberto')
      .reduce((acc, c) => acc + c.valor, 0);
  }, [contasPagar]);

  const totalPagoMes = useMemo(() => {
    return contasPagar
      .filter(c => c.status === 'pago')
      .reduce((acc, c) => acc + c.valor, 0);
  }, [contasPagar]);

  const saldoCaixaAtual = 428500.00;
  const saldoProjetadoFimMes = saldoCaixaAtual + totalReceberAberto - totalPagarAberto;

  // Lógica de Baixa de Título a Receber
  const handleBaixarReceber = (id) => {
    setContasReceber(prev => prev.map(c => {
      if (c.id === id) {
        return { ...c, status: 'pago', dataPagamento: new Date().toLocaleDateString('pt-BR') };
      }
      return c;
    }));
    toast({ title: 'Título Liquidado', description: `Medição ${id} baixada no caixa com sucesso.`, status: 'success' });
  };

  // Lógica de Baixa de Título a Pagar
  const handleBaixarPagar = (id) => {
    setContasPagar(prev => prev.map(p => {
      if (p.id === id) {
        return { ...p, status: 'pago', dataPagamento: new Date().toLocaleDateString('pt-BR') };
      }
      return p;
    }));
    toast({ title: 'Pagamento Realizado', description: `Lançamento ${id} liquidado na conta jurídica.`, status: 'success' });
  };

  // Adicionar Nova Medição
  const handleSalvarMedicao = (e) => {
    e.preventDefault();
    const vol = Number(formMedicao.volumeM3) || 0;
    const preco = Number(formMedicao.precoM3) || 465;
    const bomba = Number(formMedicao.taxaBomba) || 0;
    const bruto = (vol * preco) + bomba;
    const retencao = bruto * (Number(formMedicao.retencaoTecnicaPercent) / 100);
    const liquido = bruto - retencao;

    const dataHoje = new Date();
    const dataVenc = new Date(dataHoje.getTime() + (Number(formMedicao.prazoDias) * 24 * 60 * 60 * 1000));

    const nova = {
      id: `REC-2026-${Math.floor(100 + Math.random() * 900)}`,
      cliente: formMedicao.cliente,
      cnpj: formMedicao.cnpj,
      obra: formMedicao.obra,
      dataEmissao: dataHoje.toLocaleDateString('pt-BR'),
      vencimento: dataVenc.toLocaleDateString('pt-BR'),
      volumeM3: vol,
      fck: formMedicao.fck,
      valorBruto: bruto,
      retencaoTecnicaPercent: Number(formMedicao.retencaoTecnicaPercent),
      valorRetencao: retencao,
      valorLiquido: liquido,
      status: 'aberto',
      forma: `Boleto ${formMedicao.prazoDias} DDL com Pix`,
      banco: formMedicao.banco,
      linhaDigitavel: '74891.12513 00003.456789 01234.567890 5 ' + Math.floor(10000000000 + Math.random() * 90000000000),
      pixCopiaCola: `00020126580014br.gov.bcb.pix0136serrano-receber-${Math.floor(Math.random()*1000)}@serranoconcreto.com.br5204000053039865407${liquido.toFixed(2)}5802BR5925SERRANO CONCRETO USINADO6016TANGARA DA SERRA62070503***6304ABCD`,
      laudoNbr5739: 'Aguardando rompimento 7/28 dias',
      historicoCargas: []
    };

    setContasReceber(prev => [nova, ...prev]);
    setModalNovaMedicao(false);
    toast({ title: 'Medição Cadastrada', description: `Fatura ${nova.id} gerada para ${formMedicao.cliente}.`, status: 'success' });
  };

  // Adicionar Novo Título a Pagar
  const handleSalvarPagar = (e) => {
    e.preventDefault();
    const v = Number(formPagar.valor) || 0;
    const novo = {
      id: `PAG-2026-${Math.floor(200 + Math.random() * 800)}`,
      fornecedor: formPagar.fornecedor,
      categoria: formPagar.categoria,
      nfEntrada: formPagar.nfEntrada || 'NF-e Avulsa',
      vencimento: formPagar.vencimento ? new Date(formPagar.vencimento + 'T12:00:00').toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
      valor: v,
      status: 'aberto',
      forma: 'Boleto Bancário / Pix',
      detalhes: formPagar.detalhes || 'Despesa operacional usina'
    };
    setContasPagar(prev => [novo, ...prev]);
    setModalNovoPagar(false);
    toast({ title: 'Conta a Pagar Cadastrada', description: `Título ${novo.id} lançado com sucesso.`, status: 'success' });
  };

  // Enviar Boleto via WhatsApp
  const handleEnviarBoletoWhatsapp = (rec) => {
    const texto = encodeURIComponent(`Olá, segue a Fatura & Medição de Concretagem nº ${rec.id} da SERRANO CONCRETO USINADO.\n\nCliente: ${rec.cliente}\nObra: ${rec.obra}\nVolume: ${rec.volumeM3} m³ (${rec.fck})\nValor Líquido: R$ ${rec.valorLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\nVencimento: ${rec.vencimento}\n\nCódigo Pix Copia e Cola:\n${rec.pixCopiaCola}\n\nLinha Digitável do Boleto:\n${rec.linhaDigitavel}\n\nPara visualizar o espelho com os laudos tecnológicos NBR 5739 acesse: https://kytto.com.br/admin/concreto`);
    window.open(`https://wa.me/?text=${texto}`, '_blank');
  };

  return (
    <div className="serrano-dashboard-panel" style={{ padding: '24px 0' }}>
      
      {/* ─── CABEÇALHO DO MÓDULO FINANCEIRO ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.8rem' }}>💰</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                Gestão Financeira & Fluxo de Caixa · Serrano Concreto
              </h2>
              <div style={{ fontSize: '0.86rem', color: 'var(--muted)', marginTop: 2 }}>
                Contas a Receber (Medições de Obras) · Contas a Pagar (Insumos) · DRE Operacional · Cash Pooling Grupo Palatare
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button 
            type="button" 
            className="serrano-btn-gold"
            onClick={() => setModalNovaMedicao(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', fontWeight: 700 }}
          >
            <span>📑</span>
            Nova Medição de Obra
          </button>

          <button 
            type="button" 
            className="serrano-btn-outline"
            onClick={() => setModalNovoPagar(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', fontWeight: 700 }}
          >
            <span>🧾</span>
            Novo Contas a Pagar
          </button>

          <button 
            type="button" 
            className="serrano-btn-outline"
            onClick={() => setModalCashPooling(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 18px', fontWeight: 700, borderColor: '#C5A059', color: '#C5A059' }}
          >
            <span>🏦</span>
            Cash Pooling Holding
          </button>
        </div>
      </div>

      {/* ─── COCKPIT DE LIQUIDEZ & INDICADORES FINANCEIROS ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16, marginBottom: 24 }}>
        
        {/* Card 1: Saldo Disponível */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--joint)', borderRadius: 14, padding: 18, borderLeft: '4px solid #10B981' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800 }}>
            Saldo em Caixa & Bancos
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#10B981', marginTop: 4 }}>
            R$ {saldoCaixaAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 4 }}>
            BB Ag 0892 · Sicredi Ag 0748 (100% Conciliado)
          </div>
        </div>

        {/* Card 2: Contas a Receber */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--joint)', borderRadius: 14, padding: 18, borderLeft: '4px solid #3B82F6' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800 }}>
            Contas a Receber (Próx. 30d)
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#3B82F6', marginTop: 4 }}>
            R$ {totalReceberAberto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 4 }}>
            Recebido no mês: R$ {totalRecebidoMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        </div>

        {/* Card 3: Contas a Pagar */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--joint)', borderRadius: 14, padding: 18, borderLeft: '4px solid #F59E0B' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800 }}>
            Contas a Pagar (Próx. 30d)
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#F59E0B', marginTop: 4 }}>
            R$ {totalPagarAberto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 4 }}>
            Liquidado no mês: R$ {totalPagoMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        </div>

        {/* Card 4: Saldo Projetado Fim de Mês */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--joint)', borderRadius: 14, padding: 18, borderLeft: '4px solid #8B5CF6' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800 }}>
            Saldo Projetado Fim de Mês
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#8B5CF6', marginTop: 4 }}>
            R$ {saldoProjetadoFimMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 4 }}>
            Superávit Operacional Líquido
          </div>
        </div>

        {/* Card 5: EBITDA da Usina */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--joint)', borderRadius: 14, padding: 18, borderLeft: '4px solid #C5A059' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800 }}>
            EBITDA Usina Serrano
          </div>
          <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#C5A059', marginTop: 4 }}>
            R$ 226.000,00
          </div>
          <div style={{ fontSize: '0.78rem', color: '#10B981', fontWeight: 700, marginTop: 4 }}>
            Margem EBITDA: 28,0% s/ Faturamento
          </div>
        </div>

      </div>

      {/* ─── NAVEGAÇÃO DE SUB-ABAS FINANCEIRAS ─── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderBottom: '1px solid var(--joint)', paddingBottom: 10, marginBottom: 20 }}>
        {[
          { id: 'receber', label: 'Contas a Receber & Medições de Obras', icone: '💳', badge: contasReceber.filter(c => c.status === 'aberto').length },
          { id: 'pagar', label: 'Contas a Pagar & Insumos Usina', icone: '🧾', badge: contasPagar.filter(p => p.status === 'aberto').length },
          { id: 'fluxo', label: 'Fluxo de Caixa Diário & Projetado', icone: '📈' },
          { id: 'dre', label: 'DRE Gerencial & Margens por m³', icone: '📊' },
          { id: 'breakeven', label: 'Ponto de Equilíbrio & Sensibilidade', icone: '⚖️' },
          { id: 'cashpooling', label: 'Cash Pooling Grupo Palatare', icone: '🏦' }
        ].map(item => {
          const ativo = subAba === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSubAba(item.id)}
              style={{
                padding: '9px 16px',
                borderRadius: 8,
                border: '1px solid',
                borderColor: ativo ? '#FF6B2C' : 'var(--joint)',
                background: ativo ? 'rgba(255, 107, 44, 0.12)' : 'var(--surface)',
                color: ativo ? '#FF6B2C' : 'var(--text-main)',
                fontWeight: ativo ? 900 : 600,
                fontSize: '0.86rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.15s ease'
              }}
            >
              <span>{item.icone}</span>
              {item.label}
              {item.badge !== undefined && item.badge > 0 && (
                <span style={{ 
                  background: ativo ? '#FF6B2C' : 'var(--joint)', 
                  color: ativo ? '#fff' : 'var(--text-main)', 
                  borderRadius: 10, 
                  padding: '2px 7px', 
                  fontSize: '0.72rem', 
                  fontWeight: 900 
                }}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─── CONTEÚDO DA SUB-ABA 1: CONTAS A RECEBER & MEDIÇÕES DE OBRAS ─── */}
      {subAba === 'receber' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)' }}>Filtro:</span>
              {['todos', 'aberto', 'em_medicao', 'pago', 'atrasado'].map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setFiltroStatusReceber(st)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--joint)',
                    background: filtroStatusReceber === st ? 'var(--text-main)' : 'var(--surface)',
                    color: filtroStatusReceber === st ? 'var(--bg-card)' : 'var(--muted)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {st === 'todos' ? 'Todos' : st === 'aberto' ? 'A Vencer' : st === 'em_medicao' ? 'Em Medição' : st === 'pago' ? 'Liquidados' : 'Atrasados'}
                </button>
              ))}
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
              Mostrando <b>{contasReceber.filter(c => filtroStatusReceber === 'todos' || c.status === filtroStatusReceber).length}</b> títulos de construtoras
            </div>
          </div>

          <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--joint)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.03)', borderBottom: '1px solid var(--joint)', color: 'var(--muted)', textTransform: 'uppercase', fontSize: '0.74rem', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '12px 16px' }}>Código / Fatura</th>
                  <th style={{ padding: '12px 16px' }}>Construtora / Obra</th>
                  <th style={{ padding: '12px 16px' }}>Volume & FCK</th>
                  <th style={{ padding: '12px 16px' }}>Vencimento</th>
                  <th style={{ padding: '12px 16px' }}>Valor Bruto</th>
                  <th style={{ padding: '12px 16px' }}>Retenção (5%)</th>
                  <th style={{ padding: '12px 16px' }}>Valor Líquido</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {contasReceber
                  .filter(c => filtroStatusReceber === 'todos' || c.status === filtroStatusReceber)
                  .map(rec => {
                    const stColor = rec.status === 'pago' ? '#10B981' : rec.status === 'atrasado' ? '#EF4444' : rec.status === 'em_medicao' ? '#8B5CF6' : '#3B82F6';
                    const stLabel = rec.status === 'pago' ? 'Liquidado' : rec.status === 'atrasado' ? 'Vencido' : rec.status === 'em_medicao' ? 'Em Medição' : 'A Vencer';

                    return (
                      <tr key={rec.id} style={{ borderBottom: '1px solid var(--joint)' }}>
                        <td style={{ padding: '14px 16px', fontWeight: 800 }}>
                          <div>{rec.id}</div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--muted)', fontWeight: 500 }}>Emissão: {rec.dataEmissao}</div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{rec.cliente}</div>
                          <div style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>{rec.obra}</div>
                          <div style={{ fontSize: '0.72rem', color: '#10B981', fontWeight: 600 }}>{rec.laudoNbr5739}</div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 800 }}>{rec.volumeM3} m³</div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>{rec.fck}</div>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 800, color: rec.status === 'atrasado' ? '#EF4444' : 'var(--text-main)' }}>{rec.vencimento}</div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>{rec.forma}</div>
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                          R$ {rec.valorBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#F59E0B', fontWeight: 600 }}>
                          {rec.retencaoTecnicaPercent > 0 ? `- R$ ${rec.valorRetencao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '0%'}
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 900, color: '#10B981', fontSize: '0.98rem' }}>
                          R$ {rec.valorLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ 
                            background: `rgba(${rec.status === 'pago' ? '16, 185, 129' : rec.status === 'atrasado' ? '239, 68, 68' : rec.status === 'em_medicao' ? '139, 92, 246' : '59, 130, 246'}, 0.15)`,
                            color: stColor,
                            padding: '4px 9px',
                            borderRadius: 6,
                            fontSize: '0.75rem',
                            fontWeight: 800
                          }}>
                            {stLabel}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <button
                              type="button"
                              title="Visualizar e Imprimir Boleto com Pix"
                              onClick={() => setModalBoletoAberto(rec)}
                              style={{
                                background: 'var(--surface)',
                                border: '1px solid var(--joint)',
                                borderRadius: 6,
                                padding: '6px 10px',
                                cursor: 'pointer',
                                fontSize: '0.82rem',
                                fontWeight: 700
                              }}
                            >
                              📄 Boleto
                            </button>

                            <button
                              type="button"
                              title="Enviar fatura via WhatsApp"
                              onClick={() => handleEnviarBoletoWhatsapp(rec)}
                              style={{
                                background: '#25D366',
                                border: 'none',
                                borderRadius: 6,
                                padding: '6px 10px',
                                color: '#fff',
                                cursor: 'pointer',
                                fontSize: '0.82rem',
                                fontWeight: 700
                              }}
                            >
                              💬
                            </button>

                            {rec.status !== 'pago' && (
                              <button
                                type="button"
                                title="Liquidar Título / Registrar Pagamento"
                                onClick={() => handleBaixarReceber(rec.id)}
                                style={{
                                  background: '#10B981',
                                  border: 'none',
                                  borderRadius: 6,
                                  padding: '6px 10px',
                                  color: '#fff',
                                  cursor: 'pointer',
                                  fontSize: '0.82rem',
                                  fontWeight: 700
                                }}
                              >
                                ✓ Baixar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <div style={{ background: 'rgba(197, 160, 89, 0.08)', border: '1px solid #C5A059', borderRadius: 10, padding: 14, fontSize: '0.84rem', color: 'var(--text-main)' }}>
            <b>ℹ️ Política de Retenção Técnica & Liberação NBR 5739:</b> As construtoras retêm contratualmente de 5% a 10% do valor da medição até a entrega dos laudos oficiais de ruptura aos 28 dias. O sistema Kytto sincroniza os laudos do laboratório tecnológico diretamente na fatura para liberação automática das retenções.
          </div>

        </div>
      )}

      {/* ─── CONTEÚDO DA SUB-ABA 2: CONTAS A PAGAR & INSUMOS USINA ─── */}
      {subAba === 'pagar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--muted)' }}>Filtro:</span>
              {['todos', 'aberto', 'pago'].map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setFiltroStatusPagar(st)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--joint)',
                    background: filtroStatusPagar === st ? 'var(--text-main)' : 'var(--surface)',
                    color: filtroStatusPagar === st ? 'var(--bg-card)' : 'var(--muted)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {st === 'todos' ? 'Todos' : st === 'aberto' ? 'A Pagar' : 'Pagos'}
                </button>
              ))}
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
              Total a pagar em aberto: <b style={{ color: '#F59E0B' }}>R$ {totalPagarAberto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</b>
            </div>
          </div>

          <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--joint)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.03)', borderBottom: '1px solid var(--joint)', color: 'var(--muted)', textTransform: 'uppercase', fontSize: '0.74rem', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '12px 16px' }}>Código</th>
                  <th style={{ padding: '12px 16px' }}>Fornecedor / Insumo</th>
                  <th style={{ padding: '12px 16px' }}>Categoria</th>
                  <th style={{ padding: '12px 16px' }}>Documento</th>
                  <th style={{ padding: '12px 16px' }}>Vencimento</th>
                  <th style={{ padding: '12px 16px' }}>Valor</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {contasPagar
                  .filter(p => filtroStatusPagar === 'todos' || p.status === filtroStatusPagar)
                  .map(pag => (
                    <tr key={pag.id} style={{ borderBottom: '1px solid var(--joint)' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 800 }}>{pag.id}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{pag.fornecedor}</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>{pag.detalhes}</div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ background: 'rgba(0,0,0,0.05)', padding: '3px 8px', borderRadius: 4, fontSize: '0.76rem', fontWeight: 600 }}>
                          {pag.categoria}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '0.82rem', color: 'var(--muted)' }}>
                        {pag.nfEntrada}
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: 700 }}>
                        {pag.vencimento}
                        <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{pag.forma}</div>
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: 900, color: '#EF4444', fontSize: '0.98rem' }}>
                        R$ {pag.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ 
                          background: pag.status === 'pago' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: pag.status === 'pago' ? '#10B981' : '#F59E0B',
                          padding: '4px 9px',
                          borderRadius: 6,
                          fontSize: '0.75rem',
                          fontWeight: 800
                        }}>
                          {pag.status === 'pago' ? 'Pago' : 'A Pagar'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        {pag.status !== 'pago' ? (
                          <button
                            type="button"
                            onClick={() => handleBaixarPagar(pag.id)}
                            style={{
                              background: '#10B981',
                              border: 'none',
                              borderRadius: 6,
                              padding: '6px 12px',
                              color: '#fff',
                              cursor: 'pointer',
                              fontSize: '0.82rem',
                              fontWeight: 700
                            }}
                          >
                            ✓ Pagar
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: '#10B981', fontWeight: 700 }}>
                            Liquidado
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* ─── CONTEÚDO DA SUB-ABA 3: FLUXO DE CAIXA DIÁRIO & PROJETADO (DFC) ─── */}
      {subAba === 'fluxo' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--joint)', borderRadius: 14, padding: 20 }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 800 }}>
              Demonstração do Fluxo de Caixa Diário & Projeção 30 Dias (Novembro/2026)
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
              {[
                { dia: '10/11 (Seg)', ent: 45200, sai: 14300, saldo: 428500 },
                { dia: '12/11 (Qua)', ent: 0, sai: 0, saldo: 428500 },
                { dia: '15/11 (Sex)', ent: 0, sai: 42500, saldo: 386000 },
                { dia: '18/11 (Seg)', ent: 36575, sai: 12600, saldo: 409975 },
                { dia: '22/11 (Sex)', ent: 0, sai: 74000, saldo: 335975 },
                { dia: '25/11 (Seg)', ent: 70680, sai: 54200, saldo: 352455 },
                { dia: '28/11 (Qui)', ent: 59660, sai: 0, saldo: 412115 },
                { dia: '30/11 (Sáb)', ent: 0, sai: 19800, saldo: 392315 },
                { dia: '05/12 (Qui)', ent: 88740, sai: 68200, saldo: 412855 }
              ].map((f, i) => (
                <div key={i} style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid var(--joint)', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-main)' }}>{f.dia}</div>
                  <div style={{ fontSize: '0.75rem', color: '#10B981', marginTop: 4 }}>+ R$ {f.ent.toLocaleString('pt-BR')}</div>
                  <div style={{ fontSize: '0.75rem', color: '#EF4444' }}>- R$ {f.sai.toLocaleString('pt-BR')}</div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#3B82F6', marginTop: 6, borderTop: '1px dashed var(--joint)', paddingTop: 4 }}>
                    R$ {f.saldo.toLocaleString('pt-BR')}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid #10B981', borderRadius: 10, padding: 14 }}>
              <div style={{ fontWeight: 800, color: '#10B981', fontSize: '0.92rem' }}>
                ✓ Análise de Liquidez Operacional Segura:
              </div>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-main)', marginTop: 4 }}>
                Em nenhum dia do horizonte projetado de 30 dias o saldo de caixa fica abaixo de R$ 335.000,00, mantendo ampla cobertura do capital de giro e dispensando qualquer contratação de crédito bancário ou antecipação de recebíveis.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── CONTEÚDO DA SUB-ABA 4: DRE GERENCIAL & MARGENS POR M³ ─── */}
      {subAba === 'dre' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--joint)', borderRadius: 14, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900 }}>
                DRE Gerencial Consolidada · Serrano Concreto Usinado & Mineração
              </h3>
              <span style={{ fontSize: '0.84rem', color: 'var(--muted)' }}>Competência: Novembro/2026 (1.830 m³ faturados)</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: '(=) RECEITA BRUTA DE VENDAS & SERVIÇOS', val: 850000.00, perc: '100,0%', neg: false, bold: true, bg: 'rgba(0,0,0,0.03)' },
                { label: '   (–) Concreto Usinado FCK 20 a 40 MPa (1.830 m³)', val: 785000.00, perc: '92,4%', neg: false, bold: false },
                { label: '   (–) Serviços de Bombeamento com Bomba-Lança 32m', val: 65000.00, perc: '7,6%', neg: false, bold: false },
                { label: '(–) DEDUÇÕES E TRIBUTOS SOBRE FATURAMENTO', val: -42500.00, perc: '-5,0%', neg: true, bold: true, bg: 'rgba(239, 68, 68, 0.05)' },
                { label: '   (–) ISSQN Serviços de Concretagem (3,0% Tangará)', val: -25500.00, perc: '-3,0%', neg: true, bold: false },
                { label: '   (–) CFEM Mineração e Extração de Agregados (1,5%)', val: -4250.00, perc: '-0,5%', neg: true, bold: false },
                { label: '   (–) Simples Nacional / Tributos Federais Unificados', val: -12750.00, perc: '-1,5%', neg: true, bold: false },
                { label: '(=) RECEITA OPERACIONAL LÍQUIDA', val: 807500.00, perc: '95,0%', neg: false, bold: true, bg: 'rgba(59, 130, 246, 0.08)', color: '#3B82F6' },
                { label: '(–) CUSTO DOS PRODUTOS & INSUMOS VENDIDOS (CPV)', val: -498000.00, perc: '-61,7%', neg: true, bold: true, bg: 'rgba(245, 158, 11, 0.05)' },
                { label: '   (–) Cimento Portland a Granel CP II-F-32 (Votoran)', val: -238000.00, perc: '-29,5%', neg: true, bold: false },
                { label: '   (–) Agregados da Mineração (Areia Lavada + Britas 0 e 1)', val: -136000.00, perc: '-16,8%', neg: true, bold: false },
                { label: '   (–) Aditivos Químicos Superplastificantes (BASF)', val: -39000.00, perc: '-4,8%', neg: true, bold: false },
                { label: '   (–) Combustível Diesel S10 da Frota e Pás Carregadeiras', val: -85000.00, perc: '-10,5%', neg: true, bold: false },
                { label: '(=) MARGEM DE CONTRIBUIÇÃO BRUTA', val: 309500.00, perc: '38,3%', neg: false, bold: true, bg: 'rgba(16, 185, 129, 0.08)', color: '#10B981' },
                { label: '(–) DESPESAS OPERACIONAIS & ADMINISTRATIVAS', val: -83500.00, perc: '-10,3%', neg: true, bold: true },
                { label: '   (–) Folha de Pagamento Usina (Operadores, Laboratório, Motoristas)', val: -68200.00, perc: '-8,4%', neg: true, bold: false },
                { label: '   (–) Energia Elétrica Trifásica Usina 380V (Energisa MT)', val: -14300.00, perc: '-1,8%', neg: true, bold: false },
                { label: '   (–) Softwares Kytto, Comunicação e Despesas Gerais', val: -1000.00, perc: '-0,1%', neg: true, bold: false },
                { label: '(=) EBITDA OPERACIONAL DA USINA', val: 226000.00, perc: '28,0%', neg: false, bold: true, bg: 'rgba(197, 160, 89, 0.15)', color: '#C5A059' },
                { label: '(–) Depreciação de Equipamentos, Betoneiras e Usina', val: -22000.00, perc: '-2,7%', neg: true, bold: false },
                { label: '(=) LUCRO LÍQUIDO OPERACIONAL DA USINA', val: 204000.00, perc: '25,3%', neg: false, bold: true, bg: 'rgba(16, 185, 129, 0.18)', color: '#10B981' }
              ].map((row, idx) => (
                <div 
                  key={idx}
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '8px 12px', 
                    borderRadius: 6,
                    background: row.bg || 'transparent',
                    fontWeight: row.bold ? 800 : 500,
                    fontSize: row.bold ? '0.92rem' : '0.84rem'
                  }}
                >
                  <span style={{ color: row.color || 'var(--text-main)' }}>{row.label}</span>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <span style={{ width: 60, textAlign: 'right', fontSize: '0.78rem', color: 'var(--muted)' }}>{row.perc}</span>
                    <span style={{ width: 140, textAlign: 'right', color: row.color || (row.neg ? '#EF4444' : 'var(--text-main)') }}>
                      R$ {row.val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 24, padding: 16, background: 'rgba(0,0,0,0.02)', borderRadius: 10, border: '1px solid var(--joint)' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.94rem', fontWeight: 800 }}>Métricas Unitárias Médias por m³ de Concreto:</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <div>Preço Médio de Venda: <b style={{ color: '#10B981' }}>R$ 464,50/m³</b></div>
                <div>Custo Médio de Insumos: <b style={{ color: '#EF4444' }}>R$ 272,13/m³</b></div>
                <div>Margem Bruta Unitária: <b style={{ color: '#3B82F6' }}>R$ 169,12/m³ (36,4%)</b></div>
                <div>EBITDA por m³: <b style={{ color: '#C5A059' }}>R$ 123,50/m³</b></div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ─── CONTEÚDO DA SUB-ABA 5: PONTO DE EQUILÍBRIO & ANÁLISE DE SENSIBILIDADE ─── */}
      {subAba === 'breakeven' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--joint)', borderRadius: 14, padding: 24 }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: 900 }}>
              Simulador Interativo de Break-Even (Ponto de Equilíbrio Metrológico)
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '0.86rem', color: 'var(--muted)' }}>
              Simule como oscilações de volume de vendas e custos de matéria-prima impactam a lucratividade e o volume mínimo de segurança da usina.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 24 }}>
              <div style={{ background: 'rgba(0,0,0,0.02)', padding: 16, borderRadius: 10, border: '1px solid var(--joint)' }}>
                <label style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-main)', display: 'block', marginBottom: 8 }}>
                  Volume Mensal de Concreto (m³): <b>{simulacaoVolumeM3} m³</b>
                </label>
                <input 
                  type="range" 
                  min="500" 
                  max="3000" 
                  step="50"
                  value={simulacaoVolumeM3}
                  onChange={e => setSimulacaoVolumeM3(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--muted)' }}>
                  <span>500 m³</span>
                  <span>Break-Even: 820 m³</span>
                  <span>3.000 m³</span>
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.02)', padding: 16, borderRadius: 10, border: '1px solid var(--joint)' }}>
                <label style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-main)', display: 'block', marginBottom: 8 }}>
                  Preço Médio por m³ (R$): <b>R$ {simulacaoPrecoMedio.toFixed(2)}</b>
                </label>
                <input 
                  type="range" 
                  min="380" 
                  max="550" 
                  step="5"
                  value={simulacaoPrecoMedio}
                  onChange={e => setSimulacaoPrecoMedio(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--muted)' }}>
                  <span>R$ 380,00</span>
                  <span>Atual: R$ 464,50</span>
                  <span>R$ 550,00</span>
                </div>
              </div>
            </div>

            {/* Resultado do Simulador */}
            {(() => {
              const recBruta = simulacaoVolumeM3 * simulacaoPrecoMedio;
              const deducoes = recBruta * 0.05;
              const recLiq = recBruta - deducoes;
              const cpv = simulacaoVolumeM3 * 272.13;
              const margemContrib = recLiq - cpv;
              const custosFixos = 83500.00;
              const ebitda = margemContrib - custosFixos;
              const breakEvenM3 = Math.round(custosFixos / ((simulacaoPrecoMedio * 0.95) - 272.13));
              const margemSegurancaPerc = (((simulacaoVolumeM3 - breakEvenM3) / simulacaoVolumeM3) * 100).toFixed(1);

              return (
                <div style={{ background: 'rgba(197, 160, 89, 0.08)', border: '1px solid #C5A059', borderRadius: 12, padding: 20 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 700 }}>Volume de Ponto de Equilíbrio</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#3B82F6' }}>{breakEvenM3} m³/mês</div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>Volume mínimo para não ter prejuízo</div>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 700 }}>Margem de Segurança Operacional</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#10B981' }}>{margemSegurancaPerc}%</div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>{simulacaoVolumeM3 - breakEvenM3} m³ acima do ponto crítico</div>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 700 }}>EBITDA Projetado no Cenário</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 900, color: ebitda >= 0 ? '#10B981' : '#EF4444' }}>
                        R$ {ebitda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>Margem: {((ebitda / recBruta) * 100).toFixed(1)}%</div>
                    </div>
                  </div>
                </div>
              );
            })()}

          </div>
        </div>
      )}

      {/* ─── CONTEÚDO DA SUB-ABA 6: CASH POOLING GRUPO PALATARE ─── */}
      {subAba === 'cashpooling' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--joint)', borderRadius: 14, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.8rem' }}>🏦</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900 }}>
                    Central de Cash Pooling & Mútuo Corporativo · Holding Grupo Palatare
                  </h3>
                  <div style={{ fontSize: '0.84rem', color: 'var(--muted)' }}>
                    Gestão Centralizada de Liquidez entre Serrano Concreto, Palatare Pizzaria e Holding S/A
                  </div>
                </div>
              </div>

              <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', padding: '6px 12px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 800 }}>
                ● Barramento A2 Síncrono Ativo
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
              <div style={{ background: 'rgba(0,0,0,0.02)', padding: 16, borderRadius: 10, border: '1px solid var(--joint)' }}>
                <div style={{ fontSize: '0.76rem', color: 'var(--muted)', fontWeight: 700 }}>Saldo Serrano Concreto</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#FF6B2C', marginTop: 4 }}>R$ 428.500,00</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>Conta Operacional Sicredi Tangará</div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.02)', padding: 16, borderRadius: 10, border: '1px solid var(--joint)' }}>
                <div style={{ fontSize: '0.76rem', color: 'var(--muted)', fontWeight: 700 }}>Saldo Palatare Pizzaria</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#EF4444', marginTop: 4 }}>R$ 168.200,00</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>Conta Operacional Banco do Brasil</div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.02)', padding: 16, borderRadius: 10, border: '1px solid var(--joint)' }}>
                <div style={{ fontSize: '0.76rem', color: 'var(--muted)', fontWeight: 700 }}>Tesouraria Central Holding</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#C5A059', marginTop: 4 }}>R$ 516.800,00</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>Aplicação CDB 102% CDI Automático</div>
              </div>

              <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: 16, borderRadius: 10, border: '1px solid #10B981' }}>
                <div style={{ fontSize: '0.76rem', color: 'var(--muted)', fontWeight: 700 }}>Liquidez Imediata Consolidada</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#10B981', marginTop: 4 }}>R$ 1.113.500,00</div>
                <div style={{ fontSize: '0.74rem', color: '#10B981', fontWeight: 700 }}>Poder de Fogo Conglomerado</div>
              </div>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid var(--joint)', borderRadius: 10, padding: 16 }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '0.94rem', fontWeight: 800 }}>Regras do Contrato de Mútuo Intercompany (Receita Federal):</h4>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: '0.84rem', color: 'var(--text-main)', lineHeight: 1.6 }}>
                <li><b>Remuneração:</b> Atualização pela taxa Selic oficial diária com liquidação mensal.</li>
                <li><b>Isenção de IOF:</b> Respaldado pelo Decreto Federal nº 6.306/2007 para holdings com previsão estatutária de centralização financeira.</li>
                <li><b>Finalidade:</b> Elimina custos de cheque especial ou empréstimos bancários externos quando qualquer unidade necessita de reforço momentâneo de capital de giro.</li>
              </ul>
            </div>

          </div>
        </div>
      )}

      {/* ─── MODAL: VISUALIZAÇÃO E IMPRESSÃO DE BOLETO COM PIX QR CODE ─── */}
      {modalBoletoAberto && (
        <div className="serrano-modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 16 }}>
          <div style={{ background: '#fff', color: '#111', borderRadius: 12, maxWidth: 680, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #C5A059', paddingBottom: 12, marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#C5A059' }}>
                  SERRANO CONCRETO USINADO & MINERAÇÃO LTDA
                </h3>
                <div style={{ fontSize: '0.76rem', color: '#666' }}>
                  CNPJ: 53.798.485/0001-77 · Rodovia MT-358 km 08 · Tangará da Serra/MT
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setModalBoletoAberto(null)} 
                style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#666' }}
              >
                ✕
              </button>
            </div>

            {/* Recibo do Pagador */}
            <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 14, marginBottom: 16, background: '#fafafa' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#666', textTransform: 'uppercase' }}>Pagador / Construtora</div>
                  <div style={{ fontWeight: 800, fontSize: '0.92rem' }}>{modalBoletoAberto.cliente}</div>
                  <div style={{ fontSize: '0.76rem', color: '#666' }}>CNPJ: {modalBoletoAberto.cnpj}</div>
                  <div style={{ fontSize: '0.76rem', color: '#666' }}>Obra: {modalBoletoAberto.obra}</div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.72rem', color: '#666', textTransform: 'uppercase' }}>Vencimento</div>
                  <div style={{ fontWeight: 900, fontSize: '1.1rem', color: '#EF4444' }}>{modalBoletoAberto.vencimento}</div>
                  <div style={{ fontSize: '0.72rem', color: '#666', marginTop: 4 }}>Valor a Pagar</div>
                  <div style={{ fontWeight: 900, fontSize: '1.15rem', color: '#10B981' }}>
                    R$ {modalBoletoAberto.valorLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px dashed #ccc', paddingTop: 8, fontSize: '0.78rem', color: '#444' }}>
                Concretagem estrutural: <b>{modalBoletoAberto.volumeM3} m³ ({modalBoletoAberto.fck})</b> · Retenção Técnica: <b>{modalBoletoAberto.retencaoTecnicaPercent}% (R$ {modalBoletoAberto.valorRetencao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})</b> · Laudo NBR 5739: <b>{modalBoletoAberto.laudoNbr5739}</b>
              </div>
            </div>

            {/* Pix QR Code Integrado */}
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 16, alignItems: 'center', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: 14, marginBottom: 16 }}>
              <div style={{ background: '#fff', padding: 8, borderRadius: 6, textAlign: 'center', border: '1px solid #86EFAC' }}>
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(modalBoletoAberto.pixCopiaCola)}`} 
                  alt="QR Code Pix"
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#16A34A', marginTop: 4, display: 'block' }}>PIX NOVO NBR</span>
              </div>

              <div>
                <div style={{ fontWeight: 900, fontSize: '0.94rem', color: '#166534', marginBottom: 4 }}>
                  Pague com Pix Instantâneo (Liquidação 24h)
                </div>
                <div style={{ fontSize: '0.76rem', color: '#15803D', marginBottom: 8 }}>
                  Aponte a câmera do aplicativo do seu banco para o QR Code ao lado ou utilize o Pix Copia e Cola.
                </div>
                <div style={{ background: '#fff', border: '1px solid #86EFAC', borderRadius: 6, padding: '6px 10px', fontSize: '0.7rem', color: '#333', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                  {modalBoletoAberto.pixCopiaCola}
                </div>
              </div>
            </div>

            {/* Linha Digitável do Boleto */}
            <div style={{ background: '#fff', border: '1px solid #ccc', borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <div style={{ fontSize: '0.72rem', color: '#666', textTransform: 'uppercase' }}>Linha Digitável ({modalBoletoAberto.banco})</div>
              <div style={{ fontWeight: 800, fontSize: '0.88rem', fontFamily: 'monospace', letterSpacing: '0.04em', color: '#000', margin: '4px 0' }}>
                {modalBoletoAberto.linhaDigitavel}
              </div>
              <div style={{ height: 42, background: 'repeating-linear-gradient(90deg, #000, #000 2px, transparent 2px, transparent 4px, #000 4px, #000 7px, transparent 7px, transparent 9px)', marginTop: 8 }}></div>
            </div>

            {/* Ações */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button 
                type="button" 
                onClick={() => window.print()}
                style={{ padding: '9px 18px', background: '#333', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}
              >
                🖨️ Imprimir Fatura / Boleto
              </button>
              <button 
                type="button" 
                onClick={() => setModalBoletoAberto(null)}
                style={{ padding: '9px 18px', background: '#e5e7eb', color: '#333', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}
              >
                Fechar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ─── MODAL: NOVA MEDIÇÃO DE OBRA ─── */}
      {modalNovaMedicao && (
        <div className="serrano-modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 16 }}>
          <div style={{ background: 'var(--surface)', color: 'var(--text-main)', borderRadius: 14, maxWidth: 560, width: '100%', padding: 24, border: '1px solid var(--joint)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', fontWeight: 900 }}>
              Emitir Nova Medição & Fatura de Concretagem
            </h3>

            <form onSubmit={handleSalvarMedicao} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>Construtora / Cliente *</label>
                <input 
                  type="text"
                  required
                  value={formMedicao.cliente}
                  onChange={e => setFormMedicao({ ...formMedicao, cliente: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--joint)', background: 'var(--bg-card)', color: 'var(--text-main)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>Obra / Local *</label>
                <input 
                  type="text"
                  required
                  value={formMedicao.obra}
                  onChange={e => setFormMedicao({ ...formMedicao, obra: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--joint)', background: 'var(--bg-card)', color: 'var(--text-main)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>Volume de Concreto (m³)</label>
                  <input 
                    type="number"
                    step="0.5"
                    required
                    value={formMedicao.volumeM3}
                    onChange={e => setFormMedicao({ ...formMedicao, volumeM3: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--joint)', background: 'var(--bg-card)', color: 'var(--text-main)' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>Preço por m³ (R$)</label>
                  <input 
                    type="number"
                    step="1"
                    required
                    value={formMedicao.precoM3}
                    onChange={e => setFormMedicao({ ...formMedicao, precoM3: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--joint)', background: 'var(--bg-card)', color: 'var(--text-main)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>Retenção Técnica Caução (%)</label>
                  <select 
                    value={formMedicao.retencaoTecnicaPercent}
                    onChange={e => setFormMedicao({ ...formMedicao, retencaoTecnicaPercent: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--joint)', background: 'var(--bg-card)', color: 'var(--text-main)' }}
                  >
                    <option value="0">0% (Sem Retenção)</option>
                    <option value="5">5% (Padrão Obras)</option>
                    <option value="10">10% (Contratos Grandes)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>Condição de Pagamento</label>
                  <select 
                    value={formMedicao.prazoDias}
                    onChange={e => setFormMedicao({ ...formMedicao, prazoDias: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--joint)', background: 'var(--bg-card)', color: 'var(--text-main)' }}
                  >
                    <option value="15">Boleto 15 DDL</option>
                    <option value="28">Boleto 28 DDL (Padrão)</option>
                    <option value="42">Boleto 42 DDL</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button 
                  type="button" 
                  onClick={() => setModalNovaMedicao(false)}
                  style={{ padding: '9px 16px', background: 'var(--surface)', border: '1px solid var(--joint)', color: 'var(--text-main)', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="serrano-btn-gold"
                  style={{ padding: '9px 18px', fontWeight: 800 }}
                >
                  Gerar Medição & Boleto Pix
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: NOVO CONTAS A PAGAR ─── */}
      {modalNovoPagar && (
        <div className="serrano-modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 16 }}>
          <div style={{ background: 'var(--surface)', color: 'var(--text-main)', borderRadius: 14, maxWidth: 520, width: '100%', padding: 24, border: '1px solid var(--joint)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', fontWeight: 900 }}>
              Lançar Novo Título no Contas a Pagar
            </h3>

            <form onSubmit={handleSalvarPagar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>Fornecedor *</label>
                <input 
                  type="text"
                  required
                  placeholder="Ex: Votorantim Cimentos S/A"
                  value={formPagar.fornecedor}
                  onChange={e => setFormPagar({ ...formPagar, fornecedor: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--joint)', background: 'var(--bg-card)', color: 'var(--text-main)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>Categoria do Insumo</label>
                  <select 
                    value={formPagar.categoria}
                    onChange={e => setFormPagar({ ...formPagar, categoria: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--joint)', background: 'var(--bg-card)', color: 'var(--text-main)' }}
                  >
                    <option value="Cimento a Granel">Cimento a Granel</option>
                    <option value="Brita e Agregados">Brita e Agregados</option>
                    <option value="Areia Lavada">Areia Lavada</option>
                    <option value="Aditivos Químicos">Aditivos Químicos</option>
                    <option value="Óleo Diesel Frota">Óleo Diesel Frota</option>
                    <option value="Manutenção e Peças">Manutenção e Peças</option>
                    <option value="Energia Elétrica">Energia Elétrica Usina</option>
                    <option value="Folha e Encargos">Folha e Encargos</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>Nota Fiscal de Entrada</label>
                  <input 
                    type="text"
                    placeholder="NF-e 12345"
                    value={formPagar.nfEntrada}
                    onChange={e => setFormPagar({ ...formPagar, nfEntrada: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--joint)', background: 'var(--bg-card)', color: 'var(--text-main)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>Data de Vencimento *</label>
                  <input 
                    type="date"
                    required
                    value={formPagar.vencimento}
                    onChange={e => setFormPagar({ ...formPagar, vencimento: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--joint)', background: 'var(--bg-card)', color: 'var(--text-main)' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>Valor do Título (R$) *</label>
                  <input 
                    type="number"
                    step="0.01"
                    required
                    placeholder="0,00"
                    value={formPagar.valor}
                    onChange={e => setFormPagar({ ...formPagar, valor: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--joint)', background: 'var(--bg-card)', color: 'var(--text-main)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: 4 }}>Descrição / Detalhes</label>
                <input 
                  type="text"
                  placeholder="Ex: 30 toneladas cimento para reposição do Silo 01"
                  value={formPagar.detalhes}
                  onChange={e => setFormPagar({ ...formPagar, detalhes: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1px solid var(--joint)', background: 'var(--bg-card)', color: 'var(--text-main)' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <button 
                  type="button" 
                  onClick={() => setModalNovoPagar(false)}
                  style={{ padding: '9px 16px', background: 'var(--surface)', border: '1px solid var(--joint)', color: 'var(--text-main)', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="serrano-btn-gold"
                  style={{ padding: '9px 18px', fontWeight: 800 }}
                >
                  Salvar Título a Pagar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: CASH POOLING E CENTRALIZAÇÃO ─── */}
      {modalCashPooling && (
        <div className="serrano-modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 16 }}>
          <div style={{ background: 'var(--surface)', color: 'var(--text-main)', borderRadius: 14, maxWidth: 580, width: '100%', padding: 24, border: '1px solid var(--joint)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#C5A059' }}>
                🏦 Remessa Automática de Caixa para Holding S/A
              </h3>
              <button 
                type="button" 
                onClick={() => setModalCashPooling(false)} 
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--muted)' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.86rem', color: 'var(--muted)', margin: '0 0 16px 0' }}>
              Transferência de sobras de liquidez da <b>Serrano Concreto Usinado</b> para a conta centralizadora de investimentos da <b>Holding Grupo Palatare Participações S/A</b> remunerada a 102% do CDI.
            </p>

            <div style={{ background: 'rgba(0,0,0,0.02)', padding: 14, borderRadius: 8, border: '1px solid var(--joint)', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', marginBottom: 6 }}>
                <span>Saldo Atual Serrano Concreto:</span>
                <b>R$ 428.500,00</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', marginBottom: 6 }}>
                <span>Reserva Mínima Operacional Usina:</span>
                <b>R$ 150.000,00</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', fontWeight: 800, color: '#10B981', borderTop: '1px dashed var(--joint)', paddingTop: 6 }}>
                <span>Disponível para Aplicação Centralizada:</span>
                <span>R$ 278.500,00</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button 
                type="button" 
                onClick={() => setModalCashPooling(false)}
                style={{ padding: '9px 16px', background: 'var(--surface)', border: '1px solid var(--joint)', color: 'var(--text-main)', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}
              >
                Voltar
              </button>
              <button 
                type="button" 
                className="serrano-btn-gold"
                onClick={() => {
                  setModalCashPooling(false);
                  toast({ title: 'Cash Pooling Executado', description: 'Remessa de R$ 200.000,00 transferida para a Holding a 102% CDI.', status: 'success' });
                }}
                style={{ padding: '9px 18px', fontWeight: 800 }}
              >
                Confirmar Remessa de R$ 200.000,00
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
