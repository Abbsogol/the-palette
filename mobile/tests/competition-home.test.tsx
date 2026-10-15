import { fireEvent, render, screen } from "@testing-library/react-native";
import {
  CompetitionGalleryView,
  canVoteFromHome,
} from "../src/features/rewards/home-gallery";
import type { HomeEntry } from "../src/features/rewards/types";
import HomeDesignPreview from "../src/preview/home-main";
jest.mock("../src/lib/auth", () => ({ useAccountQuery: jest.fn() }));
jest.mock("../src/lib/api", () => ({ api: jest.fn() }));
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
const entry: HomeEntry = {
  id: "entry",
  design_id: "design",
  user_id: "artist",
  display_name: "Mira",
  username: "mira",
  snapshot: {
    title: "Rose",
    image_url: null,
    shape: "Almond",
    length: "Long",
    category: "Minimal",
  },
  votes: 12,
  liked: false,
  rank: null,
  final_votes: null,
  created_at: "2026-10-01T00:00:00Z",
  campaign: {
    id: "round",
    title: "Minimal challenge",
    prize_label: "Products",
    status: "published",
    opens_at: "2020-01-01T00:00:00Z",
    votes_close_at: "2030-01-01T00:00:00Z",
  },
};
const handlers = () => ({
  onRetry: jest.fn(),
  onVote: jest.fn(),
  onDesign: jest.fn(),
  onCompetition: jest.fn(),
  onAll: jest.fn(),
});
test("Home supports direct competition voting and opens the existing design and round identities", async () => {
  const h = handlers();
  await render(
    <CompetitionGalleryView items={[entry]} enabled userId="viewer" {...h} />,
  );
  await fireEvent.press(screen.getByRole("button", { name: "Vote for Rose" }));
  expect(h.onVote).toHaveBeenCalledWith(entry);
  await fireEvent.press(
    screen.getByRole("button", { name: "View competition design Rose" }),
  );
  expect(h.onDesign).toHaveBeenCalledWith("design");
  await fireEvent.press(
    screen.getByRole("button", { name: "View competition Minimal challenge" }),
  );
  expect(h.onCompetition).toHaveBeenCalledWith("round");
});
test("self-votes, paused/results/expired rounds and inactive prize gates stay disabled on Home", () => {
  expect(canVoteFromHome(entry, "artist", true)).toBe(false);
  expect(canVoteFromHome(entry, "viewer", false)).toBe(false);
  expect(
    canVoteFromHome(
      { ...entry, campaign: { ...entry.campaign, status: "paused" } },
      "viewer",
      true,
    ),
  ).toBe(false);
  expect(canVoteFromHome(entry, "viewer", true, Date.parse("2031-01-01"))).toBe(
    false,
  );
});
test("Home source selection swaps content without irrelevant LaQue sorts or duplicate feeds", async () => {
  await render(<HomeDesignPreview />);
  await fireEvent.press(screen.getByRole("tab", { name: "Home Competition" }));
  expect(screen.queryByRole("button", { name: "Sort: Most saved" })).toBeNull();
  expect(
    screen.getByRole("button", {
      name: "View competition design Rosewood Bride",
    }),
  ).toBeTruthy();
  expect(screen.queryByRole("header", { name: "TRENDING" })).toBeNull();
  await fireEvent.press(screen.getByRole("tab", { name: "Home Pinterest" }));
  expect(screen.getByText("Pinterest inspiration")).toBeTruthy();
  expect(screen.queryByText("Competition designs")).toBeNull();
  await fireEvent.press(screen.getByRole("tab", { name: "Home LaQue" }));
  expect(
    screen.getByRole("header", { name: "Competition designs" }),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Sort: Most saved" })).toBeTruthy();
});
test("a submitted preview entry appears on Home automatically and stays submitted after leaving the round", async () => {
  await render(<HomeDesignPreview />);
  await fireEvent.press(screen.getByRole("tab", { name: "Home Competition" }));
  await fireEvent.press(
    screen.getAllByRole("button", {
      name: "View competition The independent designer edit",
    })[0],
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Choose designs · 3 entries left" }),
  );
  await fireEvent.press(
    screen.getByRole("checkbox", { name: "Select My minimal rose" }),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Review 1 selected design" }),
  );
  await fireEvent.press(screen.getByRole("checkbox", { name: /I accept/ }));
  await fireEvent.press(
    screen.getByRole("button", { name: "Submit competition entries" }),
  );
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  await fireEvent.press(screen.getByRole("tab", { name: "Explore" }));
  expect(
    screen.getByRole("button", {
      name: "View competition design My minimal rose",
    }),
  ).toBeTruthy();
  await fireEvent.press(
    screen.getAllByRole("button", {
      name: "View competition The independent designer edit",
    })[0],
  );
  expect(
    screen.getByRole("button", { name: "Choose designs · 2 entries left" }),
  ).toBeTruthy();
});
