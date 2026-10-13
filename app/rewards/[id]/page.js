import RewardLink from "./reward-link";
import { environmentReturnSchemes } from '@/lib/mobile-environment';
export const metadata = {
  title: "LaQue · Designer Rewards",
  description:
    "Open a shared LaQue competition entry. Sign in to view and support designers.",
};
export default async function Page({ params, searchParams }) {
  const { id } = await params,
    query = await searchParams;
  const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
  if (!uuid.test(id))
    return (
      <main>
        <h1>Competition unavailable</h1>
      </main>
    );
  return (
    <RewardLink
      id={id}
      entry={uuid.test(query?.entry || "") ? query.entry : null}
      appScheme={environmentReturnSchemes()[0]}
    />
  );
}
