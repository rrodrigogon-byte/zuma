with open('web/src/pages/admin/dino/MetasComissoesPanel.jsx', 'r', encoding='utf8') as f:
    code = f.read()

target = """  // Profissionais filtrados pela busca
  const profissionaisFiltrados = useMemo(() => {
    if (!buscaNome) return profissionais
    const q = buscaNome.toLowerCase()
    return profissionais.filter((p) => p.nome.toLowerCase().includes(q) || (p.especialidade && p.especialidade.toLowerCase().includes(q)))
  }, [profissionais, buscaNome])"""

replacement = """  // Helper de normalização fonética e apelidos dos barbeiros da equipe Dino
  const matchProfissionalBusca = (prof, termo) => {
    if (!termo) return true;
    const t = String(termo || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').trim();
    const nomeNorm = String(prof?.nome || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
    const espNorm = String(prof?.especialidade || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');

    // Match direto por nome ou especialidade
    if (nomeNorm.includes(t) || espNorm.includes(t)) return true;

    // Aliases e apelidos comuns da equipe Dino
    if ((t.includes('naty') || t.includes('nati')) && (nomeNorm.includes('natani') || nomeNorm.includes('minanis'))) return true;
    if (t.includes('dino') && (nomeNorm.includes('guilherme') || nomeNorm.includes('cunha'))) return true;
    if (t.includes('ester') && (nomeNorm.includes('steffany') || nomeNorm.includes('oliveira'))) return true;
    if (t.includes('jhe') && (nomeNorm.includes('jhenyffer') || nomeNorm.includes('andrade'))) return true;

    return false;
  };

  // Profissionais filtrados pela busca inteligente
  const profissionaisFiltrados = useMemo(() => {
    if (!buscaNome) return profissionais;
    return profissionais.filter((p) => matchProfissionalBusca(p, buscaNome));
  }, [profissionais, buscaNome]);"""

if target in code:
    code = code.replace(target, replacement, 1)
    with open('web/src/pages/admin/dino/MetasComissoesPanel.jsx', 'w', encoding='utf8') as f:
        f.write(code)
    print('MetasComissoesPanel.jsx atualizado com busca inteligente de apelidos!')
else:
    print('Target nao encontrado em MetasComissoesPanel.jsx')
