export class MediaPermissionError extends Error {
  constructor() {
    super(
      "Photo access is off. Allow LaQue to access your photo library in Settings, then choose your photo or video again.",
    );
    this.name = "MediaPermissionError";
  }
}
