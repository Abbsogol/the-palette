import { render, screen, fireEvent } from "@testing-library/react-native";
import { Text } from "react-native";
import { Button, Field, QueryState, RequireAuth } from "../src/components/ui";
jest.mock("../src/lib/auth", () => ({
  useAuth: () => ({ session: null, ready: true }),
}));
test("a pending financial action cannot be pressed twice and announces its state", async () => {
  const submit = jest.fn();
  await render(<Button title="Pay deposit" busy onPress={submit} />);
  const button = screen.getByRole("button");
  expect(button).toBeDisabled();
  await fireEvent.press(button);
  expect(submit).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Pay deposit, in progress")).toBeTruthy();
});
test("a failed query shows a retry without rendering private stale content", async () => {
  const retry = jest.fn();
  await render(
    <QueryState
      loading={false}
      error={new Error("Connection lost")}
      retry={retry}
    >
      <Text>Private conversation</Text>
    </QueryState>,
  );
  expect(screen.queryByText("Private conversation")).toBeNull();
  expect(screen.getByRole("alert")).toHaveTextContent("Connection lost");
  await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
  expect(retry).toHaveBeenCalledTimes(1);
});
test("signed out users must authenticate before protected children mount", async () => {
  const mount = jest.fn();
  function Protected() {
    mount();
    return <Text>Secret</Text>;
  }
  await render(
    <RequireAuth>
      <Protected />
    </RequireAuth>,
  );
  expect(mount).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
});
test("forms expose a label and retain typed input while the keyboard is open", async () => {
  const change = jest.fn();
  await render(
    <Field
      label="Email"
      value=""
      onChangeText={change}
      keyboardType="email-address"
    />,
  );
  await fireEvent.changeText(
    screen.getByLabelText("Email"),
    "beta@example.invalid",
  );
  expect(change).toHaveBeenCalledWith("beta@example.invalid");
});
