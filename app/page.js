import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const { data: designs } = await supabase
    .from('designs')
    .select('*')
    .eq('is_published', true)
    .order('created_at', { ascending: false })

  return (
    <div style={{ padding: '24px 20px 0' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{
          color: 'var(--text-primary)',
          fontWeight: '500',
          fontSize: '22px',
          letterSpacing: '-0.02em',
          marginBottom: '4px',
        }}>
          The Palette
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Nail & beauty design platform
        </p>
      </div>

      {/* Design Grid */}
      {designs && designs.length > 0 ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px',
        }}>
          {designs.map((design) => (
            <Link
              key={design.id}
              href={`/design/${design.id}`}
              style={{
                background: 'var(--bg-card)',
                borderRadius: '12px',
                border: '0.5px solid var(--border)',
                overflow: 'hidden',
                cursor: 'pointer',
                textDecoration: 'none',
                display: 'block',
              }}
            >
              {/* Image */}
              {design.image_url ? (
                <div style={{ width: '100%', aspectRatio: '1 / 1', overflow: 'hidden' }}>
                  <img
                    src={design.image_url}
                    alt={design.title}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: 'left center',
                      display: 'block',
                    }}
                  />
                </div>
              ) : (
                <div style={{
                  width: '100%',
                  aspectRatio: '1 / 1',
                  background: 'var(--bg-chip)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>No image</span>
                </div>
              )}

              {/* Card Info */}
              <div style={{ padding: '10px 12px 12px' }}>
                <p style={{
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontWeight: '500',
                  marginBottom: '4px',
                  lineHeight: '1.3',
                }}>
                  {design.title}
                </p>
                <p style={{
                  color: 'var(--accent)',
                  fontSize: '10px',
                  fontWeight: '500',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}>
                  {design.shape} · {design.occasion}
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: '12px',
          padding: '32px 20px',
          border: '0.5px solid var(--border)',
          textAlign: 'center',
        }}>
          <p style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: '500', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>
            Coming soon
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6' }}>
            Hundreds of nail & beauty designs,<br />
            each with full specs and colour codes.
          </p>
        </div>
      )}
    </div>
  )
}
