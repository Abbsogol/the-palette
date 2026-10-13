import { fireEvent, render, screen } from "@testing-library/react-native";
import {
  ProfileView,
  type ProfileViewProps,
} from "../src/features/profiles/profile-view";
import ProfilePreview from "../src/preview/profiles";
import SearchPreview from "../src/preview/search-main";
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
const base = (): ProfileViewProps => ({
  profile: {
    id: "a",
    name: "Kim",
    role: "creator",
    bio: "Artist bio",
    location: "Dubai",
    specialties: ["Gel"],
  },
  tab: "Designs",
  onTab: jest.fn(),
  onAction: jest.fn(),
  designs: [{ id: "d", title: "Chrome", published: true }],
  stats: { followers: 3, designs: 1, rating: null },
  account: {
    upcoming: 8,
    saved: 22,
    favorites: 5,
    collections: 2,
    credits: 999,
  },
});
test("public profile never renders the owner account payload", async () => {
  const p = base();
  await render(<ProfileView {...p} />);
  expect(screen.queryByText("My Account")).toBeNull();
  expect(screen.queryByText("999")).toBeNull();
  expect(screen.queryByText("Upcoming Appointment")).toBeNull();
  expect(screen.queryByRole("button", { name: "Edit profile" })).toBeNull();
  await fireEvent.press(
    screen.getByRole("button", { name: "Book Appointment" }),
  );
  expect(p.onAction).toHaveBeenCalledWith("book", undefined);
  await fireEvent.press(screen.getByRole("button", { name: "Message" }));
  expect(p.onAction).toHaveBeenCalledWith("message", undefined);
});
test("owner design badges, dashboard actions and public view use separate callbacks", async () => {
  const p = base();
  p.designs!.push({ id: "secret", title: "Unpublished", published: false });
  await render(<ProfileView {...p} owner tab="My Designs" />);
  expect(screen.getByText("My Account")).toBeTruthy();
  expect(screen.getByText("Private")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Credits: 999" }));
  expect(p.onAction).toHaveBeenCalledWith("credits", undefined);
  await fireEvent.press(screen.getByRole("button", { name: "Public Profile" }));
  expect(p.onAction).toHaveBeenCalledWith("public", undefined);
  expect(screen.queryByRole("button", { name: "Book Appointment" })).toBeNull();
});
test("private public profile hides its grid even if a caller supplies designs", async () => {
  const p = base();
  p.profile!.private = true;
  await render(<ProfileView {...p} />);
  expect(screen.queryByText("Chrome")).toBeNull();
  expect(screen.getByText(/This profile is private/)).toBeTruthy();
});
test("content errors replace cached cards and expose retry", async () => {
  const retry = jest.fn();
  await render(
    <ProfileView
      {...base()}
      contentError="Access changed"
      onRetryContent={retry}
    />,
  );
  expect(screen.queryByText("Chrome")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
  expect(retry).toHaveBeenCalledTimes(1);
});
test("public customer profile keeps designs and follows without message, booking, services or rating", async () => {
  const p = base();
  p.profile!.role = "user";
  p.stats = { followers: 847, designs: 1, following: 234 };
  await render(<ProfileView {...p} />);
  expect(screen.queryByRole("button", { name: "Book Appointment" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Message" })).toBeNull();
  expect(screen.queryByRole("tab", { name: "Services" })).toBeNull();
  expect(screen.queryByText("Rating")).toBeNull();
  expect(screen.getByText("847")).toBeTruthy();
  expect(screen.getByText("234")).toBeTruthy();
  expect(screen.getByRole("button", { name: "View Chrome" })).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Follow" }));
  expect(p.onAction).toHaveBeenCalledWith("follow", undefined);
});
test("safety controls remain reachable behind the public menu", async () => {
  const p = base();
  await render(<ProfileView {...p} />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Profile options" }),
  );
  expect(screen.getByRole("button", { name: "Report profile" })).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Block profile" }));
  expect(p.onAction).toHaveBeenCalledWith("block", undefined);
});
test("demo owner can view public profile, return, edit identity and open settings", async () => {
  const exit = jest.fn();
  await render(<ProfilePreview width={393} onExitDemo={exit} />);
  await fireEvent.press(screen.getByRole("button", { name: "Public Profile" }));
  expect(screen.queryByText("My Account")).toBeNull();
  expect(screen.queryByText("Private")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByText("My Account")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Edit profile" }));
  await fireEvent.changeText(screen.getByLabelText("Display name"), "Mina");
  await fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
  expect(
    screen.getByText(
      "Profile saved. Your changes are now visible on your profile.",
    ),
  ).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByText("Mina")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Settings" }));
  await fireEvent.press(screen.getByRole("button", { name: "More settings" }));
  await fireEvent.press(
    screen.getByRole("button", { name: "Exit demo account" }),
  );
  expect(exit).toHaveBeenCalledTimes(1);
});
test("Search artist cards open public profile and can return to artist results", async () => {
  await render(<SearchPreview width={393} />);
  await fireEvent.press(screen.getByRole("tab", { name: "People & Salons" }));
  await fireEvent.press(
    screen.getAllByRole("button", { name: /View Kimia Kimia/ })[0],
  );
  expect(screen.getByTestId("public-profile")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByRole("tab", { name: "People & Salons" })).toBeTruthy();
});
test("Search salon profile retains the selected identity and location", async () => {
  await render(<SearchPreview width={393} />);
  await fireEvent.press(screen.getByRole("tab", { name: "People & Salons" }));
  await fireEvent.press(
    screen.getByRole("button", { name: /View Nail Bar Studio/ }),
  );
  expect(screen.getByText("Nail Bar Studio")).toBeTruthy();
  expect(screen.getByText("Kyiv")).toBeTruthy();
  expect(screen.getByText("SALON")).toBeTruthy();
  expect(screen.queryByText("NAIL ARTIST")).toBeNull();
});
test("a regular owner with no designs has an upload entry while public visitors do not", async () => {
  const p = base();
  p.profile!.role = "user";
  p.designs = [];
  const view = await render(<ProfileView {...p} owner tab="My Designs" />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Upload a design" }),
  );
  expect(p.onAction).toHaveBeenCalledWith("upload-design", undefined);
  await view.rerender(<ProfileView {...p} tab="Designs" />);
  expect(screen.queryByRole("button", { name: "Upload a design" })).toBeNull();
});
