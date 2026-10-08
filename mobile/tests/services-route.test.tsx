import { act, fireEvent, render, screen } from "@testing-library/react-native";
import ServicesScreen from "../src/app/services";
import { usePreventRemove } from "expo-router/react-navigation";
import { router } from "expo-router";
const mockDispatch = jest.fn(),
  mockInvalidate = jest.fn().mockResolvedValue(undefined);
let mockRole = "creator",
  mockProfileError: Error | null = null;
const mockRows = [
  {
    id: "service",
    creator_id: "owner",
    name: "Gel",
    price: 100,
    deposit_amount: 20,
    duration_minutes: 60,
    is_active: false,
  },
];
let mockReply: { data: { id: string }[]; error: { message: string } | null } = {
  data: [{ id: "service" }],
  error: null,
};
const mockBuilder: any = {
  update: jest.fn(() => mockBuilder),
  upsert: jest.fn(() => mockBuilder),
  eq: jest.fn(() => mockBuilder),
  select: jest.fn(() => Promise.resolve(mockReply)),
};
const mockFrom = jest.fn().mockImplementation(() => mockBuilder);
jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useNavigation: () => ({ dispatch: mockDispatch }),
}));
jest.mock("expo-router/react-navigation", () => ({
  usePreventRemove: jest.fn(),
}));
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
jest.mock("../src/components/ui", () => ({
  RequireAuth: ({ children }: any) => children,
  QueryState: ({ children }: any) => children,
}));
jest.mock("../src/lib/supabase", () => ({
  supabase: { from: (...args: any[]) => mockFrom(...args) },
}));
jest.mock("../src/lib/auth", () => ({
  useAuth: () => ({ session: { user: { id: "owner" } }, epoch: 1 }),
  useProfile: () => ({
    data: { id: "owner", account_type: mockRole },
    isPending: false,
    error: mockProfileError,
    refetch: jest.fn(),
  }),
  useAccountQuery: jest.fn(() => ({
    data: mockRows,
    isPending: false,
    error: null,
    refetch: jest.fn(),
  })),
  queryClient: {
    invalidateQueries: (...args: any[]) => mockInvalidate(...args),
  },
}));
const press = (name: string) =>
  fireEvent.press(screen.getByRole("button", { name }));
beforeEach(() => {
  mockRole = "creator";
  mockProfileError = null;
  mockReply = { data: [{ id: "service" }], error: null };
});
test("edit uses the owner filter, preserves hidden status and guards navigation", async () => {
  const view = await render(<ServicesScreen />);
  await press("Edit Gel");
  await fireEvent.changeText(
    screen.getByLabelText("Service name"),
    "Updated gel",
  );
  await press("Back");
  expect(router.back).toHaveBeenCalled();
  const guard = jest.mocked(usePreventRemove).mock.calls.at(-1)!;
  expect(guard[0]).toBe(true);
  await act(() => guard[1]({ data: { action: { type: "GO_BACK" } } }));
  await press("Keep editing");
  mockProfileError = new Error("Offline");
  await view.rerender(<ServicesScreen />);
  expect(screen.getByLabelText("Service name").props.value).toBe("Updated gel");
  await press("Save service");
  expect(mockBuilder.update).toHaveBeenCalledWith(
    expect.objectContaining({
      name: "Updated gel",
      price: 100,
      deposit_amount: 20,
    }),
  );
  expect(mockBuilder.update.mock.calls[0][0]).not.toHaveProperty("is_active");
  expect(mockBuilder.eq).toHaveBeenCalledWith("id", "service");
  expect(mockBuilder.eq).toHaveBeenCalledWith("creator_id", "owner");
  expect(mockInvalidate).toHaveBeenCalled();
});
test("new-service retries upsert one stable ID after a lost response", async () => {
  await render(<ServicesScreen />);
  await press("Add a service");
  await fireEvent.changeText(screen.getByLabelText("Service name"), "New gel");
  await fireEvent.changeText(screen.getByLabelText("Total price (AED)"), "100");
  mockReply = { data: [], error: { message: "Response lost" } };
  await press("Save service");
  expect(screen.getByText("Response lost")).toBeTruthy();
  mockReply = { data: [{ id: "new" }], error: null };
  await press("Save service");
  expect(mockBuilder.upsert).toHaveBeenCalledTimes(2);
  expect(mockBuilder.upsert.mock.calls[0][0].id).toBe(
    mockBuilder.upsert.mock.calls[1][0].id,
  );
  expect(mockBuilder.upsert.mock.calls[1]).toEqual([
    expect.objectContaining({ creator_id: "owner", is_active: true }),
    { onConflict: "id" },
  ]);
});
test("zero-row visibility writes fail visibly rather than claiming success", async () => {
  await render(<ServicesScreen />);
  mockReply = { data: [], error: null };
  await press("Show in booking menu");
  await press("Confirm show");
  expect(
    screen.getByText("This service is unavailable. Refresh and try again."),
  ).toBeTruthy();
  expect(mockInvalidate).not.toHaveBeenCalled();
});
test("customers cannot access creator mutations", async () => {
  mockRole = "user";
  await render(<ServicesScreen />);
  expect(screen.getByRole("button", { name: "Become a creator" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Add a service" })).toBeNull();
  expect(mockFrom).not.toHaveBeenCalled();
});
