import { redirect } from 'next/navigation'

// Collections live on /saved now (rail + create + shared boards).
// The old boards index redirects so existing links and the
// moodboard_invite notification target keep working.
export default function MoodboardsIndexRedirect() {
  redirect('/saved')
}
