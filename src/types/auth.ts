export type AuthMode = "mock" | "oidc";
export type AuthStatus = "bootstrapping" | "authenticated" | "anonymous";

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  tenantId: string;
  actorId: string;
  actorRole: string;
  actorType: "USER" | "SERVICE_ACCOUNT" | "AGENT" | "SYSTEM_SCHEDULER";
}

export interface MockUserOption extends AuthUser {
  passwordHint: string;
}
