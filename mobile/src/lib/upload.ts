import * as ImagePicker from "expo-image-picker";
import { api } from "./api";
import { accountScope } from "./account-scope";
export async function chooseAndUpload(
  kind: "design" | "message",
  conversationId?: string,
) {
  const ticket = accountScope.capture();
  const selected = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.85,
    allowsMultipleSelection: false,
  });
  accountScope.assert(ticket);
  if (selected.canceled) return null;
  const asset = selected.assets[0];
  if (asset.fileSize && asset.fileSize > 8 * 1024 * 1024)
    throw new Error("Choose an image smaller than 8 MB.");
  const body = new FormData();
  body.append("kind", kind);
  if (conversationId) body.append("conversationId", conversationId);
  body.append("file", {
    uri: asset.uri,
    name: asset.fileName || "photo.jpg",
    type: asset.mimeType || "image/jpeg",
  } as unknown as Blob);
  return api<{ path: string; previewUrl: string; privateUrl: string }>(
    "/mobile/upload",
    body,
  );
}
