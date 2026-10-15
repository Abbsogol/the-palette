import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { pickSocialMedia } from "../src/features/social/picker";
import { MediaPermissionError } from "../src/features/social/media-permission";
import { accountScope } from "../src/lib/account-scope";
jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(Platform, "OS", "ios");
  accountScope.change("owner", true);
});
afterEach(() => {
  jest.restoreAllMocks();
  accountScope.change(null);
});
test("denied iOS access never launches the picker and returns the actionable permission error", async () => {
  jest
    .mocked(ImagePicker.requestMediaLibraryPermissionsAsync)
    .mockResolvedValue({
      status: "denied",
      granted: false,
      canAskAgain: false,
      expires: "never",
      accessPrivileges: "none",
    } as ImagePicker.MediaLibraryPermissionResponse);
  await expect(pickSocialMedia()).rejects.toBeInstanceOf(MediaPermissionError);
  expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
});
test("limited photo access permits selection; cancelling returns without changing the draft", async () => {
  jest
    .mocked(ImagePicker.requestMediaLibraryPermissionsAsync)
    .mockResolvedValue({
      status: "granted",
      granted: true,
      canAskAgain: true,
      expires: "never",
      accessPrivileges: "limited",
    } as ImagePicker.MediaLibraryPermissionResponse);
  jest
    .mocked(ImagePicker.launchImageLibraryAsync)
    .mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          uri: "file:///photo.jpg",
          width: 100,
          height: 100,
          type: "image",
          mimeType: "image/jpeg",
        },
      ],
    })
    .mockResolvedValueOnce({ canceled: true, assets: null });
  await expect(pickSocialMedia()).resolves.toEqual({
    uri: "file:///photo.jpg",
    type: "image",
    mime: "image/jpeg",
  });
  await expect(pickSocialMedia()).resolves.toBeNull();
});
