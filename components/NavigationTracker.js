'use client'
import { useEffect } from 'react'
import { installNavTracker } from '@/lib/navHistory'

// Installs the history depth tracker once, before any client navigation.
export default function NavigationTracker() {
  useEffect(() => { installNavTracker() }, [])
  return null
}
