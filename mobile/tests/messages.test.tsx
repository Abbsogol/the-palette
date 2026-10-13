import { fireEvent, render, screen } from "@testing-library/react-native";
import {
  MessagesView,
  type MessagesViewProps,
} from "../src/features/messages-ui/messages-view";
import {
  filterContacts,
  type MessageContact,
} from "../src/features/messages-ui/model";
import HomeDesignPreview from "../src/preview/home-main";
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
const contacts: MessageContact[] = [
  {
    id: "kim-conversation",
    name: "Kim",
    username: "kimnails",
    role: "creator",
    location: "Dubai",
    unread: true,
  },
  {
    id: "client-conversation",
    name: "keyvan",
    username: "keyvan",
    role: "user",
  },
  {
    id: "salon-conversation",
    name: "Nail Bar Studio",
    username: "nailbar",
    role: "salon",
    location: "Kyiv",
  },
];
const props = (): MessagesViewProps => ({
  contacts,
  onOpen: jest.fn(),
  onRefresh: jest.fn(),
  onMore: jest.fn(),
  onFind: jest.fn(),
});
test("contact search matches names, usernames and cities, and composes with role/unread filters", () => {
  expect(
    filterContacts(contacts, "  dubAI ", "All contacts").map((c) => c.id),
  ).toEqual(["kim-conversation"]);
  expect(
    filterContacts(contacts, "@kimnails", "Nail artists").map((c) => c.id),
  ).toEqual(["kim-conversation"]);
  expect(filterContacts(contacts, "@Dubai", "All contacts")).toEqual([]);
  expect(filterContacts(contacts, "Kim", "Salons")).toEqual([]);
  expect(filterContacts(contacts, "", "Unread").map((c) => c.id)).toEqual([
    "kim-conversation",
  ]);
  expect(
    filterContacts(
      [{ id: "missing", name: "Unavailable member" }],
      "",
      "Clients",
    ),
  ).toEqual([]);
});
test("search and filter controls open only the selected conversation and can reset the filter", async () => {
  const p = props();
  await render(<MessagesView {...p} />);
  await fireEvent.changeText(
    screen.getByLabelText("Search contacts by name, username or city"),
    "@kim",
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Message Kim, unread messages" }),
  );
  expect(p.onOpen).toHaveBeenLastCalledWith("kim-conversation");
  expect(screen.queryByRole("button", { name: "Message keyvan" })).toBeNull();
  await fireEvent.press(
    screen.getByRole("button", { name: "Filter contacts" }),
  );
  await fireEvent.press(screen.getByRole("radio", { name: "Salons" }));
  expect(
    screen.getByText("No recent contacts match your search or filter."),
  ).toBeTruthy();
  await fireEvent.changeText(
    screen.getByLabelText("Search contacts by name, username or city"),
    "",
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Message Nail Bar Studio" }),
  );
  expect(p.onOpen).toHaveBeenLastCalledWith("salon-conversation");
  await fireEvent.press(
    screen.getByRole("button", { name: "Filter contacts" }),
  );
  await fireEvent.press(screen.getByRole("radio", { name: "All contacts" }));
  expect(screen.getByRole("button", { name: "Message keyvan" })).toBeTruthy();
});
test("loading/errors hide stale contacts; retry, empty discovery and pagination remain available", async () => {
  const p = props();
  const view = await render(<MessagesView {...p} loading />);
  expect(screen.getByLabelText("Loading contacts")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Message keyvan" })).toBeNull();
  await view.rerender(<MessagesView {...p} error="Offline" />);
  expect(screen.queryByRole("button", { name: "Message keyvan" })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
  expect(p.onRefresh).toHaveBeenCalledTimes(1);
  await view.rerender(<MessagesView {...p} contacts={[]} />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Find an artist or salon" }),
  );
  expect(p.onFind).toHaveBeenCalledTimes(1);
  await view.rerender(<MessagesView {...p} hasMore busy />);
  expect(screen.getByRole("button", { name: "Message keyvan" })).toBeDisabled();
  await fireEvent.press(
    screen.getByRole("button", { name: "Load more contacts" }),
  );
  expect(p.onMore).toHaveBeenCalledTimes(1);
});
test("Messages tab shows the Figma contacts and demo actions without claiming a message was sent", async () => {
  await render(<HomeDesignPreview />);
  await fireEvent.press(screen.getByRole("tab", { name: "Messages" }));
  expect(screen.getByRole("header", { name: "Messages" })).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", { name: "Message Polished" }),
  );
  expect(
    screen.getByText(/Design preview · messages stay on this device/),
  ).toBeTruthy();
  expect(screen.queryByRole("tab", { name: "Lab" })).toBeNull();
  await fireEvent.press(
    screen.getByRole("button", { name: "Back to messages" }),
  );
  await fireEvent.press(screen.getByRole("tab", { name: "Lab" }));
  await fireEvent.press(screen.getByRole("button", { name: "History" }));
  expect(screen.getByRole("header", { name: "My Generations" })).toBeTruthy();
  expect(screen.getByText("3 designs")).toBeTruthy();
});
test("message rows display a changed profile photo and return to initials when removed", async () => {
  const p = props();
  const row = {
    ...contacts[0],
    avatar: { uri: "https://images.test/first.webp" },
  };
  const view = await render(<MessagesView {...p} contacts={[row]} />);
  expect(
    JSON.stringify(screen.getByLabelText("Kim profile photo").props.source),
  ).toContain("first.webp");
  await view.rerender(
    <MessagesView
      {...p}
      contacts={[
        { ...row, avatar: { uri: "https://images.test/replacement.webp" } },
      ]}
    />,
  );
  expect(
    JSON.stringify(screen.getByLabelText("Kim profile photo").props.source),
  ).toContain("replacement.webp");
  await view.rerender(
    <MessagesView {...p} contacts={[{ ...row, avatar: null }]} />,
  );
  expect(screen.queryByLabelText("Kim profile photo")).toBeNull();
  expect(screen.getByText("K")).toBeTruthy();
});
