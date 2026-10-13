// Official Updates are published through the MFA-protected Admin Studio only.
// Community has its own post composer and permissions.
export async function publishUpdate(_id: string, _body: string): Promise<void> {
  throw new Error(
    "Official Updates are managed in Admin Studio. Share your own posts in Community.",
  );
}
