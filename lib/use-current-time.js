'use client'

import { useEffect, useState } from 'react'

// Relative timestamps refresh while a page stays open. Server and initial
// client renders share a zero snapshot; browser clock events update it.
export function useCurrentTime() {
  const [now, setNow] = useState(0)
  useEffect(() => {
    const update = () => setNow(Date.now())
    const frame = requestAnimationFrame(update)
    const timer = setInterval(update, 60_000)
    return () => { cancelAnimationFrame(frame); clearInterval(timer) }
  }, [])
  return now
}
