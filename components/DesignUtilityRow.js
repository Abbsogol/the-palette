'use client'
import SendDesignButton from './SendDesignButton'
import SaveToBoard from './SaveToBoard'

// Client wrapper for the design page's utility row. The page is a server
// component, so render-prop functions can't cross into SendDesignButton /
// SaveToBoard from there — they live here instead. Two matched glass pills;
// grid columns make both fill equally (SaveToBoard wraps in its own button).
const pill = {
  width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '1000px', minHeight: '46px',
  fontFamily: 'var(--lq-font-ui)', fontWeight: 500, fontSize: '13px', color: 'var(--lq-white)', cursor: 'pointer',
}

export default function DesignUtilityRow({ design }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
      <SendDesignButton
        design={design}
        renderTrigger={({ open }) => (
          <button onClick={open} style={pill}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg>
            Send to chat
          </button>
        )}
      />
      <SaveToBoard
        designId={design.id} designImageUrl={design.image_url}
        renderTrigger={() => (
          <div style={pill}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
            Save to board
          </div>
        )}
      />
    </div>
  )
}
