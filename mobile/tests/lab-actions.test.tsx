const mockBillingRefetch=jest.fn();
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import LabScreen from "../src/features/lab";
import { api } from "../src/lib/api";
import { readPending, writePending } from "../src/lib/pending";
import { accountScope } from "../src/lib/account-scope";
import { router } from "expo-router";
import { setSaved } from "../src/lib/designs";
import { defaultLabSettings } from "../src/features/lab-ui/model";
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
jest.mock("../src/lib/auth", () => ({
  useAuth: () => ({ ready: true, session: { user: { id: "user-a" } } }),
  useAccountQuery: () => ({data:{credits:5,subscription:{active:true}},refetch:mockBillingRefetch}),
  useProfile: () => ({ data: { credit_balance: 5 }, refetch: jest.fn() }),
  queryClient: { invalidateQueries: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock("../src/lib/api", () => ({
  api: jest.fn(),
  checked: jest.fn().mockResolvedValue({ free_regen_used: false }),
  ApiError: class extends Error {},
}));
jest.mock("../src/lib/designs", () => ({
  setSaved: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../src/lib/supabase", () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ single: jest.fn() }) }) }),
  },
}));
jest.mock("../src/lib/pending", () => ({
  readPending: jest.fn(),
  writePending: jest.fn().mockResolvedValue(undefined),
}));
beforeEach(() => {
  jest.clearAllMocks();
  accountScope.change("user-a", true);
  jest.mocked(readPending).mockResolvedValue(null);
  jest.mocked(api).mockImplementation(async (path) =>
    path.startsWith("/generation-status")
      ? ({ status: "pending" } as never)
      : ({
          generationId: "g-1",
          imageUrl: "https://example.test/g-1.png",
        } as never),
  );
});
test("generation submits all chosen Figma fields, and the save action targets the returned generation", async () => {
  await render(<LabScreen />);
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Generate · 1 design token" }),
    ).not.toBeDisabled(),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "2. Personalize" }),
  );
  await fireEvent.press(
    screen.getByRole("checkbox", { name: "Occasion: Wedding" }),
  );
  await fireEvent.press(screen.getByRole("checkbox", { name: "Colour: Rose" }));
  await fireEvent.changeText(
    screen.getByLabelText("Additional details"),
    "Chrome stars",
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Generate · 1 design token" }),
  );
  expect(api).toHaveBeenCalledWith(
    "/generate-nail-design",
    expect.objectContaining({
      vibe: ["Bridal"],
      shape: "Almond",
      length: "Medium",
      colors: ["#F0A0B8"],
      occasion: ["Wedding"],
      customText: "Chrome stars",
    }),
  );
  expect(writePending).toHaveBeenCalledWith(
    "generation",
    null,
    accountScope.capture(),
  );
  jest.mocked(api).mockResolvedValue({ designId: "design-1" });
  await fireEvent.press(screen.getByRole("button", { name: "Save privately" }));
  expect(api).toHaveBeenLastCalledWith("/publish-nail-lab-generation", {
    generationId: "g-1",
    asDraft: true,
  });
  expect(setSaved).toHaveBeenCalledWith("user-a", "design-1", true);
  expect(router.push).toHaveBeenCalledWith({
    pathname: "/design/[id]",
    params: { id: "design-1",from:"lab" },
  });
});
test("a restored request is retried unchanged even if the user changes the form", async () => {
  const pending = {
    ...defaultLabSettings(),
    requestId: "persisted",
    customText: "Original",
  };
  jest.mocked(readPending).mockResolvedValue(pending);
  await render(<LabScreen />);
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Retry / recover this generation" }),
    ).not.toBeDisabled(),
  );
  await fireEvent.changeText(
    screen.getByLabelText("Additional details"),
    "Changed",
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Retry / recover this generation" }),
  );
  expect(api).toHaveBeenCalledWith("/generate-nail-design", pending);
});
test("rapid taps send one generation and responses from a previous account cannot expose its image", async () => {
  let resolve!: (value: unknown) => void;
  jest.mocked(api).mockImplementation((path) =>
    path.startsWith("/generation-status")
      ? (Promise.resolve({ status: "pending" }) as never)
      : (new Promise((done) => {
          resolve = done;
        }) as never),
  );
  await render(<LabScreen />);
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Generate · 1 design token" }),
    ).not.toBeDisabled(),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Generate · 1 design token" }),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Retry / recover this generation" }),
  );
  expect(
    jest
      .mocked(api)
      .mock.calls.filter(([path]) => path === "/generate-nail-design"),
  ).toHaveLength(1);
  accountScope.change("user-b");
  await act(async () =>
    resolve({
      generationId: "g-secret",
      imageUrl: "https://example.test/private.png",
    }),
  );
  expect(screen.queryByLabelText("Generated nail design")).toBeNull();
  expect(writePending).not.toHaveBeenCalledWith(
    "generation",
    null,
    expect.anything(),
  );
});

test("a failed pending-request read stays safe and can be retried without restarting the app", async () => {
  jest
    .mocked(readPending)
    .mockRejectedValueOnce(new Error("Secure storage unavailable"));
  await render(<LabScreen />);
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Secure storage unavailable",
    ),
  );
  expect(
    screen.getByRole("button", { name: "Checking your generation…" }),
  ).toBeDisabled();
  await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Generate · 1 design token" }),
    ).not.toBeDisabled(),
  );
  expect(api).not.toHaveBeenCalled();
});
