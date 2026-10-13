import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert, Text } from "react-native";
import {
  IntroView,
  AuthView,
  type AuthViewProps,
} from "../src/features/welcome/welcome-view";
import {
  FirstLaunchProvider,
  useFirstLaunch,
} from "../src/features/welcome/first-launch";
import WelcomePreview from "../src/preview/welcome";
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

beforeEach(async () => {
  await AsyncStorage.clear();
});
test("Next visits all four Figma frames before opening the final entry screen", async () => {
  const finish = jest.fn();
  await render(<IntroView onFinish={finish} />);
  expect(screen.getByRole("header", { name: "laQue" })).toBeTruthy();
  for (const title of [
    "FULL COLOUR SPECS",
    "SEARCH & FILTER",
    "SAVE & SHARE",
  ]) {
    await fireEvent.press(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("header", { name: title })).toBeTruthy();
    expect(finish).not.toHaveBeenCalled();
  }
  await fireEvent.press(screen.getByRole("button", { name: "Get started" }));
  expect(finish).toHaveBeenCalledTimes(1);
});
test.each([0, 1, 2, 3])(
  "Skip from frame %s opens the final entry without another slide",
  async (step) => {
    const finish = jest.fn();
    await render(<IntroView onFinish={finish} />);
    for (let i = 0; i < step; i++)
      await fireEvent.press(screen.getByRole("button", { name: "Next" }));
    await fireEvent.press(
      screen.getByRole("button", { name: "Skip introduction" }),
    );
    expect(finish).toHaveBeenCalledTimes(1);
  },
);
test("completion can retry failed persistence and concurrent taps complete only once", async () => {
  let reject!: (error: Error) => void;
  const finish = jest.fn(
    () =>
      new Promise<void>((_, fail) => {
        reject = fail;
      }),
  );
  await render(<IntroView onFinish={finish} />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Skip introduction" }),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Skip introduction" }),
  );
  expect(finish).toHaveBeenCalledTimes(1);
  await act(async () => reject(new Error("Disk unavailable")));
  expect(screen.getByRole("alert")).toHaveTextContent(/Please try again/);
  expect(
    screen.getByRole("button", { name: "Skip introduction" }),
  ).not.toBeDisabled();
});
function Seen() {
  const state = useFirstLaunch();
  return <Text>{state.ready ? (state.seen ? "seen" : "new") : "loading"}</Text>;
}
test("introduction completion survives restart and preview state cannot mark the real app complete", async () => {
  await AsyncStorage.setItem("laque.introduction.v1.preview", "complete");
  const view = await render(
    <FirstLaunchProvider>
      <Seen />
    </FirstLaunchProvider>,
  );
  await waitFor(() => expect(screen.getByText("new")).toBeTruthy());
  await view.unmount();
  await AsyncStorage.setItem("laque.introduction.v1", "complete");
  await render(
    <FirstLaunchProvider>
      <Seen />
    </FirstLaunchProvider>,
  );
  await waitFor(() => expect(screen.getByText("seen")).toBeTruthy());
});
const authProps = (): AuthViewProps => ({
  mode: "welcome",
  onMode: jest.fn(),
  email: "",
  password: "",
  onEmail: jest.fn(),
  onPassword: jest.fn(),
  onSubmit: jest.fn(),
  onProvider: jest.fn(),
  onCreator: jest.fn(),
  onBack: jest.fn(),
  onResend: jest.fn(),
});
test("Onboarding 0 exposes both providers, email sign-in/signup, creator choices without guest entry", async () => {
  const p = authProps();
  await render(<AuthView {...p} />);
  await fireEvent.press(screen.getByRole("checkbox",{name:"I am 18 or older"}));
  await fireEvent.press(screen.getByRole("checkbox",{name:"I have read the Privacy Policy"}));
  expect(
    screen.queryByRole("button", { name: "Explore demo account" }),
  ).toBeNull();
  await fireEvent.press(
    screen.getByRole("button", { name: "Continue with Google" }),
  );
  expect(p.onProvider).toHaveBeenLastCalledWith("google", {ageConfirmed:true,privacyAccepted:true});
  await fireEvent.press(
    screen.getByRole("button", { name: "Continue with Apple" }),
  );
  expect(p.onProvider).toHaveBeenLastCalledWith("apple", {ageConfirmed:true,privacyAccepted:true});
  await fireEvent.press(screen.getByRole("button", { name: "Sign up" }));
  expect(p.onMode).toHaveBeenLastCalledWith("Create account");
  await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
  expect(p.onMode).toHaveBeenLastCalledWith("Sign in");
  expect(screen.queryByRole("button", {name:"View Home as a guest"})).toBeNull();
  expect(screen.queryByRole("tab", {name:"Home"})).toBeNull();
  await fireEvent.press(
    screen.getByRole("button", { name: "Join as a Creator" }),
  );
  expect(p.onCreator).toHaveBeenCalledTimes(1);
});
test("demo entry unlocks search, Length filters and design details without credentials", async () => {
  await render(<WelcomePreview />);
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Skip introduction" }),
    ).toBeTruthy(),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Skip introduction" }),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Explore demo account" }),
  );
  expect(
    screen.queryByRole("button", { name: "Sign in to search" }),
  ).toBeNull();
  await fireEvent.press(screen.getByRole("tab", { name: "Search" }));
  await fireEvent.press(screen.getByRole("button", { name: "Filters" }));
  await fireEvent.press(screen.getByRole("checkbox", { name: "Length: Long" }));
  await fireEvent.press(screen.getByRole("button", { name: "Show 2 Results" }));
  expect(screen.queryByRole("button", { name: "View Pistachio" })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Save Cathedral" }));
  expect(screen.getByRole("button", { name: "Unsave Cathedral" })).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "View Cathedral" }));
  expect(screen.getByRole("header", { name: "Colour Specs" })).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(screen.queryByTestId("design-detail-preview")).toBeNull();
  expect(
    screen.getByRole("button", { name: "Filters, 1 selected" }),
  ).toBeTruthy();
});
test("exiting the isolated demo returns to auth and clears temporary saves", async () => {
  await AsyncStorage.setItem("laque.introduction.v1.preview", "complete");
  await render(<WelcomePreview />);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy(),
  );
  await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
  // The escape hatch is also present if the owner is already on an email form.
  await fireEvent.press(
    screen.getByRole("button", { name: "Explore demo account" }),
  );
  await fireEvent.press(
    screen.getAllByRole("button", { name: "Save Cathedral" })[0],
  );
  await fireEvent.press(screen.getByRole("tab", { name: "Profile" }));
  expect(screen.getByRole("header", { name: "Sarah" })).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Settings" }));
  await fireEvent.press(screen.getByRole("button", { name: "More settings" }));
  await fireEvent.press(
    screen.getByRole("button", { name: "Exit demo account" }),
  );
  expect(screen.queryByRole("button", { name: "View Home as a guest" })).toBeNull();
  expect(screen.queryByRole("tab", {name:"Search"})).toBeNull();
  expect(screen.queryByRole("button", { name: "Filters" })).toBeNull();
  await fireEvent.press(
    screen.getByRole("button", { name: "Explore demo account" }),
  );
  expect(screen.queryByRole("button", { name: "Unsave Cathedral" })).toBeNull();
  expect(
    screen.getAllByRole("button", { name: "Save Cathedral" }).length,
  ).toBeGreaterThan(0);
});
test("demo Saved opens folders and both favorites tabs, with state kept across tabs", async () => {
  await AsyncStorage.setItem("laque.introduction.v1.preview", "complete");
  await render(<WelcomePreview />);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Explore demo account" })).toBeTruthy(),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Explore demo account" }),
  );
  await fireEvent.press(screen.getByRole("tab", { name: "Search" }));
  await fireEvent.press(screen.getByRole("button", { name: "Save Cathedral" }));
  await fireEvent.press(screen.getByRole("tab", { name: "Saved" }));
  expect(screen.getByRole("tab", { name: "Saved" })).toBeSelected();
  expect(screen.getByRole("button", { name: "View Cathedral" })).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", { name: "Create a folder" }),
  );
  await fireEvent.changeText(
    screen.getByLabelText("Folder name"),
    "My inspiration",
  );
  await fireEvent.press(screen.getByRole("button", { name: "Create folder" }));
  await fireEvent.press(screen.getByRole("tab", { name: "Home" }));
  await fireEvent.press(screen.getByRole("tab", { name: "Saved" }));
  expect(
    screen.getByRole("button", { name: "Open folder My inspiration" }),
  ).toBeTruthy();
  await fireEvent.press(screen.getByRole("tab", { name: "Saved Profiles" }));
  expect(screen.getByRole("button", { name: "View Kimia Kimia" })).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", { name: "View Kimia Kimia" }),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Back" }),
  );
  expect(screen.getByRole("tab", { name: "Saved Profiles" })).toBeSelected();
});
test("the preview follows introduction → authentication with no automatic browsing", async () => {
  await render(<WelcomePreview />);
  await waitFor(() => expect(screen.getByRole("button", {name:"Skip introduction"})).toBeTruthy());
  await fireEvent.press(screen.getByRole("button", {name:"Skip introduction"}));
  expect(screen.getByRole("button", {name:"Continue with Google"})).toBeTruthy();
  expect(screen.getByRole("button", {name:"Continue with Apple"})).toBeTruthy();
  expect(screen.queryByRole("button", {name:"View Home as a guest"})).toBeNull();
  expect(screen.queryByRole("tab", {name:"Home"})).toBeNull();
  expect(screen.queryByLabelText("Search designs, nail artists, salons")).toBeNull();
  await fireEvent.press(screen.getByRole("button", {name:"Sign in"}));
  expect(screen.getByLabelText("Email")).toBeTruthy();
});
