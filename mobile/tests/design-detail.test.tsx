import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react-native";
import * as Clipboard from "expo-clipboard";
import {
  DetailView,
  type DetailViewProps,
} from "../src/features/design-detail/detail-view";
import { cathedralDetail, previewDetail } from "../src/preview/design-detail";
import SearchDesignPreview from "../src/preview/search-main";
import HomeDesignPreview from "../src/preview/home-main";

jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn() }));
const props = (): DetailViewProps => ({
  design: cathedralDetail,
  width: 393,
  onRetry: jest.fn(),
  onBack: jest.fn(),
  onShare: jest.fn(),
  onSave: jest.fn(),
  onShowTech: jest.fn(),
  onNavigate: jest.fn(),
});

test("frame 36 includes every content section and independent save, share and tech actions", async () => {
  const p = props();
  await render(<DetailView {...p} />);
  for (const name of ["Cathedral", "Technique", "Colour Specs", "Tags"])
    expect(screen.getByRole("header", { name })).toBeTruthy();
  expect(screen.getByText("#architectural")).toBeTruthy();
  expect(screen.getByText("24 Review")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Save Cathedral" }));
  expect(p.onSave).toHaveBeenCalledTimes(1);
  expect(p.onShare).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Share design" }));
  await fireEvent.press(
    screen.getByRole("button", { name: "Share outside LaQue" }),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Share with my nail tech" }),
  );
  expect(p.onShare).toHaveBeenCalledTimes(1);
  expect(p.onShowTech).toHaveBeenCalledTimes(1);
});

test("gallery paging tracks swipes and page buttons without changing the selected design", async () => {
  await render(<DetailView {...props()} />);
  expect(
    screen.getByRole("button", { name: "Show image 2 of 3", selected: true }),
  ).toBeTruthy();
  await fireEvent.scroll(screen.getByTestId("design-gallery"), {
    nativeEvent: { contentOffset: { x: 690, y: 0 } },
  });
  expect(
    screen.getByRole("button", { name: "Show image 3 of 3", selected: true }),
  ).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", { name: "Show image 1 of 3" }),
  );
  expect(
    screen.getByRole("button", { name: "Show image 1 of 3", selected: true }),
  ).toBeTruthy();
  expect(screen.getByRole("header", { name: "Cathedral" })).toBeTruthy();
});

test("close-up opens the actual selected photograph and can be dismissed", async () => {
  await render(<DetailView {...props()} />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Enlarge close-up 3" }),
  );
  expect(screen.getByTestId("detail-photo-cross").props.source).toEqual([
    cathedralDetail.closeups[2].source,
  ]);
  await fireEvent.press(screen.getByRole("button", { name: "Close image" }));
  expect(screen.queryByRole("button", { name: "Close image" })).toBeNull();
});

test.each([true, false, "reject"])(
  "colour copy reports the real clipboard outcome: %s",
  async (result) => {
    jest.mocked(Clipboard.setStringAsync).mockReset();
    if (result === "reject")
      jest
        .mocked(Clipboard.setStringAsync)
        .mockRejectedValue(new Error("Denied"));
    else
      jest
        .mocked(Clipboard.setStringAsync)
        .mockResolvedValue(result as boolean);
    await render(<DetailView {...props()} />);
    await fireEvent.press(
      screen.getByRole("button", { name: "Copy colour code #D8D4CC" }),
    );
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith("#D8D4CC");
    if (result === true)
      await waitFor(() =>
        expect(screen.getByText("Copied #D8D4CC")).toBeTruthy(),
      );
    else
      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent(/Could not copy/),
      );
  },
);

test("pending saves are disabled and revoked access hides stale content", async () => {
  const p = props();
  const view = await render(<DetailView {...p} saving />);
  await fireEvent.press(screen.getByRole("button", { name: "Save Cathedral" }));
  expect(p.onSave).not.toHaveBeenCalled();
  await view.rerender(
    <DetailView {...p} error="This design is unavailable." />,
  );
  expect(screen.queryByRole("header", { name: "Cathedral" })).toBeNull();
  expect(screen.getByRole("button", { name: "Share design" })).toBeDisabled();
  await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
  expect(p.onRetry).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(p.onBack).toHaveBeenCalledTimes(1);
});

test("missing metadata never creates invented colours, reviews, close-ups or tags", async () => {
  const p = props();
  p.design = {
    ...cathedralDetail,
    photos: [],
    closeups: [],
    colours: [],
    tags: [],
    techniques: [],
    reviewCount: undefined,
  };
  await render(<DetailView {...p} width={320} />);
  expect(screen.getByText("No image available")).toBeTruthy();
  expect(screen.queryByText("24 Review")).toBeNull();
  expect(screen.queryByRole("header", { name: "Colour Specs" })).toBeNull();
  expect(screen.queryByRole("button", { name: /Show image/ })).toBeNull();
});

test("a failed image can retry without opening the full-screen viewer", async () => {
  await render(<DetailView {...props()} />);
  await fireEvent(screen.getByTestId("detail-photo-hero"), "error", {
    nativeEvent: { error: "Failed" },
  });
  await fireEvent.press(screen.getByRole("button", { name: "Retry image" }), {
    stopPropagation: jest.fn(),
  });
  expect(screen.getByTestId("detail-photo-hero")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Close image" })).toBeNull();
});

test("Search opens a design, saves it and returns without losing the query", async () => {
  await render(<SearchDesignPreview width={393} initialQuery="cathedral" />);
  await fireEvent.press(screen.getByRole("button", { name: "View Cathedral" }));
  expect(screen.getByRole("header", { name: "Colour Specs" })).toBeTruthy();
  await fireEvent.press(
    within(screen.getByTestId("design-detail-preview")).getByRole("button", {
      name: "Save Cathedral",
    }),
  );
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(screen.queryByTestId("design-detail-preview")).toBeNull();
  expect(
    screen.getByLabelText("Search designs, nail artists, salons"),
  ).toHaveDisplayValue("cathedral");
  expect(screen.getByRole("button", { name: "Unsave Cathedral" })).toBeTruthy();
});

test("other preview designs retain their own photo and title", () => {
  const d = previewDetail({
    id: "other",
    title: "Rose",
    image: "https://example.test/rose.jpg",
    attributes: ["Oval"],
  });
  expect(d.title).toBe("Rose");
  expect(d.photos[0].source).toBe("https://example.test/rose.jpg");
  expect(d.colours).toEqual([]);
});

test("revoked access also removes an already-open full-screen image", async () => {
  const p = props();
  const view = await render(<DetailView {...p} />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Enlarge close-up 3" }),
  );
  expect(screen.getByRole("button", { name: "Close image" })).toBeTruthy();
  await view.rerender(<DetailView {...p} error="Access revoked" />);
  expect(screen.queryByTestId("detail-photo-cross")).toBeNull();
  expect(screen.queryByRole("button", { name: "Close image" })).toBeNull();
});

test("Home designs open the same detail layout and return to the feed", async () => {
  await render(<HomeDesignPreview />);
  await fireEvent.press(
    screen.getAllByRole("button", { name: "View Cathedral" })[0],
  );
  expect(screen.getByRole("header", { name: "Cathedral" })).toBeTruthy();
  const detail = within(screen.getByTestId("design-detail-preview"));
  await fireEvent.press(detail.getByRole("button", { name: "Save Cathedral" }));
  await fireEvent.press(detail.getByRole("button", { name: "Back" }));
  expect(screen.queryByTestId("design-detail-preview")).toBeNull();
  expect(screen.getByRole("button", { name: "Unsave Cathedral" })).toBeTruthy();
});
