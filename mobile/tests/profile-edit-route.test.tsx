import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { usePreventRemove } from "expo-router/react-navigation";
import { router } from "expo-router";
import EditProfile from "../src/app/profile-edit";
import { api } from "../src/lib/api";
const mockDispatch = jest.fn();
let mockRefreshError: Error | null = null;
jest.mock("expo-router", () => ({
  router: { back: jest.fn() },
  useNavigation: () => ({ dispatch: mockDispatch }),
}));
jest.mock("expo-router/react-navigation", () => ({
  usePreventRemove: jest.fn(),
}));
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
jest.mock("../src/lib/upload", () => ({ chooseAndUpload: jest.fn() }));
jest.mock("../src/lib/api", () => ({
  api: jest.fn().mockResolvedValue({ ok: true }),
}));
jest.mock("../src/components/ui", () => ({
  RequireAuth: ({ children }: any) => children,
  QueryState: ({ children }: any) => children,
}));
jest.mock("../src/lib/auth", () => ({
  useAuth: () => ({ session: { user: { id: "owner" } } }),
  useProfile: () => ({
    data: {
      id: "owner",
      display_name: "Sarah",
      username: "sarah.nails",
      location: "Dubai",
      bio: "",
      specialties: ["Chrome"],
      account_type: "user",
    },
    isPending: false,
    error: mockRefreshError,
    refetch: jest.fn(),
  }),
  queryClient: { invalidateQueries: jest.fn().mockResolvedValue(undefined) },
}));
test("navigation back actions are guarded, discard resumes that action and saved tags use the authenticated API", async () => {
  await render(<EditProfile />);
  await fireEvent.changeText(screen.getByLabelText("Bio"), "Updated bio");
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(router.back).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("button", { name: "Discard changes" })).toBeNull();
  const guard = jest.mocked(usePreventRemove).mock.calls.at(-1)!;
  expect(guard[0]).toBe(true);
  const action = { type: "GO_BACK" };
  await act(() => guard[1]({ data: { action } }));
  expect(mockDispatch).not.toHaveBeenCalled();
  await fireEvent.press(
    screen.getByRole("button", { name: "Discard changes" }),
  );
  expect(mockDispatch).toHaveBeenCalledWith(action);
  await fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
  expect(api).toHaveBeenCalledWith(
    "/update-profile",
    expect.objectContaining({ specialties: ["Chrome"], bio: "Updated bio" }),
  );
  expect(jest.mocked(usePreventRemove).mock.calls.at(-1)![0]).toBe(false);
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(router.back).toHaveBeenCalledTimes(2);
});
test("a failed background refresh preserves the profile draft and offers retry", async () => {
  const view = await render(<EditProfile />);
  await fireEvent.changeText(screen.getByLabelText("Bio"), "Unsaved bio");
  mockRefreshError = new Error("Offline");
  await view.rerender(<EditProfile />);
  expect(screen.getByLabelText("Bio").props.value).toBe("Unsaved bio");
  expect(
    screen.getByRole("button", { name: "Retry profile refresh" }),
  ).toBeTruthy();
  mockRefreshError = null;
});
