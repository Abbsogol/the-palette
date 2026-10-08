import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { LabView, type LabViewProps } from "../src/features/lab-ui/lab-view";
import { defaultLabSettings } from "../src/features/lab-ui/model";
import {
  HistoryView,
  type HistoryViewProps,
} from "../src/features/lab-ui/history-view";
import HomeDesignPreview from "../src/preview/home-main";
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
const props = (): LabViewProps => ({
  settings: defaultLabSettings(),
  onSettings: jest.fn(),
  credits: 5,
  onGenerate: jest.fn(),
  onCredits: jest.fn(),
  onHistory: jest.fn(),
});
function Form({ base = props() }: { base?: LabViewProps }) {
  const [settings, onSettings] = useState(base.settings);
  return <LabView {...base} settings={settings} onSettings={onSettings} />;
}
test("essentials, occasions and colours are interactive; no selection disables a new generation", async () => {
  await render(<Form />);
  await fireEvent.press(
    screen.getByRole("checkbox", { name: "Vibe / Style: Bridal" }),
  );
  expect(
    screen.getByRole("button", { name: "Generate · 1 design token" }),
  ).toBeDisabled();
  await fireEvent.press(
    screen.getByRole("checkbox", { name: "Vibe / Style: Moody" }),
  );
  await fireEvent.press(
    screen.getByRole("checkbox", { name: "Vibe / Style: Glam" }),
  );
  await fireEvent.press(screen.getByRole("radio", { name: "Shape: Squoval" }));
  await fireEvent.press(screen.getByRole("button", { name: "2. Personalize" }));
  await fireEvent.press(
    screen.getByRole("checkbox", { name: "Occasion: Wedding" }),
  );
  expect(
    screen.getByRole("checkbox", { name: "Vibe / Style: Moody" }),
  ).toBeChecked();
  expect(
    screen.getByRole("checkbox", { name: "Vibe / Style: Glam" }),
  ).toBeChecked();
  expect(screen.getByRole("radio", { name: "Shape: Squoval" })).toBeChecked();
  expect(
    screen.getByRole("radio", { name: "Shape: Almond" }),
  ).not.toBeChecked();
  expect(
    screen.getByRole("checkbox", { name: "Occasion: Wedding" }),
  ).toBeChecked();
  expect(
    screen.getByRole("button", { name: "Generate · 1 design token" }),
  ).not.toBeDisabled();
});
test("the four-colour limit applies to swatches and custom colours; invalid hex is rejected", async () => {
  await render(<Form />);
  await fireEvent.press(screen.getByRole("button", { name: "2. Personalize" }));
  for (const name of ["Ivory", "Nude", "Sand", "Caramel"])
    await fireEvent.press(
      screen.getByRole("checkbox", { name: `Colour: ${name}` }),
    );
  await fireEvent.press(
    screen.getByRole("checkbox", { name: "Colour: Taupe" }),
  );
  expect(
    screen.getByRole("checkbox", { name: "Colour: Taupe" }),
  ).not.toBeChecked();
  await fireEvent.press(
    screen.getByRole("button", { name: "Custom colour picker" }),
  );
  await fireEvent.changeText(screen.getByLabelText("Hex colour"), "nothex");
  await fireEvent.press(screen.getByRole("button", { name: "Add colour" }));
  expect(screen.getByText(/Enter a valid hex/)).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText("Hex colour"), "#abc");
  await fireEvent.press(screen.getByRole("button", { name: "Add colour" }));
  expect(
    screen.getByRole("header", { name: "Custom colour picker" }),
  ).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", { name: "Close Custom colour picker" }),
  );
  await fireEvent.press(
    screen.getByRole("checkbox", { name: "Colour: Ivory" }),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Custom colour picker" }),
  );
  await fireEvent.press(screen.getByRole("button", { name: "Add colour" }));
  expect(
    screen.getByRole("checkbox", { name: "Colour: #AABBCC" }),
  ).toBeChecked();
});
test("collapsing Lab sections preserves choices without generating or spending credits", async () => {
  const p = props();
  await render(<Form base={p} />);
  await fireEvent.press(screen.getByRole("radio", { name: "Shape: Squoval" }));
  await fireEvent.press(screen.getByRole("button", { name: "1. Essentials" }));
  expect(
    screen.getByRole("button", { name: "1. Essentials", expanded: false }),
  ).toBeTruthy();
  expect(screen.queryByRole("radio", { name: "Shape: Squoval" })).toBeNull();
  await fireEvent.press(
    screen.getByRole("button", { name: "2. Personalize", expanded: false }),
  );
  await fireEvent.press(screen.getByRole("checkbox", { name: "Colour: Rose" }));
  await fireEvent.press(
    screen.getByRole("checkbox", { name: "Occasion: Wedding" }),
  );
  await fireEvent.press(screen.getByRole("button", { name: "2. Personalize" }));
  expect(screen.queryByRole("checkbox", { name: "Colour: Rose" })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "1. Essentials" }));
  expect(screen.getByRole("radio", { name: "Shape: Squoval" })).toBeChecked();
  await fireEvent.press(screen.getByRole("button", { name: "2. Personalize" }));
  expect(screen.getByRole("checkbox", { name: "Colour: Rose" })).toBeChecked();
  expect(
    screen.getByRole("checkbox", { name: "Occasion: Wedding" }),
  ).toBeChecked();
  expect(p.onGenerate).not.toHaveBeenCalled();
  expect(p.onCredits).not.toHaveBeenCalled();
});
test("zero credits opens billing, while a pending request remains recoverable even at zero balance", async () => {
  const p = {
    ...props(),
    settings: { ...defaultLabSettings(), vibe: [] },
    credits: 0,
  };
  const view = await render(<LabView {...p} />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Buy design tokens" }),
  );
  expect(p.onGenerate).not.toHaveBeenCalled();
  expect(p.onCredits).toHaveBeenCalledTimes(1);
  await view.rerender(<LabView {...p} pending />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Retry / recover this generation" }),
  );
  expect(p.onGenerate).toHaveBeenCalledTimes(1);
  await view.rerender(<LabView {...p} pending busy />);
  expect(
    screen.getByRole("button", { name: "Retry / recover this generation" }),
  ).toBeDisabled();
});
test("unknown credits and pending-storage recovery cannot start a new generation", async () => {
  const p = props();
  const view = await render(<LabView {...p} credits={null} />);
  expect(
    screen.getByRole("button", { name: "Checking design tokens…" }),
  ).toBeDisabled();
  await view.rerender(<LabView {...p} recovering />);
  expect(
    screen.getByRole("button", { name: "Checking your generation…" }),
  ).toBeDisabled();
});
test("inspiration uses supported text details instead of an inert reference picker", async () => {
  const p = props();
  await render(<LabView {...p} />);
  expect(
    screen.queryByRole("button", { name: "Reference designs" }),
  ).toBeNull();
  await fireEvent.changeText(
    screen.getByLabelText("Additional details"),
    "Rose gold chrome",
  );
  expect(p.onSettings).toHaveBeenCalledWith(
    expect.objectContaining({ customText: "Rose gold chrome" }),
  );
  expect(p.onGenerate).not.toHaveBeenCalled();
});
const historyProps = (): HistoryViewProps => ({
  designs: [
    {
      id: "a",
      title: "Glam + Minimal",
      shape: "Square",
      length: "Long",
      date: "Jun 15",
      image: null,
    },
    {
      id: "b",
      title: "Bridal",
      shape: "Almond",
      length: "Short",
      date: "Jun 14",
      image: null,
    },
  ],
  total: 20,
  hasMore: true,
  onBack: jest.fn(),
  onMore: jest.fn(),
  onRetry: jest.fn(),
  onSave: jest.fn(),
  onOpen: jest.fn(),
});
test("history cards open the selected generation and pass its identity to save or publish", async () => {
  const p = historyProps();
  await render(<HistoryView {...p} />);
  expect(screen.getByText("20 designs")).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", { name: "Load older designs" }),
  );
  expect(p.onMore).toHaveBeenCalledTimes(1);
  await fireEvent.press(
    screen.getByRole("button", { name: /^Open generation: Bridal/ }),
  );
  expect(p.onOpen).toHaveBeenLastCalledWith("b");
  expect(screen.queryByText("Publish to community")).toBeNull();
});
test("history exposes loading, empty, retry and failed-save states; failed refresh hides stale cards", async () => {
  const p = historyProps();
  const view = await render(<HistoryView {...p} loading />);
  expect(screen.getByLabelText("Loading generations")).toBeTruthy();
  await view.rerender(<HistoryView {...p} error="Offline" />);
  expect(screen.queryByRole("button", { name: /^Open generation/ })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
  expect(p.onRetry).toHaveBeenCalledTimes(1);
  await view.rerender(
    <HistoryView {...p} designs={[]} total={0} hasMore={false} />,
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Create a design" }),
  );
  expect(p.onBack).toHaveBeenCalledTimes(1);
  await view.rerender(<HistoryView {...p} busy actionError="Save failed" />);
  await fireEvent.press(
    screen.getByRole("button", { name: /^Open generation: Bridal/ }),
  );
  expect(screen.getByRole("alert")).toHaveTextContent("Save failed");
  expect(screen.getByRole("button", { name: /^Open generation: Bridal/ })).toBeDisabled();
});
test("the demo Lab tab opens both Figma screens and preserves selections when returning from History", async () => {
  await render(<HomeDesignPreview />);
  await fireEvent.press(screen.getByRole("tab", { name: "Lab" }));
  expect(screen.getByRole("header", { name: "Nail Lab" })).toBeTruthy();
  await fireEvent.press(screen.getByRole("radio", { name: "Shape: Square" }));
  await fireEvent.press(screen.getByRole("button", { name: "History" }));
  expect(screen.getByRole("header", { name: "My Generations" })).toBeTruthy();
  expect(screen.getByText("3 designs")).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", { name: "Back to Nail Lab" }),
  );
  expect(screen.getByRole("radio", { name: "Shape: Square" })).toBeChecked();
});
