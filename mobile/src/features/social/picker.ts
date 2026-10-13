import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";
import { accountScope } from "../../lib/account-scope";
import type { SocialMedia } from "./media";
import { MediaPermissionError } from "./media-permission";
export async function pickSocialMedia(): Promise<SocialMedia | null> {
  const ticket = accountScope.capture();
  if (Platform.OS === "ios") {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    accountScope.assert(ticket);
    if (!permission.granted) throw new MediaPermissionError();
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images", "videos"],
    quality: 0.85,
    allowsMultipleSelection: false,
    videoMaxDuration: 60,
  });
  accountScope.assert(ticket);
  if (result.canceled) return null;
  const a = result.assets[0];
  const video = a.type === "video";
  if ((a.fileSize || 0) > (video ? 50 : 8) * 1024 * 1024)
    throw new Error(
      `Choose ${video ? "a video under 50" : "a photo under 8"} MB.`,
    );
  if (video && (a.duration || 0) > 60000)
    throw new Error("Choose a video no longer than 60 seconds.");
  return {
    uri: a.uri,
    type: video ? "video" : "image",
    mime: a.mimeType || (video ? "video/mp4" : "image/jpeg"),
  };
}
