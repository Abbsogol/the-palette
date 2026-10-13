import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Share } from "react-native";
import Details from "../src/app/design/[id]";
import { setSaved } from "../src/lib/designs";
import { accountScope } from "../src/lib/account-scope";

jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn() }));
jest.mock("../src/lib/supabase", () => ({ supabase: {} }));
jest.mock("../src/lib/designs", () => ({ setSaved: jest.fn() }));
jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
  },
  useLocalSearchParams: jest.fn(() => ({ id: "design-a", from: "search" })),
}));
let mockSignedIn = true;
let mockPublished = true;
let mockSavedData: { id: string }[] | undefined = [];
let mockSavedError: Error | null = null;
const mockRefetch = jest.fn();
const mockInvalidate = jest.fn().mockResolvedValue(undefined);
jest.mock("../src/lib/auth", () => ({
  useAuth: () => ({
    session: mockSignedIn ? { user: { id: "customer-a" } } : null,
  }),
  queryClient: { invalidateQueries: () => mockInvalidate() },
  useAccountQuery: (key: string[]) =>
    key[0] === "saved-status"
      ? { data: mockSavedData, error: mockSavedError, refetch: mockRefetch }
      : {
          data: {
            record: {
              id: key[1],
              title: key[1],
              is_published: mockPublished,
              created_by: "creator-a",
            },
            model: {
              id: key[1],
              title: key[1],
              description: "",
              photos: [],
              closeups: [],
              techniques: [],
              colours: [],
              tags: [],
              saves: 0,
            },
          },
          isPending: false,
          error: null,
          refetch: jest.fn(),
        },
}));
beforeEach(() => {
  mockSignedIn = true;
  mockPublished = true;
  mockSavedData = [];
  mockSavedError = null;
  mockRefetch.mockReset();
  jest.mocked(setSaved).mockReset();
  jest.mocked(router.push).mockClear();
  jest
    .mocked(useLocalSearchParams)
    .mockReturnValue({ id: "design-a", from: "search" });
  accountScope.change("customer-a", true);
});
test("signed-out saves return to the exact design after authentication", async () => {
  mockSignedIn = false;
  accountScope.change(null);
  await render(<Details />);
  await fireEvent.press(screen.getByRole("button", { name: "Save design-a" }));
  expect(setSaved).not.toHaveBeenCalled();
  expect(router.push).toHaveBeenCalledWith({
    pathname: "/auth",
    params: { returnTo: "/design/design-a" },
  });
});
test("failed saved-status refresh cannot toggle based on stale data", async () => {
  mockSavedData = [{ id: "saved" }];
  mockSavedError = new Error("Offline");
  mockRefetch.mockResolvedValue({ data: mockSavedData, error: mockSavedError });
  await render(<Details />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Unsave design-a" }),
  );
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent(/could not be checked/),
  );
  expect(setSaved).not.toHaveBeenCalled();
});
test("duplicate saves make one write; provider failure keeps the button retryable", async () => {
  let reject!: (error: Error) => void;
  jest.mocked(setSaved).mockReturnValue(
    new Promise((_, fail) => {
      reject = fail;
    }),
  );
  await render(<Details />);
  await fireEvent.press(screen.getByRole("button", { name: "Save design-a" }));
  await fireEvent.press(screen.getByRole("button", { name: "Save design-a" }));
  expect(setSaved).toHaveBeenCalledTimes(1);
  expect(setSaved).toHaveBeenCalledWith("customer-a", "design-a", true);
  await act(async () => reject(new Error("Offline. Try again.")));
  expect(screen.getByRole("alert")).toHaveTextContent(/Offline/);
  expect(
    screen.getByRole("button", { name: "Save design-a" }),
  ).not.toBeDisabled();
});
test("account change during a status refresh prevents the old mutation", async () => {
  mockSavedData = undefined;
  let resolve!: (value: { data: { id: string }[]; error: null }) => void;
  mockRefetch.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  await render(<Details />);
  await fireEvent.press(screen.getByRole("button", { name: "Save design-a" }));
  accountScope.change("customer-b");
  await act(async () => resolve({ data: [], error: null }));
  expect(setSaved).not.toHaveBeenCalled();
  expect(screen.queryByRole("alert")).toBeNull();
});
test("tech, collection, booking and reporting all carry the selected design ID", async () => {
  await render(<Details />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Share with my nail tech" }),
  );
  expect(router.push).toHaveBeenLastCalledWith({
    pathname: "/share-design",
    params: { designId: "design-a" },
  });
  await fireEvent.press(
    screen.getByRole("button", { name: "Add to collection" }),
  );
  expect(router.push).toHaveBeenLastCalledWith({
    pathname: "/collections",
    params: { designId: "design-a" },
  });
  await fireEvent.press(
    screen.getByRole("button", { name: "Book this design" }),
  );
  expect(router.push).toHaveBeenLastCalledWith({
    pathname: "/book/[id]",
    params: { id: "creator-a", designId: "design-a" },
  });
  await fireEvent.press(screen.getByRole("button", { name: "Report design" }));
  expect(router.push).toHaveBeenLastCalledWith({
    pathname: "/report",
    params: { targetType: "design", targetId: "design-a" },
  });
});
test("unpublished designs are not shared externally", async () => {
  mockPublished = false;
  const share = jest
    .spyOn(Share, "share")
    .mockResolvedValue({ action: Share.dismissedAction });
  await render(<Details />);
  await fireEvent.press(screen.getByRole("button", { name: "Share design" }));
  await fireEvent.press(
    screen.getByRole("button", { name: "Share outside LaQue" }),
  );
  expect(share).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent(/Publish this design/);
  share.mockRestore();
});
test("changing route ID replaces both the title and mutation target", async () => {
  const view = await render(<Details />);
  jest.mocked(useLocalSearchParams).mockReturnValue({ id: "design-b" });
  await view.rerender(<Details />);
  expect(screen.queryByRole("header", { name: "design-a" })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Save design-b" }));
  expect(setSaved).toHaveBeenCalledWith("customer-a", "design-b", true);
});
