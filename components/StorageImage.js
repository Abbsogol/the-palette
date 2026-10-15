'use client'
import { useEffect, useState } from 'react'
import { supabase, getNailLabSignedUrl, getPrivateImageSignedUrl } from '@/lib/supabase'
import { privateImageLocation } from '@/lib/storage-reference'

export default function StorageImage({ src, alt, ...props }) {
  const location = privateImageLocation(src)
  const bucket = location?.bucket, path = location?.path
  const [resolved, setResolved] = useState(null)
  useEffect(() => {
    if (!path) return
    let active = true
    let version = 0
    const refresh = async () => {
      const requestVersion = ++version
      const url = bucket === 'nail-lab' ? await getNailLabSignedUrl(path) : await getPrivateImageSignedUrl({ bucket, path })
      if (active && requestVersion === version) setResolved({ bucket, path, url })
    }
    refresh()
    const timer = setInterval(refresh, (bucket === 'nail-lab' ? 50 : 12) * 60 * 1000)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      version++
      setResolved(null)
      // Defer Storage work outside the auth callback's lock.
      queueMicrotask(refresh)
    })
    return () => { active = false; clearInterval(timer); subscription.unsubscribe() }
  }, [path, bucket])
  const imageSrc = path ? (resolved?.path === path && resolved?.bucket === bucket ? resolved.url : undefined) : src
  return <img {...props} src={imageSrc || undefined} alt={alt} />
}
