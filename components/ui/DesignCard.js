'use client'
import Link from 'next/link'
import HeartSaveButton from './HeartSaveButton'

function formatCount(n) {
  if (n == null) return '0'
  if (n >= 1000) {
    const k = n / 1000
    return `${k >= 10 ? Math.round(k) : Math.round(k * 10) / 10}k`
  }
  return String(n)
}

// Design card from the redesign: rounded image with a glass heart-save,
// title below, and either "Nk saves" or CAPS "SHAPE · VIBE" metadata.
// width=140 + imageHeight=222 is the drawn carousel size; the library grid
// passes width='100%' and its own image height.
export default function DesignCard({
  design,
  rank = null,
  meta = 'saves',        // 'saves' | 'tags'
  width = 140,
  imageHeight = 222,
  currentUser = null,
  initiallySaved = false,
  onNavigate,
}) {
  const tagLine = [design.shape, design.vibe]
    .filter(Boolean)
    .join(' · ')
    .toUpperCase()

  return (
    <div style={{ width: typeof width === 'number' ? `${width}px` : width, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 'var(--lq-space-sm)' }}>
      <div style={{ position: 'relative', height: `${imageHeight}px`, borderRadius: 'var(--lq-radius-card)', overflow: 'hidden' }}>
        <Link href={`/design/${design.id}`} onClick={onNavigate} aria-label={design.title || 'View design'}>
          <img
            src={design.image_url}
            alt={design.title || 'Nail design'}
            loading="lazy"
            style={{ width: '100%', height: `${imageHeight}px`, objectFit: 'cover', display: 'block' }}
          />
        </Link>
        {rank != null && (
          <span aria-label={`Rank ${rank}`} style={{
            position: 'absolute', top: '8px', left: '8px',
            width: '24px', height: '24px', borderRadius: 'var(--lq-radius-pill)',
            background: 'var(--lq-accent-grad)', color: 'var(--lq-white)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--lq-font-ui)', fontSize: '12px', fontWeight: 500,
          }}>
            {rank}
          </span>
        )}
        <span style={{ position: 'absolute', bottom: '4px', right: '4px' }}>
          <HeartSaveButton designId={design.id} currentUser={currentUser} initiallySaved={initiallySaved} />
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
        <p style={{
          fontFamily: 'var(--lq-font-ui)', fontWeight: 400, fontSize: '17px', lineHeight: 1.2,
          color: 'var(--lq-white)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {design.title || 'Untitled'}
        </p>
        {meta === 'saves' ? (
          <p style={{ fontFamily: 'var(--lq-font-ui)', fontWeight: 300, fontSize: '12px', color: 'var(--lq-white)', opacity: 0.92 }}>
            {formatCount(design.saves_count)} saves
          </p>
        ) : (
          tagLine && (
            <p style={{ fontFamily: 'var(--lq-font-ui)', fontWeight: 300, fontSize: '11px', letterSpacing: '0.06em', color: 'var(--lq-white)', opacity: 0.92 }}>
              {tagLine}
            </p>
          )
        )}
      </div>
    </div>
  )
}
