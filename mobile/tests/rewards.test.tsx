import { fireEvent, render, screen } from "@testing-library/react-native";
import { UpdatesHubView } from "../src/features/rewards/updates-hub";
import { RewardRoundView } from "../src/features/rewards/round-view";
import { protectedReturnPath, safeReturnPath } from "../src/lib/links";
import type { RewardDetail } from "../src/features/rewards/types";
jest.mock("../src/lib/auth", () => ({ useAccountQuery: jest.fn() }));
jest.mock("../src/lib/api", () => ({ api: jest.fn() }));
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
const detail: RewardDetail = {
  campaign: {
    id: "round",
    title: "Minimal challenge",
    theme: "Minimal",
    description: "Support freelance designers",
    prize_type: "cash",
    prize_label: "$2,000",
    country_codes: ["IN"],
    opens_at: "2020-01-01T00:00:00Z",
    entries_close_at: "2030-01-01T00:00:00Z",
    votes_close_at: "2030-01-02T00:00:00Z",
    award_at: "2030-01-03T00:00:00Z",
    status: "published",
    version: 3,
    winner_count: 1,
    rules: "Official rules for this competition",
  },
  items: [
    {
      id: "entry",
      design_id: "design",
      user_id: "artist",
      display_name: "Mira",
      username: "mira",
      snapshot: {
        title: "Rose",
        image_url: null,
        shape: "Almond",
        length: "Medium",
        category: "Minimal",
      },
      votes: 8,
      liked: false,
      rank: null,
      final_votes: null,
      created_at: "2026-10-09T00:00:00Z",
    },
  ],
  ownItems: [],
  candidates: [
    {
      id: "own-design",
      title: "My Rose",
      image_url: null,
      shape: "Almond",
      length: "Medium",
    },
  ],
  myEntries: [],
  country: "IN",
  enabled: true,
  verified: true,
  profileComplete: true,
  subscription: { active: true, needsReview: false },
};
const handlers = () => ({
  onRetry: jest.fn(),
  onSubmit: jest.fn(async () => true),
  onVote: jest.fn(),
  onShare: jest.fn(),
  onDesign: jest.fn(),
  onProfile: jest.fn(),
  onProfileEdit: jest.fn(),
  onBilling: jest.fn(),
  onLab: jest.fn(),
});
test("Updates has News and Rewards, without a member publishing action", async () => {
  const onCampaign = jest.fn();
  await render(
    <UpdatesHubView
      news={[
        { id: "official", title: "LaQue news", body: "Admin-managed update" },
      ]}
      rewards={{
        items: [detail.campaign],
        winners: [],
        country: "IN",
        enabled: true,
      }}
      onRetry={jest.fn()}
      onCampaign={onCampaign}
      onProfile={jest.fn()}
      onCountry={jest.fn()}
      onNotifications={jest.fn()}
    />,
  );
  expect(screen.getByText("Admin-managed update")).toBeTruthy();
  expect(screen.queryByText("Create update")).toBeNull();
  await fireEvent.press(screen.getByRole("tab", { name: "Rewards" }));
  expect(screen.getByText("Minimal challenge")).toBeTruthy();
  expect(screen.queryByText("Admin-managed update")).toBeNull();
  await fireEvent.press(
    screen.getByRole("button", { name: "View competition" }),
  );
  expect(onCampaign).toHaveBeenCalledWith("round");
});
test("entry submission requires selecting a design and explicit rules acceptance", async () => {
  const h = handlers();
  await render(<RewardRoundView data={detail} {...h} />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Choose designs · 3 entries left" }),
  );
  await fireEvent.press(
    screen.getByRole("checkbox", { name: "Select My Rose" }),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Review 1 selected design" }),
  );
  expect(
    screen.getByRole("button", { name: "Submit competition entries" }),
  ).toBeDisabled();
  expect(h.onSubmit).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("checkbox", { name: /I accept/ }));
  await fireEvent.press(
    screen.getByRole("button", { name: "Submit competition entries" }),
  );
  expect(h.onSubmit).toHaveBeenCalledWith(["own-design"]);
});
test("a non-subscriber can vote but cannot submit; designs open their existing detail screen", async () => {
  const h = handlers();
  await render(
    <RewardRoundView
      data={{ ...detail, subscription: { active: false, needsReview: false } }}
      {...h}
    />,
  );
  expect(
    screen.getByRole("button", { name: "Choose designs · 3 entries left" }),
  ).toBeDisabled();
  await fireEvent.press(screen.getByRole("button", { name: "♡ Vote" }));
  expect(h.onVote).toHaveBeenCalledWith(detail.items[0]);
  await fireEvent.press(
    screen.getByRole("button", { name: "Open design Rose" }),
  );
  expect(h.onDesign).toHaveBeenCalledWith("design");
});
test("paused rounds disable participation and three slots stay consumed after disqualification", async () => {
  const h = handlers();
  await render(
    <RewardRoundView
      data={{
        ...detail,
        campaign: { ...detail.campaign, status: "paused" },
        myEntries: [
          { id: "a", designId: null, disqualified: true },
          { id: "b", designId: null, disqualified: false },
          { id: "c", designId: null, disqualified: false },
        ],
      }}
      {...h}
    />,
  );
  expect(screen.queryByText(/Choose designs/)).toBeNull();
  expect(screen.getByRole("button", { name: "♡ Vote" })).toBeDisabled();
  expect(screen.getByText(/This round is paused/)).toBeTruthy();
});
test("shared competition links preserve the entry through authentication", () => {
  const id = "00000000-0000-4000-8000-000000000901",
    entry = "00000000-0000-4000-8000-000000000902";
  expect(protectedReturnPath("/rewards/" + id, { entry })).toBe(
    "/rewards/" + id + "?entry=" + entry,
  );
  expect(safeReturnPath("/rewards/" + id + "?entry=" + entry)).toBe(
    "/rewards/" + id + "?entry=" + entry,
  );
  expect(
    protectedReturnPath("/rewards/" + id, { entry: "//evil.invalid" }),
  ).toBe("/rewards/" + id);
});
