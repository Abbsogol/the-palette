import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import SaveButton from '@/components/SaveButton'
import ImageCarousel from '@/components/ImageCarousel'
import ColourSwatches from '@/components/ColourSwatches'
import ShareButton from '@/components/ShareButton'
import BackButton from '@/components/BackButton'
import NailTechCard from '@/components/NailTechCard'
import SaveToBoard from '@/components/SaveToBoard'
import SendDesignButton from '@/components/SendDesignButton'
import BoostButton from '@/components/BoostButton'

export const dynamic = 'force-dynamic'

export default async function DesignPage({ params, searchParams }) {
  const { id } = await params
  const { from, boosted } = await searchParams || {}
  const backHref = from ? decodeURIComponent(from) : '/'

  const { data: design } = await supabase
    .from('designs')
    .select('*')
    .eq('id', id)
    .single()

  // Fetch creator profile if design has one
  let creator = null
  if (design?.created_by) {
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, is_verified, account_type')
      .eq('id', design.created_by)
      .single()
    creator = data
  }

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

  // Check if creator has active services (for Book this look button)
  let creatorHasServices = false
  if (creator && (creator.account_type === 'creator' || creator.account_type === 'salon')) {
    const { count } = await supabase
      .from('services')
      .select('id', { count: 'exact', head: true })
      .eq('creator_id', creator.id)
      .eq('is_active', true)
    creatorHasServices = (count || 0) > 0
  }

  // Shop this look — linked products
  const { data: linkedProductRows } = await supabase
    .from('design_products')
    .select('products(*)')
    .eq('design_id', id)
    .order('sort_order', { ascending: true })
  const shopProducts = linkedProductRows?.map(row => row.products).filter(Boolean) || []

  // Related designs — category first, then shape/occasion as tiebreaker
  let related = []
  if (design) {
    const category  = design.category?.trim()
    const shape     = design.shape?.trim()
    const occasion  = design.occasion?.split(',')[0]?.trim()
    const technique = design.technique?.split(',')[0]?.trim()

    // 1. Same category (strongest signal — Dark stays Dark, Floral stays Floral)
    let byCat = []
    if (category) {
      const { data } = await supabase
        .from('designs')
        .select('id, title, image_url, shape, occasion, category')
        .eq('is_published', true)
        .neq('id', id)
        .ilike('category', `%${category.split('/')[0].trim()}%`)
        .limit(8)
      byCat = data || []
    }

    // 2. Same shape (secondary)
    let byShape = []
    if (shape && byCat.length < 4) {
      const { data } = await supabase
        .from('designs')
        .select('id, title, image_url, shape, occasion, category')
        .eq('is_published', true)
        .neq('id', id)
        .eq('shape', shape)
        .limit(6)
      byShape = data || []
    }

    // 3. Same occasion/technique (fallback)
    let byOccasion = []
    if (byCat.length < 4) {
      const orParts = []
      if (occasion)  orParts.push(`occasion.ilike.%${occasion}%`)
      if (technique) orParts.push(`technique.ilike.%${technique}%`)
      if (orParts.length) {
        const { data } = await supabase
          .from('designs')
          .select('id, title, image_url, shape, occasion, category')
          .eq('is_published', true)
          .neq('id', id)
          .or(orParts.join(','))
          .limit(6)
        byOccasion = data || []
      }
    }

    // Merge: category first, then fill with shape/occasion, dedupe
    const seen = new Set([id])
    const merged = []
    for (const d of [...byCat, ...byShape, ...byOccasion]) {
      if (!seen.has(d.id) && merged.length < 6) {
        seen.add(d.id)
        merged.push(d)
      }
    }
    related = merged
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

  // The redirect back from Stripe (?boosted=1) can arrive before the webhook
  // has actually set boosted_until — this page re-fetches fresh on every
  // request (force-dynamic), so checking the real column instead of just
  // trusting the URL param avoids showing a "boosted" banner that isn't
  // true yet.
  const isActuallyBoosted = design.boosted_until && new Date(design.boosted_until) > new Date()

  return (
    <div style={{ paddingBottom: '32px' }}>

      {/* Boost success banner */}
      {boosted === '1' && (
        <div style={{ background: 'rgba(212,160,192,0.15)', borderBottom: '0.5px solid rgba(212,160,192,0.3)', padding: '12px 20px', textAlign: 'center' }}>
          <p style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: '600', margin: 0 }}>
            {isActuallyBoosted
              ? '✦ Your design is now boosted and featured in the feed!'
              : 'Payment received — your boost will appear here in a moment.'}
          </p>
        </div>
      )}

      {/* Back + Save */}
      <div style={{ padding: '16px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href={backHref} style={{
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
          {design.created_by && (
            <BoostButton designId={design.id} creatorId={design.created_by} boostedUntil={design.boosted_until || null} />
          )}
          <ShareButton title={design.title} />
          <SendDesignButton design={{ id: design.id, title: design.title, image_url: design.image_url }} />
          <SaveToBoard designId={design.id} designImageUrl={design.image_url} />
          <SaveButton designId={design.id} />
        </div>
      </div>

      <ImageCarousel images={allImages} title={design.title} />

      <div style={{ padding: '20px 20px 0' }}>

        <h1 style={{
          color: 'var(--text-primary)', fontSize: '22px', fontWeight: '500',
          letterSpacing: '-0.02em', marginBottom: creator ? '10px' : '16px',
        }}>
          {design.title}
        </h1>

        {/* Creator row */}
        {creator && (
          <Link href={`/creator/${creator.id}`} style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            textDecoration: 'none', marginBottom: '16px',
          }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--bg-chip)', border: '0.5px solid var(--border)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {creator.avatar_url
                ? <img src={creator.avatar_url} alt={creator.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ color: 'var(--accent)', fontSize: '10px', fontWeight: '600' }}>{(creator.display_name || '?')[0].toUpperCase()}</span>
              }
            </div>
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '500' }}>
              {creator.display_name}
            </span>
            {creator.is_verified && (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" fill="#D4A0C0"/>
                <path d="M5 8L7 10L11 6" stroke="#2C0A1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </Link>
        )}

        {/* Book this look */}
        {creatorHasServices && (
          <Link
            href={`/book/${creator.id}?designId=${design.id}`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              background: 'var(--accent)', color: '#2C0A1E',
              borderRadius: '14px', padding: '13px 20px',
              fontSize: '14px', fontWeight: '600',
              textDecoration: 'none', marginBottom: '20px',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Book this look
          </Link>
        )}

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

        {/* Show My Nail Tech — shareable spec card */}
        <div style={{ marginBottom: '24px' }}>
          <NailTechCard design={design} colours={colours || []} />
        </div>

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

      {/* Shop this look — hidden for now */}

      {/* Similar Looks */}
      {related.length > 0 && (
        <div style={{ marginTop: '8px', borderTop: '0.5px solid var(--border)', padding: '24px 20px 0' }}>
          <p style={sectionLabel}>Similar Looks</p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '10px',
          }}>
            {related.map((r) => (
              <Link key={r.id} href={`/design/${r.id}?from=${encodeURIComponent(`/design/${id}`)}`} style={{
                background: 'var(--bg-card)', borderRadius: '12px',
                border: '0.5px solid var(--border)', overflow: 'hidden',
                textDecoration: 'none', display: 'block',
              }}>
                {r.image_url ? (
                  <div style={{ width: '100%', aspectRatio: '1 / 1', overflow: 'hidden' }}>
                    <img src={r.image_url} alt={r.title}
                      style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                  </div>
                ) : (
                  <div style={{ width: '100%', aspectRatio: '1 / 1', background: 'var(--bg-chip)' }} />
                )}
                <div style={{ padding: '8px 10px 10px' }}>
                  <p style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: '500', lineHeight: '1.3', marginBottom: '4px' }}>
                    {r.title}
                  </p>
                  {(r.shape || r.category) && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '11px', margin: 0 }}>
                      {[r.shape, r.category].filter(Boolean).join(' · ')}
                    </p>
                  )}
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
