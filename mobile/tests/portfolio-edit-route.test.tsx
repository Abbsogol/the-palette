import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import PortfolioEdit from "../src/app/portfolio-edit";
import { usePreventRemove } from "expo-router/react-navigation";
import { router } from "expo-router";
import { accountScope } from "../src/lib/account-scope";
const mockDispatch = jest.fn(),
  mockInvalidate = jest.fn().mockResolvedValue(undefined),
  mockApi = jest.fn(),
  mockRefetch = jest.fn();
let mockOwner = "owner",
  mockEpoch = 1,
  mockParams: { id?: string } = {},
  mockError: Error | null = null,
  mockCanonical = "public-photo";
const mockDetails = {
  record: {
    created_by: "owner",
    id: "saved",
    title: "Ivory",
    description: "A saved set",
    shape: "Almond",
    length: "Short",
    category: "Minimal",
    technique: "Gel",
    occasion: "",
    image_url: "private-photo",
    is_published: false,
    design_colours: [],
    design_images: [],
  },
  model: { tags: ["ivory"], photos: [{ source: "signed-photo" }] },
};
jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
  useNavigation: () => ({ dispatch: mockDispatch }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock("expo-router/react-navigation", () => ({
  usePreventRemove: jest.fn(),
}));
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
jest.mock("../src/components/ui", () => ({
  RequireAuth: ({ children }: any) => children,
  QueryState: ({ children }: any) => children,
}));
jest.mock("../src/lib/api", () => ({
  api: (...args: any[]) => mockApi(...args),
}));
jest.mock("../src/lib/designs", () => ({
  resolvePrivateImage: jest.fn(async (url) => "signed:" + url),
}));
jest.mock("../src/lib/upload", () => ({
  chooseAndUpload: jest.fn(async () => ({
    path: "staged-photo",
    previewUrl: "staged-preview",
  })),
}));
jest.mock("../src/features/design-detail/data", () => ({
  loadDetail: jest.fn(),
}));
jest.mock("../src/lib/auth", () => ({
  useAuth: () => ({ session: { user: { id: mockOwner } }, epoch: mockEpoch }),
  useAccountQuery: (key: any[]) => ({
    data:
      key[0] === "portfolio-allowance"
        ? { used: 1, limit: 5, remaining: 4, resetsAt: null }
        : key[1]
          ? mockDetails
          : undefined,
    isPending: false,
    error: key[0] === "portfolio-allowance" ? null : mockError,
    refetch: mockRefetch,
  }),
  queryClient: { invalidateQueries: () => mockInvalidate() },
}));
const press = (name: string) =>
  fireEvent.press(screen.getByRole("button", { name }));
beforeEach(() => {
  mockOwner = "owner";
  mockEpoch = 1;
  mockParams = { id: "saved" };
  mockError = null;
  accountScope.change("owner", true);
  mockApi.mockImplementation(async () => ({
    designId: "saved",
    images: [mockCanonical],
  }));
});
afterEach(() => accountScope.change(null));
test("saved public photo URLs replace staging paths before a second edit and save", async () => {
  await render(<PortfolioEdit />);
  await press("Publish design");
  await fireEvent.changeText(screen.getByLabelText("Design title"), "Revised");
  await press("Publish design");
  expect(mockApi.mock.calls[1][1]).toEqual(
    expect.objectContaining({
      images: ["public-photo"],
      id: "saved",
      create: false,
      detailsVersion: 1,
    }),
  );
  expect(mockInvalidate).toHaveBeenCalledTimes(2);
});
test("retrying a failed create retains its UUID and draft rather than creating another design", async () => {
  mockParams = {};
  mockApi.mockRejectedValueOnce(new Error("Connection lost"));
  await render(<PortfolioEdit />);
  await press("Choose design photo");
  await fireEvent.changeText(
    screen.getByLabelText("Design title"),
    "My upload",
  );
  await press("Save private design");
  expect(screen.getByText("Connection lost")).toBeTruthy();
  await press("Save private design");
  expect(mockApi.mock.calls[1][1]).toEqual(mockApi.mock.calls[0][1]);
  expect(mockApi.mock.calls[0][1]).toEqual(
    expect.objectContaining({
      create: true,
      id: "00000000-0000-4000-8000-000000000001",
      images: ["staged-photo"],
    }),
  );
});
test("cached refresh failure and preview retain edits; native back requires explicit discard", async () => {
  const view = await render(<PortfolioEdit />);
  await fireEvent.changeText(
    screen.getByLabelText("Description"),
    "Unsaved detail",
  );
  mockError = new Error("Refresh failed");
  await view.rerender(<PortfolioEdit />);
  expect(screen.getByLabelText("Description")).toHaveProp(
    "value",
    "Unsaved detail",
  );
  await press("Preview design page");
  await fireEvent.press(
    screen.getAllByRole("button", { name: "Back" }).at(-1)!,
  );
  expect(screen.getByLabelText("Description")).toHaveProp(
    "value",
    "Unsaved detail",
  );
  const guard = jest.mocked(usePreventRemove).mock.calls.at(-1)!;
  expect(guard[0]).toBe(true);
  await act(() => guard[1]({ data: { action: { type: "GO_BACK" } } }));
  await press("Keep editing");
  expect(mockDispatch).not.toHaveBeenCalled();
  await act(() => guard[1]({ data: { action: { type: "GO_BACK" } } }));
  await press("Discard changes");
  expect(mockDispatch).toHaveBeenCalledWith({ type: "GO_BACK" });
});
test("confirmed deletion exits only after the pending guard is removed", async () => {
  await render(<PortfolioEdit />);
  await fireEvent.changeText(screen.getByLabelText("Description"), "Unsaved");
  await press("Delete design");
  await press("Confirm delete design");
  expect(mockApi).toHaveBeenCalledWith(
    "/mobile/portfolio",
    { id: "saved" },
    "DELETE",
  );
  await waitFor(() =>
    expect(router.replace).toHaveBeenCalledWith("/portfolio"),
  );
  expect(jest.mocked(usePreventRemove).mock.calls.at(-1)![0]).toBe(false);
});
test("late save completion cannot refresh or open a different account’s portfolio", async () => {
  let finish!: (result: any) => void;
  mockApi.mockImplementationOnce(() => new Promise((r) => (finish = r)));
  const view = await render(<PortfolioEdit />);
  await press("Publish design");
  mockOwner = "other";
  mockEpoch = 2;
  accountScope.change("other");
  await view.rerender(<PortfolioEdit />);
  await act(() => finish({ designId: "saved", images: ["public-photo"] }));
  expect(mockInvalidate).not.toHaveBeenCalled();
  expect(router.push).not.toHaveBeenCalled();
});
