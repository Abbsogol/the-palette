import { fireEvent, render, screen } from "@testing-library/react-native";
import {
  creatorSetup,
  type SetupRecords,
} from "../src/features/creator-setup/model";
import { BusinessView } from "../src/features/secondary/business-view";
const profile = {
  display_name: "Kim",
  username: "kim.nails",
  location: "Dubai",
  booking_area: "Studio 1, Dubai",
  onboarding_complete: true,
  account_type: "creator" as const,
};
const records: SetupRecords = {
  timeZone: "Asia/Dubai",
  publishedDesigns: 1,
  days: [
    {
      day_of_week: 1,
      start_time: "09:00:00",
      end_time: "18:00:00",
      is_active: true,
    },
  ],
  services: [
    {
      id: "service",
      creator_id: "kim",
      name: "Gel manicure",
      description: null,
      price: 100,
      deposit_amount: 25,
      duration_minutes: 60,
      is_active: true,
    },
  ],
};
test("the checklist directs creators to the first missing step and updates after saved changes", () => {
  let s = creatorSetup(
    { ...profile, booking_area: "" },
    { ...records, services: [], days: [], publishedDesigns: 0 },
  );
  expect(s.completed).toBe(0);
  expect(s.next?.id).toBe("profile-edit");
  expect(s.ready).toBe(false);
  s = creatorSetup(profile, {
    ...records,
    services: [],
    days: [],
    publishedDesigns: 0,
  });
  expect(s.next?.id).toBe("services");
  s = creatorSetup(profile, { ...records, days: [], publishedDesigns: 0 });
  expect(s.next?.id).toBe("availability");
  s = creatorSetup(profile, { ...records, publishedDesigns: 0 });
  expect(s.next?.id).toBe("portfolio");
  expect(creatorSetup(profile, records)).toMatchObject({
    completed: 4,
    ready: true,
    next: null,
  });
});
test.each([
  { ...records, timeZone: null },
  { ...records, timeZone: "Invalid/City" },
  { ...records, days: records.days.map((d) => ({ ...d, is_active: false })) },
  { ...records, days: records.days.map((d) => ({ ...d, end_time: "09:30" })) },
  {
    ...records,
    days: records.days.map((d) => ({
      ...d,
      start_time: "18:00",
      end_time: "09:00",
    })),
  },
  {
    ...records,
    services: records.services.map((s) => ({ ...s, is_active: false })),
  },
  {
    ...records,
    services: records.services.map((s) => ({ ...s, deposit_amount: 101 })),
  },
  { ...records, publishedDesigns: 0 },
])("missing or unusable booking configuration never shows ready", (r) => {
  expect(creatorSetup(profile, r).ready).toBe(false);
});
test("working hours ending at midnight can fit a service", () => {
  expect(
    creatorSetup(profile, {
      ...records,
      days: [
        {
          day_of_week: 1,
          start_time: "23:00",
          end_time: "24:00:00",
          is_active: true,
        },
      ],
    }).ready,
  ).toBe(true);
});
test("customers cannot become ready from pre-existing records", () => {
  expect(
    creatorSetup({ ...profile, account_type: "user" }, records).ready,
  ).toBe(false);
});
test("Continue setup opens the next incomplete tool and complete steps stay editable", async () => {
  const open = jest.fn(),
    setup = creatorSetup(profile, { ...records, days: [] });
  await render(<BusinessView creator setup={setup} onOpen={open} />);
  await fireEvent.press(screen.getByRole("button", { name: "Continue setup" }));
  expect(open).toHaveBeenLastCalledWith("availability");
  await fireEvent.press(
    screen.getByRole("button", { name: /01.*Profile & service location/ }),
  );
  expect(open).toHaveBeenLastCalledWith("profile-edit");
});
test("a refresh or read failure suppresses cached ready state and offers retry", async () => {
  const retry = jest.fn();
  await render(
    <BusinessView
      creator
      setup={creatorSetup(profile, records)}
      checkError="Could not check"
      onRefresh={retry}
      onOpen={jest.fn()}
    />,
  );
  expect(screen.queryByText("READY TO TAKE BOOKINGS")).toBeNull();
  await fireEvent.press(
    screen.getByRole("button", { name: "Retry setup check" }),
  );
  expect(retry).toHaveBeenCalledTimes(1);
});
test("activation remains explicit and locks creator-only tools", async () => {
  const start = jest.fn(),
    open = jest.fn();
  await render(<BusinessView creator={false} onStart={start} onOpen={open} />);
  await fireEvent.press(screen.getByRole("button", { name: /02.*Services/ }));
  expect(open).not.toHaveBeenCalled();
  expect(start).not.toHaveBeenCalled();
  await fireEvent.press(
    screen.getByRole("button", { name: "Set up my creator account" }),
  );
  expect(start).toHaveBeenCalledTimes(1);
});
test("ready state links to requests and explains availability still controls slots", async () => {
  const open = jest.fn();
  await render(
    <BusinessView
      creator
      setup={creatorSetup(profile, records)}
      onOpen={open}
    />,
  );
  expect(screen.getByText("READY TO TAKE BOOKINGS")).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", { name: "View appointment requests" }),
  );
  expect(open).toHaveBeenLastCalledWith("appointments");
});
