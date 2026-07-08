import type { AuthMode } from "@/types/auth";

export const authMode = (import.meta.env.VITE_AUTH_MODE || "mock") as AuthMode;

export const oidcConfig = {
  authority: import.meta.env.VITE_OIDC_AUTHORITY || "http://localhost:18080/realms/datasmart",
  clientId: import.meta.env.VITE_OIDC_CLIENT_ID || "datasmart-gateway",
  scope: import.meta.env.VITE_OIDC_SCOPE || "openid profile email",
  redirectUri: import.meta.env.VITE_OIDC_REDIRECT_URI || `${window.location.origin}/auth/callback`,
  postLogoutRedirectUri:
    import.meta.env.VITE_OIDC_POST_LOGOUT_REDIRECT_URI || `${window.location.origin}/login`,
};
