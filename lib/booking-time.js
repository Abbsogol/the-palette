export function dateInZone(zone, now = new Date()) {
  if (!zone) return null
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(p => [p.type, p.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

// UTC is only a carrier for a calendar date here, never a booking time zone.
export const calendarDate = key => new Date(`${key}T00:00:00Z`)
export const calendarKey = date => date.toISOString().slice(0, 10)
export function bookingCalendar(availability, zone, now = new Date()) {
  if (!zone) return []
  const today = calendarDate(dateInZone(zone, now))
  const start = new Date(today); start.setUTCDate(today.getUTCDate() - today.getUTCDay())
  const days = new Set(availability.map(a => a.day_of_week))
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start); date.setUTCDate(start.getUTCDate() + i)
    return { date, available: date >= today && days.has(date.getUTCDay()) }
  })
}
export const bookingHasEnded = (booking, now = new Date()) => !!booking.ends_at && new Date(booking.ends_at) <= now
export const bookingCanTakeDeposit = (booking, now = new Date()) => ['pending', 'confirmed'].includes(booking.status) && !booking.deposit_paid && !!booking.starts_at && new Date(booking.starts_at) > now
export const bookingZoneLabel = booking => booking.time_zone || 'Time zone needs confirmation'
