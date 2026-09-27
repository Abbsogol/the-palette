'use client'

// Filter/vibe chip. Visual pill ~32px tall; transparent vertical padding on
// the button extends the hit area to >=44px without changing the layout look.
export default function Chip({ children, active = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        background: 'none',
        border: 'none',
        padding: '6px 0',
        minHeight: '44px',
        cursor: 'pointer',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '8px 16px',
        borderRadius: 'var(--lq-radius-pill)',
        background: active ? 'var(--lq-accent-b)' : 'var(--lq-glass)',
        border: active ? '1px solid transparent' : '1px solid var(--lq-glass-border)',
        color: 'var(--lq-white)',
        fontFamily: 'var(--lq-font-ui)',
        fontSize: '13px',
        fontWeight: active ? 500 : 300,
        whiteSpace: 'nowrap',
      }}>
        {children}
      </span>
    </button>
  )
}
