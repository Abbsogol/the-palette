import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { CompleteProfile } from "../src/features/onboarding/complete-profile";
import { accountScope } from "../src/lib/account-scope";
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
const initial = {
  display_name: "Sarah",
  username: "sarah.nails",
  location: "Dubai",
  bio: "",
  booking_area: "",
  role: "Customer" as const,
};
const accept = async () => {
  await fireEvent.press(
    screen.getByRole("checkbox", { name: "I am 18 or older" }),
  );
  await fireEvent.press(
    screen.getByRole("checkbox", { name: "I have read the Privacy Policy" }),
  );
};
beforeEach(() => accountScope.change("account-a", true));
test("required city validation and creator service location preserve the editable form", async () => {
  const save = jest.fn();
  await render(
    <CompleteProfile
      initial={{ ...initial, location: "", role: "Creator" }}
      initialStep={1}
      onSave={save}
      onContinue={jest.fn()}
    />,
  );
  await accept();
  await fireEvent.press(
    screen.getByRole("button", { name: "Finish my profile" }),
  );
  expect(screen.getByText("Enter your city or area.")).toBeTruthy();
  expect(save).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText("City / area"), "Dubai");
  await fireEvent.press(
    screen.getByRole("button", { name: "Finish my profile" }),
  );
  expect(screen.getByText("Enter your studio or service area.")).toBeTruthy();
});
test("a failed completion keeps details and retries before showing success", async () => {
  const save = jest
      .fn()
      .mockRejectedValueOnce(new Error("Connection lost"))
      .mockResolvedValue(undefined),
    next = jest.fn().mockResolvedValue(undefined);
  await render(
    <CompleteProfile
      initial={initial}
      initialStep={1}
      onSave={save}
      onContinue={next}
    />,
  );
  await accept();
  await fireEvent.press(
    screen.getByRole("button", { name: "Finish my profile" }),
  );
  expect(screen.getByText("Connection lost")).toBeTruthy();
  expect(screen.getByLabelText("Username").props.value).toBe("sarah.nails");
  expect(next).not.toHaveBeenCalled();
  await fireEvent.press(
    screen.getByRole("button", { name: "Finish my profile" }),
  );
  expect(screen.getByText("PROFILE COMPLETE")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Explore LaQue" }));
  expect(next).toHaveBeenCalledWith("Customer");
});
test("restored progress opens the saved step with fresh eligibility confirmations", async () => {
  const progress = jest.fn(),
    save = jest.fn();
  await render(
    <CompleteProfile
      initial={initial}
      initialStep={1}
      onProgress={progress}
      onSave={save}
      onContinue={jest.fn()}
    />,
  );
  expect(screen.getByLabelText("Bio").props.value).toBe("");
  await fireEvent.press(
    screen.getByRole("button", { name: "Finish my profile" }),
  );
  expect(save).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText("Bio"), "My nail world");
  expect(progress).toHaveBeenLastCalledWith(
    expect.objectContaining({
      step: 1,
      draft: expect.objectContaining({ bio: "My nail world" }),
    }),
  );
});
test("a late completion from another account cannot reveal success", async () => {
  let resolve!: () => void;
  const save = jest.fn(
    () =>
      new Promise<void>((r) => {
        resolve = r;
      }),
  );
  await render(
    <CompleteProfile
      initial={initial}
      initialStep={1}
      onSave={save}
      onContinue={jest.fn()}
    />,
  );
  await accept();
  await fireEvent.press(
    screen.getByRole("button", { name: "Finish my profile" }),
  );
  accountScope.change("account-b");
  await act(async () => resolve());
  expect(screen.queryByText("PROFILE COMPLETE")).toBeNull();
});
test("already completed accounts see the creator next step without submitting again", async () => {
  const save = jest.fn(),
    next = jest.fn().mockRejectedValue(new Error("Try again"));
  await render(
    <CompleteProfile
      alreadyComplete
      initial={{ ...initial, role: "Creator" }}
      onSave={save}
      onContinue={next}
    />,
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Continue to Creator Studio" }),
  );
  await waitFor(() => expect(screen.getByText("Try again")).toBeTruthy());
  expect(save).not.toHaveBeenCalled();
});
