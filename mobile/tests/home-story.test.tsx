import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import StoryScreen from "../src/app/story/new";
import { accountScope } from "../src/lib/account-scope";

jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);
jest.mock("expo-image-picker", () => ({ launchImageLibraryAsync: jest.fn(),requestMediaLibraryPermissionsAsync:jest.fn().mockResolvedValue({granted:true}) }));
jest.mock("../src/lib/api",()=>({...jest.requireActual("../src/lib/api"),api:jest.fn().mockResolvedValue({path:"customer-a/photo.jpg",token:"test-ticket"})}));
const mockUpload = jest.fn(),
  mockInsert = jest.fn(),
  mockFrom = jest.fn();
jest.mock("../src/lib/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    storage: {
      from: () => ({
        uploadToSignedUrl: mockUpload,
        getPublicUrl: () => ({
          data: { publicUrl: "https://test.invalid/story.jpg" },
        }),
      }),
    },
  },
}));
jest.mock("../src/lib/auth", () => ({
  useAuth: () => ({ ready: true, session: { user: { id: "customer-a" } } }),
  queryClient: { invalidateQueries: jest.fn().mockResolvedValue(undefined) },
}));
const photo = {
  uri: "file:///photo.jpg",
  width: 100,
  height: 100,
  fileSize: 100,
  mimeType: "image/jpeg",
};
let mockExisting: { id: string }[];
let mockInsertError: { message: string } | null;
beforeEach(() => {
  accountScope.change("customer-a", true);
  mockExisting = [];
  mockInsertError = null;
  mockUpload.mockReset().mockResolvedValue({ error: null });
  mockInsert.mockReset();
  jest
    .mocked(ImagePicker.launchImageLibraryAsync)
    .mockResolvedValue({ canceled: false, assets: [photo] });
  mockFrom.mockImplementation(() => {
    let inserting = false;
    const builder = {
      select: () => builder,
      eq: () => builder,
      limit: () => builder,
      single: () => builder,
      insert: (values: unknown) => {
        inserting = true;
        mockInsert(values);
        return builder;
      },
      then: (resolve: (v: unknown) => unknown) =>
        resolve({
          data: inserting ? { id: "story" } : mockExisting,
          error: inserting ? mockInsertError : null,
        }),
    };
    return builder;
  });
  jest.spyOn(globalThis, "fetch").mockResolvedValue({
    arrayBuffer: async () => new ArrayBuffer(100),
  } as Response);
});
afterEach(() => jest.restoreAllMocks());

test("a new story posts after an empty existence check; a failed insert retries without a second upload", async () => {
  mockInsertError = { message: "Network unavailable" };
  await render(<StoryScreen />);
  await fireEvent.press(screen.getByRole("button", { name: "Choose photo or video" }));
  await fireEvent.press(screen.getByRole("button", { name: "Share story" }));
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent("Network unavailable"),
  );
  expect(mockUpload).toHaveBeenCalledTimes(1);
  mockInsertError = null;
  await fireEvent.press(screen.getByRole("button", { name: "Retry posting" }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
  expect(mockUpload).toHaveBeenCalledTimes(1);
  expect(mockInsert).toHaveBeenCalledTimes(2);
  expect(mockInsert.mock.calls[0][0].id).toBe(mockInsert.mock.calls[1][0].id);
});

test("a story committed before a lost response is reconciled without publishing it twice", async () => {
  mockExisting = [{ id: "already-posted" }];
  await render(<StoryScreen />);
  await fireEvent.press(screen.getByRole("button", { name: "Choose photo or video" }));
  await fireEvent.press(screen.getByRole("button", { name: "Share story" }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
  expect(mockInsert).not.toHaveBeenCalled();
  expect(mockUpload).not.toHaveBeenCalled();
});

test("switching accounts while choosing a photo discards the old selection", async () => {
  let resolve!: (value: ImagePicker.ImagePickerResult) => void;
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  await render(<StoryScreen />);
  await fireEvent.press(screen.getByRole("button", { name: "Choose photo or video" }));
  accountScope.change("customer-b");
  await act(async () => resolve({ canceled: false, assets: [photo] }));
  expect(
    screen.queryByRole("button", { name: "Remove photo 1" }),
  ).toBeNull();
  expect(mockUpload).not.toHaveBeenCalled();
});
