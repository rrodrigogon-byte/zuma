with open('app/core/whatsapp-ai-tools.js', 'r', encoding='utf8') as f:
    c = f.read()

target = """export function findOwnAppointment(appointments = [], ref = '') {
  const lista = (appointments || []).filter((item) => !['cancelado', 'concluido', 'nao_compareceu'].includes(String(item?.status)));
  const alvo = String(ref || '').trim();
  if (alvo) {
    const norm = alvo.replace(/^#/, '').toLowerCase();
    const achado = lista.find((item) => item.id === alvo)
      || lista.find((item) => String(item.codigo || '').toLowerCase() === norm)
      || lista.find((item) => String(item.id || '').toLowerCase().endsWith(norm) && norm.length >= 4)
      || lista.find((item) => String(item.servico?.nome || '').toLowerCase().includes(norm))
      || lista.find((item) => String(item.profissional?.nome || '').toLowerCase().includes(norm));
    if (achado) return achado;
  }
  return lista.length === 1 ? lista[0] : null;
}"""

replacement = """export function findOwnAppointment(appointments = [], ref = '') {
  const lista = (appointments || [])
    .filter((item) => !['cancelado', 'concluido', 'nao_compareceu'].includes(String(item?.status)))
    .sort((a, b) => new Date(a.dataHora).valueOf() - new Date(b.dataHora).valueOf());
  const alvo = String(ref || '').trim();
  if (alvo) {
    const norm = alvo.replace(/^#/, '').toLowerCase();
    const achado = lista.find((item) => item.id === alvo)
      || lista.find((item) => String(item.codigo || '').toLowerCase() === norm)
      || lista.find((item) => String(item.id || '').toLowerCase().endsWith(norm) && norm.length >= 4)
      || lista.find((item) => String(item.servico?.nome || '').toLowerCase().includes(norm))
      || lista.find((item) => String(item.profissional?.nome || '').toLowerCase().includes(norm));
    if (achado) return achado;
  }
  // Se não foi informada referência, prioriza o próximo agendamento cronológico ativo
  return lista.length ? lista[0] : null;
}"""

assert target in c, "target não encontrado em whatsapp-ai-tools.js!"
c = c.replace(target, replacement, 1)

with open('app/core/whatsapp-ai-tools.js', 'w', encoding='utf8') as f:
    f.write(c)

print("findOwnAppointment em whatsapp-ai-tools.js atualizado com sucesso!")
