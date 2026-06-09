import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import SaveButton from '@/components/SaveButton'
import ImageCarousel from '@/components/ImageCarousel'
import ColourSwatches from '@/components/ColourSwatches'
import ShareButton from '@/components/ShareButton'

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

  // Shop this look — linked products
  const { data: linkedProductRows } = await supabase
    .from('design_products')
    .select('products(*)')
    .eq('design_id', id)
    .order('sort_order', { ascending: true })
  const shopProducts = linkedProductRows?.map(row => row.products).filter(Boolean) || []

  // Related designs — match by occasion or technique
  const firstOccasion = design?.occasion?.split(',')[0]?.trim()
  const firstTechnique = design?.technique?.split(',')[0]?.trim()
  let related = []
  if (firstOccasion || firstTechnique) {
    const orParts = []
    if (firstOccasion) orParts.push(`occasion.ilike.%${firstOccasion}%`)
    if (firstTechnique) orParts.push(`technique.ilike.%${firstTechnique}%`)
    const { data: relatedData } = await supabase
      .from('designs')
      .select('id, title, image_url, shape, occasion')
      .eq('is_published', true)
      .neq('id', id)
      .or(orParts.join(','))
      .limit(6)
    related = relatedData || []
  }

  if (!design) {
    return (
      <div style={{ padding: '24px 20px', color: 'var(--text-secondary)' }}>
        Design not found.
      </div>
    )
  }

  const tags = designTags?.map(dt => dt.tags?.name).filter(Boolean) || []

  const allImages = [
    design.image_url,
    ...(extraImages?.map(img => img.image_url) || []),
  ].filter(Boolean)

  const techniqueChips = design.technique
    ? design.technique.split(',').map(t => t.trim()).filter(Boolean)
    : []

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
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <ShareButton title={design.title} />
          <SaveButton designId={design.id} />
        </div>
      </div>

      <ImageCarousel images={allImages} title={design.title} />

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

        {/* Colours — client component handles copy + hides empty fields */}
        {colours && colours.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <p style={sectionLabel}>Colour Specs</p>
            <ColourSwatches colours={colours} />
          </div>
        )}

        {/* Tags — clickable, navigate to search filtered by tag */}
        {tags.length > 0 && (
          <div>
            <p style={sectionLabel}>Tags</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {tags.map((tag) => (
                <Link key={tag} href={`/search?tag=${encodeURIComponent(tag)}`} style={{
                  background: 'var(--bg-chip)', color: 'var(--text-secondary)',
                  fontSize: '12px', padding: '6px 12px', borderRadius: '20px',
                  textDecoration: 'none', display: 'inline-block',
                }}>
                  #{tag}
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Shop this look */}
      {shopProducts.length > 0 && (
        <div style={{ marginTop: '24px', borderTop: '0.5px solid var(--border)', padding: '24px 20px 0' }}>
          <p style={sectionLabel}>Shop this look</p>
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {shopProducts.map(product => (
              <a
                key={product.id}
                href={product.affiliate_url}
                target="_blank"
                rel="noopener noreferrer sponsored"
                style={{
                  flexShrink: 0, width: '140px',
                  background: 'var(--bg-card)', borderRadius: '12px',
                  border: '0.5px solid var(--border)', overflow: 'hidden',
                  textDecoration: 'none', display: 'block',
                }}
              >
                {product.image_url ? (
                  <div style={{ width: '140px', height: '140px', background: 'var(--bg-chip)', overflow: 'hidden' }}>
                    <img src={product.image_url} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                  </div>
                ) : (
                  <div style={{ width: '140px', height: '140px', background: 'var(--bg-chip)' }} />
                )}
                <div style={{ padding: '8px 10px 10px' }}>
                  <p style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: '500', lineHeight: '1.3', marginBottom: '4px' }}>{product.name}</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                    {product.price_label && <p style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: '600' }}>{product.price_label}</p>}
                    <span style={{ background: 'var(--bg-chip)', color: 'var(--text-secondary)', fontSize: '9px', fontWeight: '500', padding: '3px 7px', borderRadius: '6px', whiteSpace: 'nowrap' }}>Shop ↗</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Related designs */}
      {related.length > 0 && (
        <div style={{ marginTop: '8px', borderTop: '0.5px solid var(--border)', padding: '24px 20px 0' }}>
          <p style={sectionLabel}>You might also like</p>
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {related.map((r) => (
              <Link key={r.id} href={`/design/${r.id}`} style={{
                flexShrink: 0, width: '140px',
                background: 'var(--bg-card)', borderRadius: '12px',
                border: '0.5px solid var(--border)', overflow: 'hidden',
                textDecoration: 'none', display: 'block',
              }}>
                {r.image_url ? (
                  <div style={{ width: '140px', height: '140px', overflow: 'hidden' }}>
                    <img src={r.image_url} alt={r.title}
                      style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                  </div>
                ) : (
                  <div style={{ width: '140px', height: '140px', background: 'var(--bg-chip)' }} />
                )}
                <div style={{ padding: '8px 10px 10px' }}>
                  <p style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: '500', lineHeight: '1.3' }}>{r.title}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
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
