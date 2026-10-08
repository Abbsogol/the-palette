import { fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import { Inbox } from "../src/features/inbox";
import { accountScope } from "../src/lib/account-scope";
import { api } from "../src/lib/api";
import { readPending, writePending } from "../src/lib/pending";
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
const mockContacts = [
  {
    id: "conversation-a",
    client_id: "account-a",
    creator_id: "creator-a",
    last_message_at: "2026-09-29",
    unread: true,
    other: {
      display_name: "Kim",
      username: "kimnails",
      location: "Dubai",
      account_type: "creator",
    },
  },
];
jest.mock("../src/lib/auth", () => ({
  useAuth: () => ({ session: { user: { id: "account-a" } } }),
  useAccountQuery: () => ({
    data: mockContacts,
    refetch: jest.fn(),
    isPending: false,
    isFetching: false,
  }),
}));
jest.mock("../src/lib/supabase", () => ({ supabase: {} }));
jest.mock("../src/lib/api", () => ({ api: jest.fn(), checked: jest.fn() }));
jest.mock("../src/lib/pending", () => ({
  readPending: jest.fn(),
  writePending: jest.fn(),
}));
beforeEach(() => {
  jest.clearAllMocks();
  accountScope.change("account-a", true);
  jest.mocked(readPending).mockResolvedValue(null);
  jest.mocked(writePending).mockResolvedValue(undefined);
  jest.mocked(api).mockResolvedValue({});
});
test("a contact opens its existing conversation without sending anything", async () => {
  await render(<Inbox />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Message Kim, unread messages" }),
  );
  expect(router.push).toHaveBeenCalledWith({
    pathname: "/conversation/[id]",
    params: { id: "conversation-a" },
  });
  expect(api).not.toHaveBeenCalled();
});
