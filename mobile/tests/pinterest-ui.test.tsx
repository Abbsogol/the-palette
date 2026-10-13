import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { AppState } from "react-native";
import * as Linking from "expo-linking";
import { api, ApiError } from "../src/lib/api";
import { accountScope } from "../src/lib/account-scope";
import { PinterestInspiration, usePinterestFeed, type InspirationPage, type InspirationPin } from "../src/features/pinterest/inspiration";
import { emptyFilters, type SearchFilters } from "../src/features/search/filters";
jest.mock("../src/lib/api", () => ({ api: jest.fn(), ApiError: class extends Error {
  status: number; code?: string; retryAt?: string;
  constructor(message: string, status: number, code?: string, retryAt?: string) {
    super(message); this.status = status; this.code = code; this.retryAt = retryAt;
  }
} }));
jest.mock("expo-linking", () => ({ openURL: jest.fn().mockResolvedValue(undefined) }));
const pin: InspirationPin = { source: "pinterest", id: "123", title: "Short pink French nail art",
  description: "Minimal manicure", alt_text: "Pink nails", creator: "nail.artist", imageUrl: "https://i.pinimg.com/sample.jpg",
  pinUrl: "https://www.pinterest.com/pin/123/", detailTicket: "ticket" };
const page: InspirationPage = { records: [pin], cursor: "next", topic: "all" };
function Harness({ active = true, authenticated = true, preview = false, query = "", filters = emptyFilters() }: {
  active?: boolean; authenticated?: boolean; preview?: boolean; query?: string; filters?: SearchFilters;
}) {
  const feed = usePinterestFeed(active, authenticated, preview);
  return <PinterestInspiration feed={feed} active={active} authenticated={authenticated} preview={preview} query={query} filters={filters} />;
}
beforeEach(async () => {
  jest.clearAllMocks();
  jest.mocked(api).mockReset().mockResolvedValue(page);
  await act(async () => { accountScope.change("owner", true); });
});
test.each([{ authenticated: false }, { preview: true }, { active: false }])("never fetches for a signed-out, preview or inactive view: %j", async props => {
  await render(<Harness {...props} />); expect(api).not.toHaveBeenCalled();
});
test("shows source/creator attribution without save, booking, fabricated metrics or Lab actions", async () => {
  await render(<Harness />);
  await waitFor(() => expect(screen.getByText("From Pinterest · @nail.artist")).toBeTruthy());
  expect(screen.queryByRole("button", { name: /Save|Book|Generate/ })).toBeNull();
  expect(screen.getByText(/1 matching looks in this selection/)).toBeTruthy();
});
test("search and Length filters change only the loaded selection without more API calls", async () => {
  const view = await render(<Harness />);
  await waitFor(() => expect(screen.getByRole("button", { name: /View Pinterest design/ })).toBeTruthy());
  await view.rerender(<Harness query="construction" />);
  expect(screen.getByText(/No nail looks match/)).toBeTruthy();
  const filters = emptyFilters(); filters.length = ["Long"];
  await view.rerender(<Harness filters={filters} />);
  expect(screen.getByText(/No nail looks match/)).toBeTruthy(); expect(api).toHaveBeenCalledTimes(1);
});
test("withholds missing-text and unrelated Pins instead of fabricating nail designs", async () => {
  jest.mocked(api).mockResolvedValue({ ...page, records: [{ ...pin, title: "", description: "", alt_text: "" }, { ...pin, id: "124", title: "Construction nail gun", alt_text: "", description: "" }] });
  await render(<Harness />);
  await waitFor(() => expect(screen.getByText(/No nail looks match/)).toBeTruthy());
});
test("topic selections filter board records even when the provider returns the same page", async () => {
  await render(<Harness />);
  await waitFor(() => expect(screen.getByText("From Pinterest · @nail.artist")).toBeTruthy());
  jest.mocked(api).mockResolvedValue({ ...page, topic: "chrome" });
  await fireEvent.press(screen.getByRole("button", { name: "Pinterest topic: Chrome" }));
  await waitFor(() => expect(screen.getByText(/No nail looks match/)).toBeTruthy());
  expect(api).toHaveBeenLastCalledWith("/pinterest/inspiration?topic=chrome");
  expect(screen.queryByRole("button", { name: /View Pinterest design/ })).toBeNull();
});
test("pagination is explicit and removes duplicate Pin IDs", async () => {
  await render(<Harness />);
  await waitFor(() => expect(screen.getByText("From Pinterest · @nail.artist")).toBeTruthy());
  jest.mocked(api).mockResolvedValue({ ...page, cursor: null });
  await fireEvent.press(screen.getByRole("button", { name: "Load more Pinterest" }));
  await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
  expect(api).toHaveBeenLastCalledWith("/pinterest/inspiration?topic=all&cursor=next");
  expect(screen.getAllByText("From Pinterest · @nail.artist")).toHaveLength(1);
});
test("a full second page adds 24 different designs and announces visible progress", async () => {
  const first = Array.from({ length: 24 }, (_, index) => ({ ...pin, id: String(index + 100), title: `Pink nail art ${index + 1}` }));
  const second = Array.from({ length: 24 }, (_, index) => ({ ...pin, id: String(index + 200), title: `Blue nail art ${index + 25}` }));
  jest.mocked(api).mockResolvedValueOnce({ ...page, records: first }).mockResolvedValueOnce({ ...page, records: second, cursor: "next-again" });
  await render(<Harness />);
  await waitFor(() => expect(screen.getAllByRole("button", { name: /View Pinterest design/ })).toHaveLength(24));
  await fireEvent.press(screen.getByRole("button", { name: "Load more Pinterest" }));
  await waitFor(() => expect(screen.getAllByRole("button", { name: /View Pinterest design/ })).toHaveLength(48));
  expect(screen.getByText("24 more matching looks added.")).toBeTruthy();
  expect(api).toHaveBeenCalledTimes(2);
});
test("a failed next page retries its cursor and preserves already loaded designs", async () => {
  const extra = { ...pin, id: "124", title: "Blue nail art" };
  jest.mocked(api).mockResolvedValueOnce(page).mockRejectedValueOnce(new Error("Connection interrupted")).mockResolvedValueOnce({ ...page, records: [extra], cursor: null });
  await render(<Harness />);
  await waitFor(() => expect(screen.getByText("From Pinterest · @nail.artist")).toBeTruthy());
  await fireEvent.press(screen.getByRole("button", { name: "Load more Pinterest" }));
  await waitFor(() => expect(screen.getByText("Connection interrupted")).toBeTruthy());
  expect(screen.getByRole("button", { name: `View Pinterest design: ${pin.title}` })).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Retry Pinterest" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "View Pinterest design: Blue nail art" })).toBeTruthy());
  expect(api).toHaveBeenLastCalledWith("/pinterest/inspiration?topic=all&cursor=next");
  expect(screen.getAllByRole("button", { name: /View Pinterest design/ })).toHaveLength(2);
});
test("a page with no additional matches explains the result and keeps its next-page cursor", async () => {
  jest.mocked(api).mockResolvedValueOnce(page).mockResolvedValueOnce({ ...page, records: [pin, { ...pin, id: "124", title: "Construction nail gun", description: "", alt_text: "" }], cursor: "another" });
  await render(<Harness />);
  await waitFor(() => expect(screen.getByText("From Pinterest · @nail.artist")).toBeTruthy());
  await fireEvent.press(screen.getByRole("button", { name: "Load more Pinterest" }));
  await waitFor(() => expect(screen.getByText("No additional looks match this selection. Try clearing filters or load the next page.")).toBeTruthy());
  expect(screen.getAllByRole("button", { name: /View Pinterest design/ })).toHaveLength(1);
  await fireEvent.press(screen.getByRole("button", { name: "Load more Pinterest" }));
  await waitFor(() => expect(api).toHaveBeenLastCalledWith("/pinterest/inspiration?topic=all&cursor=another"));
});
test("Halloween loads its own selection and removes the previous board's cards", async () => {
  await render(<Harness />);
  await waitFor(() => expect(screen.getByText("From Pinterest · @nail.artist")).toBeTruthy());
  jest.mocked(api).mockResolvedValue({ records: [{ ...pin, id: "456", title: "Halloween ghost nail art" }], cursor: null, topic: "halloween" });
  await fireEvent.press(screen.getByRole("button", { name: "Pinterest topic: Halloween" }));
  await waitFor(() => expect(screen.getByText("Halloween ghost nail art")).toBeTruthy());
  expect(screen.queryByText(pin.title!)).toBeNull();
  expect(api).toHaveBeenLastCalledWith("/pinterest/inspiration?topic=halloween");
});
test("detail is rechecked before display and opens only the original Pin link", async () => {
  await render(<Harness />);
  await waitFor(() => expect(screen.getByText("From Pinterest · @nail.artist")).toBeTruthy());
  await fireEvent.press(screen.getByRole("button", { name: /View Pinterest design/ }));
  await waitFor(() => expect(screen.getByRole("button", { name: "View on Pinterest" })).toBeTruthy());
  expect(api).toHaveBeenLastCalledWith("/pinterest/inspiration?topic=all&pin=ticket");
  await fireEvent.press(screen.getByRole("button", { name: "View on Pinterest" }));
  expect(Linking.openURL).toHaveBeenCalledWith(pin.pinUrl);
  await fireEvent.press(screen.getByRole("button", { name: "Close Pinterest design" }));
  expect(screen.queryByRole("button", { name: "View on Pinterest" })).toBeNull();
});
test("revoked or failed detail does not expose the stale card as accessible detail", async () => {
  await render(<Harness />);
  await waitFor(() => expect(screen.getByText("From Pinterest · @nail.artist")).toBeTruthy());
  jest.mocked(api).mockRejectedValue(new Error("This Pin is no longer available."));
  await fireEvent.press(screen.getByRole("button", { name: /View Pinterest design/ }));
  await waitFor(() => expect(screen.getByText("This Pin is no longer available.")).toBeTruthy());
  expect(screen.queryByRole("button", { name: "View on Pinterest" })).toBeNull();
});
test("late responses are discarded after an account change and after leaving the view", async () => {
  let finish!: (value: InspirationPage) => void;
  jest.mocked(api).mockReturnValueOnce(new Promise(resolve => { finish = resolve; })).mockRejectedValueOnce(new Error("Account is not approved for Pinterest."));
  const view = await render(<Harness />);
  await act(async () => { accountScope.change("stranger"); finish(page); });
  expect(screen.queryByText("From Pinterest · @nail.artist")).toBeNull();
  await view.rerender(<Harness active={false} />);
  expect(screen.queryByText("From Pinterest · @nail.artist")).toBeNull();
});
test("backgrounding clears transient records and does not poll on resume", async () => {
  const callbacks: ((state: string) => void)[] = [];
  const original = jest.mocked(AppState.addEventListener).getMockImplementation();
  const spy = jest.spyOn(AppState, "addEventListener").mockImplementation((event, callback) => {
    if (event === "change") callbacks.push(callback as (state: string) => void);
    return { remove: jest.fn() };
  });
  try {
    await render(<Harness />);
    await waitFor(() => expect(screen.getByText("From Pinterest · @nail.artist")).toBeTruthy());
    await act(async () => { callbacks.forEach(fn => fn("background")); });
    expect(screen.queryByText("From Pinterest · @nail.artist")).toBeNull();
    await act(async () => { callbacks.forEach(fn => fn("active")); });
    expect(api).toHaveBeenCalledTimes(1);
  } finally {
    spy.mockRestore();
    // Expo’s preset supplies a mock; mockRestore clears its original implementation.
    if (original) jest.mocked(AppState.addEventListener).mockImplementation(original);
  }
});
test("a minute pause disables requests until reset, then permits an explicit retry without polling", async () => {
  jest.useFakeTimers();
  try {
    const retryAt = new Date(Date.now() + 2000).toISOString();
    jest.mocked(api).mockRejectedValueOnce(new ApiError("LaQue’s short request limit was reached.", 429, "PINTEREST_BUDGET", retryAt));
    await render(<Harness />);
    await act(async () => { await Promise.resolve(); });
    const retry = screen.getByRole("button", { name: "Retry Pinterest" });
    expect(retry.props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText("Retry available in 0:02.")).toBeTruthy();
    await fireEvent.press(retry);
    await fireEvent.press(screen.getByRole("button", { name: "Pinterest topic: Halloween" }));
    expect(api).toHaveBeenCalledTimes(1);
    await act(async () => { jest.advanceTimersByTime(1000); });
    expect(screen.getByText("Retry available in 0:01.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry Pinterest" }).props.accessibilityState.disabled).toBe(true);
    expect(api).toHaveBeenCalledTimes(1);
    await act(async () => { jest.advanceTimersByTime(1001); });
    expect(screen.getByText(/The pause has ended/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry Pinterest" }).props.accessibilityState.disabled).toBe(false);
    expect(api).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole("button", { name: "Retry Pinterest" }));
    await act(async () => { await Promise.resolve(); });
    expect(api).toHaveBeenCalledTimes(2);
    expect(screen.getByText("From Pinterest · @nail.artist")).toBeTruthy();
  } finally { jest.useRealTimers(); }
});
test("old budget errors without reset metadata still offer a manual recovery action", async () => {
  jest.mocked(api).mockRejectedValueOnce(new ApiError("Pinterest requests are paused.", 429, "PINTEREST_BUDGET"));
  await render(<Harness />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Retry Pinterest" })).toBeTruthy());
  await fireEvent.press(screen.getByRole("button", { name: "Retry Pinterest" }));
  await waitFor(() => expect(screen.getByText("From Pinterest · @nail.artist")).toBeTruthy());
  expect(api).toHaveBeenCalledTimes(2);
});
