import { fireEvent, render, screen } from "@testing-library/react-native";
import {
  SearchView,
  type SearchArtist,
  type SearchViewProps,
} from "../src/features/search/search-view";
import { emptyFilters } from "../src/features/search/filters";
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 393, height: 852, scale: 3, fontScale: 1 }),
}));
const props = (): SearchViewProps => ({
  width: 393,
  input: "",
  onInput: jest.fn(),
  onSubmit: jest.fn(),
  mode: "Designs",
  onMode: jest.fn(),
  sort: "Newest",
  onSort: jest.fn(),
  filters: emptyFilters(),
  onApply: jest.fn(),
  onDraft: jest.fn(),
  draftTotal: 24,
  onRetryCount: jest.fn(),
  total: 177,
  designs: [
    {
      id: "a",
      title: "Cathedral",
      image: null,
      attributes: ["Stiletto", "Long"],
      reviewCount: 24,
    },
  ],
  artists: [],
  onRetry: jest.fn(),
  onDesign: jest.fn(),
  onSave: jest.fn(),
  onArtist: jest.fn(),
  onSaveArtist: jest.fn(),
  onMore: jest.fn(),
});
test("opening, multi-selecting and applying includes Length without committing each draft tap", async () => {
  const p = props();
  await render(<SearchView {...p} />);
  await fireEvent.press(screen.getByRole("button", { name: "Filters" }));
  await fireEvent.press(screen.getByRole("checkbox", { name: "Shape: Oval" }));
  await fireEvent.press(
    screen.getByRole("checkbox", { name: "Shape: Ballerina" }),
  );
  await fireEvent.press(
    screen.getByRole("checkbox", { name: "Length: Short" }),
  );
  expect(p.onApply).not.toHaveBeenCalled();
  expect(screen.getByRole("header", { name: "Shape ( 2 )" })).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", { name: "Show 24 Results" }),
  );
  expect(p.onApply).toHaveBeenCalledWith({
    ...emptyFilters(),
    shape: ["Oval", "Ballerina"],
    length: ["Short"],
  });
  expect(screen.queryByTestId("search-filter-sheet")).toBeNull();
});
test("Clear All only changes the draft and closing restores the applied selections on reopen", async () => {
  const p = props();
  p.filters = { ...emptyFilters(), color: ["Mauve"], shape: ["Oval"] };
  await render(<SearchView {...p} />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Filters, 2 selected" }),
  );
  await fireEvent.press(screen.getByRole("button", { name: "Clear All" }));
  expect(
    screen.getByRole("checkbox", { name: "Color: Mauve" }),
  ).not.toBeChecked();
  await fireEvent.press(screen.getByRole("button", { name: "Close filters" }));
  expect(p.onApply).not.toHaveBeenCalled();
  await fireEvent.press(
    screen.getByRole("button", { name: "Filters, 2 selected" }),
  );
  expect(screen.getByRole("checkbox", { name: "Color: Mauve" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Shape: Oval" })).toBeChecked();
});
test("failed draft counts never display stale totals and remain retryable", async () => {
  const p = props();
  p.countError = "Count unavailable.";
  p.draftTotal = 177;
  await render(<SearchView {...p} />);
  await fireEvent.press(screen.getByRole("button", { name: "Filters" }));
  expect(screen.getByText("Show Results")).toBeTruthy();
  expect(screen.queryByText("Show 177 Results")).toBeNull();
  expect(screen.getByRole("button", { name: /^Show Results$/ })).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", { name: "Retry result count" }),
  );
  expect(p.onRetryCount).toHaveBeenCalledTimes(1);
});
test("a real zero count can be applied", async () => {
  const p = props();
  p.draftTotal = 0;
  await render(<SearchView {...p} />);
  await fireEvent.press(screen.getByRole("button", { name: "Filters" }));
  await fireEvent.press(screen.getByRole("button", { name: "Show 0 Results" }));
  expect(p.onApply).toHaveBeenCalledWith(emptyFilters());
});
test("the native modal dismissal request discards unapplied filters", async () => {
  const p = props();
  await render(<SearchView {...p} />);
  await fireEvent.press(screen.getByRole("button", { name: "Filters" }));
  await fireEvent.press(screen.getByRole("checkbox", { name: "Length: Long" }));
  await fireEvent(screen.getByTestId("search-filter-sheet"), "requestClose");
  expect(p.onApply).not.toHaveBeenCalled();
  expect(p.onDraft).toHaveBeenLastCalledWith(null);
  expect(screen.queryByTestId("search-filter-sheet")).toBeNull();
});
test("search, sorting and separate save/detail actions target their intended records", async () => {
  const p = props();
  await render(<SearchView {...p} />);
  await fireEvent.changeText(
    screen.getByLabelText("Search designs, nail artists, salons"),
    "rose",
  );
  await fireEvent(
    screen.getByLabelText("Search designs, nail artists, salons"),
    "submitEditing",
  );
  expect(p.onInput).toHaveBeenCalledWith("rose");
  expect(p.onSubmit).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole("button", { name: "Sort results" }));
  await fireEvent.press(screen.getByRole("button", { name: "Most saved" }));
  expect(p.onSort).toHaveBeenCalledWith("Most saved");
  await fireEvent.press(screen.getByRole("button", { name: "Save Cathedral" }));
  expect(p.onSave).toHaveBeenCalledWith("a");
  expect(p.onDesign).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "View Cathedral" }));
  expect(p.onDesign).toHaveBeenCalledWith("a");
});
test("failed result refresh hides stale cards and a pending save is disabled", async () => {
  const p = props();
  p.designs[0].saving = true;
  const view = await render(<SearchView {...p} />);
  expect(screen.getByRole("button", { name: "Save Cathedral" })).toBeDisabled();
  await view.rerender(<SearchView {...p} error="Offline" />);
  expect(screen.queryByRole("button", { name: "View Cathedral" })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
  expect(p.onRetry).toHaveBeenCalledTimes(1);
});

const artist: SearchArtist = {
  id: "artist-1",
  name: "Kimia Kimia",
  kind: "NAIL ARTIST",
  image: "https://example.test/kimia.jpg",
  location: "Dubai",
  rating: 4.9,
  reviews: 124,
};
test("artist profile and favorite actions remain separate, including pending and saved states", async () => {
  const p = { ...props(), mode: "Artists" as const, artists: [artist], total: 1 };
  const view = await render(<SearchView {...p} />);
  expect(screen.getByText("NAIL ARTIST")).toBeTruthy();
  expect(screen.getByText("Dubai")).toBeTruthy();
  expect(screen.getByText("4.9 (124)")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Save Kimia Kimia" }));
  expect(p.onSaveArtist).toHaveBeenCalledWith(artist.id);
  expect(p.onArtist).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "View Kimia Kimia" }));
  expect(p.onArtist).toHaveBeenCalledWith(artist.id);
  await view.rerender(<SearchView {...p} artists={[{ ...artist, saving: true }]} />);
  const pending = screen.getByRole("button", { name: "Save Kimia Kimia", busy: true });
  expect(pending).toBeDisabled();
  await fireEvent.press(pending);
  expect(p.onSaveArtist).toHaveBeenCalledTimes(1);
  await view.rerender(<SearchView {...p} artists={[{ ...artist, saved: true }]} />);
  const saved = screen.getByRole("button", {
    name: "Unsave Kimia Kimia", selected: true, busy: false,
  });
  await fireEvent.press(saved);
  expect(p.onSaveArtist).toHaveBeenCalledTimes(2);
});
test("a failed avatar falls back to an initial and a new photo can recover", async () => {
  const p = { ...props(), mode: "Artists" as const, artists: [artist] };
  const view = await render(<SearchView {...p} />);
  await fireEvent(screen.getByTestId("search-artist-avatar-artist-1"), "error", {
    nativeEvent: { error: "Photo unavailable" },
  });
  expect(screen.queryByTestId("search-artist-avatar-artist-1")).toBeNull();
  expect(screen.getByText("K")).toBeTruthy();
  await view.rerender(
    <SearchView {...p} artists={[{ ...artist, image: "https://example.test/new.jpg" }]} />,
  );
  expect(screen.getByTestId("search-artist-avatar-artist-1")).toBeTruthy();
  expect(screen.queryByText("K")).toBeNull();
});
test.each([
  { rating: undefined, reviews: undefined },
  { rating: 4.9, reviews: undefined },
  { rating: 0, reviews: 0 },
  { rating: Number.NaN, reviews: 124 },
  { rating: 6, reviews: 124 },
])("unknown or invalid review data never becomes a displayed rating: %j", async (rating) => {
  await render(
    <SearchView {...props()} mode="Artists" artists={[{ ...artist, ...rating }]} />,
  );
  expect(screen.queryByText(/\(.*\)/)).toBeNull();
  expect(screen.getByRole("button", { name: "View Kimia Kimia" })).toBeTruthy();
});
test("salons with no photo or rating still expose their full name and profile action", async () => {
  const p = props();
  const salon = {
    ...artist,
    name: "Nail Moxie Lounge and Beauty Studio",
    kind: "SALON" as const,
    image: null,
    location: "Dubai Design District",
    rating: undefined,
    reviews: undefined,
  };
  await render(<SearchView {...p} width={320} mode="Artists" artists={[salon]} />);
  expect(screen.getByText(salon.name)).toBeTruthy();
  expect(screen.getByText("SALON")).toBeTruthy();
  expect(screen.getByText("N")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: `View ${salon.name}` }));
  expect(p.onArtist).toHaveBeenCalledWith(salon.id);
});
