jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
  },
  usePathname: () => "/profile",
  useLocalSearchParams: () => ({}),
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
