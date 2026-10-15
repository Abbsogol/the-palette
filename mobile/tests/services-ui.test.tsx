import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { ServiceManager } from "../src/features/secondary/service-manager";
import { ServiceForm } from "../src/features/secondary/service-form";
import {
  ServicePricing,
  parseServiceAmount,
} from "../src/features/secondary/service-pricing";
import { useDraftExit } from "../src/features/secondary/profile-exit";
import { accountScope } from "../src/lib/account-scope";
import type { Service } from "../src/lib/types";
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
const service: Service = {
  id: "service",
  creator_id: "owner",
  name: "Gel manicure",
  description: "Includes chrome finish",
  duration_minutes: 60,
  price: 125,
  deposit_amount: 25,
  is_active: true,
};
function Menu({
  initial = [service],
  save = jest.fn(),
  visibility = jest.fn(),
}: {
  initial?: Service[];
  save?: jest.Mock;
  visibility?: jest.Mock;
}) {
  const [rows, setRows] = useState(initial);
  const exit = useDraftExit("Unsaved service changes");
  return (
    <>
      <ServiceManager
        services={rows}
        requestExit={exit.requestExit}
        onStatusChange={exit.onStatusChange}
        onSave={async (draft, previous, id) => {
          await save(draft, previous, id);
          setRows((v) =>
            previous
              ? v.map((r) => (r.id === previous.id ? { ...r, ...draft } : r))
              : [...v, { ...draft, id, creator_id: "owner", is_active: true }],
          );
        }}
        onVisibility={async (row, active) => {
          await visibility(row, active);
          setRows((v) =>
            v.map((r) => (r.id === row.id ? { ...r, is_active: active } : r)),
          );
        }}
      />
      {exit.dialog}
    </>
  );
}
const press = (name: string) =>
  fireEvent.press(screen.getByRole("button", { name }));
afterEach(() => accountScope.change(null));
test("deposit and balance are distinct parts of the fixed total", async () => {
  await render(<ServicePricing price={125.5} deposit={25.25} />);
  expect(screen.getByText("AED 125.50")).toBeTruthy();
  expect(screen.getByText("AED 25.25")).toBeTruthy();
  expect(screen.getByText("AED 100.25")).toBeTruthy();
});
test.each(["1.005", "1e2", "0x10", "", "-1", "NaN", "Infinity"])(
  "does not silently round or accept non-currency %s",
  (value) => {
    expect(parseServiceAmount(value)).toBeNull();
  },
);
test.each([0, 125])(
  "explains the payment terms when deposit is %s",
  async (deposit) => {
    await render(<ServicePricing price={125} deposit={deposit} />);
    expect(
      screen.getByText(
        deposit ? /Nothing remains to pay/ : /No deposit required/,
      ),
    ).toBeTruthy();
  },
);
test("save rejects extra decimal places, retains an offline draft and retries the same create ID", async () => {
  const save = jest
    .fn()
    .mockRejectedValueOnce(new Error("Offline"))
    .mockResolvedValue(undefined);
  await render(<Menu initial={[]} save={save} />);
  await press("Add a service");
  await fireEvent.changeText(screen.getByLabelText("Service name"), "New gel");
  await fireEvent.changeText(
    screen.getByLabelText("Total price (AED)"),
    "100.005",
  );
  await press("Save service");
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByText(/Enter a total price/)).toBeTruthy();
  await fireEvent.changeText(
    screen.getByLabelText("Total price (AED)"),
    "100.50",
  );
  await press("Save service");
  expect(screen.getByText("Offline")).toBeTruthy();
  expect(screen.getByLabelText("Service name").props.value).toBe("New gel");
  await press("Save service");
  expect(save.mock.calls[0][2]).toBe(save.mock.calls[1][2]);
  expect(screen.getByText("Service added to your booking menu.")).toBeTruthy();
});
test("hide is confirmed, can be cancelled, and a failed restore stays open for retry", async () => {
  const visibility = jest
    .fn()
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error("Offline"))
    .mockResolvedValueOnce(undefined);
  await render(<Menu visibility={visibility} />);
  await press("Hide from booking menu");
  expect(visibility).not.toHaveBeenCalled();
  await press("Keep current visibility");
  expect(screen.getByText("AVAILABLE TO BOOK")).toBeTruthy();
  await press("Hide from booking menu");
  await press("Confirm hide");
  expect(visibility).toHaveBeenLastCalledWith(service, false);
  await press("Hidden");
  expect(screen.getByText("HIDDEN FROM BOOKING")).toBeTruthy();
  await press("Show in booking menu");
  await press("Confirm show");
  expect(screen.getByText("Offline")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Confirm show" })).toBeTruthy();
  await press("Confirm show");
  expect(screen.getByText("Service is available to book again.")).toBeTruthy();
  await press("Available");
  expect(screen.getByText("AVAILABLE TO BOOK")).toBeTruthy();
});
test("editing a hidden service preserves visibility and guards unsaved cancellation", async () => {
  const save = jest.fn();
  await render(
    <Menu initial={[{ ...service, is_active: false }]} save={save} />,
  );
  await press("Edit Gel manicure");
  expect(screen.getByText(/Saving changes keeps it hidden/)).toBeTruthy();
  await fireEvent.changeText(
    screen.getByLabelText("Service name"),
    "Updated gel",
  );
  await press("Cancel editing");
  expect(screen.getByText("Unsaved service changes")).toBeTruthy();
  await press("Keep editing");
  expect(screen.getByLabelText("Service name").props.value).toBe("Updated gel");
  await press("Save service");
  expect(screen.getByText("HIDDEN FROM BOOKING")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Edit Updated gel" })).toBeTruthy();
  await press("Edit Updated gel");
  await fireEvent.changeText(
    screen.getByLabelText("Service name"),
    "Discard me",
  );
  await press("Cancel editing");
  await press("Discard changes");
  expect(screen.queryByText("Discard me")).toBeNull();
  expect(save).toHaveBeenCalledTimes(1);
});
test("pending save prevents double taps, editing and cancellation", async () => {
  let finish!: () => void;
  const save = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  await render(
    <ServiceForm initial={service} onSave={save} onCancel={jest.fn()} />,
  );
  await press("Save service");
  await press("Save service");
  expect(save).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText("Service name").props.editable).toBe(false);
  expect(screen.getByRole("button", { name: "Cancel editing" })).toBeDisabled();
  await act(() => finish());
});
test("an account change discards a late visibility success", async () => {
  accountScope.change("owner");
  let finish!: () => void;
  const visibility = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  await render(<Menu visibility={visibility} />);
  await press("Hide from booking menu");
  await press("Confirm hide");
  accountScope.change("other");
  await act(() => finish());
  expect(
    screen.queryByText("Service hidden. Existing appointments are unchanged."),
  ).toBeNull();
});
