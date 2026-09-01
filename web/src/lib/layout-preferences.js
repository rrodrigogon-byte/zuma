export const SIDEBAR_COLLAPSE_KEY = 'sp_sidebar_collapsed'

export function readSidebarCollapsed(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  try { return storage?.getItem(SIDEBAR_COLLAPSE_KEY) === '1' } catch { return false }
}

export function writeSidebarCollapsed(collapsed, storage = typeof localStorage !== 'undefined' ? localStorage : null) {
  try {
    storage?.setItem(SIDEBAR_COLLAPSE_KEY, collapsed ? '1' : '0')
    return true
  } catch { return false }
}
