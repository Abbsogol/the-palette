import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { UpdateComposer } from "../src/features/home/update-composer";
import { UpdatesFeed } from "../src/features/home/updates-view";
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);

test("Updates has its own create action even when empty", async () => {
  const compose = jest.fn();
  await render(
    <UpdatesFeed
      posts={[]}
      onCompose={compose}
      onRetry={jest.fn()}
      onProfile={jest.fn()}
      onDiscover={jest.fn()}
      onNotifications={jest.fn()}
    />,
  );
  await fireEvent.press(screen.getByRole("button", { name: "Create update" }));
  expect(compose).toHaveBeenCalledTimes(1);
});
test("empty updates cannot publish; text-only updates publish and return", async () => {
  const publish = jest.fn().mockResolvedValue(undefined),
    close = jest.fn();
  await render(<UpdateComposer onPublish={publish} onClose={close} />);
  await fireEvent.press(screen.getByRole("button", { name: "Publish update" }));
  expect(publish).not.toHaveBeenCalled();
  await fireEvent.changeText(
    screen.getByLabelText("Your update"),
    "  A new studio note  ",
  );
  await fireEvent.press(screen.getByRole("button", { name: "Publish update" }));
  await waitFor(() =>
    expect(screen.getByText("Your update is ready")).toBeTruthy(),
  );
  expect(publish).toHaveBeenCalledWith("A new studio note");
  await fireEvent.press(
    screen.getByRole("button", { name: "Back to Updates" }),
  );
  expect(close).toHaveBeenCalledTimes(1);
});
test("failed publishing preserves and locks the submitted text for retry", async () => {
  const publish = jest
    .fn()
    .mockRejectedValueOnce(new Error("Offline"))
    .mockResolvedValue(undefined);
  await render(<UpdateComposer onPublish={publish} onClose={jest.fn()} />);
  await fireEvent.changeText(
    screen.getByLabelText("Your update"),
    "Friday appointments available",
  );
  await fireEvent.press(screen.getByRole("button", { name: "Publish update" }));
  await waitFor(() => expect(screen.getByText("Offline")).toBeTruthy());
  expect(screen.getByLabelText("Your update").props.editable).toBe(false);
  await fireEvent.press(screen.getByRole("button", { name: "Retry publish" }));
  await waitFor(() =>
    expect(screen.getByText("Your update is ready")).toBeTruthy(),
  );
  expect(publish.mock.calls).toEqual([
    ["Friday appointments available"],
    ["Friday appointments available"],
  ]);
});
test("leaving an unfinished update requires an explicit discard", async () => {
  const close = jest.fn();
  await render(<UpdateComposer onPublish={jest.fn()} onClose={close} />);
  await fireEvent.changeText(screen.getByLabelText("Your update"), "Draft");
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(close).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Discard update" }));
  expect(close).toHaveBeenCalledTimes(1);
});

test("preview shows the author and full note without publishing, then returns to the preserved draft", async () => {
  const publish = jest.fn();
  await render(
    <UpdateComposer
      author={{ name: "Mira", username: "mira.nails" }}
      onPublish={publish}
      onClose={jest.fn()}
    />,
  );
  await fireEvent.changeText(
    screen.getByLabelText("Your update"),
    "Friday slots available",
  );
  await fireEvent.press(screen.getByRole("button", { name: "Preview update" }));
  expect(screen.getByText("Friday slots available")).toBeTruthy();
  expect(screen.getByText("@mira.nails")).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Open profile for Mira" }),
  ).toBeNull();
  expect(publish).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Edit update" }));
  expect(screen.getByLabelText("Your update").props.value).toBe(
    "Friday slots available",
  );
});
test("own update cards use owner presentation and do not offer self-reporting", async () => {
  await render(
    <UpdatesFeed
      currentUserId="owner"
      posts={[
        {
          id: "note",
          creator_id: "owner",
          name: "Mira",
          username: "mira.nails",
          body: "Studio news",
          created_at: new Date().toISOString(),
          avatar: { uri: "https://example.test/avatar.png" },
        },
      ]}
      onRetry={jest.fn()}
      onProfile={jest.fn()}
      onDiscover={jest.fn()}
      onNotifications={jest.fn()}
      onReport={jest.fn()}
    />,
  );
  expect(screen.getByText("YOUR UPDATE")).toBeTruthy();
  expect(screen.getByLabelText("Mira profile photo")).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Options for Mira's update" }),
  ).toBeNull();
});
