import { useEffect, useState } from 'react'
import { useLocation } from '@tanstack/react-router'

/** Query controls deliberately mount after hydration: prerendering has no
 * query string, while the browser does, so rendering them immediately makes
 * the server and first client tree disagree. */
export function useToolsEnabled() {
  const search = useLocation({ select: (location) => location.searchStr })
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  return hydrated && new URLSearchParams(search).get('tools') === 'true'
}
