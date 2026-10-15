import { fireEvent, render, screen } from "@testing-library/react-native";
import NewUpdate from "../src/app/updates/new";
import { router } from "expo-router";
jest.mock("../src/components/ui", () => ({
  RequireAuth: ({ children }: any) => children,
}));
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
beforeEach(() => jest.clearAllMocks());
test("old member publishing links explain official administration and direct personal posts to Community", async () => {
  await render(<NewUpdate />);
  expect(
    screen.getByText(
      "Official Updates are managed by assigned admins in Admin Studio.",
    ),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Publish update" })).toBeNull();
  await fireEvent.press(
    screen.getByRole("button", { name: "Create a Community post" }),
  );
  expect(router.replace).toHaveBeenCalledWith("/community/new");
});
