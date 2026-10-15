import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import SearchScreen from "../src/features/search";
import { accountScope } from "../src/lib/account-scope";
import { setSaved } from "../src/lib/designs";
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
jest.mock("../src/lib/supabase", () => ({ supabase: {} }));
jest.mock("../src/lib/designs", () => ({ setSaved: jest.fn() }));
let mockSignedIn = true;
let mockEpoch = 0;
let mockSaved: { designs: string[]; artists: string[] } | undefined = {
  designs: [],
  artists: [],
};
const mockRefetch = jest.fn(),
  mockInvalidate = jest.fn();
jest.mock("../src/lib/auth", () => ({
  useAuth: () => ({
    session: mockSignedIn ? { user: { id: "customer-a" } } : null,
    epoch: mockEpoch,
  }),
  queryClient: { invalidateQueries: () => mockInvalidate() },
  useAccountQuery: (key: string[]) =>
    key[0] === "search-saved"
      ? { data: mockSaved, refetch: mockRefetch, error: null }
      : { data: 0, isFetching: false, refetch: jest.fn() },
}));
jest.mock("@tanstack/react-query", () => ({
  useInfiniteQuery: ({ queryKey }: { queryKey: unknown[] }) => ({
    data: {
      pages: [
        {
          total: 1,
          records:
            queryKey[2] === "search-designs"
              ? [
                  {
                    id: "design-a",
                    title: "Cathedral",
                    image_url: null,
                    shape: "Oval",
                  },
                ]
              : [],
        },
      ],
    },
    isPending: false,
    refetch: jest.fn(),
    fetchNextPage: jest.fn(),
  }),
}));
beforeEach(() => {
  mockSignedIn = true;
  mockSaved = { designs: [], artists: [] };
  mockRefetch.mockReset();
  jest.mocked(setSaved).mockReset();
  accountScope.change("customer-a", true);
  mockEpoch = accountScope.capture().epoch;
});
test("signed-out Search saves preserve the selected design as the sign-in return intent", async () => {
  mockSignedIn = false;
  accountScope.change(null);
  await render(<SearchScreen />);
  await fireEvent.press(screen.getByRole("button", { name: "Save Cathedral" }));
  expect(setSaved).not.toHaveBeenCalled();
  expect(router.push).toHaveBeenCalledWith({
    pathname: "/auth",
    params: { returnTo: "/design/design-a" },
  });
});
test("rapid duplicate Search saves issue one write and a failed write remains retryable", async () => {
  let reject!: (e: Error) => void;
  jest.mocked(setSaved).mockReturnValue(
    new Promise((_, fail) => {
      reject = fail;
    }),
  );
  await render(<SearchScreen />);
  await fireEvent.press(screen.getByRole("button", { name: "Save Cathedral" }));
  expect(screen.getByRole("button", { name: "Save Cathedral" })).toBeDisabled();
  await fireEvent.press(screen.getByRole("button", { name: "Save Cathedral" }));
  expect(setSaved).toHaveBeenCalledTimes(1);
  await act(async () => reject(new Error("Offline")));
  expect(screen.getByRole("alert")).toHaveTextContent("Offline");
});
test("switching accounts during the saved-state read prevents the old account's write", async () => {
  mockSaved = undefined;
  let resolve!: (data: unknown) => void;
  mockRefetch.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  await render(<SearchScreen />);
  await fireEvent.press(screen.getByRole("button", { name: "Save Cathedral" }));
  accountScope.change("customer-b");
  await act(async () =>
    resolve({ data: { designs: [], artists: [] }, error: null }),
  );
  expect(setSaved).not.toHaveBeenCalled();
  expect(screen.queryByRole("alert")).toBeNull();
});
test("a new account does not inherit the previous account's save error", async () => {
  jest.mocked(setSaved).mockRejectedValue(new Error("Offline"));
  const view = await render(<SearchScreen />);
  await fireEvent.press(screen.getByRole("button", { name: "Save Cathedral" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Offline");
  accountScope.change("customer-b");
  mockEpoch = accountScope.capture().epoch;
  await view.rerender(<SearchScreen />);
  expect(screen.queryByRole("alert")).toBeNull();
});
