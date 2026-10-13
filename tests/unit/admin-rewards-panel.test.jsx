// @vitest-environment jsdom
import { it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import RewardsPanel from "@/app/admin/rewards";
afterEach(cleanup);
const data = {
  items: [],
  page: 0,
  hasMore: false,
  enabled: false,
  countryCodes: ["IN", "TR"],
};
it("admin drafts have country targeting and never enable prizes from the browser", () => {
  const action = vi.fn();
  render(
    <RewardsPanel
      section="rewards"
      data={data}
      request={vi.fn()}
      action={action}
      owner
    />,
  );
  expect(screen.getByText(/Prize competitions are inactive/)).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Create competition" }));
  expect(screen.getByLabelText("Audience")).toBeDefined();
  expect(screen.getByLabelText("Official rules")).toBeDefined();
  expect(screen.queryByRole("button", { name: /Activate/ })).toBeNull();
  expect(action).not.toHaveBeenCalled();
});
it("moderators can inspect all regional drafts but cannot record Owner review or publish an inactive competition", async () => {
  const record = {
    id: "round",
    version: 1,
    status: "draft",
    title: "India challenge",
    theme: "Minimal",
    description: "Local designers",
    prize_label: "$2,000",
    country_codes: ["IN"],
    winner_count: 3,
    rules: "Published official rules",
  };
  render(
    <RewardsPanel
      section="rewards"
      data={{ ...data, items: [record] }}
      request={vi
        .fn()
        .mockResolvedValue({ record, entries: [], results: [], page: 0 })}
      action={vi.fn()}
      owner={false}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Inspect / preview" }));
  await waitFor(() => expect(screen.getByText("Official rules")).toBeDefined());
  expect(
    screen.queryByRole("button", { name: "Record review evidence" }),
  ).toBeNull();
  expect(screen.getByRole("button", { name: "Publish" }).disabled).toBe(true);
  expect(screen.getByText(/Audience: India/)).toBeDefined();
});
it("official News is separate from Community and exposes the assigned-admin drafting form", () => {
  render(
    <RewardsPanel
      section="updates"
      data={data}
      request={vi.fn()}
      action={vi.fn()}
      owner={false}
    />,
  );
  expect(screen.getByText(/Official news is published only/)).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Create update" }));
  expect(screen.getByLabelText("Update text")).toBeDefined();
  expect(screen.queryByLabelText("Prize type")).toBeNull();
});
