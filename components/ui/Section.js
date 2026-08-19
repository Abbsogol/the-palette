// Section header + horizontal card carousel used by the "Trending Designs"
// pattern in the redesign.

export function SectionHeader({ title, sub, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--lq-space-sm)' }}>
      <div>
        <h2 style={{
          fontFamily: 'var(--lq-font-ui)',
          fontWeight: 400,
          fontSize: '20px',
          lineHeight: 1.2,
          color: 'var(--lq-white)',
        }}>
          {title}
        </h2>
        {sub && (
          <p style={{
            fontFamily: 'var(--lq-font-ui)',
            fontWeight: 300,
            fontSize: '13px',
            color: 'var(--lq-white-80)',
            marginTop: '2px',
          }}>
            {sub}
          </p>
        )}
      </div>
      {right}
    </div>
  )
}

export function CardCarousel({ children, gap = 8 }) {
  return (
    <div style={{
      display: 'flex',
      gap: `${gap}px`,
      overflowX: 'auto',
      WebkitOverflowScrolling: 'touch',
      scrollbarWidth: 'none',
      margin: '0 calc(-1 * var(--lq-space-2xl))',
      padding: '0 var(--lq-space-2xl)',
    }}>
      {children}
    </div>
  )
}

export function Section({ title, sub, right, children }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--lq-space-md)' }}>
      <SectionHeader title={title} sub={sub} right={right} />
      {children}
    </section>
  )
}
