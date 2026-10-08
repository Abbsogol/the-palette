jest.mock("expo-router", () => ({
  useFocusEffect: jest.fn(),
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
  },
  usePathname: () => "/profile",
  useLocalSearchParams: () => ({}),
  useNavigation: () => ({ dispatch: jest.fn() }),
}));
jest.mock("expo-router/react-navigation", () => ({
  usePreventRemove: jest.fn(),
}));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock("expo-crypto", () => ({
  randomUUID: () => "00000000-0000-4000-8000-000000000001",
}));
jest.mock("react-native-purchases", () => ({
  __esModule: true,
  default: { isConfigured: jest.fn().mockResolvedValue(false) },
  LOG_LEVEL: { ERROR: "ERROR" },
}));
// Native playback is verified in a development build; component tests exercise controls/selection.
jest.mock("expo-video", () => ({
  VideoView: require("react-native").View,
  useVideoPlayer: jest.fn(() => ({
    status: "readyToPlay",
    loop: false,
    pause: jest.fn(),
    play: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  })),
}));
