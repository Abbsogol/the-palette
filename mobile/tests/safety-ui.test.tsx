import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { ReportView } from "../src/features/safety/report-view";
import { PrivacyView } from "../src/features/secondary/privacy-view";
import { DeleteView } from "../src/features/secondary/delete-view";
import { accountScope } from "../src/lib/account-scope";
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
const target = {
  type: "profile" as const,
  id: "00000000-0000-4000-8000-000000000001",
};
const press = (name: string | RegExp) =>
  fireEvent.press(screen.getByRole("button", { name }));
beforeEach(() => accountScope.change("owner", true));
afterEach(() => accountScope.change(null));
test("invalid targets are explained without a submission action", async () => {
  const submit = jest.fn();
  await render(
    <ReportView target={null} onClose={jest.fn()} onSubmit={submit} />,
  );
  expect(screen.getByText("This report link is unavailable")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Submit report" })).toBeNull();
});
test("reports require a reason and Other requires useful details; confirmation follows server success", async () => {
  const submit = jest.fn().mockResolvedValue(undefined),
    close = jest.fn();
  await render(
    <ReportView target={target} onClose={close} onSubmit={submit} />,
  );
  expect(screen.getByRole("button", { name: "Submit report" })).toBeDisabled();
  await press("Other");
  expect(screen.getByRole("button", { name: "Submit report" })).toBeDisabled();
  await fireEvent.changeText(
    screen.getByLabelText("What happened?"),
    "Repeated abusive messages",
  );
  await press("Submit report");
  expect(submit).toHaveBeenCalledWith("Other: Repeated abusive messages");
  expect(screen.getByText("Report received")).toBeTruthy();
  expect(screen.getByText(/Reporting doesn’t block/)).toBeTruthy();
  await press("Done");
  expect(close).toHaveBeenCalledTimes(1);
});
test("failed reports preserve the selected reason and details for a deliberate retry", async () => {
  const submit = jest
    .fn()
    .mockRejectedValueOnce(new Error("Offline"))
    .mockResolvedValue(undefined);
  await render(
    <ReportView target={target} onClose={jest.fn()} onSubmit={submit} />,
  );
  await press("Other");
  await fireEvent.changeText(
    screen.getByLabelText("What happened?"),
    "Relevant details",
  );
  await press("Submit report");
  expect(screen.getByText("Offline")).toBeTruthy();
  expect(screen.getByLabelText("What happened?").props.value).toBe(
    "Relevant details",
  );
  expect(screen.queryByText("Report received")).toBeNull();
  await press("Submit report");
  expect(submit).toHaveBeenCalledTimes(2);
});
test("duplicate report taps send once and a late account result cannot show confirmation", async () => {
  let done!: () => void;
  const submit = jest.fn(
    () =>
      new Promise<void>((r) => {
        done = r;
      }),
  );
  await render(
    <ReportView target={target} onClose={jest.fn()} onSubmit={submit} />,
  );
  await press("Spam or scam");
  await press("Submit report");
  await press("Submit report");
  expect(submit).toHaveBeenCalledTimes(1);
  accountScope.change("other");
  await act(async () => done());
  expect(screen.queryByText("Report received")).toBeNull();
});
test("blocked identities show names and @IDs, support search and confirm before unblocking", async () => {
  const unblock = jest.fn().mockResolvedValue(true);
  await render(
    <PrivacyView
      settings={{
        is_private: false,
        message_permission: "everyone",
        show_saves: false,
      }}
      blocks={[
        {
          id: "private-block-id",
          name: "Sarah M.",
          username: "sarah.nails",
          avatar: "https://example.invalid/avatar.png",
        },
        { id: "unknown-block-id", name: "Unavailable account" },
      ]}
      onUpdate={jest.fn()}
      onUnblock={unblock}
      onDelete={jest.fn()}
      onPolicy={jest.fn()}
    />,
  );
  expect(screen.getByText("@sarah.nails")).toBeTruthy();
  expect(screen.queryByText("private-block-id")).toBeNull();
  await fireEvent.changeText(
    screen.getByLabelText("Search blocked accounts"),
    "@sarah",
  );
  expect(screen.queryByText("Unavailable account")).toBeNull();
  await press("Review unblocking Sarah M., @sarah.nails");
  expect(unblock).not.toHaveBeenCalled();
  await press("Unblock");
  expect(unblock).toHaveBeenCalledWith("private-block-id");
});
test("failed unblock feedback stays in the confirmation sheet", async () => {
  await render(
    <PrivacyView
      settings={{
        is_private: true,
        message_permission: "none",
        show_saves: false,
      }}
      blocks={[{ id: "b", name: "Sarah" }]}
      onUpdate={jest.fn()}
      onUnblock={async () => false}
      onDelete={jest.fn()}
      onPolicy={jest.fn()}
    />,
  );
  await press("Review unblocking Sarah");
  await press("Unblock");
  expect(screen.getByText(/Couldn’t unblock this account/)).toBeTruthy();
  expect(screen.getByText("Unblock account?")).toBeTruthy();
});
test("deletion explains continuing refunds and exposes existing resolution routes without pretending they block closure", async () => {
  const appointments = jest.fn(),
    credits = jest.fn();
  await render(
    <DeleteView
      onDelete={async () => {}}
      onPolicy={jest.fn()}
      onDone={jest.fn()}
      onAppointments={appointments}
      onCredits={credits}
    />,
  );
  expect(screen.getByText(/You don’t need to wait for a refund/)).toBeTruthy();
  await fireEvent.press(screen.getByText("Review appointments & deposit refunds"));
  await fireEvent.press(screen.getByText("Review Lab credit purchases"));
  expect(appointments).toHaveBeenCalledTimes(1);
  expect(credits).toHaveBeenCalledTimes(1);
});
