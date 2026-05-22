export default function Home() {
  return (
    <div style={{ padding: '24px 20px' }}>
      <div style={{ marginBottom: '28px' }}>
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

      <div style={{
        background: 'var(--bg-card)',
        borderRadius: '12px',
        padding: '32px 20px',
        border: '0.5px solid var(--border)',
        textAlign: 'center',
        marginBottom: '12px',
      }}>
        <p style={{
          color: 'var(--accent)',
          fontSize: '13px',
          fontWeight: '500',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          marginBottom: '8px',
        }}>
          Coming soon
        </p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6' }}>
          Hundreds of nail & beauty designs,<br />
          each with full specs and colour codes.
        </p>
      </div>
    </div>
  )
}
