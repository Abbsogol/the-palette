import { render, screen, fireEvent } from "@testing-library/react-native";
import { Text } from "react-native";
import { router } from "expo-router";
import {
  RouteAccess,
  routeAccessPath,
  signedOutRoute,
} from "../src/features/welcome/access";
import HomeDesignPreview from "../src/preview/home-main";
let mockReady = true,
  mockSignedIn = false,
  mockSeen = true;
const mockComplete = jest.fn().mockResolvedValue(undefined);
jest.mock("../src/lib/auth", () => ({
  useAuth: () => ({
    ready: mockReady,
    session: mockSignedIn ? { user: { id: "user" } } : null,
  }),
}));
jest.mock("../src/features/welcome/first-launch", () => ({
  useFirstLaunch: () => ({
    ready: true,
    seen: mockSeen,
    complete: mockComplete,
  }),
}));
jest.mock("expo-router", () => ({
  router: { replace: jest.fn() },
  usePathname: () => "/search",
  useGlobalSearchParams: () => ({}),
  Redirect: ({ href }: { href: { params: { returnTo: string } } }) => {
    const { Text } = require("react-native");
    return <Text>{`Sign in for ${href.params.returnTo}`}</Text>;
  },
}));
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
const mounted = jest.fn();
function Private() {
  mounted();
  return <Text>Protected content</Text>;
}
beforeEach(() => {
  mockReady = true;
  mockSeen = true;
  mockSignedIn = false;
  mounted.mockClear();
});
test.each([
  "index",
  "(tabs)",
  "creator/[id]",
  "search",
  "lab",
  "messages",
  "saved",
  "profile",
  "design/[id]",
  "story/[id]",
  "story/new",
  "collections",
  "availability",
  "services",
  "billing",
  "delete-account",
  "report",
  "share-design",
  "onboarding",
])("guest direct route %s never mounts its protected screen", async (name) => {
  await render(
    <RouteAccess
      name={name}
      params={{ id: "00000000-0000-4000-8000-000000000123" }}
    >
      <Private />
    </RouteAccess>,
  );
  expect(mounted).not.toHaveBeenCalled();
  expect(screen.queryByText("Protected content")).toBeNull();
  expect(screen.getByText(/^Sign in for/)).toBeTruthy();
});
test.each(["auth/index", "auth/callback", "account-closed"])(
  "guest route %s remains available",
  async (name) => {
    await render(
      <RouteAccess name={name}>
        <Private />
      </RouteAccess>,
    );
    expect(mounted).toHaveBeenCalledTimes(1);
  },
);
test("session hydration does not briefly expose protected content", async () => {
  mockReady = false;
  await render(
    <RouteAccess name="search">
      <Private />
    </RouteAccess>,
  );
  expect(mounted).not.toHaveBeenCalled();
});
test.each(["index", "search", "creator/[id]"])("signing out removes %s immediately", async (name) => {
  mockSignedIn = true;
  const view = await render(
    <RouteAccess name={name}>
      <Private />
    </RouteAccess>,
  );
  expect(screen.getByText("Protected content")).toBeTruthy();
  mockSignedIn = false;
  await view.rerender(
    <RouteAccess name={name}>
      <Private />
    </RouteAccess>,
  );
  expect(screen.queryByText("Protected content")).toBeNull();
});
test("first-launch skip preserves a protected initial tab as the authentication destination", async () => {
  mockSeen = false;
  await render(
    <RouteAccess name="(tabs)" introduction>
      <Private />
    </RouteAccess>,
  );
  expect(mounted).not.toHaveBeenCalled();
  await fireEvent.press(
    screen.getByRole("button", { name: "Skip introduction" }),
  );
  expect(mockComplete).toHaveBeenCalled();
  expect(router.replace).toHaveBeenCalledWith({
    pathname: "/auth",
    params: { returnTo: "/search" },
  });
});
test("Home gates filters, design taps and navigation while leaving the feed visible", async () => {
  const gate = jest.fn();
  await render(<HomeDesignPreview guest onRequireSignIn={gate} />);
  await fireEvent.press(screen.getByRole("button", { name: "Category: Dark" }));
  expect(gate).toHaveBeenCalledTimes(1);
  await fireEvent.press(
    screen.getAllByRole("button", { name: "View Cathedral" })[0],
  );
  expect(gate).toHaveBeenCalledTimes(2);
  expect(screen.queryByTestId("design-detail-preview")).toBeNull();
  await fireEvent.press(screen.getByRole("tab", { name: "Search" }));
  expect(gate).toHaveBeenCalledTimes(3);
  expect(screen.queryByRole("button", { name: "Filters" })).toBeNull();
});
test("unrecognized paths default to protected; route interpolation cannot inject a public path", () => {
  expect(signedOutRoute("/auth/unexpected")).toBe(false);
  expect(signedOutRoute("/new-feature")).toBe(false);
  expect(signedOutRoute(routeAccessPath("design/[id]", { id: "../../auth" }))).toBe(
    false,
  );
});

test.each(["index", "creator/[id]", "auth/index"])("fresh install opens intro before %s", async (name) => {
  mockSeen=false;
  await render(<RouteAccess name={name} params={{id:"00000000-0000-4000-8000-000000000123"}} introduction><Private/></RouteAccess>);
  expect(mounted).not.toHaveBeenCalled();
  expect(screen.getByRole("button", {name:"Skip introduction"})).toBeTruthy();
});
test.each(["auth/callback", "account-closed"])("cold %s remains reachable for recovery", async (name) => {
  mockSeen=false;
  await render(<RouteAccess name={name} introduction><Private/></RouteAccess>);
  expect(mounted).toHaveBeenCalledTimes(1);
});
test("signed-in members can enter without repeating the introduction", async () => {
  mockSeen=false;mockSignedIn=true;
  await render(<RouteAccess name="index" introduction><Private/></RouteAccess>);
  expect(mounted).toHaveBeenCalledTimes(1);
});
test("first-launch auth keeps the feature requested before authentication", async () => {
  mockSeen=false;
  await render(<RouteAccess name="auth/index" params={{returnTo:"/saved"}} introduction><Private/></RouteAccess>);
  await fireEvent.press(screen.getByRole("button", {name:"Skip introduction"}));
  expect(router.replace).toHaveBeenCalledWith({pathname:"/auth",params:{returnTo:"/saved"}});
});
