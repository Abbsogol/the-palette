import { SocialComposerPreview } from "./social";
import type { StoryItem } from "../features/stories/story-ui";
export function StoryComposerPreview({
  onClose,
  onPost,
}: {
  width: number;
  onClose: () => void;
  onPost: (story: StoryItem) => void;
}) {
  return (
    <SocialComposerPreview
      kind="story"
      onClose={onClose}
      onPost={(d) =>
        onPost({
          id: `demo-${Date.now()}`,
          userId: "preview-self",
          name: "You",
          image: d.media[0].uri,
          mediaType: d.media[0].type,
          caption: d.caption,
          tags: d.tags,
          people: d.people,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        })
      }
    />
  );
}
