import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import BillingScreen from "../src/app/billing";
import { api } from "../src/lib/api";
import { buyPackage, restoreStorePurchases } from "../src/lib/purchases";
import { accountScope } from "../src/lib/account-scope";
import { queryClient } from "../src/lib/auth";
import { useFocusEffect } from "expo-router";
import { AppState, type AppStateStatus } from "react-native";
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
const mockState = {
  subscription: { active:true, monthlyRemaining:0, purchasedTokens:0, renewsAt:null,store:"APP_STORE" },
  canSubscribe: false,
  credits: 0,
  configured: true,
  needsReview: false,
  pendingPurchases: [] as { id: string }[],
  catalog: [
    {
      store: "APP_STORE",
      product_id: "laque_lab_tokens_30",
      kind: "credits",
      credits: 30,
    },
  ],
};
let mockUser = "a",
  mockEpoch = 1;
const mockRefetch = jest.fn();
const mockPackages = [
  {
    product: {
      identifier: "laque_lab_tokens_30",
      priceString: "AED 9.99",
      productCategory: "NON_SUBSCRIPTION",
      productType: "CONSUMABLE",
      subscriptionPeriod: null as string | null,
    },
  },
];
jest.mock("../src/lib/auth", () => ({
  useAuth: () => ({
    ready: true,
    session: { user: { id: mockUser } },
    epoch: mockEpoch,
  }),
  queryClient: { invalidateQueries: jest.fn() },
  useAccountQuery: (key: string[]) =>
    key[0] === "billing"
      ? { data: mockState, refetch: mockRefetch }
      : { data: mockPackages, refetch: jest.fn() },
}));
jest.mock("../src/lib/api", () => ({ api: jest.fn() }));
jest.mock("../src/lib/purchases", () => ({
  buyPackage: jest.fn(),
  restoreStorePurchases: jest.fn(),
  storePackages: jest.fn(),
}));
const buy = () =>
  fireEvent.press(
    screen.getByRole("button", { name: "Buy 30 design tokens · AED 9.99" }),
  );
beforeEach(() => {
  jest.clearAllMocks();
  accountScope.change("a", true);
  mockUser = "a";
  mockEpoch = accountScope.capture().epoch;
  mockState.subscription.active = true;
  mockState.subscription.monthlyRemaining = 0;
  mockState.canSubscribe = false;
  mockState.catalog = [{store:"APP_STORE",product_id:"laque_lab_tokens_30",kind:"credits",credits:30}];
  mockPackages[0].product = {identifier:"laque_lab_tokens_30",priceString:"AED 9.99",productCategory:"NON_SUBSCRIPTION",productType:"CONSUMABLE",subscriptionPeriod:null};
  mockState.credits = 0;
  mockState.needsReview = false;
  mockState.pendingPurchases = [];
  mockRefetch.mockImplementation(async () => ({ data: mockState }));
  jest
    .mocked(api)
    .mockImplementation(async (_path, body) =>
      body ? ({} as never) : (mockState as never),
    );
  jest.mocked(buyPackage).mockResolvedValue({} as never);
  jest.mocked(restoreStorePurchases).mockResolvedValue({} as never);
});
test("reserve before charging, prevent double taps, and show balance only after server verification", async () => {
  let finish!: () => void;
  jest.mocked(buyPackage).mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }) as never,
  );
  await render(<BillingScreen />);
  await buy();
  await waitFor(() => expect(buyPackage).toHaveBeenCalledTimes(1));
  await fireEvent.press(
    screen.getByRole("button", { name: "Awaiting verification" }),
  );
  expect(buyPackage).toHaveBeenCalledTimes(1);
  expect(api).toHaveBeenCalledWith(
    "/mobile/billing",
    expect.objectContaining({
      action: "purchase",
      productId: "laque_lab_tokens_30",
      store: "APP_STORE",
    }),
  );
  expect(screen.queryByText("15")).toBeNull();
  mockState.credits = 15;
  await act(async () => finish());
  await waitFor(() =>
    expect(screen.getByText("Your subscription and design-token balance are up to date.")).toBeTruthy(),
  );
  expect(screen.getByText(/0 of 15 monthly designs remaining/)).toBeTruthy();
  expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
    queryKey: ["profile"],
  });
});
test("a cancelled store purchase records cancellation without crediting", async () => {
  jest
    .mocked(buyPackage)
    .mockRejectedValue(
      Object.assign(new Error("Cancelled"), { userCancelled: true }),
    );
  await render(<BillingScreen />);
  await buy();
  await waitFor(() =>
    expect(screen.getByText(/Purchase cancelled/)).toBeTruthy(),
  );
  expect(api).toHaveBeenCalledWith("/mobile/billing", {
    action: "cancel",
    id: "00000000-0000-4000-8000-000000000001",
  });
  expect(mockState.credits).toBe(0);
  expect(
    screen.getByRole("button", { name: "Buy 30 design tokens · AED 9.99" }),
  ).not.toBeDisabled();
});
test("a late verification keeps another purchase blocked and permits status recovery", async () => {
  jest.mocked(buyPackage).mockImplementation(async () => {
    mockState.pendingPurchases = [{ id: "pending" }];
    return {} as never;
  });
  await render(<BillingScreen />);
  await buy();
  await waitFor(() =>
    expect(
      screen.getByText(/Your purchase is still being verified/),
    ).toBeTruthy(),
  );
  expect(
    screen.getByRole("button", { name: "Awaiting verification" }),
  ).toBeDisabled();
  mockState.pendingPurchases = [];
  mockState.credits = 15;
  await fireEvent.press(
    screen.getByRole("button", { name: "Check purchase status" }),
  );
  await waitFor(() =>
    expect(screen.getByText("Your subscription and design-token balance are up to date.")).toBeTruthy(),
  );
  expect(buyPackage).toHaveBeenCalledTimes(1);
});
test("network failure after reservation does not trigger another charge and preserves verification controls", async () => {
  jest.mocked(api).mockImplementation(async (_path, body) => {
    if ((body as { action?: string } | undefined)?.action === "purchase") {
      mockState.pendingPurchases = [{ id: "uncertain" }];
      throw new Error("Connection lost");
    }
    return mockState as never;
  });
  await render(<BillingScreen />);
  await buy();
  await waitFor(() => expect(screen.getByText("Connection lost")).toBeTruthy());
  expect(buyPackage).not.toHaveBeenCalled();
  expect(
    screen.getByRole("button", { name: "Awaiting verification" }),
  ).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Check purchase status" }),
  ).not.toBeDisabled();
});
test("switching accounts while reserving prevents a store purchase and old-account UI writes", async () => {
  let finish!: (value: unknown) => void;
  jest.mocked(api).mockImplementation(async (_path, body) =>
    (body as { action?: string } | undefined)?.action === "purchase"
      ? new Promise((resolve) => {
          finish = resolve;
        })
      : (mockState as never),
  );
  await render(<BillingScreen />);
  await buy();
  await waitFor(() => expect(finish).toBeDefined());
  accountScope.change("b");
  await act(async () => finish({}));
  expect(buyPackage).not.toHaveBeenCalled();
  expect(mockRefetch).not.toHaveBeenCalled();
  expect(screen.queryByRole("alert")).toBeNull();
});
test("restore asks the server to reconcile and never adds credits locally", async () => {
  await render(<BillingScreen />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Restore purchases" }),
  );
  await waitFor(() =>
    expect(
      screen.getByText(/Purchase history checked.*0 design tokens/),
    ).toBeTruthy(),
  );
  expect(restoreStorePurchases).toHaveBeenCalledTimes(1);
  expect(api).toHaveBeenCalledWith("/mobile/billing", {});
  expect(mockState.credits).toBe(0);
});

test("a new account gets a usable credit screen while the old reservation is still in flight", async () => {
  let finish!: (value: unknown) => void;
  jest.mocked(api).mockImplementation(async (_path, body) =>
    (body as { action?: string } | undefined)?.action === "purchase"
      ? new Promise((resolve) => {
          finish = resolve;
        })
      : (mockState as never),
  );
  const view = await render(<BillingScreen />);
  await buy();
  await waitFor(() => expect(finish).toBeDefined());
  accountScope.change("b");
  mockUser = "b";
  mockEpoch = accountScope.capture().epoch;
  await view.rerender(<BillingScreen />);
  expect(
    screen.getByRole("button", { name: "Buy 30 design tokens · AED 9.99" }),
  ).not.toBeDisabled();
  expect(screen.queryByText("Payment awaiting verification")).toBeNull();
  await act(async () => finish({}));
  expect(buyPackage).not.toHaveBeenCalled();
  expect(screen.queryByRole("alert")).toBeNull();
});

test("pending store approval keeps the durable reservation and never claims credits or cancels it", async () => {
  jest
    .mocked(buyPackage)
    .mockRejectedValue(Object.assign(new Error("Deferred"), { code: "20" }));
  await render(<BillingScreen />);
  await buy();
  await waitFor(() =>
    expect(
      screen.getByText(/Your store payment is pending approval/),
    ).toBeTruthy(),
  );
  expect(
    screen.getByRole("button", { name: "Awaiting verification" }),
  ).toBeDisabled();
  expect(api).not.toHaveBeenCalledWith(
    "/mobile/billing",
    expect.objectContaining({ action: "cancel" }),
  );
  expect(api).not.toHaveBeenCalledWith("/mobile/billing", {});
  expect(mockState.credits).toBe(0);
});
test("failed verification keeps purchases blocked until a successful explicit check", async () => {
  jest.mocked(api).mockImplementation(async (_path, body) => {
    if (body && !(body as { action?: string }).action)
      throw new Error("Verification unavailable");
    if ((body as { action?: string } | undefined)?.action === "purchase")
      mockState.pendingPurchases = [{ id: "pending" }];
    return (body ? {} : mockState) as never;
  });
  await render(<BillingScreen />);
  await buy();
  await waitFor(() =>
    expect(screen.getByText("Verification unavailable")).toBeTruthy(),
  );
  expect(
    screen.getByRole("button", { name: "Awaiting verification" }),
  ).toBeDisabled();
  expect(buyPackage).toHaveBeenCalledTimes(1);
  mockState.pendingPurchases = [];
  mockState.credits = 15;
  jest
    .mocked(api)
    .mockImplementation(
      async (_path, body) => (body ? {} : mockState) as never,
    );
  await fireEvent.press(
    screen.getByRole("button", { name: "Check purchase status" }),
  );
  await waitFor(() =>
    expect(screen.getByText("Your subscription and design-token balance are up to date.")).toBeTruthy(),
  );
  expect(buyPackage).toHaveBeenCalledTimes(1);
});

test("returning from the store refreshes server state without repeating a purchase and removes the listener", async () => {
  let listener!: (state: AppStateStatus) => void;
  const remove = jest.fn();
  const spy = jest
    .spyOn(AppState, "addEventListener")
    .mockImplementation((_event, fn) => {
      listener = fn;
      return { remove };
    });
  await render(<BillingScreen />);
  let cleanup!: () => void;
  await act(async () => {
    cleanup = jest.mocked(useFocusEffect).mock.calls.at(-1)![0]() as () => void;
  });
  expect(mockRefetch).toHaveBeenCalledTimes(1);
  await act(async () => listener("background"));
  expect(mockRefetch).toHaveBeenCalledTimes(1);
  await act(async () => listener("active"));
  expect(mockRefetch).toHaveBeenCalledTimes(2);
  expect(buyPackage).not.toHaveBeenCalled();
  expect(api).not.toHaveBeenCalled();
  cleanup();
  expect(remove).toHaveBeenCalledTimes(1);
  spy.mockRestore();
});


test("a new member reserves the monthly subscription before opening the store payment", async () => {
  mockState.subscription.active = false;
  mockState.canSubscribe = true;
  mockState.catalog = [{store:"APP_STORE",product_id:"laque_lab_monthly_5",kind:"subscription",credits:15}];
  mockPackages[0].product = {identifier:"laque_lab_monthly_5",priceString:"$5.00",productCategory:"SUBSCRIPTION",productType:"AUTO_RENEWABLE_SUBSCRIPTION",subscriptionPeriod:"P1M"};
  await render(<BillingScreen />);
  await fireEvent.press(screen.getByRole("button", {name:"Subscribe · $5.00/month"}));
  await waitFor(() => expect(buyPackage).toHaveBeenCalledTimes(1));
  expect(api).toHaveBeenCalledWith("/mobile/billing",expect.objectContaining({action:"purchase",productId:"laque_lab_monthly_5",store:"APP_STORE"}));
  expect(jest.mocked(api).mock.invocationCallOrder[1]).toBeLessThan(jest.mocked(buyPackage).mock.invocationCallOrder[0]);
});

test("a fresh membership read blocks a stale subscription button before any charge", async () => {
  mockState.subscription.active = false;
  mockState.canSubscribe = true;
  mockState.catalog = [{store:"APP_STORE",product_id:"laque_lab_monthly_5",kind:"subscription",credits:15}];
  mockPackages[0].product = {identifier:"laque_lab_monthly_5",priceString:"$5.00",productCategory:"SUBSCRIPTION",productType:"AUTO_RENEWABLE_SUBSCRIPTION",subscriptionPeriod:"P1M"};
  jest.mocked(api).mockResolvedValue({...mockState,canSubscribe:false} as never);
  await render(<BillingScreen />);
  await fireEvent.press(screen.getByRole("button", {name:"Subscribe · $5.00/month"}));
  await waitFor(() => expect(screen.getByText(/membership or allowance changed/)).toBeTruthy());
  expect(buyPackage).not.toHaveBeenCalled();
  expect(api).not.toHaveBeenCalledWith("/mobile/billing",expect.objectContaining({action:"purchase"}));
});
