import { act, render } from "@testing-library/react-native";
import { ConnectedComposer } from "../src/features/social/connected-composer";
import { postSocial } from "../src/features/social/data";
import { router } from "expo-router";
import { accountScope } from "../src/lib/account-scope";
const mockPrevent = jest.fn(),
  mockInvalidate = jest.fn();
let mockProps: any;
jest.mock("../src/features/social/composer", () => ({
  SocialComposer: (props: any) => {
    mockProps = props;
    return null;
  },
}));
jest.mock("../src/features/social/data", () => ({
  postSocial: jest.fn(),
  pickSocialMedia: jest.fn(),
  searchPeople: jest.fn(),
}));
jest.mock("expo-router", () => ({
  router: { replace: jest.fn(), back: jest.fn() },
  useNavigation: () => ({ dispatch: jest.fn() }),
}));
jest.mock("expo-router/react-navigation", () => ({
  usePreventRemove: (...args: any[]) => mockPrevent(...args),
}));
jest.mock("../src/lib/auth", () => ({
  useAuth: () => ({ session: { user: { id: "owner" } }, epoch: 1 }),
  queryClient: { invalidateQueries: () => mockInvalidate() },
}));
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
beforeEach(() => {
  jest.clearAllMocks();
  accountScope.change("owner", true);
  jest.mocked(postSocial).mockResolvedValue();
});
afterEach(() => accountScope.change(null));
test("native draft guard is enabled while dirty or busy and completion disables it before navigation", async () => {
  await render(<ConnectedComposer kind="story" />);
  await act(async () => mockProps.onStatusChange({ dirty: true, busy: false }));
  expect(mockPrevent).toHaveBeenLastCalledWith(true, expect.any(Function));
  const draft = { caption: "Moment", tags: [], people: [], media: [] };
  await act(async () => mockProps.onPost(draft, jest.fn()));
  expect(router.replace).not.toHaveBeenCalled();
  await act(async () => mockProps.onComplete());
  expect(mockPrevent).toHaveBeenLastCalledWith(false, expect.any(Function));
  expect(router.replace).toHaveBeenCalledWith("/");
});
test("retry uses the same publication ID/upload map and a changed account cannot complete posting", async () => {
  await render(<ConnectedComposer kind="story" />);
  const draft = { caption: "Moment", tags: [], people: [], media: [] };
  await mockProps.onPost(draft, jest.fn());
  await mockProps.onPost(draft, jest.fn());
  expect(jest.mocked(postSocial).mock.calls[0][1]).toBe(
    jest.mocked(postSocial).mock.calls[1][1],
  );
  expect(jest.mocked(postSocial).mock.calls[0][3]).toBe(
    jest.mocked(postSocial).mock.calls[1][3],
  );
  jest.mocked(postSocial).mockImplementation(async () => {
    accountScope.change("other");
  });
  await expect(mockProps.onPost(draft, jest.fn())).rejects.toThrow(
    /account changed/,
  );
  expect(router.replace).not.toHaveBeenCalled();
});
