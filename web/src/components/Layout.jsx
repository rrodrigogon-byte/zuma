import Sidebar from './Sidebar'

export default function Layout({ children, noSidebar = false }) {
  if (noSidebar) return <>{children}</>
  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ marginLeft: 220, flex: 1, minHeight: '100vh' }}>
        {children}
      </main>
    </div>
  )
}
