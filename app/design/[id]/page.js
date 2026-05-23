import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import SaveButton from '@/components/SaveButton'
import ImageCarousel from '@/components/ImageCarousel'

export const dynamic = 'force-dynamic'

export default async function DesignPage({ params }) {
  const { id } = await params

  const { data: design } = await supabase
    .from('designs')
    .select('*')
    .eq('id', id)
    .single()

  const { data: colours } = await supabase
    .from('design_colours')
    .select('*')
    .eq('design_id', id)
    .order('colour_order', { ascending: true })

  const { data: extraImages } = await supabase
    .from('design_images')
    .select('*')
    .eq('design_id', id)
    .order('image_order', { ascending: true })

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

  // Build full image list: main first, then extras
  const allImages = [
    design.image_url,
    ...(extraImages?.map(img => img.image_url) || []),
  ].filter(Boolean)

  // Technique can be comma-separated
  const techniqueChips = design.technique
    ? design.technique.split(',').map(t => t.trim()).filter(Boolean)
    : []

  // Occasion can be comma-separated
  const occasionChips = design.occasion
    ? design.occasion.split(',').map(o => o.trim()).filter(Boolean)
    : []

  return (
    <div style={{ paddingBottom: '32px' }}>

      {/* Back + Save */}
      <div style={{ padding: '16px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href="/" style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          color: 'var(--text-secondary)', textDecoration: 'none',
          fontSize: '13px', fontWeight: '500',
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </Link>
        <SaveButton designId={design.id} />
      </div>

      {/* Swipeable image carousel */}
      <ImageCarousel images={allImages} title={design.title} />

      {/* Content */}
      <div style={{ padding: '20px 20px 0' }}>

        <h1 style={{
          color: 'var(--text-primary)', fontSize: '22px', fontWeight: '500',
          letterSpacing: '-0.02em', marginBottom: '16px',
        }}>
          {design.title}
        </h1>

        {/* Spec chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
          {[design.shape, design.length].filter(Boolean).map((spec) => (
            <span key={spec} style={chipStyle}>{spec}</span>
          ))}
          {occasionChips.map(o => (
            <span key={o} style={chipStyle}>{o}</span>
          ))}
          {techniqueChips.map(t => (
            <span key={t} style={chipStyle}>{t}</span>
          ))}
        </div>

        {design.description && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.7', marginBottom: '24px' }}>
            {design.description}
          </p>
        )}

        {/* Colours */}
        {colours && colours.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <p style={sectionLabel}>Colour Specs</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {colours.map((colour) => (
                <div key={colour.id} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  background: 'var(--bg-card)', borderRadius: '10px',
                  padding: '12px', border: '0.5px solid var(--border)',
                }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '8px',
                    background: colour.hex_code || '#333', flexShrink: 0,
                    border: '0.5px solid rgba(255,255,255,0.1)',
                  }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>
                      {colour.colour_name || 'Unnamed'}
                    </p>
                    <ColourRow label="Colour code" value={colour.hex_code} />
                    <ColourRow label="Brand" value={clean(colour.brand_name)} />
                    <ColourRow label="Brand code" value={clean(colour.brand_code)} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div>
            <p style={sectionLabel}>Tags</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {tags.map((tag) => (
                <span key={tag} style={{
                  background: 'var(--bg-chip)', color: 'var(--text-secondary)',
                  fontSize: '12px', padding: '6px 12px', borderRadius: '20px',
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

// Filter out accidental "Optional" placeholder values
function clean(value) {
  if (!value) return null
  if (value.toLowerCase() === 'optional') return null
  return value
}

function ColourRow({ label, value }) {
  return (
    <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '2px' }}>
      <span style={{ color: 'var(--text-secondary)', opacity: 0.5 }}>{label}: </span>
      {value || <span style={{ opacity: 0.4 }}>—</span>}
    </p>
  )
}

const chipStyle = {
  background: 'var(--bg-chip)',
  color: 'var(--text-secondary)',
  fontSize: '12px',
  fontWeight: '500',
  padding: '6px 12px',
  borderRadius: '20px',
  textTransform: 'capitalize',
}

const sectionLabel = {
  color: 'var(--accent)',
  fontSize: '11px',
  fontWeight: '500',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  marginBottom: '12px',
}
