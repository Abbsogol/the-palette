'use client'
import { useState, useRef, useEffect } from 'react'

export default function ShareButton({ title }) {
  const [copied, setCopied] = useState(false)
  const copiedTimer = useRef(null)

  useEffect(() => () => clearTimeout(copiedTimer.current), [])

  const handleShare = async () => {
    const url = window.location.href

    if (navigator.share) {
      try {
        await navigator.share({ title: `${title} — laQue`, url })
      } catch (e) {
        // user dismissed — do nothing
      }
    } else {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      onClick={handleShare}
      title={copied ? 'Copied!' : 'Share'}
      style={{
        background: 'var(--bg-chip)',
        border: '0.5px solid var(--border)',
        borderRadius: '20px',
        padding: '7px 14px',
        display: 'flex', alignItems: 'center', gap: '6px',
        color: copied ? 'var(--accent)' : 'var(--text-secondary)',
        fontSize: '13px', fontWeight: '500',
        fontFamily: "'DM Sans', sans-serif",
        cursor: 'pointer',
        transition: 'color 0.2s',
      }}
    >
      {copied ? (
        <>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9.5 2.5L11.5 4.5L9.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2.5 8.5V10.5A1 1 0 003.5 11.5H10.5A1 1 0 0011.5 10.5V4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M5 7.5C5 5.5 7 4.5 11.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Share
        </>
      )}
    </button>
  )
}
