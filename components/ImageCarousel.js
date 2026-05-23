'use client'

import { useState, useRef } from 'react'

export default function ImageCarousel({ images, title }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [lightboxIndex, setLightboxIndex] = useState(null)
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

  const openLightbox = (index) => setLightboxIndex(index)
  const closeLightbox = () => setLightboxIndex(null)
  const lightboxPrev = () => setLightboxIndex(i => (i - 1 + images.length) % images.length)
  const lightboxNext = () => setLightboxIndex(i => (i + 1) % images.length)

  return (
    <>
      <div style={{ position: 'relative', width: '100%', marginTop: '16px' }}>

        {/* Scrollable strip */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          style={{
            display: 'flex',
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            WebkitOverflowScrolling: 'touch',
            msOverflowStyle: 'none',
            scrollbarWidth: 'none',
          }}
        >
          {images.map((src, i) => (
            <div
              key={i}
              onClick={() => openLightbox(i)}
              style={{
                flexShrink: 0,
                width: '100%',
                scrollSnapAlign: 'start',
                cursor: 'zoom-in',
              }}
            >
              <img
                src={src}
                alt={`${title} ${i + 1}`}
                style={{
                  width: '100%',
                  height: 'auto',
                  maxHeight: '72vh',
                  objectFit: 'contain',
                  display: 'block',
                  background: 'var(--bg-primary)',
                }}
              />
            </div>
          ))}
        </div>

        {/* Dots */}
        {images.length > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', padding: '10px 0 2px' }}>
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

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div
          onClick={closeLightbox}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.95)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Close button */}
          <button
            onClick={closeLightbox}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              color: '#fff',
              fontSize: '20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1001,
            }}
          >
            ×
          </button>

          {/* Image counter */}
          {images.length > 1 && (
            <p style={{
              position: 'absolute',
              top: '20px',
              left: '20px',
              color: 'rgba(255,255,255,0.5)',
              fontSize: '12px',
              zIndex: 1001,
            }}>
              {lightboxIndex + 1} / {images.length}
            </p>
          )}

          {/* Image */}
          <img
            src={images[lightboxIndex]}
            alt={`${title} ${lightboxIndex + 1}`}
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '100%',
              maxHeight: '90vh',
              objectFit: 'contain',
              display: 'block',
            }}
          />

          {/* Prev / Next */}
          {images.length > 1 && (
            <>
              <button
                onClick={e => { e.stopPropagation(); lightboxPrev() }}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  color: '#fff',
                  fontSize: '20px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1001,
                }}
              >
                ‹
              </button>
              <button
                onClick={e => { e.stopPropagation(); lightboxNext() }}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  color: '#fff',
                  fontSize: '20px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1001,
                }}
              >
                ›
              </button>
            </>
          )}
        </div>
      )}
    </>
  )
}
