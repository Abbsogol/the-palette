import { fireEvent, render, screen } from "@testing-library/react-native";
import { ProfileForm } from "../src/features/secondary/profile-form";
import { useProfileExit } from "../src/features/secondary/profile-exit";
import { Screen } from "../src/features/secondary/primitives";
import { accountScope } from "../src/lib/account-scope";
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
const initial = {
  display_name: "Sarah",
  username: "sarah.nails",
  location: "Dubai",
  specialties: ["Minimal"],
};
test("interests can be selected, removed and added; save includes the public tags", async () => {
  const save = jest.fn().mockResolvedValue(undefined);
  await render(<ProfileForm initial={initial} onSave={save} />);
  expect(
    screen.getByRole("checkbox", { name: "Minimal" }).props.accessibilityState
      .checked,
  ).toBe(true);
  await fireEvent.press(screen.getByRole("checkbox", { name: "Minimal" }));
  await fireEvent.press(screen.getByRole("checkbox", { name: "Chrome" }));
  expect(
    screen.getByRole("checkbox", { name: "Chrome" }).props.accessibilityState
      .checked,
  ).toBe(true);
  await fireEvent.changeText(
    screen.getByLabelText("Add your own tag"),
    "Sculpted gel",
  );
  await fireEvent.press(screen.getByRole("button", { name: "Add tag" }));
  await fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({ specialties: ["Chrome", "Sculpted gel"] }),
    expect.any(Object),
  );
  expect(
    screen.getByText(
      "Profile saved. Your changes are now visible on your profile.",
    ),
  ).toBeTruthy();
});
test("a failed save retains the edits for retry and does not claim success", async () => {
  const save = jest
    .fn()
    .mockRejectedValueOnce(new Error("That username is already taken"))
    .mockResolvedValue(undefined);
  await render(<ProfileForm initial={initial} onSave={save} />);
  await fireEvent.changeText(screen.getByLabelText("Username"), "new.username");
  await fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
  expect(screen.getByText("That username is already taken")).toBeTruthy();
  expect(screen.queryByText(/Profile saved/)).toBeNull();
  expect(screen.getByLabelText("Username").props.value).toBe("new.username");
  await fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
  expect(save).toHaveBeenCalledTimes(2);
  expect(screen.getByText(/Profile saved/)).toBeTruthy();
});
test("an unfinished custom tag is treated as an unsaved edit and cannot be silently omitted", async () => {
  const save = jest.fn(),
    leave = jest.fn();
  await render(<Harness save={save} leave={leave} />);
  await fireEvent.changeText(
    screen.getByLabelText("Add your own tag"),
    "New tag",
  );
  await fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
  expect(save).not.toHaveBeenCalled();
  expect(
    screen.getByText("Add your new tag or clear it before saving."),
  ).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(leave).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Keep editing" })).toBeTruthy();
});
test("20 tags are allowed, duplicate and extra tags do not expand the list", async () => {
  await render(
    <ProfileForm
      initial={{
        ...initial,
        specialties: Array.from({ length: 20 }, (_, i) => `Tag ${i}`),
      }}
      onSave={jest.fn()}
    />,
  );
  await fireEvent.press(screen.getByRole("checkbox", { name: "Chrome" }));
  expect(
    screen.getByText("Choose up to 20 tags. Remove one to add another."),
  ).toBeTruthy();
  await fireEvent.changeText(
    screen.getByLabelText("Add your own tag"),
    "tag 0",
  );
  await fireEvent.press(screen.getByRole("button", { name: "Add tag" }));
  expect(screen.getByText("This tag is already selected.")).toBeTruthy();
});
function Harness({
  leave,
  save,
}: {
  leave: () => void;
  save: () => Promise<void>;
}) {
  const exit = useProfileExit();
  return (
    <Screen title="Edit profile" onBack={() => exit.requestExit(leave)}>
      <ProfileForm
        initial={initial}
        onStatusChange={exit.onStatusChange}
        onSave={save}
      />
      {exit.dialog}
    </Screen>
  );
}
test("back offers keep editing or discard, and a successful save clears the guard", async () => {
  const leave = jest.fn();
  await render(
    <Harness leave={leave} save={jest.fn().mockResolvedValue(undefined)} />,
  );
  await fireEvent.changeText(screen.getByLabelText("Display name"), "Mina");
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(leave).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Discard changes" })).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Keep editing" }));
  expect(screen.getByLabelText("Display name").props.value).toBe("Mina");
  await fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(leave).toHaveBeenCalledTimes(1);
});
test("discard explicitly leaves without saving; a stale account cannot execute a queued exit", async () => {
  accountScope.change("owner-a", true);
  const leave = jest.fn(),
    save = jest.fn();
  await render(<Harness leave={leave} save={save} />);
  await fireEvent.changeText(screen.getByLabelText("Bio"), "New bio");
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  await fireEvent.press(
    screen.getByRole("button", { name: "Discard changes" }),
  );
  expect(leave).toHaveBeenCalledTimes(1);
  expect(save).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  accountScope.change("owner-b");
  await fireEvent.press(
    screen.getByRole("button", { name: "Discard changes" }),
  );
  expect(leave).toHaveBeenCalledTimes(1);
});
