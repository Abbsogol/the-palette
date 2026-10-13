import { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import {
  FavoritesView,
  type FavoritesViewProps,
} from "../src/features/favorites/favorites-view";
import {
  emptyLibrary,
  type FavoriteAction,
  type FavoritesLibrary,
} from "../src/features/favorites/model";
import { updatePreviewFavorites } from "../src/preview/favorites-store";
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
const library: FavoritesLibrary = {
  designs: [
    { id: "a", title: "Cathedral", image: null, attributes: [] },
    { id: "b", title: "Pistachio", image: null, attributes: [] },
  ],
  savedIds: ["a", "b"],
  profiles: [{ id: "p", name: "Anelia", kind: "NAIL ARTIST", image: null }],
  folders: [{ id: "f", name: "Next set", designIds: ["a"] }],
};
function Harness(props: Partial<FavoritesViewProps> = {}) {
  const [data, setData] = useState(library);
  return (
    <FavoritesView
      library={data}
      width={393}
      onRetry={jest.fn()}
      onDesign={jest.fn()}
      onProfile={jest.fn()}
      onDiscover={jest.fn()}
      onAction={async (action) => {
        setData((v) => updatePreviewFavorites(v, action));
        return true;
      }}
      {...props}
    />
  );
}
const press = async (name: string) =>
  fireEvent.press(screen.getByRole("button", { name }));
test("two tabs separate saved profiles from designs and open the selected profile", async () => {
  const onProfile = jest.fn();
  await render(<Harness onProfile={onProfile} />);
  expect(screen.getByRole("button", { name: "View Cathedral" })).toBeTruthy();
  await fireEvent.press(screen.getByRole("tab", { name: "Saved Profiles" }));
  expect(screen.queryByRole("button", { name: "View Cathedral" })).toBeNull();
  await press("View Anelia");
  expect(onProfile).toHaveBeenCalledWith("p");
  await fireEvent.changeText(
    screen.getByLabelText("Search saved profiles"),
    "missing",
  );
  expect(screen.getByText("No matches found")).toBeTruthy();
});
test("creates a trimmed folder, adds selected saved designs, renames and deletes without losing saved designs", async () => {
  await render(<Harness />);
  await press("Create a folder");
  await press("Create folder");
  expect(screen.getByRole("alert")).toHaveTextContent("Enter a folder name.");
  await fireEvent.changeText(
    screen.getByLabelText("Folder name"),
    "  Summer  ",
  );
  await press("Create folder");
  await press("Open folder Summer");
  await press("Add designs");
  await fireEvent.press(screen.getByRole("checkbox", { name: "Pistachio" }));
  await press("Add 1 design");
  expect(screen.getByRole("button", { name: "View Pistachio" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "View Cathedral" })).toBeNull();
  await press("Rename");
  await fireEvent.changeText(screen.getByLabelText("Folder name"), "Holiday");
  await press("Save name");
  expect(screen.getByRole("header", { name: "Holiday" })).toBeTruthy();
  await press("Delete folder");
  await press("Delete folder permanently");
  expect(
    screen.queryByRole("button", { name: "Open folder Holiday" }),
  ).toBeNull();
  expect(screen.getByRole("button", { name: "View Pistachio" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "View Cathedral" })).toBeTruthy();
});
test("organizing is deduplicated and removing from a folder preserves Saved Designs", async () => {
  await render(<Harness />);
  await press("Organize Cathedral");
  expect(
    screen.getByRole("button", { name: "Add to Next set" }),
  ).toBeDisabled();
  await press("Close Save to a folder");
  await press("Open folder Next set");
  await press("Remove Cathedral from folder");
  expect(screen.queryByRole("button", { name: "View Cathedral" })).toBeNull();
  await press("Back to favorites");
  expect(screen.getByRole("button", { name: "View Cathedral" })).toBeTruthy();
});
test("unsaving discloses that folder membership is retained", async () => {
  await render(<Harness />);
  await press("Unsave Cathedral");
  expect(screen.getByText(/Any copies in your folders/)).toBeTruthy();
  await press("Remove saved design");
  expect(screen.queryByRole("button", { name: "View Cathedral" })).toBeNull();
  await press("Open folder Next set");
  expect(screen.getByRole("button", { name: "View Cathedral" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Save Cathedral" })).toBeTruthy();
});
test("failed creation keeps the name and same id for a retry; duplicate taps submit once", async () => {
  let reject!: (e: Error) => void;
  const onAction = jest
    .fn<Promise<boolean>, [FavoriteAction]>()
    .mockImplementationOnce(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    )
    .mockResolvedValue(true);
  await render(<Harness onAction={onAction} />);
  await press("Create a folder");
  await fireEvent.changeText(screen.getByLabelText("Folder name"), "Birthday");
  await press("Create folder");
  await press("Create folder");
  expect(onAction).toHaveBeenCalledTimes(1);
  await act(async () => reject(new Error("Offline")));
  expect(screen.getByRole("alert")).toHaveTextContent("Offline");
  expect(screen.getByLabelText("Folder name")).toHaveDisplayValue("Birthday");
  await press("Create folder");
  expect(onAction.mock.calls[1][0]).toEqual(onAction.mock.calls[0][0]);
});
test("loading, unavailable folder, empty and read failure do not pretend there are records", async () => {
  const view = await render(<Harness library={emptyLibrary} loading />);
  expect(screen.getByLabelText("Loading favorites")).toBeTruthy();
  expect(screen.queryByText("Start your inspiration library")).toBeNull();
  await view.rerender(<Harness library={emptyLibrary} error="Offline" />);
  expect(screen.getByRole("alert")).toHaveTextContent("Offline");
  expect(
    screen.getByRole("button", { name: "Retry loading favorites" }),
  ).toBeTruthy();
  await view.rerender(<Harness library={emptyLibrary} />);
  expect(screen.getByText("Start your inspiration library")).toBeTruthy();
});
test("duplicate add and repeated create preserve one membership and one folder", () => {
  let state = updatePreviewFavorites(library, {
    kind: "add",
    folderId: "f",
    designIds: ["a", "a", "b"],
  });
  expect(state.folders[0].designIds).toEqual(["a", "b"]);
  state = updatePreviewFavorites(state, {
    kind: "create",
    id: "new",
    name: "Test",
  });
  state = updatePreviewFavorites(state, {
    kind: "create",
    id: "new",
    name: "Test",
  });
  expect(state.folders.filter((f) => f.id === "new")).toHaveLength(1);
});
