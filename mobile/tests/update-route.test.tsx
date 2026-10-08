import { act, render } from "@testing-library/react-native";
import NewUpdate from "../src/app/updates/new";
import { publishUpdate } from "../src/features/home/update-data";
import { accountScope } from "../src/lib/account-scope";
import { router } from "expo-router";
let mockOwner = "owner",
  mockEpoch = 1,
  mockProps: any;
const mockPrevent = jest.fn(),
  mockInvalidate = jest.fn();
jest.mock("../src/components/ui", () => ({
  RequireAuth: ({ children }: any) => children,
}));
jest.mock("../src/features/home/update-composer", () => ({
  UpdateComposer: (props: any) => {
    mockProps = props;
    return null;
  },
}));
jest.mock("../src/features/home/update-data", () => ({
  publishUpdate: jest.fn(),
}));
jest.mock("expo-router/react-navigation", () => ({
  usePreventRemove: (...args: any[]) => mockPrevent(...args),
}));
jest.mock("../src/lib/auth", () => ({
  useAuth: () => ({ session: { user: { id: mockOwner } }, epoch: mockEpoch }),
  useProfile: () => ({
    data: {
      display_name: "Mira",
      username: "mira.nails",
      avatar_url: "https://example.test/photo.png",
    },
  }),
  queryClient: {
    invalidateQueries: (...args: any[]) => mockInvalidate(...args),
  },
}));
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
beforeEach(() => {
  jest.clearAllMocks();
  mockOwner = "owner";
  mockEpoch++;
  accountScope.change("owner", true);
  jest.mocked(publishUpdate).mockResolvedValue();
  mockInvalidate.mockResolvedValue(undefined);
});
test("route guards dirty/busy drafts and resets the guard before returning to Updates", async () => {
  await render(<NewUpdate />);
  await act(async () => mockProps.onStatusChange({ dirty: true, busy: false }));
  expect(mockPrevent).toHaveBeenLastCalledWith(true, expect.any(Function));
  await act(async () => mockProps.onClose());
  expect(mockPrevent).toHaveBeenLastCalledWith(false, expect.any(Function));
  expect(router.back).toHaveBeenCalledTimes(1);
});
test("a stale account publication cannot refresh another account or navigate", async () => {
  await render(<NewUpdate />);
  jest.mocked(publishUpdate).mockImplementation(async () => {
    accountScope.change("other");
  });
  await expect(mockProps.onPublish("Studio note")).rejects.toThrow(
    /account changed/,
  );
  expect(mockInvalidate).not.toHaveBeenCalled();
  expect(router.back).not.toHaveBeenCalled();
});
test("confirmed publication survives cache refresh failure and exposes connected author identity", async () => {
  await render(<NewUpdate />);
  mockInvalidate.mockRejectedValue(new Error("Offline"));
  await expect(mockProps.onPublish("Studio note")).resolves.toBeUndefined();
  expect(mockProps.author).toMatchObject({
    name: "Mira",
    username: "mira.nails",
    avatar: { uri: "https://example.test/photo.png" },
  });
});
