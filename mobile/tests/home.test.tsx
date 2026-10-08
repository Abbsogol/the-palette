import { fireEvent, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import {
  HomeMainView,
  type HomeMainProps,
} from "../src/features/home/home-main-view";
import { HomeNavigation } from "../src/components/home-tab-bar";
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 393, height: 852, scale: 3, fontScale: 1 }),
}));
beforeEach(() => {
  jest
    .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
    .mockResolvedValue(false);
});
afterEach(() => jest.restoreAllMocks());

const props = (): HomeMainProps => ({
  trending: {
    title: "TRENDING",
    retry: jest.fn(),
    designs: [{ id: "a", title: "Rose set", image: null, saves: 2000 }],
  },
  library: { title: "Explore Library", retry: jest.fn(), designs: [] },
  week: {
    title: "New This Week",
    retry: jest.fn(),
    designs: [
      { id: "week-only", title: "New moss set", image: null, saves: 12 },
    ],
  },
  community: { retry: jest.fn() },
  tab: "Explore",
  category: "All",
  sort: "For you",
  onTab: jest.fn(),
  onCategory: jest.fn(),
  onSort: jest.fn(),
  stories: [{ id: "creator-a", name: "Sarah", image: null }],
  onStory: jest.fn(),
  onAddStory: jest.fn(),
  onDesign: jest.fn(),
  onSave: jest.fn(),
  onSearch: jest.fn(),
  onNotifications: jest.fn(),
  onFavorites: jest.fn(),
});

test("restored weekly designs open and save the same record; the community card opens its feed", async () => {
  const p = props();
  await render(<HomeMainView {...p} />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Save New moss set" }),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "View New moss set" }),
  );
  expect(p.onSave).toHaveBeenCalledWith("week-only");
  expect(p.onDesign).toHaveBeenCalledWith("week-only");
  await fireEvent.press(
    screen.getByRole("button", { name: "Explore Community" }),
  );
  expect(p.onTab).toHaveBeenCalledWith("Community");
  expect(screen.queryByText(/2,500/)).toBeNull();
  expect(screen.getByText("Artists")).toBeTruthy();
});

test("weekly and community failures retry independently and do not show stale totals", async () => {
  const p = props();
  p.week.error = "New designs are unavailable.";
  p.community.stats = { artists: 2500, posts: 550 };
  p.community.error = "Community totals are unavailable.";
  await render(<HomeMainView {...p} />);
  expect(
    screen.queryByRole("button", { name: "View New moss set" }),
  ).toBeNull();
  expect(screen.queryByText(/2,500/)).toBeNull();
  await fireEvent.press(
    screen.getByRole("button", { name: "Retry New This Week" }),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Retry community totals" }),
  );
  expect(p.week.retry).toHaveBeenCalledTimes(1);
  expect(p.community.retry).toHaveBeenCalledTimes(1);
  expect(p.trending.retry).not.toHaveBeenCalled();
});

test("Home search submits the typed query; header and discovery actions work", async () => {
  const p = props();
  await render(<HomeMainView {...p} />);
  const search = screen.getByLabelText("Search designs, nail artists, salons");
  await fireEvent.changeText(search, "  almond rose  ");
  await fireEvent(search, "submitEditing");
  expect(p.onSearch).toHaveBeenCalledWith("almond rose");
  await fireEvent.press(screen.getByRole("button", { name: "Notifications" }));
  await fireEvent.press(
    screen.getByRole("button", { name: "Open saved designs" }),
  );
  await fireEvent.press(screen.getByRole("tab", { name: "Community" }));
  expect(p.onNotifications).toHaveBeenCalledTimes(1);
  expect(p.onFavorites).toHaveBeenCalledTimes(1);
  expect(p.onTab).toHaveBeenCalledWith("Community");
});

test("saving targets the same record as opening it and is disabled while pending", async () => {
  const p = props();
  const view = await render(<HomeMainView {...p} />);
  await fireEvent.press(screen.getByRole("button", { name: "Save Rose set" }));
  expect(p.onSave).toHaveBeenCalledWith("a");
  expect(p.onDesign).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "View Rose set" }));
  expect(p.onDesign).toHaveBeenCalledWith("a");
  p.trending.designs[0].saving = true;
  await view.rerender(<HomeMainView {...p} />);
  const button = screen.getByRole("button", { name: "Save Rose set" });
  expect(button).toBeDisabled();
  await fireEvent.press(button);
  expect(p.onSave).toHaveBeenCalledTimes(1);
});

test("a failed section hides stale cards and retries independently", async () => {
  const p = props();
  p.trending.error = "Connection lost";
  await render(<HomeMainView {...p} />);
  expect(screen.queryByRole("button", { name: "View Rose set" })).toBeNull();
  expect(screen.getByRole("alert")).toHaveTextContent("Connection lost");
  await fireEvent.press(screen.getByRole("button", { name: "Retry TRENDING" }));
  expect(p.trending.retry).toHaveBeenCalledTimes(1);
  expect(p.library.retry).not.toHaveBeenCalled();
  expect(screen.getByRole("tab", { name: "Community" })).toBeTruthy();
});

test("loading and empty results have meaningful states, without made-up activity counts", async () => {
  const p = props();
  p.trending.loading = true;
  p.library.emptyMessage = "Follow artists to see their designs.";
  const location = jest.fn();
  p.library.action = { title: "Find artists", onPress: location };
  await render(<HomeMainView {...p} />);
  expect(screen.getByLabelText("Loading TRENDING")).toBeTruthy();
  expect(screen.queryByText("12.1k")).toBeNull();
  expect(screen.queryByText(/2,500/)).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Find artists" }));
  expect(location).toHaveBeenCalledTimes(1);
});

test("all six navigation items are reachable and the active item is announced", async () => {
  const navigate = jest.fn();
  await render(<HomeNavigation selected="index" onSelect={navigate} />);
  expect(screen.getAllByRole("tab")).toHaveLength(6);
  expect(screen.getByRole("tab", { name: "Home" })).toBeSelected();
  await fireEvent.press(screen.getByRole("tab", { name: "Saved" }));
  expect(navigate).toHaveBeenCalledWith("saved");
});

test("the covered hero leaves the accessibility tree, then returns when the panel lowers", async () => {
  await render(<HomeMainView {...props()} viewportWidth={393} />);
  await fireEvent(screen.getByTestId("home-viewport"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 393, height: 852 } },
  });
  expect(screen.getByTestId("home-sheet-content")).toBeTruthy();
  const scroll = screen.getByTestId("home-scroll");
  expect(screen.getByRole("button", { name: "Notifications" })).toBeTruthy();
  await fireEvent.scroll(scroll, {
    nativeEvent: { contentOffset: { x: 0, y: 600 } },
  });
  expect(screen.queryByRole("button", { name: "Notifications" })).toBeNull();
  expect(screen.getByRole("button", { name: "Save Rose set" })).toBeTruthy();
  await fireEvent.scroll(scroll, {
    nativeEvent: { contentOffset: { x: 0, y: 200 } },
  });
  expect(screen.getByRole("button", { name: "Notifications" })).toBeTruthy();
  await fireEvent.scroll(scroll, {
    nativeEvent: { contentOffset: { x: 0, y: 0 } },
  });
  expect(screen.getByRole("header", { name: "Nail & beauty design library" })).toBeTruthy();
});

test("a short viewport keeps the hero and content in ordinary scrolling", async () => {
  await render(<HomeMainView {...props()} viewportWidth={393} />);
  await fireEvent(screen.getByTestId("home-viewport"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 393, height: 480 } },
  });
  expect(screen.queryByTestId("home-sheet-content")).toBeNull();
  expect(screen.getByRole("button", { name: "Notifications" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Save Rose set" })).toBeTruthy();
});

test("reduced motion uses ordinary scrolling and keeps every section available", async () => {
  const preference = jest
    .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
    .mockResolvedValue(true);
  try {
    await render(<HomeMainView {...props()} />);
    expect(screen.queryByTestId("home-sheet-content")).toBeNull();
    expect(screen.getByRole("button", { name: "Notifications" })).toBeTruthy();
    expect(
      screen.getByRole("header", { name: "Explore Library" }),
    ).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Community" })).toBeTruthy();
  } finally {
    preference.mockRestore();
  }
});

test("V2 filters, sort and story controls use their real action identifiers", async () => {
  const p = props();
  await render(<HomeMainView {...p} />);
  expect(screen.getByRole("tab", { name: "Explore" })).toBeSelected();
  expect(screen.getByRole("button", { name: "Category: All" })).toBeSelected();
  await fireEvent.press(screen.getByRole("button", { name: "Category: Dark" }));
  await fireEvent.press(screen.getByRole("button", { name: "Sort: Newest" }));
  await fireEvent.press(
    screen.getByRole("button", { name: "View Sarah’s story" }),
  );
  await fireEvent.press(screen.getByRole("button", { name: "Add your story" }));
  expect(p.onCategory).toHaveBeenCalledWith("Dark");
  expect(p.onSort).toHaveBeenCalledWith("Newest");
  expect(p.onStory).toHaveBeenCalledWith("creator-a");
  expect(p.onAddStory).toHaveBeenCalledTimes(1);
});

test("empty and failed feeds retain all controls inside one sticky header", async () => {
  const p = props();
  p.trending.designs = [];
  p.library.error = "Offline";
  await render(<HomeMainView {...p} />);
  await fireEvent(screen.getByTestId("home-viewport"), "layout", {
    nativeEvent: { layout: { x: 0, y: 0, width: 393, height: 852 } },
  });
  expect(screen.getByTestId("home-scroll").props.stickyHeaderIndices).toEqual([
    0,
  ]);
  const header = screen.getByTestId("home-sticky-header");
  expect(header).toHaveTextContent(/Explore/);
  expect(header).toHaveTextContent(/Your story/);
  expect(header).toHaveTextContent(/Minimal/);
  expect(header).toHaveTextContent(/Most saved/);
  expect(
    screen.getByRole("button", { name: "Retry Explore Library" }),
  ).toBeTruthy();
});

test('featured designs have their own Explore section and announcements are labelled in Updates',async()=>{
 const p=props();const view=await render(<HomeMainView {...p} featured={{title:'Featured by LaQue',retry:jest.fn(),designs:[{id:'featured',title:'LaQue pick',image:null,saves:0}]}}/>);
 expect(screen.getByText('Featured by LaQue')).toBeTruthy();
 await fireEvent.press(screen.getByRole('button',{name:'View LaQue pick'}));expect(p.onDesign).toHaveBeenCalledWith('featured');
 await view.rerender(<HomeMainView {...p} tab='Updates' announcements={[{id:'news',title:'From the studio',body:'Welcome to the new collection.'}]}/>);
 expect(screen.getByText('LaQue announcement')).toBeTruthy();expect(screen.getByText('From the studio')).toBeTruthy();expect(screen.queryByText('Featured by LaQue')).toBeNull();
});
