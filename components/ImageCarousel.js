'use client'

import { useState, useRef } from 'react'

export default function ImageCarousel({ images, title }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const scrollRef = useRef(null)

  if (!images || images.length === 0) return null

  const handleScroll = () => {
    if (!scrollRef.current) return
    const scrollLeft = scrollRef.current.scrollLeft
    const width = scrollRef.current.offsetWidth
    const index = Math.round(scrollLeft / width)
    setActiveIndex(index)
  }

  const goTo = (index) => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTo({
      left: index * scrollRef.current.offsetWidth,
      behavior: 'smooth',
    })
    setActiveIndex(index)
  }

  return (
    <div style={{ position: 'relative', width: '100%', marginTop: '16px' }}>
      {/* Scrollable strip */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          display: 'flex',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          scrollBehavior: 'smooth',
          WebkitOverflowScrolling: 'touch',
          msOverflowStyle: 'none',
          scrollbarWidth: 'none',
        }}
      >
        {images.map((src, i) => (
          <div
            key={i}
            style={{
              flexShrink: 0,
              width: '100%',
              scrollSnapAlign: 'start',
            }}
          >
            <img
              src={src}
              alt={`${title} ${i + 1}`}
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
          </div>
        ))}
      </div>

      {/* Dots — only show if more than 1 image */}
      {images.length > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '6px',
          padding: '12px 0 4px',
        }}>
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              style={{
                width: i === activeIndex ? '18px' : '6px',
                height: '6px',
                borderRadius: '3px',
                background: i === activeIndex ? 'var(--accent)' : 'var(--bg-chip)',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                transition: 'width 0.2s, background 0.2s',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
