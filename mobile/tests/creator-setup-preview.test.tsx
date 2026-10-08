import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { SecondaryPreview } from "../src/preview/secondary";
import type { ProfileIdentity } from "../src/features/profiles/model";
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
jest.mock("expo-image-picker", () => ({ launchImageLibraryAsync: jest.fn() }));
test("saving a checklist profile returns to the studio and preserves setup progress", async () => {
  const exit = jest.fn();
  function Preview() {
    const [profile, setProfile] = useState<ProfileIdentity>({
      id: "demo",
      name: "Sarah",
      username: "sarah.nails",
      location: "Dubai",
      role: "user",
      specialties: [],
    });
    return (
      <SecondaryPreview
        initial="business"
        profile={profile}
        onSaveProfile={(p) => setProfile((v) => ({ ...v, ...p }))}
        onBack={exit}
        onCalendar={jest.fn()}
        onAppointment={jest.fn()}
        onExit={jest.fn()}
        onPortfolio={jest.fn()}
      />
    );
  }
  await render(<Preview />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Set up my creator account" }),
  );
  expect(screen.getByText("2 OF 4 COMPLETE")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Continue setup" }));
  await fireEvent.changeText(
    screen.getByLabelText("Service location"),
    "Demo studio, Dubai",
  );
  await fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(exit).not.toHaveBeenCalled();
  expect(screen.getByText("3 OF 4 COMPLETE")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Continue setup" }));
  await fireEvent.press(
    screen.getByRole("button", { name: "Save working hours" }),
  );
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByText("4 OF 4 COMPLETE")).toBeTruthy();
  expect(screen.getByText("READY TO TAKE BOOKINGS")).toBeTruthy();
});
