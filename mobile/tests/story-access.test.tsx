import { act, render } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";
import StoryScreen from "../src/app/story/[id]";
import { accountScope } from "../src/lib/account-scope";
let mockViewer: any;
const mockRefetch = jest.fn();
jest.mock("../src/features/stories/story-ui", () => ({
  StoryViewer: (props: any) => {
    mockViewer = props;
    return null;
  },
}));
jest.mock("../src/lib/auth", () => ({
  useAuth: () => ({ session: { user: { id: "owner" } } }),
  useAccountQuery: () => ({
    refetch: mockRefetch,
    isPending: false,
    data: [
      {
        id: "story",
        user_id: "author",
        name: "Elena",
        image_url: "https://example.invalid/story.webp",
        created_at: "2026-10-07T00:00:00Z",
      },
    ],
  }),
}));
jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    canGoBack: () => true,
  },
  useLocalSearchParams: () => ({ id: "story" }),
  useFocusEffect: (callback: () => void) =>
    require("react").useEffect(callback, [callback]),
}));
beforeEach(() => accountScope.change("owner", true));
afterEach(() => {
  accountScope.change(null);
  jest.restoreAllMocks();
});
test("cached stories stay hidden until access is rechecked on entry and foregrounding", async () => {
  let finish!: () => void, appChange!: (state: AppStateStatus) => void;
  mockRefetch.mockImplementation(
    () =>
      new Promise<void>((done) => {
        finish = done;
      }),
  );
  jest
    .spyOn(AppState, "addEventListener")
    .mockImplementation((_event, callback) => {
      appChange = callback;
      return { remove: jest.fn() };
    });
  await render(<StoryScreen />);
  expect(mockViewer.loading).toBe(true);
  await act(async () => finish());
  expect(mockViewer.loading).toBe(false);
  await act(async () => appChange("background"));
  expect(mockViewer.loading).toBe(true);
  await act(async () => appChange("active"));
  expect(mockViewer.loading).toBe(true);
  await act(async () => finish());
  expect(mockViewer.loading).toBe(false);
});
test("an access response for the previous account cannot reveal cached stories", async () => {
  let finish!: () => void;
  mockRefetch.mockImplementation(
    () =>
      new Promise<void>((done) => {
        finish = done;
      }),
  );
  await render(<StoryScreen />);
  accountScope.change("other");
  await act(async () => finish());
  expect(mockViewer.loading).toBe(true);
});
test("backgrounding invalidates an in-flight access check until a fresh foreground check completes", async () => {
  const finish: (() => void)[] = [];
  let appChange!: (state: AppStateStatus) => void;
  mockRefetch.mockImplementation(
    () => new Promise<void>((done) => finish.push(done)),
  );
  jest
    .spyOn(AppState, "addEventListener")
    .mockImplementation((_event, callback) => {
      appChange = callback;
      return { remove: jest.fn() };
    });
  await render(<StoryScreen />);
  await act(async () => appChange("background"));
  await act(async () => finish[0]());
  expect(mockViewer.loading).toBe(true);
  await act(async () => appChange("active"));
  expect(mockViewer.loading).toBe(true);
  await act(async () => finish[1]());
  expect(mockViewer.loading).toBe(false);
});
