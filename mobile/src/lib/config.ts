import { validateEnvironment, schemeForEnvironment } from "../../environment-validation";
import Constants from 'expo-constants';
export { validateEnvironment, schemeForEnvironment, validateServiceIdentity } from "../../environment-validation";
export type { MobileEnvironment } from "../../environment-validation";
export const environment = {
  appEnv: process.env.EXPO_PUBLIC_APP_ENV,
  apiUrl: process.env.EXPO_PUBLIC_API_URL,
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  projectRef: process.env.EXPO_PUBLIC_SUPABASE_PROJECT_REF,
};
const nativeEnvironment = Constants.expoConfig?.extra?.appEnvironment;
export const configurationError = (environment.appEnv === 'production' && nativeEnvironment !== 'production' || nativeEnvironment && nativeEnvironment !== environment.appEnv)
  ? 'This native build and service configuration belong to different environments.'
  : validateEnvironment(environment);
export const appScheme = schemeForEnvironment(environment.appEnv);
