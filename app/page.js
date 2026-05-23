import { supabase } from '@/lib/supabase'

export default async function Home() {
  const { data: designs } = await supabase
    .from('designs')
    .select('*')
    .eq('is_published', true)
    .order('created_at', { ascending: false })

  return (
    <div style={{ padding: '24px 20px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '22px', letterSpacing: '-0.02em', marginBottom: '4px' }}>
          The Palette
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Nail & beauty design platform
        </p>
      </div>

      {designs && designs.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {designs.map((design) => (
            <div
              key={design.id}
              style={{
                background: 'var(--bg-card)',
                borderRadius: '12px',
                padding: '20px',
                border: '0.5px solid var(--border)',
              }}
            >
              <p style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>
                {design.occasion} · {design.technique}
              </p>
              <h2 style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: '500', marginBottom: '6px' }}>
                {design.title}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6' }}>
                {design.description}
              </p>
              <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                <span style={{ background: 'var(--bg-chip)', color: 'var(--text-secondary)', fontSize: '11px', padding: '4px 10px', borderRadius: '20px' }}>
                  {design.shape}
                </span>
                <span style={{ background: 'var(--bg-chip)', color: 'var(--text-secondary)', fontSize: '11px', padding: '4px 10px', borderRadius: '20px' }}>
                  {design.length}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '32px 20px', border: '0.5px solid var(--border)', textAlign: 'center' }}>
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
