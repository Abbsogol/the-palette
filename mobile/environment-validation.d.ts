export type MobileEnvironment = { appEnv?: string; apiUrl?: string; supabaseUrl?: string; supabaseKey?: string; projectRef?: string };
export function validateEnvironment(env: MobileEnvironment): string | null;
export function schemeForEnvironment(value?: string): string;
export function validateServiceIdentity(config: { environment?: string; projectRef?: string; contractVersion?: number; apiOrigin?: string; appScheme?: string }, env: MobileEnvironment): boolean;
