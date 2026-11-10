with open('web/src/pages/admin/BarbeariaAgendaPeriodo.jsx', 'r', encoding='utf-8') as f:
    c = f.read()

antigo = """  // Sincroniza quando os barbeiros ativos carregam
  useEffect(() => {
    if (
      (!visiveisIds || visiveisIds.length === 0) &&
      barbeirosAtivos.length > 0
    ) {
      setVisiveisIds(barbeirosAtivos.map((p) => p.id));
    }
  }, [barbeirosAtivos]);"""

novo = """  // Sincroniza e auto-reconcilia quando os barbeiros ativos carregam
  useEffect(() => {
    if (!barbeirosAtivos || barbeirosAtivos.length === 0) return;
    const idsAtivos = barbeirosAtivos.map((p) => p.id);
    if (!visiveisIds || visiveisIds.length === 0) {
      setVisiveisIds(idsAtivos);
      try {
        localStorage.setItem(STORAGE_KEY_VISIVEIS, JSON.stringify(idsAtivos));
      } catch (_) {}
      return;
    }
    // Auto-reconciliação resiliente: garante que novos profissionais ativos (como o Bruno)
    // sejam sempre incluídos na exibição, e remove do cache ex-profissionais desligados
    const setAtual = new Set(visiveisIds);
    const setAtivos = new Set(idsAtivos);
    let alterou = false;
    for (const id of idsAtivos) {
      if (!setAtual.has(id)) {
        setAtual.add(id);
        alterou = true;
      }
    }
    for (const id of Array.from(setAtual)) {
      if (!setAtivos.has(id)) {
        setAtual.delete(id);
        alterou = true;
      }
    }
    if (alterou) {
      const novos = Array.from(setAtual);
      setVisiveisIds(novos);
      try {
        localStorage.setItem(STORAGE_KEY_VISIVEIS, JSON.stringify(novos));
      } catch (_) {}
    }
  }, [barbeirosAtivos]);"""

if antigo in c:
    c = c.replace(antigo, novo, 1)
    with open('web/src/pages/admin/BarbeariaAgendaPeriodo.jsx', 'w', encoding='utf-8') as f:
        f.write(c)
    print('BarbeariaAgendaPeriodo.jsx atualizado com sucesso!')
else:
    print('AVISO: antigo nao encontrado diretamente')
