'use client'
import { useEffect, useState } from 'react'
import { supabase, getNailLabSignedUrl } from '@/lib/supabase'
import { privateImagePath } from '@/lib/storage-reference'

export default function StorageImage({ src, alt, ...props }) {
  const path = privateImagePath(src)
  const [resolved, setResolved] = useState(null)
  useEffect(() => {
    if (!path) return
    let active = true
    let version = 0
    const refresh = async () => {
      const requestVersion = ++version
      const url = await getNailLabSignedUrl(path)
      if (active && requestVersion === version) setResolved({ path, url })
    }
    refresh()
    const timer = setInterval(refresh, 50 * 60 * 1000)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      version++
      setResolved(null)
      // Defer Storage work outside the auth callback's lock.
      queueMicrotask(refresh)
    })
    return () => { active = false; clearInterval(timer); subscription.unsubscribe() }
  }, [path])
  const imageSrc = path ? (resolved?.path === path ? resolved.url : undefined) : src
  return <img {...props} src={imageSrc || undefined} alt={alt} />
}
