'use client'
import Link from 'next/link'
import IconButton from './IconButton'
import { CandleFilterIcon } from './icons'

function FieldSearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M7.66667 14C11.1645 14 14 11.1645 14 7.66667C14 4.16886 11.1645 1.33333 7.66667 1.33333C4.16886 1.33333 1.33333 4.16886 1.33333 7.66667C1.33333 11.1645 4.16886 14 7.66667 14Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14.6667 14.6667L13.3333 13.3333" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// variant 'solid': white pill with pink placeholder (Home main hero style).
// variant 'glass': translucent pill on the wine background (feed style).
const variantStyles = {
  solid: {
    pill: { background: 'var(--lq-white)', border: 'none' },
    text: { color: 'var(--lq-pink-soft)' },
    icon: { color: 'var(--lq-pink-soft)' },
    filterIcon: { color: '#B36177' },
  },
  glass: {
    pill: { background: 'rgba(255, 255, 255, 0.08)', border: '1px solid var(--lq-glass-border)' },
    text: { color: 'var(--lq-white-80)' },
    icon: { color: 'var(--lq-white-80)' },
    filterIcon: { color: 'var(--lq-white-80)' },
  },
}

// Two modes:
// - href mode (Home): the pill is a navigation link that looks like the input.
// - input mode (Search page): a real labeled <input>.
export default function SearchInput({
  placeholder = 'Search designs, nail artists, salons..',
  href,
  filterHref,
  value,
  onChange,
  variant = 'solid',
  label = 'Search designs, nail artists, salons',
}) {
  const v = variantStyles[variant]
  const pillStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--lq-space-sm)',
    borderRadius: 'var(--lq-radius-pill)',
    padding: '12px 16px',
    minHeight: '48px',
    width: '100%',
    textDecoration: 'none',
    ...v.pill,
  }
  const placeholderStyle = {
    fontFamily: 'var(--lq-font-ui)',
    fontWeight: 300,
    fontSize: '14px',
    flex: 1,
    textAlign: 'left',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    ...v.text,
  }

  if (href) {
    return (
      <div style={{ position: 'relative', width: '100%' }}>
        <Link href={href} aria-label={label} style={{ ...pillStyle, paddingRight: filterHref ? '52px' : '16px' }}>
          <span style={{ ...v.icon, display: 'flex' }}><FieldSearchIcon /></span>
          <span style={placeholderStyle}>{placeholder}</span>
        </Link>
        {filterHref && (
          <span style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', ...v.filterIcon }}>
            <IconButton label="Open search filters" href={filterHref} variant="plain" visualSize={32}>
              <CandleFilterIcon size={22} />
            </IconButton>
          </span>
        )}
      </div>
    )
  }
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <label style={{ ...pillStyle, cursor: 'text' }}>
        <span style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clipPath: 'inset(50%)' }}>{label}</span>
        <span style={{ ...v.icon, display: 'flex' }}><FieldSearchIcon /></span>
        <input
          type="search"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          style={{
            border: 'none',
            outline: 'none',
            background: 'transparent',
            flex: 1,
            fontFamily: 'var(--lq-font-ui)',
            fontSize: '14px',
            color: variant === 'glass' ? 'var(--lq-white)' : 'var(--lq-plum)',
            minWidth: 0,
          }}
        />
      </label>
    </div>
  )
}
