import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { SocialComposer } from "../src/features/social/composer";
import { StoryViewer, type StoryItem } from "../src/features/stories/story-ui";
import { accountScope } from "../src/lib/account-scope";
import { MediaPermissionError } from "../src/features/social/media-permission";
import * as Linking from "expo-linking";
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
const story: StoryItem = {
  id: "s",
  userId: "owner",
  name: "Sarah",
  image: "https://example.invalid/story.png",
  caption: "A moment",
  createdAt: "2026-10-07T00:00:00Z",
};
const press = (name: string) =>
  fireEvent.press(screen.getByRole("button", { name }));
beforeEach(() => accountScope.change("owner", true));
afterEach(() => {
  accountScope.change(null);
  jest.useRealTimers();
  jest.restoreAllMocks();
});
test("story photos show loading until image load finishes, and show loading again on retry", async () => {
  await render(
    <StoryViewer stories={[story]} onRetry={jest.fn()} onClose={jest.fn()} />,
  );
  expect(screen.getByLabelText("Loading story photo")).toBeTruthy();
  await fireEvent(screen.getByLabelText("Story by Sarah"), "loadEnd");
  expect(screen.queryByLabelText("Loading story photo")).toBeNull();
  await fireEvent(screen.getByLabelText("Story by Sarah"), "error", {
    nativeEvent: { error: "Network error" },
  });
  await press("Retry photo");
  expect(screen.getByLabelText("Loading story photo")).toBeTruthy();
});
test("denied photo access offers Settings and retains the story draft for another pick", async () => {
  const settings = jest.spyOn(Linking, "openSettings").mockResolvedValue();
  const pick = jest
    .fn()
    .mockRejectedValueOnce(new MediaPermissionError())
    .mockResolvedValueOnce({ type: "image", uri: "file:///allowed.png" });
  await render(
    <SocialComposer
      kind="story"
      onClose={jest.fn()}
      onPick={pick}
      onPost={jest.fn()}
      searchPeople={async () => []}
    />,
  );
  await fireEvent.changeText(
    screen.getByLabelText("Caption"),
    "Keep this draft",
  );
  await press("Choose photo or video");
  expect(screen.getByRole("alert")).toHaveTextContent(/Photo access is off/);
  await press("Open photo settings");
  expect(settings).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText("Caption")).toHaveProp(
    "value",
    "Keep this draft",
  );
  await press("Choose photo or video");
  expect(screen.getByRole("button", { name: "Remove photo 1" })).toBeTruthy();
});
test("an open story disappears at its actual expiry, rather than staying visible until manually refreshed", async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-10-07T23:59:59Z"));
  await render(
    <StoryViewer
      stories={[{ ...story, expiresAt: "2026-10-08T00:00:00Z" }]}
      onRetry={jest.fn()}
      onClose={jest.fn()}
    />,
  );
  expect(screen.getByText("A moment")).toBeTruthy();
  await act(async () => jest.advanceTimersByTime(1000));
  expect(screen.queryByText("A moment")).toBeNull();
  expect(screen.getByText("This moment has passed")).toBeTruthy();
});
test("failed visibility checks remove stale identity and report controls as well as media", async () => {
  await render(
    <StoryViewer
      stories={[story]}
      error="Access unavailable"
      onReport={jest.fn()}
      onRetry={jest.fn()}
      onClose={jest.fn()}
    />,
  );
  expect(screen.queryByText("Sarah")).toBeNull();
  expect(screen.queryByRole("button", { name: "Story options" })).toBeNull();
  expect(screen.getByRole("alert")).toHaveTextContent("Access unavailable");
});
test("owners cannot report their own story and photo errors have an explicit retry", async () => {
  await render(
    <StoryViewer
      stories={[story]}
      viewerId="owner"
      onReport={jest.fn()}
      onRetry={jest.fn()}
      onClose={jest.fn()}
    />,
  );
  expect(screen.queryByRole("button", { name: "Story options" })).toBeNull();
  await fireEvent(screen.getByLabelText("Story by Sarah"), "error", {
    nativeEvent: { error: "Network error" },
  });
  expect(screen.getByRole("button", { name: "Retry photo" })).toBeTruthy();
});
test("caption/tag-only drafts ask before leaving the composer", async () => {
  const close = jest.fn();
  await render(
    <SocialComposer
      kind="story"
      onClose={close}
      onPick={async () => null}
      onPost={jest.fn()}
      searchPeople={async () => []}
    />,
  );
  await fireEvent.changeText(screen.getByLabelText("Hashtags"), "#nailart");
  await press("Back");
  expect(close).not.toHaveBeenCalled();
  expect(screen.getByText("Discard this story?")).toBeTruthy();
  await press("Discard");
  expect(close).toHaveBeenCalledTimes(1);
});
test("upload stages are visible, posting taps submit once, and retry keeps the same payload", async () => {
  let done!: () => void;
  const post = jest.fn((draft, progress) => {
    progress("Uploading photo 1 of 1…");
    return new Promise<void>((r) => {
      done = r;
    });
  });
  await render(
    <SocialComposer
      kind="story"
      onClose={jest.fn()}
      onPick={async () => ({ type: "image", uri: "file:///photo.png" })}
      onPost={post}
      searchPeople={async () => []}
    />,
  );
  await press("Choose photo or video");
  await press("Share story");
  await press("Share story");
  expect(post).toHaveBeenCalledTimes(1);
  expect(screen.getByText("Uploading photo 1 of 1…")).toBeTruthy();
  expect(screen.getByLabelText("Caption")).toHaveProp("editable", false);
  await act(async () => done());
});
test("a late picker result after an account change cannot add media", async () => {
  let done!: (v: any) => void;
  const pick = () =>
    new Promise<any>((r) => {
      done = r;
    });
  await render(
    <SocialComposer
      kind="story"
      onClose={jest.fn()}
      onPick={pick}
      onPost={jest.fn()}
      searchPeople={async () => []}
    />,
  );
  await press("Choose photo or video");
  accountScope.change("other");
  await act(async () =>
    done({ type: "image", uri: "file:///old-account.png" }),
  );
  expect(screen.queryByRole("button", { name: "Remove photo 1" })).toBeNull();
});
