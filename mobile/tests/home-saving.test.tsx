import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { router } from "expo-router";
import HomeScreen from "../src/features/home";
import { setSaved } from "../src/lib/designs";
import { accountScope } from "../src/lib/account-scope";

jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
jest.mock("../src/lib/supabase", () => ({ supabase: {} }));
jest.mock("../src/lib/designs", () => ({ setSaved: jest.fn() }));
let mockSignedIn = true;
let mockSavedData: { design_id: string }[] | undefined = [];
let mockSavedError: Error | null = null;
const mockRefetch = jest.fn();
const mockInvalidate = jest.fn().mockResolvedValue(undefined);
jest.mock("../src/lib/auth", () => ({
  useAuth: () => ({
    session: mockSignedIn ? { user: { id: "customer-a" } } : null,
  }),
  useProfile: () => ({ data: null, isPending: false }),
  queryClient: { invalidateQueries: () => mockInvalidate() },
  useAccountQuery: (key: string[]) =>
    key[0] === "home-saved"
      ? {
          data: mockSavedData,
          error: mockSavedError,
          refetch: mockRefetch,
        }
      : {
          data:
            key[1] === "trending"
              ? [
                  {
                    id: "design-a",
                    title: "Rose set",
                    saves_count: 3,
                    image_url: null,
                  },
                ]
              : key[1] === "community-counts"
                ? { artists: 0, posts: 0 }
                : key[1] === "week"
                  ? [
                      {
                        id: "week-only",
                        title: "New moss set",
                        saves_count: 12,
                        image_url: null,
                      },
                    ]
                  : [],
          isLoading: false,
          error: null,
          refetch: jest.fn(),
        },
}));

beforeEach(() => {
  mockSignedIn = true;
  mockSavedData = [];
  mockSavedError = null;
  mockRefetch.mockReset();
  jest.mocked(setSaved).mockReset();
  accountScope.change("customer-a", true);
});

test("a saved design found only in New This Week is unsaved with its own ID", async () => {
  mockSavedData = [{ design_id: "week-only" }];
  jest.mocked(setSaved).mockResolvedValue(undefined);
  await render(<HomeScreen />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Unsave New moss set" }),
  );
  expect(setSaved).toHaveBeenCalledWith("customer-a", "week-only", false);
});

test("signed-out saves navigate to authentication with the same design as the return intent", async () => {
  mockSignedIn = false;
  accountScope.change(null);
  await render(<HomeScreen />);
  await fireEvent.press(screen.getByRole("button", { name: "Save Rose set" }));
  expect(setSaved).not.toHaveBeenCalled();
  expect(router.push).toHaveBeenCalledWith({
    pathname: "/auth",
    params: { returnTo: "/design/design-a" },
  });
});

test("connected Home blocks guest filters and discovery without changing the displayed feed", async () => {
  mockSignedIn = false;
  accountScope.change(null);
  await render(<HomeScreen />);
  await fireEvent.press(screen.getByRole("button", { name: "Category: Dark" }));
  expect(
    screen.getByRole("button", { name: "Category: All", selected: true }),
  ).toBeTruthy();
  await fireEvent.press(screen.getByRole("tab", { name: "Community" }));
  expect(
    screen.getByRole("tab", { name: "Explore", selected: true }),
  ).toBeTruthy();
  expect(
    screen.queryByLabelText("Search designs, nail artists, salons"),
  ).toBeNull();
  await fireEvent.press(
    screen.getByRole("button", { name: "Sign in to search" }),
  );
  expect(router.push).toHaveBeenLastCalledWith({
    pathname: "/auth",
    params: { returnTo: "/search" },
  });
  await fireEvent.press(screen.getByRole("button", { name: "View Rose set" }));
  expect(router.push).toHaveBeenLastCalledWith({
    pathname: "/auth",
    params: { returnTo: "/design/design-a" },
  });
  expect(setSaved).not.toHaveBeenCalled();
});

test("duplicate taps produce one write and failed saves keep the unsaved state", async () => {
  let reject!: (error: Error) => void;
  jest.mocked(setSaved).mockReturnValue(
    new Promise((_, fail) => {
      reject = fail;
    }),
  );
  await render(<HomeScreen />);
  await fireEvent.press(screen.getByRole("button", { name: "Save Rose set" }));
  await fireEvent.press(screen.getByRole("button", { name: "Save Rose set" }));
  expect(setSaved).toHaveBeenCalledTimes(1);
  expect(setSaved).toHaveBeenCalledWith("customer-a", "design-a", true);
  await act(async () => reject(new Error("Offline. Try again.")));
  expect(screen.getByRole("alert")).toHaveTextContent("Offline. Try again.");
  expect(
    screen.getByRole("button", { name: "Save Rose set" }),
  ).not.toBeDisabled();
});

test("a failed saved-status refresh never toggles based on stale data", async () => {
  mockSavedData = [{ design_id: "design-a" }];
  mockSavedError = new Error("Offline");
  mockRefetch.mockResolvedValue({ data: mockSavedData, error: mockSavedError });
  await render(<HomeScreen />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Unsave Rose set" }),
  );
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent(/could not be checked/),
  );
  expect(setSaved).not.toHaveBeenCalled();
});

test("switching accounts during a saved-status request discards the old action", async () => {
  mockSavedData = undefined;
  let resolve!: (value: { data: { design_id: string }[]; error: null }) => void;
  mockRefetch.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  await render(<HomeScreen />);
  await fireEvent.press(screen.getByRole("button", { name: "Save Rose set" }));
  accountScope.change("customer-b");
  await act(async () => resolve({ data: [], error: null }));
  expect(setSaved).not.toHaveBeenCalled();
  expect(screen.queryByRole("alert")).toBeNull();
});
