import { fireEvent, render, screen } from "@testing-library/react-native";
import { ProfileForm } from "../src/features/secondary/profile-form";
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
const initial = { display_name: "Sarah", username: "sarah.nails", location: "Dubai" };
test("choosing photos stays a draft; remove clears each image explicitly on save", async () => {
  const save = jest.fn().mockResolvedValue(undefined),
    pick = jest.fn(async (kind) => ({
      url: `https://images.test/${kind}`,
      preview: { uri: `https://images.test/${kind}` },
    }));
  await render(<ProfileForm initial={initial} onSave={save} onPick={pick} />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Add profile photo" }),
  );
  await fireEvent.press(screen.getByRole("button", { name: "Add banner" }));
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Profile photo")).toBeTruthy();
  expect(screen.getByLabelText("Profile banner")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
  expect(save).toHaveBeenLastCalledWith(
    expect.objectContaining({
      avatar_url: "https://images.test/avatar",
      banner_url: "https://images.test/banner",
    }),
    expect.any(Object),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Remove profile photo" }),
  );
  await fireEvent.press(screen.getByRole("button", { name: "Remove banner" }));
  await fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
  expect(save).toHaveBeenLastCalledWith(
    expect.objectContaining({ avatar_url: null, banner_url: null }),
    { avatar: null, banner: null },
  );
});
test("a failed photo picker preserves the existing photo and editable profile fields", async () => {
  const save = jest.fn().mockResolvedValue(undefined);
  await render(
    <ProfileForm
      initial={initial}
      avatar={{ uri: "https://images.test/existing" }}
      onSave={save}
      onPick={jest.fn().mockRejectedValue(new Error("Photo access denied"))}
    />,
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Change profile photo" }),
  );
  expect(screen.getByText("Photo access denied")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
  expect(save.mock.calls[0][0]).not.toHaveProperty("avatar_url");
  expect(save.mock.calls[0][1].avatar).toEqual({
    uri: "https://images.test/existing",
  });
});
test("onboarding requires both unchecked confirmations before finishing", async () => {
  const save = jest.fn().mockResolvedValue(undefined);
  await render(<ProfileForm onboarding initial={initial} onSave={save} />);
  await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
  await fireEvent.press(
    screen.getByRole("button", { name: "Finish my profile" }),
  );
  expect(save).not.toHaveBeenCalled();
  await fireEvent.press(
    screen.getByRole("checkbox", { name: "I am 18 or older" }),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Finish my profile" }),
  );
  expect(save).not.toHaveBeenCalled();
  await fireEvent.press(
    screen.getByRole("checkbox", { name: "I have read the Privacy Policy" }),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Finish my profile" }),
  );
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({ age_confirmed: true, privacy_accepted: true }),
    expect.any(Object),
  );
});
