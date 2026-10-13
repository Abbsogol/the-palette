import { act, fireEvent, render, screen } from "@testing-library/react-native";
import {
  DesignEditor,
  emptyDesign,
} from "../src/features/design-detail/editor";
import { PortfolioManager } from "../src/features/portfolio/manager";
import { PortfolioPreview } from "../src/preview/portfolio";
import { accountScope } from "../src/lib/account-scope";
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
const initial = {
  ...emptyDesign,
  title: "Ivory",
  photos: [{ value: "private-photo", preview: "signed-photo" }],
};
const press = (name: string) =>
  fireEvent.press(screen.getByRole("button", { name }));
afterEach(() => accountScope.change(null));
test("failed photo upload keeps the draft, displays actual upload progress, and permits retry", async () => {
  let reject!: (error: Error) => void;
  const pick = jest
    .fn()
    .mockImplementationOnce(async (stage: any) => {
      stage("uploading");
      return await new Promise((_, r) => (reject = r));
    })
    .mockResolvedValue({ value: "new-photo", preview: "new-preview" });
  await render(
    <DesignEditor initial={initial} onPick={pick} onSave={jest.fn()} />,
  );
  await fireEvent.changeText(
    screen.getByLabelText("Description"),
    "My details",
  );
  await press("Add a close-up");
  expect(screen.getByText(/Uploading photo/)).toBeTruthy();
  expect(screen.getByLabelText("Description")).toHaveProp("editable", false);
  await act(() => reject(new Error("Upload failed")));
  expect(screen.getByText("Upload failed")).toBeTruthy();
  expect(screen.getByLabelText("Description")).toHaveProp(
    "value",
    "My details",
  );
  await press("Add a close-up");
  expect(screen.getByText(/2\/8 photos/)).toBeTruthy();
  expect(screen.queryByText("Upload failed")).toBeNull();
});
test("picker cancellation is not a dirty change and an eight-photo draft disables further uploads", async () => {
  const status = jest.fn();
  const view = await render(
    <DesignEditor
      initial={initial}
      onPick={async () => null}
      onSave={jest.fn()}
      onStatusChange={status}
    />,
  );
  await press("Add a close-up");
  expect(status).toHaveBeenLastCalledWith({ dirty: false, busy: false });
  await view.unmount();
  const pick = jest.fn();
  await render(
    <DesignEditor
      initial={{
        ...initial,
        photos: Array.from({ length: 8 }, (_, i) => ({
          value: String(i),
          preview: String(i),
        })),
      }}
      onPick={pick}
      onSave={jest.fn()}
    />,
  );
  expect(screen.getByRole("button", { name: "Add a close-up" })).toBeDisabled();
  expect(screen.getByText(/Photo limit reached/)).toBeTruthy();
});
test("cover ordering survives save and later edits use canonical saved media instead of staged uploads", async () => {
  const status = jest.fn(),
    save = jest.fn().mockImplementation(async (d) => ({
      ...d,
      photos: d.photos.map((p: any) => ({
        ...p,
        value: "canonical:" + p.value,
      })),
    }));
  await render(
    <DesignEditor
      initial={{
        ...initial,
        photos: [
          ...initial.photos,
          { value: "close-up", preview: "close-preview" },
        ],
      }}
      onPick={jest.fn()}
      onSave={save}
      onStatusChange={status}
    />,
  );
  await press("Make photo 2 cover");
  await press("Save private design");
  expect(save.mock.calls[0][0].photos.map((p: any) => p.value)).toEqual([
    "close-up",
    "private-photo",
  ]);
  expect(status).toHaveBeenLastCalledWith({ dirty: false, busy: false });
  expect(
    screen.getByText(
      "Private draft saved. It is not listed on your public profile.",
    ),
  ).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText("Design title"), "Updated");
  await press("Save private design");
  expect(save.mock.calls[1][0].photos.map((p: any) => p.value)).toEqual([
    "canonical:close-up",
    "canonical:private-photo",
  ]);
});
test("late picked media cannot enter another account’s editor", async () => {
  accountScope.change("owner");
  let finish!: (p: any) => void;
  await render(
    <DesignEditor
      initial={initial}
      onPick={() => new Promise((r) => (finish = r))}
      onSave={jest.fn()}
    />,
  );
  await press("Add a close-up");
  accountScope.change("another");
  await act(() => finish({ value: "late", preview: "late" }));
  expect(screen.queryByText(/2\/8 photos/)).toBeNull();
});
test("deleting from the manager requires confirmation, failure keeps the item, and retry reports success only after completion", async () => {
  const remove = jest
      .fn()
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValue(undefined),
    upload = jest.fn();
  await render(
    <PortfolioManager
      filter="All"
      onFilter={jest.fn()}
      items={[{ id: "draft", title: "Ivory", image: null, published: false }]}
      onUpload={upload}
      onEdit={jest.fn()}
      onView={jest.fn()}
      onDelete={remove}
      onRetry={jest.fn()}
      allowance={{ used: 5, limit: 5, remaining: 0, resetsAt: null }}
    />,
  );
  expect(
    screen.getByRole("button", { name: "Upload a design" }),
  ).toBeDisabled();
  expect(screen.getByRole("button", { name: "Edit Ivory" })).not.toBeDisabled();
  await press("Delete Ivory");
  expect(remove).not.toHaveBeenCalled();
  await press("Keep design");
  expect(remove).not.toHaveBeenCalled();
  await press("Delete Ivory");
  await press("Confirm delete design");
  expect(screen.getByText("Offline")).toBeTruthy();
  expect(screen.queryByText(/Design removed/)).toBeNull();
  await press("Confirm delete design");
  expect(remove).toHaveBeenCalledTimes(2);
  expect(screen.getByText(/Design removed/)).toBeTruthy();
});
test("portfolio preview filters statuses and guards unsaved new uploads without losing edits", async () => {
  const close = jest.fn();
  await render(<PortfolioPreview width={393} onClose={close} />);
  await press("Drafts");
  expect(screen.getByRole("button", { name: "Edit Ivory study" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Edit Cathedral" })).toBeNull();
  await press("Upload a design");
  await fireEvent.changeText(screen.getByLabelText("Design title"), "New set");
  await press("Back");
  expect(screen.getByRole("button", { name: "Keep editing" })).toBeTruthy();
  await press("Keep editing");
  expect(screen.getByLabelText("Design title")).toHaveProp("value", "New set");
  await press("Back");
  await press("Discard changes");
  expect(screen.getByText("My designs")).toBeTruthy();
  expect(close).not.toHaveBeenCalled();
});
test("a failed cover preview leaves metadata and replacement/removal controls usable", async () => {
  await render(
    <DesignEditor initial={initial} onPick={jest.fn()} onSave={jest.fn()} />,
  );
  await fireEvent(screen.getByLabelText("Design cover preview"), "error", {
    nativeEvent: { error: "Photo unavailable" },
  });
  expect(screen.getByText(/Photo 1 preview unavailable/)).toBeTruthy();
  expect(screen.getByLabelText("Design title")).toHaveProp("value", "Ivory");
  await press("Remove cover");
  expect(
    screen.getByRole("button", { name: "Choose design photo" }),
  ).not.toBeDisabled();
});
