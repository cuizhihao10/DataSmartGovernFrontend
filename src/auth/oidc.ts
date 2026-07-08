import { User, UserManager, WebStorageStateStore } from "oidc-client-ts";
import { oidcConfig } from "@/auth/config";
import type { AuthUser } from "@/types/auth";

let userManager: UserManager | null = null;

export function getUserManager() {
  if (!userManager) {
    userManager = new UserManager({
      authority: oidcConfig.authority,
      client_id: oidcConfig.clientId,
      redirect_uri: oidcConfig.redirectUri,
      post_logout_redirect_uri: oidcConfig.postLogoutRedirectUri,
      response_type: "code",
      scope: oidcConfig.scope,
      userStore: new WebStorageStateStore({ store: window.localStorage }),
      monitorSession: true,
      loadUserInfo: true,
    });
  }
  return userManager;
}

function readStringClaim(profile: User["profile"], key: string, fallback = "") {
  const value = profile[key];
  if (Array.isArray(value)) {
    return value[0] == null ? fallback : String(value[0]);
  }
  return value == null ? fallback : String(value);
}

export function mapOidcUser(user: User): AuthUser {
  const profile = user.profile;
  const username =
    readStringClaim(profile, "preferred_username") ||
    readStringClaim(profile, "name") ||
    readStringClaim(profile, "sub", "unknown");

  return {
    id: readStringClaim(profile, "sub", username),
    username,
    displayName: readStringClaim(profile, "name", username),
    email: readStringClaim(profile, "email") || undefined,
    tenantId: readStringClaim(profile, "datasmart_tenant_id", "-"),
    actorId: readStringClaim(profile, "datasmart_actor_id", "-"),
    actorRole: readStringClaim(profile, "datasmart_actor_role", "ORDINARY_USER"),
    actorType: readStringClaim(profile, "datasmart_actor_type", "USER") as AuthUser["actorType"],
  };
}
