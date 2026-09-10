import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import ImageCarousel from '@/components/ImageCarousel'
import ColourSwatches from '@/components/ColourSwatches'
import ShareButton from '@/components/ShareButton'
import BackButton from '@/components/ui/BackButton'
import DesignUtilityRow from '@/components/DesignUtilityRow'
import DesignSaveHeart from '@/components/DesignSaveHeart'
import DesignPrimaryActions from '@/components/DesignPrimaryActions'
import { LaqueWordmark } from '@/components/ui/icons'

export const dynamic = 'force-dynamic'

const ACCENT = '#FF517F'
const WHITE80 = 'rgba(255,255,255,0.8)'
const WHITE60 = 'rgba(255,255,255,0.6)'
const PANEL = 'rgba(255,255,255,0.06)'
const PANEL_BORDER = '1px solid rgba(255,255,255,0.1)'
const ui = (weight, size, color = 'var(--lq-white)') => ({
  fontFamily: 'var(--lq-font-ui)', fontWeight: weight, fontSize: `${size}px`, color, lineHeight: 1.4,
})
const display = (size) => ({ fontFamily: 'var(--lq-font-display)', fontWeight: 400, fontSize: `${size}px`, color: 'var(--lq-white)', lineHeight: 1.2 })
const sectionLabel = { ...ui(500, 11, ACCENT), letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 12px' }
const chipStyle = { ...ui(500, 12, WHITE80), background: PANEL, border: PANEL_BORDER, padding: '6px 12px', borderRadius: '1000px', textTransform: 'capitalize' }

function Shell({ children }) {
  return (
    <div className="lq-bg-wine" style={{ minHeight: '100dvh', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,5,13,0.6)' }} />
      <div className="lq-grain" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'relative' }}>{children}</div>
    </div>
  )
}

export default async function DesignPage({ params, searchParams }) {
  const { id } = await params
  const { from, boosted } = await searchParams || {}
  const backHref = from ? decodeURIComponent(from) : '/'

  const { data: design } = await supabase.from('designs').select('*').eq('id', id).single()

  if (!design) {
    return (
      <Shell>
        <div style={{ minHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
          <p style={{ ...ui(400, 15), margin: '0 0 20px' }}>Design not found.</p>
          <Link href="/feed" style={{ ...ui(500, 14, ACCENT), textDecoration: 'none' }}>← Browse designs</Link>
        </div>
      </Shell>
    )
  }

  let creator = null
  if (design.created_by) {
    const { data } = await supabase.from('profiles')
      .select('id, display_name, avatar_url, is_verified, account_type')
      .eq('id', design.created_by).single()
    creator = data
  }

  const { data: colours } = await supabase.from('design_colours').select('*').eq('design_id', id).order('colour_order', { ascending: true })
  const { data: extraImages } = await supabase.from('design_images').select('*').eq('design_id', id).order('image_order', { ascending: true })
  const { data: designTags } = await supabase.from('design_tags').select('tags(name)').eq('design_id', id)

  let creatorHasServices = false
  if (creator && (creator.account_type === 'creator' || creator.account_type === 'salon')) {
    const { count } = await supabase.from('services').select('id', { count: 'exact', head: true }).eq('creator_id', creator.id).eq('is_active', true)
    creatorHasServices = (count || 0) > 0
  }

  // Related — category first, then shape/occasion (same-attribute fallback,
  // not a true similarity signal). Carries stored dims for reserved boxes.
  let related = []
  {
    const category = design.category?.trim()
    const shape = design.shape?.trim()
    const occasion = design.occasion?.split(',')[0]?.trim()
    const technique = design.technique?.split(',')[0]?.trim()
    const sel = 'id, title, image_url, image_width, image_height, shape, occasion, category'
    let byCat = []
    if (category) {
      const { data } = await supabase.from('designs').select(sel).eq('is_published', true).neq('id', id).ilike('category', `%${category.split('/')[0].trim()}%`).limit(8)
      byCat = data || []
    }
    let byShape = []
    if (shape && byCat.length < 4) {
      const { data } = await supabase.from('designs').select(sel).eq('is_published', true).neq('id', id).eq('shape', shape).limit(6)
      byShape = data || []
    }
    let byOccasion = []
    if (byCat.length < 4) {
      const orParts = []
      if (occasion) orParts.push(`occasion.ilike.%${occasion}%`)
      if (technique) orParts.push(`technique.ilike.%${technique}%`)
      if (orParts.length) {
        const { data } = await supabase.from('designs').select(sel).eq('is_published', true).neq('id', id).or(orParts.join(',')).limit(6)
        byOccasion = data || []
      }
    }
    const seen = new Set([id])
    for (const d of [...byCat, ...byShape, ...byOccasion]) {
      if (!seen.has(d.id) && related.length < 6) { seen.add(d.id); related.push(d) }
    }
  }

  const tags = designTags?.map(dt => dt.tags?.name).filter(Boolean) || []
  const allImages = [design.image_url, ...(extraImages?.map(img => img.image_url) || [])].filter(Boolean)
  const specChips = [design.shape, design.length].filter(Boolean)
    .concat(design.occasion ? design.occasion.split(',').map(o => o.trim()).filter(Boolean) : [])
    .concat(design.technique ? design.technique.split(',').map(t => t.trim()).filter(Boolean) : [])
  const carouselAspect = design.image_width && design.image_height ? `${design.image_width} / ${design.image_height}` : undefined
  const isActuallyBoosted = design.boosted_until && new Date(design.boosted_until) > new Date()

  return (
    <Shell>
      <div style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 120px)' }}>

        {/* Boost success banner */}
        {boosted === '1' && (
          <div style={{ background: 'rgba(255,81,127,0.15)', borderBottom: '1px solid rgba(255,81,127,0.3)', padding: '12px 20px', textAlign: 'center' }}>
            <p style={{ ...ui(600, 13, ACCENT), margin: 0 }}>
              {isActuallyBoosted ? '✦ Your design is now boosted and featured in the feed!' : 'Payment received — your boost will appear here in a moment.'}
            </p>
          </div>
        )}

        {/* Header — exactly as drawn: Back · wordmark · Share */}
        <div style={{ padding: 'calc(env(safe-area-inset-top) + 14px) 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <BackButton fallback={backHref} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '1000px', padding: '8px 14px', minHeight: '36px', gap: '6px' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span style={ui(500, 13)}>Back</span>
          </BackButton>
          <span aria-hidden style={{ color: 'var(--lq-white)', display: 'inline-flex' }}><LaqueWordmark height={22} /></span>
          <ShareButton title={design.title} variant="glass" />
        </div>

        {/* Carousel with ♥-count save badge (the frame's save affordance) */}
        <div style={{ padding: '14px 20px 0' }}>
          <ImageCarousel
            images={allImages}
            title={design.title}
            aspectRatio={carouselAspect}
            overlay={<DesignSaveHeart designId={design.id} savesCount={design.saves_count || 0} />}
          />
        </div>

        {/* Utility row — Send to chat · Save to board */}
        <div style={{ padding: '14px 20px 0' }}>
          <DesignUtilityRow design={{ id: design.id, title: design.title, image_url: design.image_url }} />
        </div>

        <div style={{ padding: '20px 20px 0', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Title (saves live on the ♥ badge; the dead "24 Review" link is removed) */}
          <h1 style={{ ...display(26), margin: 0 }}>{design.title}</h1>

          {/* Creator row — artist-discovery path */}
          {creator && (
            <Link href={`/creator/${creator.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none', marginTop: '-8px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: PANEL_BORDER, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {creator.avatar_url
                  ? <img src={creator.avatar_url} alt={creator.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={ui(500, 12)}>{(creator.display_name || '?')[0].toUpperCase()}</span>}
              </div>
              <span style={ui(500, 14, WHITE80)}>{creator.display_name}</span>
              {creator.is_verified && (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill={ACCENT}/><path d="M5 8L7 10L11 6" stroke="#2C0A1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              )}
            </Link>
          )}

          {/* Primary actions — Book / Boost / Show my nail tech (one primary, always) */}
          <DesignPrimaryActions
            design={{ id: design.id, title: design.title, image_url: design.image_url }}
            creatorId={design.created_by || null}
            creatorHasServices={creatorHasServices}
            boostedUntil={design.boosted_until || null}
            colours={colours || []}
          />

          {/* Spec chips */}
          {specChips.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {specChips.map((spec, i) => <span key={`${spec}-${i}`} style={chipStyle}>{spec}</span>)}
            </div>
          )}

          {/* Description */}
          {design.description && (
            <p style={{ ...ui(300, 14, WHITE80), lineHeight: 1.7, margin: 0 }}>{design.description}</p>
          )}

          {/* Colour Specs — absent (no gap) for the 4 photo uploads with no spec */}
          {colours && colours.length > 0 && (
            <div>
              <p style={sectionLabel}>Colour Specs</p>
              <ColourSwatches colours={colours} />
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div>
              <p style={sectionLabel}>Tags</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {tags.map(tag => (
                  <Link key={tag} href={`/search?tag=${encodeURIComponent(tag)}`} style={{ ...chipStyle, textTransform: 'none', textDecoration: 'none' }}>#{tag}</Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Similar Looks — same-attribute matching (not true similarity), image standard */}
        {related.length > 0 && (
          <div style={{ marginTop: '24px', borderTop: PANEL_BORDER, padding: '24px 20px 0' }}>
            <p style={sectionLabel}>Similar Looks</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'start' }}>
              {related.map(r => (
                <Link key={r.id} href={`/design/${r.id}?from=${encodeURIComponent(`/design/${id}`)}`} style={{ textDecoration: 'none', display: 'block' }}>
                  <div style={{ borderRadius: '16px', overflow: 'hidden', background: PANEL, border: PANEL_BORDER }}>
                    {r.image_url
                      ? <img src={r.image_url} alt={r.title} loading="lazy" decoding="async"
                          width={r.image_width || undefined} height={r.image_height || undefined}
                          style={{ width: '100%', height: 'auto', aspectRatio: r.image_width && r.image_height ? `${r.image_width} / ${r.image_height}` : undefined, display: 'block' }} />
                      : <div style={{ width: '100%', aspectRatio: '1 / 1' }} />}
                  </div>
                  <p style={{ ...ui(500, 13), margin: '8px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</p>
                  {(r.shape || r.category) && (
                    <p style={{ ...ui(400, 11, WHITE60), margin: '2px 0 0' }}>{[r.shape, r.category].filter(Boolean).join(' · ')}</p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </Shell>
  )
}
