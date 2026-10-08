import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Alert } from "react-native";
import { router } from "expo-router";
import ProfileSettings from "../src/app/profile-settings";
import { signOut } from "../src/lib/auth";
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
jest.mock("../src/lib/auth", () => ({
  useAuth: () => ({ ready: true, session: { user: { id: "owner" } } }),
  useProfile: () => ({ data: { account_type: "creator" } }),
  signOut: jest.fn(),
}));
beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.restoreAllMocks());

test("the overflow menu preserves creator and account tools without executing them when opened", async () => {
  await render(<ProfileSettings />);
  expect(screen.getByRole("button", { name: "Delete Account" })).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", { name: "Booking History" }),
  );
  expect(router.push).toHaveBeenLastCalledWith("/appointments");
  jest.mocked(router.push).mockClear();
  await fireEvent.press(screen.getByRole("button", { name: "More settings" }));
  for (const name of [
    "My Portfolio",
    "My Services",
    "Working Hours",
    "Sign out",
  ]) {
    expect(screen.getByRole("button", { name })).toBeTruthy();
  }
  expect(router.push).not.toHaveBeenCalled();
  expect(signOut).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Close Account settings" }));
  await fireEvent.press(screen.getByRole("button", { name: "Delete Account" }));
  expect(router.push).toHaveBeenCalledWith("/delete-account");
  expect(screen.queryByRole("header", { name: "Account settings" })).toBeNull();
});

test("sign out still requires its explicit confirmation after moving into More", async () => {
  const confirm = jest
    .spyOn(Alert, "alert")
    .mockImplementation(() => undefined);
  jest.mocked(signOut).mockResolvedValue(undefined);
  await render(<ProfileSettings />);
  await fireEvent.press(screen.getByRole("button", { name: "More settings" }));
  await fireEvent.press(
    screen.getByRole("button", { name: "Close Account settings" }),
  );
  expect(signOut).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "More settings" }));
  await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
  expect(signOut).not.toHaveBeenCalled();
  expect(confirm).toHaveBeenCalled();
  const buttons = confirm.mock.calls[0][2]!;
  expect(buttons.find((b) => b.text === "Stay")?.style).toBe("cancel");
  await act(async () => {
    buttons.find((b) => b.text === "Sign out")?.onPress?.();
  });
  expect(signOut).toHaveBeenCalledTimes(1);
  expect(router.replace).toHaveBeenCalledWith("/");
});

test("Lab Subscription & Tokens opens the membership route", async () => {
  await render(<ProfileSettings />);
  expect(screen.queryByRole("button", { name: "Payment Methods" })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Lab Subscription & Tokens" }));
  expect(router.push).toHaveBeenLastCalledWith("/billing");
});
