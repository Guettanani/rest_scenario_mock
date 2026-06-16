
import { useLocation, useOutlet } from 'react-router-dom'
import { useRef } from 'react'

function KeepAliveOutlet() {
  const location = useLocation()
  const outlet = useOutlet()
  const cacheRef = useRef(new Map())

  if (outlet && !cacheRef.current.has(location.pathname)) {
    cacheRef.current.set(location.pathname, outlet)
  }

  const cachedEntries = Array.from(cacheRef.current.entries())

  return (
    <>
      {cachedEntries.map(([pathname, element]) => (
        <div
          key={pathname}
          style={{ display: pathname === location.pathname ? 'block' : 'none', height: '100%' }}
          aria-hidden={pathname !== location.pathname}
        >
          {element}
        </div>
      ))}
    </>
  )
}

export default KeepAliveOutlet
