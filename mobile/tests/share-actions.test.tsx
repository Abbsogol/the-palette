import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { router } from "expo-router";
import { ShareDesignScreen } from "../src/features/messages-ui/share-screen";
import { loadShareDesign } from "../src/features/messages-ui/data";
import { accountScope } from "../src/lib/account-scope";
import { api } from "../src/lib/api";
import { readPending, writePending } from "../src/lib/pending";
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
let mockUserId = "account-a";
let mockEpoch = 0;
const mockDesign = { id: "design-a", title: "Rose Chrome" };
const mockInbox = [
  {
    id: "conversation-a",
    client_id: "account-a",
    creator_id: "creator-a",
    other: { id: "creator-a", display_name: "Kim", account_type: "creator" },
  },
];
jest.mock("../src/lib/auth", () => ({
  useAuth: () => ({ session: { user: { id: mockUserId } }, epoch: mockEpoch }),
  queryClient: { invalidateQueries: jest.fn() },
  useAccountQuery: (key: string[]) => ({
    data:
      key[0] === "share-design"
        ? mockDesign
        : key[0] === "inbox"
          ? mockInbox
          : [
              {
                id: "profile:mira",
                userId: "mira",
                name: "Mira",
                role: "creator",
                available: true,
              },
            ],
    refetch: jest.fn(),
  }),
}));
jest.mock("../src/features/messages-ui/data", () => ({
  ...jest.requireActual("../src/features/messages-ui/data"),
  loadShareDesign: jest.fn(),
}));
jest.mock("../src/lib/api", () => ({
  api: jest.fn(),
  checked: jest.fn().mockResolvedValue([]),
}));
jest.mock("../src/lib/supabase", () => ({
  supabase: {
    from: () => ({ delete: () => ({ eq: () => ({ eq: jest.fn() }) }) }),
  },
}));
jest.mock("../src/lib/pending", () => ({
  readPending: jest.fn(),
  writePending: jest.fn(),
}));
async function selectKim() {
  await render(<ShareDesignScreen designId="design-a" />);
  await fireEvent.press(screen.getByRole("radio", { name: "Select Kim" }));
}
const send = () =>
  fireEvent.press(screen.getByRole("button", { name: "Send to Kim" }));
beforeEach(() => {
  jest.clearAllMocks();
  mockUserId = "account-a";
  accountScope.change(mockUserId, true);
  mockEpoch = accountScope.capture().epoch;
  jest.mocked(readPending).mockResolvedValue(null);
  jest.mocked(writePending).mockResolvedValue(undefined);
  jest.mocked(api).mockImplementation(async (path, body) => {
    if (path === "/mobile/conversation")
      return { conversationId: "new-conversation" };
    const request = body as {
      id: string;
      conversationId: string;
      designId: string;
      content: string;
    };
    return {
      message: {
        id: request.id,
        conversation_id: request.conversationId,
        design_id: request.designId,
        sender_id: mockUserId,
        content: request.content,
      },
    };
  });
  jest.mocked(loadShareDesign).mockResolvedValue(mockDesign);
});
test("selection is read-only, send is acknowledged, then the user can open the exact chat", async () => {
  await selectKim();
  expect(api).not.toHaveBeenCalled();
  expect(writePending).not.toHaveBeenCalled();
  await send();
  await waitFor(() =>
    expect(
      screen.getByRole("header", { name: "Shared with Kim" }),
    ).toBeTruthy(),
  );
  expect(api).toHaveBeenCalledWith("/mobile/message", {
    id: "00000000-0000-4000-8000-000000000001",
    conversationId: "conversation-a",
    content: "Shared a design",
    designId: "design-a",
  });
  expect(router.replace).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Open chat" }));
  expect(router.replace).toHaveBeenCalledWith({
    pathname: "/conversation/[id]",
    params: { id: "conversation-a" },
  });
});
test("failure keeps selection and reuses the saved identity on retry", async () => {
  jest.mocked(readPending).mockResolvedValue("saved-message-id");
  jest.mocked(api).mockRejectedValueOnce(new Error("Offline"));
  await selectKim();
  await send();
  await waitFor(() => expect(screen.getByText(/Offline/)).toBeTruthy());
  expect(router.push).not.toHaveBeenCalled();
  expect(writePending).not.toHaveBeenCalledWith(
    expect.anything(),
    null,
    expect.anything(),
  );
  await fireEvent.press(screen.getByRole("button", { name: "Retry sharing" }));
  await waitFor(() =>
    expect(
      screen.getByRole("header", { name: "Shared with Kim" }),
    ).toBeTruthy(),
  );
  const messages = jest
    .mocked(api)
    .mock.calls.filter(([path]) => path === "/mobile/message");
  expect(messages).toHaveLength(2);
  expect(messages[0][1]).toEqual(messages[1][1]);
});
test("double send taps are suppressed and a response from an old account cannot report success", async () => {
  let finish!: (value: unknown) => void;
  jest.mocked(api).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  await selectKim();
  await send();
  await send();
  expect(api).toHaveBeenCalledTimes(1);
  accountScope.change("account-b");
  await act(async () => finish({}));
  expect(screen.queryByRole("header", { name: "Shared with Kim" })).toBeNull();
  expect(router.replace).not.toHaveBeenCalled();
  expect(writePending).not.toHaveBeenCalledWith(
    expect.anything(),
    null,
    expect.anything(),
  );
});
test("account changes while saving the retry identity prevent sending", async () => {
  jest.mocked(writePending).mockImplementation(async () => {
    accountScope.change("account-b");
  });
  await selectKim();
  await send();
  expect(api).not.toHaveBeenCalled();
});
test("failed secure storage or revoked design access stops before a message mutation", async () => {
  jest.mocked(writePending).mockRejectedValue(new Error("Storage unavailable"));
  await selectKim();
  await send();
  await waitFor(() =>
    expect(screen.getByText(/Storage unavailable/)).toBeTruthy(),
  );
  expect(api).not.toHaveBeenCalled();
  jest
    .mocked(loadShareDesign)
    .mockRejectedValue(new Error("Design unavailable"));
  await fireEvent.press(screen.getByRole("button", { name: "Retry sharing" }));
  await waitFor(() =>
    expect(screen.getByText(/Design unavailable/)).toBeTruthy(),
  );
  expect(api).not.toHaveBeenCalled();
});
test("a new creator is selected without creating a conversation, and denied creation cannot send", async () => {
  jest.mocked(api).mockRejectedValue(new Error("Messaging is unavailable"));
  await render(<ShareDesignScreen designId="design-a" />);
  await fireEvent.press(screen.getByRole("tab", { name: "Artists & salons" }));
  await fireEvent.press(screen.getByRole("radio", { name: "Select Mira" }));
  expect(api).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Send to Mira" }));
  await waitFor(() =>
    expect(screen.getByText(/Messaging is unavailable/)).toBeTruthy(),
  );
  expect(api).toHaveBeenCalledTimes(1);
  expect(api).toHaveBeenCalledWith("/mobile/conversation", {
    creatorId: "mira",
  });
});
test("new permitted conversation is created before sharing and uses its returned identity", async () => {
  await render(<ShareDesignScreen designId="design-a" />);
  await fireEvent.press(screen.getByRole("tab", { name: "Artists & salons" }));
  await fireEvent.press(screen.getByRole("radio", { name: "Select Mira" }));
  await fireEvent.press(screen.getByRole("button", { name: "Send to Mira" }));
  await waitFor(() =>
    expect(
      screen.getByRole("header", { name: "Shared with Mira" }),
    ).toBeTruthy(),
  );
  expect(api).toHaveBeenNthCalledWith(1, "/mobile/conversation", {
    creatorId: "mira",
  });
  expect(api).toHaveBeenNthCalledWith(
    2,
    "/mobile/message",
    expect.objectContaining({
      conversationId: "new-conversation",
      designId: "design-a",
    }),
  );
});
test("retry-record cleanup failure after delivery is shown as delivered, never as an unsent message", async () => {
  jest.mocked(writePending).mockImplementation(async (_key, value) => {
    if (value === null) throw new Error("Storage full");
  });
  await selectKim();
  await send();
  await waitFor(() =>
    expect(
      screen.getByRole("header", { name: "Shared with Kim" }),
    ).toBeTruthy(),
  );
  expect(screen.getByText(/local retry record/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Retry sharing" })).toBeNull();
});

test.each([
  {},
  { message: null },
  { message: { id: "different-message" } },
  {
    message: {
      id: "00000000-0000-4000-8000-000000000001",
      conversation_id: "conversation-a",
      design_id: "different-design",
      sender_id: "account-a",
      content: "Shared a design",
    },
  },
  {
    message: {
      id: "00000000-0000-4000-8000-000000000001",
      conversation_id: "different-chat",
      design_id: "design-a",
      sender_id: "account-a",
      content: "Shared a design",
    },
  },
  {
    message: {
      id: "00000000-0000-4000-8000-000000000001",
      conversation_id: "conversation-a",
      design_id: "design-a",
      sender_id: "another-account",
      content: "Shared a design",
    },
  },
])(
  "an unconfirmed or mismatched acknowledgement retains retry identity: %j",
  async (response) => {
    jest.mocked(api).mockResolvedValue(response);
    await selectKim();
    await send();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Retry sharing" }),
      ).toBeTruthy(),
    );
    expect(
      screen.queryByRole("header", { name: "Shared with Kim" }),
    ).toBeNull();
    expect(writePending).not.toHaveBeenCalledWith(
      expect.anything(),
      null,
      expect.anything(),
    );
  },
);
test("an invalid conversation acknowledgement does not send or save a retry identity", async () => {
  jest.mocked(api).mockResolvedValue({});
  await render(<ShareDesignScreen designId="design-a" />);
  await fireEvent.press(screen.getByRole("tab", { name: "Artists & salons" }));
  await fireEvent.press(screen.getByRole("radio", { name: "Select Mira" }));
  await fireEvent.press(screen.getByRole("button", { name: "Send to Mira" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Retry sharing" })).toBeTruthy(),
  );
  expect(api).toHaveBeenCalledTimes(1);
  expect(writePending).not.toHaveBeenCalled();
});
test("changing account or session discards selected recipients and delivery confirmation", async () => {
  const view = await render(<ShareDesignScreen designId="design-a" />);
  await fireEvent.press(screen.getByRole("radio", { name: "Select Kim" }));
  mockUserId = "account-b";
  accountScope.change(mockUserId);
  mockEpoch = accountScope.capture().epoch;
  await view.rerender(<ShareDesignScreen designId="design-a" />);
  expect(screen.getByText("No recipient selected")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Choose a recipient" }),
  ).toBeDisabled();
  mockUserId = "account-a";
  accountScope.change(mockUserId);
  mockEpoch = accountScope.capture().epoch;
  await view.rerender(<ShareDesignScreen designId="design-a" />);
  await fireEvent.press(screen.getByRole("radio", { name: "Select Kim" }));
  await send();
  await waitFor(() =>
    expect(
      screen.getByRole("header", { name: "Shared with Kim" }),
    ).toBeTruthy(),
  );
  accountScope.change(mockUserId, true);
  mockEpoch = accountScope.capture().epoch;
  await view.rerender(<ShareDesignScreen designId="design-a" />);
  expect(screen.queryByRole("button", { name: "Open chat" })).toBeNull();
  expect(screen.getByText("No recipient selected")).toBeTruthy();
});

test("an account switch during delivery mounts a usable empty picker and discards the late response", async () => {
  let finish!: (value: unknown) => void;
  jest.mocked(api).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const view = await render(<ShareDesignScreen designId="design-a" />);
  await fireEvent.press(screen.getByRole("radio", { name: "Select Kim" }));
  await send();
  expect(api).toHaveBeenCalledTimes(1);
  mockUserId = "account-b";
  accountScope.change(mockUserId);
  mockEpoch = accountScope.capture().epoch;
  await view.rerender(<ShareDesignScreen designId="design-a" />);
  expect(screen.getByText("No recipient selected")).toBeTruthy();
  expect(screen.getByRole("tab", { name: "Artists & salons" })).toBeEnabled();
  await act(async () =>
    finish({
      message: {
        id: "00000000-0000-4000-8000-000000000001",
        conversation_id: "conversation-a",
        design_id: "design-a",
        sender_id: "account-a",
        content: "Shared a design",
      },
    }),
  );
  expect(screen.queryByRole("button", { name: "Open chat" })).toBeNull();
  expect(writePending).not.toHaveBeenCalledWith(
    expect.anything(),
    null,
    expect.anything(),
  );
});
