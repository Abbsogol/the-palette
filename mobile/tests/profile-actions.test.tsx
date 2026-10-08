import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import { ProfileScreen } from "../src/features/profiles/profile-screen";
import { accountScope } from "../src/lib/account-scope";
import { setSaved } from "../src/lib/designs";
let mockSignedIn = true;
const mockRefetch = jest.fn(),
  mockInvalidate = jest.fn();
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
jest.mock("../src/lib/supabase", () => ({ supabase: {} }));
jest.mock("../src/lib/designs", () => ({ setSaved: jest.fn() }));
jest.mock("../src/lib/auth", () => ({
  useAuth: () => ({
    session: mockSignedIn ? { user: { id: "account-a" } } : null,
    epoch: 1,
  }),
  queryClient: { invalidateQueries: () => mockInvalidate() },
  useAccountQuery: (key: string[]) => {
    if (key[0] === "profile-relationships")
      return {
        data: { saved: [], favorite: false, following: false },
        refetch: mockRefetch,
        error: null,
      };
    return {
      data:
        key[0] === "profile-identity"
          ? { id: "artist-a", name: "Kim", role: "creator", specialties: [] }
          : key[0] === "profile-stats"
            ? { followers: 2, designs: 1 }
            : undefined,
      refetch: jest.fn(),
      isPending: false,
      error: null,
    };
  },
}));
jest.mock("@tanstack/react-query", () => ({
  useInfiniteQuery: () => ({
    data: {
      pages: [
        {
          designs: [{ id: "design-a", title: "Chrome", published: true }],
          collections: [],
          services: [],
          reviews: [],
        },
      ],
    },
    refetch: jest.fn(),
    isPending: false,
  }),
}));
beforeEach(() => {
  mockSignedIn = true;
  accountScope.change("account-a", true);
  mockRefetch.mockReset();
  mockInvalidate.mockReset();
  jest.mocked(setSaved).mockReset();
  jest.mocked(router.push).mockClear();
});
test("signed-out booking opens authentication and preserves the public profile destination", async () => {
  mockSignedIn = false;
  accountScope.change(null);
  await render(<ProfileScreen id="artist-a" />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Book Appointment" }),
  );
  expect(router.push).toHaveBeenCalledWith({
    pathname: "/auth",
    params: { returnTo: "/creator/artist-a" },
  });
  expect(setSaved).not.toHaveBeenCalled();
});
test("failed relationship reads prevent a guessed favorite/save mutation", async () => {
  mockRefetch.mockResolvedValue({ error: new Error("Offline") });
  await render(<ProfileScreen id="artist-a" />);
  await fireEvent.press(screen.getByRole("button", { name: "Save Chrome" }));
  expect(setSaved).not.toHaveBeenCalled();
  expect(screen.getByText("Offline")).toBeTruthy();
});
test("account changes during saved-state refresh discard the pending write", async () => {
  let resolve!: (value: unknown) => void;
  mockRefetch.mockReturnValue(new Promise((r) => (resolve = r)));
  await render(<ProfileScreen id="artist-a" />);
  await fireEvent.press(screen.getByRole("button", { name: "Save Chrome" }));
  accountScope.change("account-b");
  await act(async () =>
    resolve({ data: { saved: [], favorite: false, following: false } }),
  );
  expect(setSaved).not.toHaveBeenCalled();
});
test("rapid duplicate saves produce one mutation; failed writes unlock retry", async () => {
  mockRefetch.mockResolvedValue({
    data: { saved: [], favorite: false, following: false },
  });
  let reject!: (e: Error) => void;
  jest.mocked(setSaved).mockReturnValue(new Promise((_, r) => (reject = r)));
  await render(<ProfileScreen id="artist-a" />);
  await fireEvent.press(screen.getByRole("button", { name: "Save Chrome" }));
  await fireEvent.press(screen.getByRole("button", { name: "Save Chrome" }));
  expect(setSaved).toHaveBeenCalledTimes(1);
  await act(async () => reject(new Error("Save failed")));
  expect(
    screen.getByRole("button", { name: "Save Chrome" }),
  ).not.toBeDisabled();
  expect(screen.getByText("Save failed")).toBeTruthy();
});
