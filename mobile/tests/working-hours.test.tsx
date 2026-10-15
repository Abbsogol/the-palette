import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Schedule } from "../src/features/secondary/hours-form";
import { accountScope } from "../src/lib/account-scope";
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
const press = (name: string) =>
  fireEvent.press(screen.getByRole("button", { name }));
afterEach(() => accountScope.change(null));
test("equal wall times are rejected even if the stored closing time includes seconds", async () => {
  const save = jest.fn();
  await render(
    <Schedule
      zone="Asia/Dubai"
      initial={[
        {
          day_of_week: 1,
          start_time: "09:00",
          end_time: "09:00:00",
          is_active: true,
        },
      ]}
      onSave={save}
    />,
  );
  await press("Save working hours");
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByText(/Check Monday/)).toBeTruthy();
});
test("time selection can be cancelled or confirmed; saved records contain all seven days", async () => {
  const save = jest.fn();
  await render(<Schedule initial={[]} zone="Asia/Dubai" onSave={save} />);
  await press("Monday opens, 09:00");
  await press("Hour 10");
  await press("Minute 15");
  await press("Cancel time selection");
  expect(
    screen.getByRole("button", { name: "Monday opens, 09:00" }),
  ).toBeTruthy();
  await press("Monday opens, 09:00");
  await press("Hour 10");
  await press("Minute 15");
  await press("Use time");
  await press("Save working hours");
  expect(save).toHaveBeenCalledWith(
    "Asia/Dubai",
    expect.arrayContaining([
      expect.objectContaining({
        day_of_week: 1,
        start_time: "10:15",
        end_time: "18:00",
      }),
    ]),
  );
  expect(save.mock.calls[0][1]).toHaveLength(7);
  expect(screen.getByText(/Working hours saved/)).toBeTruthy();
  expect(screen.queryByText("Unsaved changes")).toBeNull();
});
test("closing at midnight selects 24:00 without allowing a nonzero minute", async () => {
  const save = jest.fn();
  await render(<Schedule initial={[]} zone="Asia/Dubai" onSave={save} />);
  await press("Monday closes, 18:00");
  await press("Hour 24");
  expect(screen.queryByRole("button", { name: "Minute 15" })).toBeNull();
  await press("Use time");
  await press("Save working hours");
  expect(save).toHaveBeenCalledWith(
    "Asia/Dubai",
    expect.arrayContaining([
      expect.objectContaining({ day_of_week: 1, end_time: "24:00" }),
    ]),
  );
});
test("closing and reopening a day retains its selected times", async () => {
  await render(<Schedule initial={[]} zone="Asia/Dubai" onSave={jest.fn()} />);
  await press("Monday opens, 09:00");
  await press("Hour 10");
  await press("Use time");
  await fireEvent(screen.getByLabelText("Monday open"), "valueChange", false);
  expect(
    screen.queryByRole("button", { name: "Monday opens, 10:00" }),
  ).toBeNull();
  await fireEvent(screen.getByLabelText("Monday open"), "valueChange", true);
  expect(
    screen.getByRole("button", { name: "Monday opens, 10:00" }),
  ).toBeTruthy();
});
test("invalid time zone stays inside selection sheet; valid custom search closes it", async () => {
  const save = jest.fn();
  await render(<Schedule initial={[]} zone="Asia/Dubai" onSave={save} />);
  await press("Change time zone");
  await fireEvent.changeText(
    screen.getByLabelText("Find IANA time zone"),
    "Mars/Olympus",
  );
  await press("Use Mars/Olympus");
  expect(screen.getByText(/Enter a valid IANA/)).toBeTruthy();
  await fireEvent.changeText(
    screen.getByLabelText("Find IANA time zone"),
    "Europe/London",
  );
  await press("Use Europe/London");
  expect(screen.queryByLabelText("Find IANA time zone")).toBeNull();
  await press("Save working hours");
  expect(save.mock.calls[0][0]).toBe("Europe/London");
});
test("invalid saved zone blocks submission", async () => {
  const save = jest.fn();
  await render(<Schedule initial={[]} zone="Invalid/Zone" onSave={save} />);
  await press("Save working hours");
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByText("Choose your local time zone.")).toBeTruthy();
});
test("offline save retains edits and a refetch does not overwrite the draft", async () => {
  const save = jest
    .fn()
    .mockRejectedValueOnce(new Error("Offline"))
    .mockResolvedValue(undefined);
  const view = await render(
    <Schedule initial={[]} zone="Asia/Dubai" onSave={save} />,
  );
  await press("Monday opens, 09:00");
  await press("Hour 10");
  await press("Use time");
  await press("Save working hours");
  expect(screen.getByText("Offline")).toBeTruthy();
  await view.rerender(<Schedule initial={[]} zone="UTC" onSave={save} />);
  expect(
    screen.getByRole("button", { name: "Monday opens, 10:00" }),
  ).toBeTruthy();
  await press("Save working hours");
  expect(save.mock.calls[1]).toEqual(save.mock.calls[0]);
});
test("pending submission disables edits and double taps do not submit twice", async () => {
  let release!: () => void;
  const save = jest.fn(
    () =>
      new Promise<void>((r) => {
        release = r;
      }),
  );
  await render(<Schedule initial={[]} zone="Asia/Dubai" onSave={save} />);
  await press("Save working hours");
  await press("Save working hours");
  expect(save).toHaveBeenCalledTimes(1);
  expect(
    screen.getByRole("button", { name: "Monday opens, 09:00" }),
  ).toBeDisabled();
  expect(screen.getByLabelText("Monday open")).toBeDisabled();
  await act(() => release());
});
test("late save does not show success for another account", async () => {
  accountScope.change("first", true);
  let release!: () => void;
  await render(
    <Schedule
      initial={[]}
      zone="Asia/Dubai"
      onSave={() =>
        new Promise<void>((r) => {
          release = r;
        })
      }
    />,
  );
  await press("Save working hours");
  accountScope.change("second");
  await act(() => release());
  expect(screen.queryByText(/Working hours saved/)).toBeNull();
});
test("conflict feedback keeps the draft available for retry", async () => {
  const error = Object.assign(new Error("CONFLICT"), { status: 409 });
  await render(
    <Schedule
      initial={[]}
      zone="Asia/Dubai"
      onSave={jest.fn().mockRejectedValue(error)}
    />,
  );
  await press("Save working hours");
  expect(
    screen.getByText(/Review your appointments and try again/),
  ).toBeTruthy();
});
test("all closed days explicitly warn that new bookings are unavailable", async () => {
  const save = jest.fn();
  await render(
    <Schedule
      zone="UTC"
      onSave={save}
      initial={Array.from({ length: 7 }, (_, day_of_week) => ({
        day_of_week,
        start_time: "09:00",
        end_time: "18:00",
        is_active: false,
      }))}
    />,
  );
  expect(screen.getByText(/All days are closed/)).toBeTruthy();
  await press("Save working hours");
  expect(
    save.mock.calls[0][1].every((d: { is_active: boolean }) => !d.is_active),
  ).toBe(true);
});
test("closed days send valid placeholders even when their old editable range was inverted", async () => {
  const save = jest.fn();
  await render(
    <Schedule
      zone="Asia/Dubai"
      initial={[
        {
          day_of_week: 1,
          start_time: "20:00",
          end_time: "09:00",
          is_active: false,
        },
      ]}
      onSave={save}
    />,
  );
  await press("Save working hours");
  expect(save).toHaveBeenCalledWith(
    "Asia/Dubai",
    expect.arrayContaining([
      expect.objectContaining({
        day_of_week: 1,
        is_active: false,
        start_time: "09:00",
        end_time: "18:00",
      }),
    ]),
  );
});
