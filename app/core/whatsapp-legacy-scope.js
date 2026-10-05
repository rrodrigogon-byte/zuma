// O adaptador WPP_* é global/legado. Ele não pode responder como a instância
// WhatsApp Commerce de outro tenant, mesmo para um administrador global.
export function legacyWppAvailable({ tenantScoped = false, configured = false, coreEnabled = false, globalUnselected = false, aiStatus = null } = {}) {
  if (tenantScoped || !configured) return false;
  // O fluxo global original não representa uma unidade Commerce: não há
  // instância da Dino que possa ser confundida com o adaptador legado.
  if (!coreEnabled || globalUnselected) return true;
  // Uma falha de consulta ou seleção ambígua nunca libera envio global.
  return Boolean(aiStatus && aiStatus.unavailable !== true && aiStatus.channel === null);
}
