with open('app/barbearia-erp-kytto.js', 'r', encoding='utf8') as f:
    c = f.read()

target = """export function listarAgendamentos(empresaId, filtros = {}) {
  const itens = Object.values(estadoEmpresa(empresaId, false).agendamentos)
    .filter((item) => !filtros.data || String(item.dataAgenda || chaveDia(item.dataHora)).slice(0, 10) === String(filtros.data).slice(0, 10))
    .filter((item) => !filtros.de || String(item.dataAgenda || chaveDia(item.dataHora)).slice(0, 10) >= String(filtros.de).slice(0, 10))
    .filter((item) => !filtros.ate || String(item.dataAgenda || chaveDia(item.dataHora)).slice(0, 10) <= String(filtros.ate).slice(0, 10))
    .filter((item) => !filtros.status || item.status === String(filtros.status))
    .filter((item) => !filtros.profissionalId || String(filtros.profissionalId).split(',').map(id => id.trim()).includes(item.profissionalId))
    .filter((item) => !filtros.lojaId || !item.lojaId || item.lojaId === String(filtros.lojaId))
    .sort(ordenarPorData);"""

replacement = """export function listarAgendamentos(empresaId, filtros = {}) {
  const telFiltro = filtros.telefone ? String(filtros.telefone).replace(/\\D/g, '') : '';
  const itens = Object.values(estadoEmpresa(empresaId, false).agendamentos)
    .filter((item) => !filtros.data || String(item.dataAgenda || chaveDia(item.dataHora)).slice(0, 10) === String(filtros.data).slice(0, 10))
    .filter((item) => !filtros.de || String(item.dataAgenda || chaveDia(item.dataHora)).slice(0, 10) >= String(filtros.de).slice(0, 10))
    .filter((item) => !filtros.ate || String(item.dataAgenda || chaveDia(item.dataHora)).slice(0, 10) <= String(filtros.ate).slice(0, 10))
    .filter((item) => !filtros.status || item.status === String(filtros.status))
    .filter((item) => !filtros.profissionalId || String(filtros.profissionalId).split(',').map(id => id.trim()).includes(item.profissionalId))
    .filter((item) => !filtros.lojaId || !item.lojaId || item.lojaId === String(filtros.lojaId))
    .filter((item) => {
      if (!telFiltro) return true;
      const tItem = String(item.clienteTelefone || '').replace(/\\D/g, '');
      return tItem && (tItem === telFiltro || tItem.slice(-8) === telFiltro.slice(-8));
    })
    .sort(ordenarPorData);"""

if target in c:
    c = c.replace(target, replacement, 1)
    with open('app/barbearia-erp-kytto.js', 'w', encoding='utf8') as f:
        f.write(c)
    print('listarAgendamentos com filtro de telefone atualizado com sucesso!')
else:
    print('Target listarAgendamentos nao encontrado!')
