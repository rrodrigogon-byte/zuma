import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'

export default function Layout({ children, noSidebar = false }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  if (noSidebar) return <>{children}</>

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ marginLeft: isMobile ? 0 : 220, flex: 1, minHeight: '100vh' }}>
        {children}
      </main>
    </div>
  )
}
