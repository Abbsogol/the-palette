import { AdminError } from './auth';
import { adminMediaPath } from './media';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validateHome(content) {
  const invalid = () => {
    throw new AdminError('Check the hero slides, featured IDs and announcements.');
  };
  if (!content || !Array.isArray(content.heroes) || content.heroes.length < 1 || content.heroes.length > 6 || !Array.isArray(content.featuredDesignIds) || content.featuredDesignIds.length > 24 || !Array.isArray(content.announcements) || content.announcements.length > 10) invalid();
  const text = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
  const image = v => {
    if (typeof v !== 'string') return false;
    if (adminMediaPath(v)) return true;
    if (v.startsWith('/admin-assets/') && !v.includes('..')) return true;
    try {
      const u = new URL(v);
      return u.protocol === 'https:' && !u.username && !u.password && u.hostname === new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname && u.pathname.startsWith('/storage/v1/object/public/designs/');
    } catch {
      return false;
    }
  };
  for (const h of content.heroes) if (!text(h.id, 80) || !image(h.imageUrl) || !text(h.alt, 240) || !text(h.title, 120) || ![0, 180].includes(h.rotate)) invalid();
  for (const id of content.featuredDesignIds) if (!uuid.test(id)) invalid();
  for (const a of content.announcements) if (!text(a.id, 80) || !text(a.title, 120) || !text(a.body, 1000)) invalid();
  if (new Set(content.heroes.map(x => x.id)).size !== content.heroes.length || new Set(content.announcements.map(x => x.id)).size !== content.announcements.length) invalid();
  return {
    heroes: content.heroes.map(({
      id,
      imageUrl,
      alt,
      title,
      rotate
    }) => ({
      id,
      imageUrl,
      alt,
      title,
      rotate
    })),
    featuredDesignIds: [...new Set(content.featuredDesignIds)],
    announcements: content.announcements.map(({
      id,
      title,
      body
    }) => ({
      id,
      title,
      body
    }))
  };
}
