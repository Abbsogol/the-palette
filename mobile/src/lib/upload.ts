import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { api } from "./api";
import { accountScope } from "./account-scope";
export async function chooseAndUpload(
  kind: "design" | "message" | "profile-avatar" | "profile-banner",
  conversationId?: string,
  onStage?: (stage: "choosing" | "uploading") => void,
) {
  const ticket = accountScope.capture();
  onStage?.("choosing");
  const selected = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.85,
    allowsMultipleSelection: false,
  });
  accountScope.assert(ticket);
  if (selected.canceled) return null;
  const asset = selected.assets[0];
  if (!asset?.uri)
    throw new Error("This photo could not be read. Choose another image.");
  if (asset.fileSize && asset.fileSize > 8 * 1024 * 1024)
    throw new Error("Choose an image smaller than 8 MB.");
  const body = new FormData();
  body.append("kind", kind);
  if (conversationId) body.append("conversationId", conversationId);
  if (Platform.OS === "web") {
    const response = await fetch(asset.uri);
    accountScope.assert(ticket);
    if (!response.ok)
      throw new Error("This photo could not be read. Choose another image.");
    const bytes = await response.blob();
    accountScope.assert(ticket);
    if (bytes.size > 8 * 1024 * 1024)
      throw new Error("Choose an image smaller than 8 MB.");
    body.append("file", bytes, asset.fileName || "photo.jpg");
  } else
    body.append("file", {
      uri: asset.uri,
      name: asset.fileName || "photo.jpg",
      type: asset.mimeType || "image/jpeg",
    } as unknown as Blob);
  accountScope.assert(ticket);
  onStage?.("uploading");
  const result = await api<{
    path: string;
    previewUrl: string;
    privateUrl: string;
  }>("/mobile/upload", body);
  accountScope.assert(ticket);
  return result;
}
