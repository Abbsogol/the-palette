import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default async function DesignPage({ params }) {
  const { id } = await params

  // Fetch the design
  const { data: design } = await supabase
    .from('designs')
    .select('*')
    .eq('id', id)
    .single()

  // Fetch its colours
  const { data: colours } = await supabase
    .from('design_colours')
    .select('*')
    .eq('design_id', id)
    .order('colour_order', { ascending: true })

  // Fetch its tags
  const { data: designTags } = await supabase
    .from('design_tags')
    .select('tags(name)')
    .eq('design_id', id)

  if (!design) {
    return (
      <div style={{ padding: '24px 20px', color: 'var(--text-secondary)' }}>
        Design not found.
      </div>
    )
  }

  const tags = designTags?.map(dt => dt.tags?.name).filter(Boolean) || []

  return (
    <div style={{ paddingBottom: '32px' }}>

      {/* Back button */}
      <div style={{ padding: '16px 20px 0' }}>
        <Link href="/" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          color: 'var(--text-secondary)',
          textDecoration: 'none',
          fontSize: '13px',
          fontWeight: '500',
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </Link>
      </div>

      {/* Full-width image */}
      {design.image_url && (
        <div style={{ width: '100%', aspectRatio: '1 / 1', overflow: 'hidden', marginTop: '16px' }}>
          <img
            src={design.image_url}
            alt={design.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>
      )}

      {/* Content */}
      <div style={{ padding: '20px 20px 0' }}>

        {/* Title */}
        <h1 style={{
          color: 'var(--text-primary)',
          fontSize: '22px',
          fontWeight: '500',
          letterSpacing: '-0.02em',
          marginBottom: '16px',
        }}>
          {design.title}
        </h1>

        {/* Spec chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
          {[design.shape, design.length, design.occasion, design.technique].filter(Boolean).map((spec) => (
            <span key={spec} style={{
              background: 'var(--bg-chip)',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              fontWeight: '500',
              padding: '6px 12px',
              borderRadius: '20px',
              textTransform: 'capitalize',
            }}>
              {spec}
            </span>
          ))}
        </div>

        {/* Description */}
        {design.description && (
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '14px',
            lineHeight: '1.7',
            marginBottom: '24px',
          }}>
            {design.description}
          </p>
        )}

        {/* Colours */}
        {colours && colours.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <p style={{
              color: 'var(--accent)',
              fontSize: '11px',
              fontWeight: '500',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: '12px',
            }}>
              Colour Specs
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {colours.map((colour) => (
                <div key={colour.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  background: 'var(--bg-card)',
                  borderRadius: '10px',
                  padding: '12px',
                  border: '0.5px solid var(--border)',
                }}>
                  {/* Colour swatch */}
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: colour.hex_code || '#333',
                    flexShrink: 0,
                    border: '0.5px solid rgba(255,255,255,0.1)',
                  }} />
                  <div>
                    <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', marginBottom: '2px' }}>
                      {colour.colour_name || colour.hex_code}
                    </p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                      {colour.hex_code}
                      {colour.brand_name && ` · ${colour.brand_name}`}
                      {colour.brand_code && ` ${colour.brand_code}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div>
            <p style={{
              color: 'var(--accent)',
              fontSize: '11px',
              fontWeight: '500',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: '12px',
            }}>
              Tags
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {tags.map((tag) => (
                <span key={tag} style={{
                  background: 'var(--bg-chip)',
                  color: 'var(--text-secondary)',
                  fontSize: '12px',
                  padding: '6px 12px',
                  borderRadius: '20px',
                }}>
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
