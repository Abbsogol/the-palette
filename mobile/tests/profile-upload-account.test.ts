import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { chooseAndUpload } from "../src/lib/upload";
import { api } from "../src/lib/api";
import { accountScope } from "../src/lib/account-scope";
jest.mock("expo-image-picker", () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock("../src/lib/api", () => ({ api: jest.fn() }));
const originalPlatform = Platform.OS,
  originalFetch = global.fetch;
beforeEach(() => {
  Object.defineProperty(Platform, "OS", { value: "web", configurable: true });
  accountScope.change("owner", true);
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
    canceled: false,
    assets: [
      {
        uri: "blob:synthetic-photo",
        fileName: "photo.png",
        mimeType: "image/png",
        width: 32,
        height: 32,
      },
    ],
  });
  jest.mocked(api).mockResolvedValue({
    path: "avatars/owner/test.webp",
    previewUrl: "https://test.invalid/signed",
    privateUrl: "https://test.invalid/public",
  });
});
afterEach(() => {
  Object.defineProperty(Platform, "OS", {
    value: originalPlatform,
    configurable: true,
  });
  global.fetch = originalFetch;
  accountScope.change(null);
});
test("switching accounts while preparing the selected photo never uploads it into the new account", async () => {
  let release!: (value: Blob) => void;
  const bytes = new Promise<Blob>((resolve) => {
    release = resolve;
  });
  let read!: () => void;
  const reading = new Promise<void>((resolve) => {
    read = resolve;
  });
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    blob: () => {
      read();
      return bytes;
    },
  });
  const upload = chooseAndUpload("profile-avatar");
  await reading;
  accountScope.change("another-account");
  release(new Blob(["synthetic pixels"], { type: "image/png" }));
  await expect(upload).rejects.toThrow("Your account changed");
  expect(api).not.toHaveBeenCalled();
});
test("an unreadable selected file is rejected before a profile upload", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    blob: async () => new Blob(["not a photo"]),
  });
  await expect(chooseAndUpload("profile-banner")).rejects.toThrow("read");
  expect(api).not.toHaveBeenCalled();
});
test("a cancelled picker sends no upload", async () => {
  jest
    .mocked(ImagePicker.launchImageLibraryAsync)
    .mockResolvedValue({ canceled: true, assets: null });
  await expect(chooseAndUpload("profile-avatar")).resolves.toBeNull();
  expect(api).not.toHaveBeenCalled();
});
test("successful preparation uploads the expected profile slot and file", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    blob: async () => new Blob(["synthetic pixels"], { type: "image/png" }),
  });
  await expect(chooseAndUpload("profile-banner")).resolves.toEqual(
    expect.objectContaining({ path: "avatars/owner/test.webp" }),
  );
  const [path, body] = jest.mocked(api).mock.calls[0];
  expect(path).toBe("/mobile/upload");
  expect((body as FormData).get("kind")).toBe("profile-banner");
  expect((body as FormData).get("file")).toBeTruthy();
});
test("oversized bytes are rejected even when picker size metadata is absent", async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValue({
      ok: true,
      blob: async () => new Blob([new Uint8Array(8 * 1024 * 1024 + 1)]),
    });
  await expect(chooseAndUpload("profile-avatar")).rejects.toThrow(
    "smaller than 8 MB",
  );
  expect(api).not.toHaveBeenCalled();
});
test("a late upload result is not accepted after the account changes", async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, blob: async () => new Blob(["pixels"]) });
  let release!: (value: unknown) => void, started!: () => void;
  const waiting = new Promise<void>((r) => {
    started = r;
  });
  jest.mocked(api).mockImplementationOnce(() => {
    started();
    return new Promise((r) => {
      release = r;
    });
  });
  const upload = chooseAndUpload("profile-avatar");
  await waiting;
  accountScope.change("other");
  release({
    path: "avatars/owner/new.webp",
    previewUrl: "signed",
    privateUrl: "public",
  });
  await expect(upload).rejects.toThrow("Your account changed");
});
