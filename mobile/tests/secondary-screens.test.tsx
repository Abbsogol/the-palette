import { render, screen, fireEvent, act } from "@testing-library/react-native";
import { DeleteView } from "../src/features/secondary/delete-view";
import { ProfileForm } from "../src/features/secondary/profile-form";
import { ServiceForm } from "../src/features/secondary/service-form";
import { Schedule } from "../src/features/secondary/hours-form";
import { PrivacyView } from "../src/features/secondary/privacy-view";
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
const deletion = () => ({
  onDelete: jest.fn().mockResolvedValue(undefined),
  onPolicy: jest.fn(),
  onDone: jest.fn(),
});
async function confirmDeletion() {
  await fireEvent.press(
    screen.getByRole("button", { name: "Continue to delete" }),
  );
  await fireEvent.changeText(
    screen.getByLabelText("Type DELETE to confirm"),
    "DELETE",
  );
  await fireEvent.press(screen.getByRole("checkbox"));
}
test("deletion requires both exact confirmation and acknowledgement", async () => {
  const p = deletion();
  await render(<DeleteView {...p} />);
  expect(screen.getByText(/NO RESTORE OPTION/)).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", { name: "Continue to delete" }),
  );
  const button = screen.getByRole("button", {
    name: "Permanently delete account",
  });
  expect(button).toBeDisabled();
  await fireEvent.changeText(
    screen.getByLabelText("Type DELETE to confirm"),
    "delete",
  );
  await fireEvent.press(screen.getByRole("checkbox"));
  expect(button).toBeDisabled();
  await fireEvent.changeText(
    screen.getByLabelText("Type DELETE to confirm"),
    "DELETE",
  );
  await fireEvent.press(button);
  expect(p.onDelete).toHaveBeenCalledTimes(1);
  expect(screen.getByText("Account closed")).toBeTruthy();
});
test("closure failure stays on confirmation and permits a deliberate retry", async () => {
  const p = deletion();
  p.onDelete.mockRejectedValueOnce(new Error("Service unavailable"));
  await render(<DeleteView {...p} />);
  await confirmDeletion();
  await fireEvent.press(
    screen.getByRole("button", { name: "Permanently delete account" }),
  );
  expect(screen.getByText("Service unavailable")).toBeTruthy();
  expect(screen.queryByText("Account closed")).toBeNull();
  await fireEvent.press(
    screen.getByRole("button", { name: "Permanently delete account" }),
  );
  expect(p.onDelete).toHaveBeenCalledTimes(2);
});
test("rapid repeated deletion does not submit twice", async () => {
  const p = deletion();
  let resolve!: () => void;
  p.onDelete.mockImplementation(
    () =>
      new Promise<void>((r) => {
        resolve = r;
      }),
  );
  await render(<DeleteView {...p} />);
  await confirmDeletion();
  await fireEvent.press(
    screen.getByRole("button", { name: "Permanently delete account" }),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Permanently delete account" }),
  );
  expect(p.onDelete).toHaveBeenCalledTimes(1);
  await act(async () => resolve());
});
test("profile validation keeps the draft and submits normalized fields", async () => {
  const save = jest.fn().mockResolvedValue(undefined);
  await render(<ProfileForm initial={{ display_name: "" }} onSave={save} />);
  await fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
  expect(save).not.toHaveBeenCalled();
  await fireEvent.changeText(
    screen.getByLabelText("Display name"),
    "  Sarah  ",
  );
  await fireEvent.changeText(
    screen.getByLabelText("Username"),
    "sarah_designs",
  );
  await fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      display_name: "Sarah",
      username: "sarah_designs",
    }),
    { avatar: undefined, banner: undefined },
  );
});
test("creator onboarding includes service location after selecting creator", async () => {
  await render(<ProfileForm onboarding onSave={jest.fn()} />);
  await fireEvent.press(screen.getByRole("button", { name: "Choose creator" }));
  await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByLabelText("Service location")).toBeTruthy();
});
test("deposit cannot exceed price and failed save preserves the form", async () => {
  const save = jest.fn().mockRejectedValue(new Error("Offline"));
  await render(<ServiceForm onSave={save} onCancel={jest.fn()} />);
  await fireEvent.changeText(screen.getByLabelText("Service name"), "Gel");
  await fireEvent.changeText(screen.getByLabelText("Total price (AED)"), "100");
  await fireEvent.changeText(screen.getByLabelText("Deposit (AED)"), "101");
  await fireEvent.press(screen.getByRole("button", { name: "Save service" }));
  expect(save).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText("Deposit (AED)"), "20");
  await fireEvent.press(screen.getByRole("button", { name: "Save service" }));
  expect(screen.getByText("Offline")).toBeTruthy();
  expect(screen.getByLabelText("Service name").props.value).toBe("Gel");
});
test("working hours rejects an inverted day before saving", async () => {
  const save = jest.fn();
  await render(<Schedule zone="Asia/Dubai" initial={[]} onSave={save} />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Monday opens, 09:00" }),
  );
  await fireEvent.press(screen.getByRole("button", { name: "Hour 20" }));
  await fireEvent.press(screen.getByRole("button", { name: "Use time" }));
  await fireEvent.press(
    screen.getByRole("button", { name: "Save working hours" }),
  );
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByText(/Check Monday/)).toBeTruthy();
});
test("unblock confirmation stays open when the operation fails", async () => {
  const unblock = jest.fn().mockResolvedValue(false);
  await render(
    <PrivacyView
      settings={{
        is_private: false,
        show_saves: false,
        message_permission: "none",
      }}
      blocks={[{ id: "b", name: "Blocked person" }]}
      onUpdate={jest.fn()}
      onUnblock={unblock}
      onPolicy={jest.fn()}
      onDelete={jest.fn()}
    />,
  );
  await fireEvent.press(screen.getByText("Blocked person"));
  await fireEvent.press(screen.getByRole("button", { name: "Unblock" }));
  expect(screen.getByText("Unblock account?")).toBeTruthy();
});
