'use client'

import { useState } from 'react'
import BackButton from '@/components/ui/BackButton'

const ACCENT = '#FF517F'
const WHITE60 = 'rgba(255,255,255,0.6)'
const WHITE80 = 'rgba(255,255,255,0.8)'
const PANEL = 'rgba(255,255,255,0.06)'
const PANEL_BORDER = '1px solid rgba(255,255,255,0.1)'
const ui = (weight, size, color = 'var(--lq-white)') => ({
  fontFamily: 'var(--lq-font-ui)', fontWeight: weight, fontSize: `${size}px`, color, lineHeight: 1.4,
})
const display = (size) => ({ fontFamily: 'var(--lq-font-display)', fontWeight: 400, fontSize: `${size}px`, color: 'var(--lq-white)', lineHeight: 1.2 })

const SECTIONS = [
  {
    title: 'Bookings',
    items: [
      {
        q: 'How do I book an appointment?',
        a: 'Go to any nail artist or salon profile and tap "Book ✦". Choose a service, pick a date and time, add a note if you like, and submit. The artist will confirm or decline your request.',
      },
      {
        q: 'How do I cancel a booking?',
        a: 'Open the appointment in your Appointments tab, then message the artist directly to arrange a cancellation. In-app cancellation is coming soon.',
      },
      {
        q: 'What happens after I submit a booking request?',
        a: "Your request is sent to the artist as “Pending.” Once they accept, your status changes to “Confirmed” and you'll get a notification. If a deposit is required, a payment button will appear on your appointment.",
      },
      {
        q: 'How do I pay a deposit?',
        a: 'When your booking is confirmed and a deposit is required, tap "Pay deposit" on your appointment detail page. You\'ll be taken to a secure Stripe checkout. Once paid, your deposit status updates automatically.',
      },
      {
        q: 'How do I leave a review?',
        a: 'After a confirmed appointment has passed, open that appointment from your Appointments tab. A star rating and review box will appear at the bottom — rate and write, then tap Submit.',
      },
    ],
  },
  {
    title: 'Nail Lab & Credits',
    items: [
      {
        q: 'What is the Nail Lab?',
        a: 'Nail Lab lets you generate custom AI nail design boards using your colour choices and style preferences. Each generation uses 1 credit.',
      },
      {
        q: 'How do I get credits?',
        a: 'Tap "Buy credits" on your profile or in the Nail Lab. Credits are purchased via Stripe in packs. They never expire.',
      },
      {
        q: 'What can I do with my generated designs?',
        a: 'You can save generated designs to a board, share them, or publish them to the Laque library (creator accounts only). Published designs appear on your profile.',
      },
      {
        q: 'Can I regenerate a design?',
        a: 'Yes — on the Nail Lab result screen, tap "Regenerate" to create a new version with the same settings. Each regen costs 1 credit.',
      },
    ],
  },
  {
    title: 'Account & Profile',
    items: [
      {
        q: 'How do I become a nail artist or salon on Laque?',
        a: 'During sign-up, choose "Nail Artist" or "Salon" as your account type. If you already have an account, contact us at hello@laque.app to upgrade.',
      },
      {
        q: 'How do I set up my services and availability?',
        a: 'Go to your profile and scroll to the Services and Availability sections. Tap "Add service" to list what you offer, then set your available days and hours.',
      },
      {
        q: 'How do I make my profile private?',
        a: 'Go to Profile → Privacy settings → toggle "Private account" on. Only your followers will see your designs and full profile.',
      },
      {
        q: 'How do I block someone?',
        a: 'Open their profile, tap the ⋮ menu in the top right corner, and select "Block user." You can manage your block list in Privacy settings.',
      },
      {
        q: 'How do I delete my account?',
        a: 'Scroll to the bottom of your Profile page and tap "Delete account." This is permanent and cannot be undone.',
      },
    ],
  },
  {
    title: 'Designs & Collections',
    items: [
      {
        q: 'How do I save a design?',
        a: 'Tap the heart icon on any design card or open the design and tap the save button. Saved designs appear in your Saved tab.',
      },
      {
        q: 'How do I organise my saved designs into boards?',
        a: 'In your Saved tab, tap "New board" to create a collection. Then save designs directly to a board, or move them from your saves.',
      },
      {
        q: 'How do I publish a design as a creator?',
        a: 'Go to Upload in the bottom nav. Fill in the design specs (colours, technique, occasion, tags) and tap Publish. It will appear on your profile and in the Laque library.',
      },
    ],
  },
  {
    title: 'Messaging',
    items: [
      {
        q: 'How do I message a nail artist?',
        a: 'Open their profile and tap "Message." This starts a conversation. You can also message from your appointment detail page.',
      },
      {
        q: 'Can I send a design in a message?',
        a: 'Yes — open a design, tap the share icon, and choose "Send in chat." Pick the conversation and the design will appear as a card in your message thread.',
      },
      {
        q: 'Who can message me?',
        a: 'By default, anyone on Laque can message you. You can change this in Privacy settings → Messages to "Followers only" or "No one."',
      },
    ],
  },
]

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          gap: '12px', padding: '14px 16px', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left', minHeight: '48px',
        }}
      >
        <span style={{ ...ui(500, 14), flex: 1 }}>{q}</span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: '2px', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          <path d="M4 6L8 10L12 6" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <p style={{ ...ui(300, 13, WHITE80), lineHeight: 1.65, margin: 0, padding: '0 16px 16px' }}>{a}</p>
      )}
    </div>
  )
}

export default function HelpPage() {
  return (
    <div className="lq-bg-wine" style={{ minHeight: '100dvh', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,5,13,0.6)' }} />
      <div className="lq-grain" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', paddingBottom: 'calc(env(safe-area-inset-bottom) + 60px)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: 'calc(env(safe-area-inset-top) + 16px) 20px 0' }}>
          <BackButton fallback="/profile" />
          <h1 style={{ ...display(24), margin: 0 }}>Help &amp; Support</h1>
        </div>

        {/* Intro */}
        <div style={{ padding: '16px 20px 24px' }}>
          <p style={{ ...ui(300, 14, WHITE80), lineHeight: 1.6, margin: 0 }}>
            Find answers to common questions below. Still stuck? Reach us at{' '}
            <a href="mailto:hello@laque.app" style={{ ...ui(500, 14, ACCENT), textDecoration: 'none' }}>hello@laque.app</a>
          </p>
        </div>

        {/* FAQ sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '0 20px' }}>
          {SECTIONS.map(section => (
            <div key={section.title} style={{ background: PANEL, border: PANEL_BORDER, borderRadius: '16px', overflow: 'hidden' }}>
              <p style={{ ...ui(500, 11, ACCENT), letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0, padding: '14px 16px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                {section.title}
              </p>
              {section.items.map((item, i) => (
                <FAQItem key={i} q={item.q} a={item.a} />
              ))}
            </div>
          ))}
        </div>

        {/* Contact card */}
        <div style={{ margin: '20px 20px 0', background: 'rgba(255,81,127,0.08)', border: '1px solid rgba(255,81,127,0.2)', borderRadius: '16px', padding: '20px 16px', textAlign: 'center' }}>
          <p style={{ ...ui(600, 14), margin: '0 0 6px' }}>Still need help?</p>
          <p style={{ ...ui(300, 13, WHITE60), margin: '0 0 14px' }}>Our team usually responds within 24 hours.</p>
          <a href="mailto:hello@laque.app" style={{ display: 'inline-block', background: 'linear-gradient(90deg, #660007 47.832%, #FF517F 100%)', color: 'var(--lq-white)', borderRadius: '1000px', padding: '12px 28px', ...ui(500, 14), textDecoration: 'none' }}>
            Email us
          </a>
        </div>
      </div>
    </div>
  )
}
