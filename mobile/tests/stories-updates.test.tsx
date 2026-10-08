import { fireEvent, render, screen } from "@testing-library/react-native";
import {
  StoryViewer,
  StoryComposerView,
  type StoryItem,
} from "../src/features/stories/story-ui";
import { StoryComposerPreview } from "../src/preview/stories";
import { UpdatesFeed } from "../src/features/home/updates-view";
import { homeTabs } from "../src/components/home-tab-bar";

jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
jest.mock("expo-image-picker", () => ({ launchImageLibraryAsync: jest.fn() }));

const stories: StoryItem[] = [
  {
    id: "first",
    userId: "artist-a",
    name: "Anelia",
    image: "https://test.invalid/first.jpg",
    caption: "First moment",
    createdAt: "2026-09-29T06:00:00Z",
  },
  {
    id: "second",
    userId: "artist-a",
    name: "Anelia",
    image: "https://test.invalid/second.jpg",
    caption: "Second moment",
    createdAt: "2026-09-29T07:00:00Z",
  },
];
const post = {
  id: "post-a",
  creator_id: "artist-a",
  name: "Anelia",
  body: "A new studio note. ".repeat(25),
  created_at: "2026-09-29T07:00:00Z",
};
const updateActions = () => ({
  onRetry: jest.fn(),
  onProfile: jest.fn(),
  onDiscover: jest.fn(),
  onNotifications: jest.fn(),
  onMore: jest.fn(),
});

test("viewer moves between stories, targets the current author's profile, and finishes", async () => {
  const onClose = jest.fn(),
    onProfile = jest.fn();
  await render(
    <StoryViewer
      stories={stories}
      onRetry={jest.fn()}
      onClose={onClose}
      onProfile={onProfile}
    />,
  );
  expect(screen.getByRole("button", { name: "Previous story" })).toBeDisabled();
  expect(screen.getByText("First moment")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Next story" }));
  expect(screen.queryByText("First moment")).toBeNull();
  expect(screen.getByText("Second moment")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "View profile" }));
  expect(onProfile).toHaveBeenCalledWith(stories[1]);
  await fireEvent.press(screen.getByRole("button", { name: "Previous story" }));
  expect(screen.getByText("First moment")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Next story" }));
  await fireEvent.press(screen.getByRole("button", { name: "Finish stories" }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("expired and failed story reads offer recovery and never show stale photos on error", async () => {
  const onRetry = jest.fn(),
    onClose = jest.fn();
  const view = await render(
    <StoryViewer stories={[]} onRetry={onRetry} onClose={onClose} />,
  );
  expect(screen.getByText("This moment has passed")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Check again" }));
  expect(onRetry).toHaveBeenCalledTimes(1);
  await view.rerender(
    <StoryViewer
      stories={stories}
      error="Connection lost"
      onRetry={onRetry}
      onClose={onClose}
    />,
  );
  expect(screen.queryByText("First moment")).toBeNull();
  expect(screen.getByRole("alert")).toHaveTextContent("Connection lost");
  await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
  expect(onRetry).toHaveBeenCalledTimes(2);
});

test("story account reporting stays reachable without a bottom tab", async () => {
  const onReport = jest.fn();
  await render(
    <StoryViewer
      stories={stories}
      onRetry={jest.fn()}
      onClose={jest.fn()}
      onReport={onReport}
    />,
  );
  await fireEvent.press(screen.getByRole("button", { name: "Story options" }));
  await fireEvent.press(screen.getByRole("button", { name: "Report account" }));
  expect(onReport).toHaveBeenCalledWith(stories[0]);
});

test("composer preview preserves its draft, does not publish, and asks before discarding", async () => {
  const onPost = jest.fn(),
    onClose = jest.fn();
  await render(
    <StoryComposerView
      image={stories[0].image}
      caption="My new set"
      onCaption={jest.fn()}
      onPick={jest.fn()}
      onPost={onPost}
      onClose={onClose}
    />,
  );
  await fireEvent.press(screen.getByRole("button", { name: "Preview story" }));
  expect(screen.getByText("My new set")).toBeTruthy();
  expect(onPost).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Close story" }));
  expect(screen.getByLabelText("Caption")).toHaveProp("value", "My new set");
  await fireEvent.press(screen.getByRole("button", { name: "Close composer" }));
  expect(onClose).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Keep editing" }));
  expect(onClose).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Close composer" }));
  await fireEvent.press(screen.getByRole("button", { name: "Discard draft" }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("composer prevents posting without a photo and disables edits during an upload", async () => {
  const props = {
    caption: "",
    onCaption: jest.fn(),
    onPick: jest.fn(),
    onPost: jest.fn(),
    onClose: jest.fn(),
  };
  const view = await render(<StoryComposerView {...props} />);
  expect(screen.getByRole("button", { name: "Post story" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Preview story" })).toBeDisabled();
  await view.rerender(
    <StoryComposerView
      {...props}
      image={stories[0].image}
      busy
      stage="Uploading your photo…"
    />,
  );
  expect(screen.getByRole("button", { name: "Post story" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Close composer" })).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Choose another photo" }),
  ).toBeDisabled();
  expect(screen.getByLabelText("Caption")).toHaveProp("editable", false);
  expect(screen.getByText("Uploading your photo…")).toBeTruthy();
});

test("preview composer can pick a sample and return a local story with the caption", async () => {
  const onPost = jest.fn();
  await render(
    <StoryComposerPreview width={393} onClose={jest.fn()} onPost={onPost} />,
  );
  await fireEvent.press(screen.getByRole("button", { name: "Choose photo or video" }));
  await fireEvent.press(
    screen.getByRole("button", { name: "Use sample photo 2" }),
  );
  await fireEvent.changeText(
    screen.getByLabelText("Caption"),
    "Chrome inspiration",
  );
  await fireEvent.press(screen.getByRole("button", { name: "Share story" }));
  expect(onPost).toHaveBeenCalledWith(
    expect.objectContaining({
      userId: "preview-self",
      caption: "Chrome inspiration",
    }),
  );
});

test("updates expand long content and link to the author and separate notifications screen", async () => {
  const actions = updateActions();
  await render(<UpdatesFeed posts={[post]} {...actions} />);
  expect(screen.queryByText(post.body)).toBeNull();
  await fireEvent.press(
    screen.getByRole("button", { name: "Read more from Anelia" }),
  );
  expect(screen.getByText(post.body)).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", { name: "Open profile for Anelia" }),
  );
  expect(actions.onProfile).toHaveBeenCalledWith("artist-a");
  await fireEvent.press(
    screen.getByRole("button", { name: "Open notifications" }),
  );
  expect(actions.onNotifications).toHaveBeenCalledTimes(1);
  expect(homeTabs.map((tab) => tab.name)).toEqual([
    "index",
    "search",
    "lab",
    "messages",
    "saved",
    "profile",
  ]);
});

test("empty updates encourage discovery, failure offers retry, and pagination stays explicit", async () => {
  const actions = updateActions();
  const view = await render(<UpdatesFeed posts={[]} {...actions} />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Find artists & salons" }),
  );
  expect(actions.onDiscover).toHaveBeenCalledTimes(1);
  await view.rerender(
    <UpdatesFeed posts={[]} {...actions} error="No connection" />,
  );
  expect(screen.queryByText("Your circle starts here")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Retry updates" }));
  expect(actions.onRetry).toHaveBeenCalledTimes(1);
  await view.rerender(<UpdatesFeed posts={[post]} {...actions} hasMore />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Load more updates" }),
  );
  expect(actions.onMore).toHaveBeenCalledTimes(1);
});

test("opening a newly posted story selects it even when earlier stories exist", async () => {
  await render(
    <StoryViewer
      stories={stories}
      initialStoryId="second"
      onClose={jest.fn()}
      onRetry={jest.fn()}
    />,
  );
  expect(screen.getByText("Second moment")).toBeTruthy();
  expect(screen.queryByText("First moment")).toBeNull();
  expect(
    screen.getByRole("button", { name: "Previous story" }),
  ).not.toBeDisabled();
});
