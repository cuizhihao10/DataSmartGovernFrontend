import { create } from "zustand";
import { authMode } from "@/auth/config";
import { mockUsers } from "@/auth/mockUsers";
import { getUserManager, mapOidcUser } from "@/auth/oidc";
import type { AuthMode, AuthStatus, AuthUser } from "@/types/auth";

const mockSessionKey = "datasmart-govern.mock-session";

interface AuthState {
  mode: AuthMode;
  status: AuthStatus;
  user: AuthUser | null;
  accessToken: string | null;
  error: string | null;
  bootstrap: () => Promise<void>;
  loginWithMock: (username: string, password: string) => Promise<boolean>;
  loginWithOidc: () => Promise<void>;
  completeOidcLogin: () => Promise<void>;
  logout: () => Promise<void>;
}

let oidcRenewPromise: Promise<string | null> | null = null;

function readMockSession() {
  const raw = window.localStorage.getItem(mockSessionKey);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    window.localStorage.removeItem(mockSessionKey);
    return null;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  mode: authMode,
  status: "bootstrapping",
  user: null,
  accessToken: null,
  error: null,
  bootstrap: async () => {
    set({ status: "bootstrapping", error: null });
    if (authMode === "mock") {
      const user = readMockSession();
      set({ user, accessToken: null, status: user ? "authenticated" : "anonymous" });
      return;
    }

    try {
      const oidcUser = await getUserManager().getUser();
      if (!oidcUser || oidcUser.expired) {
        set({ user: null, accessToken: null, status: "anonymous" });
        return;
      }
      set({
        user: mapOidcUser(oidcUser),
        accessToken: oidcUser.access_token,
        status: "authenticated",
      });
    } catch (error) {
      set({
        user: null,
        accessToken: null,
        status: "anonymous",
        error: error instanceof Error ? error.message : "OIDC session bootstrap failed",
      });
    }
  },
  loginWithMock: async (username, password) => {
    const user = mockUsers.find((item) => item.username === username);
    if (!user) {
      set({ error: "账号不存在" });
      return false;
    }
    if (user.passwordHint !== password) {
      set({ error: "账号或密码不正确" });
      return false;
    }
    const sessionUser: AuthUser = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      tenantId: user.tenantId,
      actorId: user.actorId,
      actorRole: user.actorRole,
      actorType: user.actorType,
    };
    window.localStorage.setItem(mockSessionKey, JSON.stringify(sessionUser));
    set({ user: sessionUser, accessToken: null, status: "authenticated", error: null });
    return true;
  },
  loginWithOidc: async () => {
    await getUserManager().signinRedirect();
  },
  completeOidcLogin: async () => {
    try {
      const oidcUser = await getUserManager().signinRedirectCallback();
      set({
        user: mapOidcUser(oidcUser),
        accessToken: oidcUser.access_token,
        status: "authenticated",
        error: null,
      });
    } catch (error) {
      set({
        user: null,
        accessToken: null,
        status: "anonymous",
        error: error instanceof Error ? error.message : "OIDC callback failed",
      });
      throw error;
    }
  },
  logout: async () => {
    if (get().mode === "mock") {
      window.localStorage.removeItem(mockSessionKey);
      set({ user: null, accessToken: null, status: "anonymous", error: null });
      return;
    }
    const manager = getUserManager();
    const oidcUser = await manager.getUser();
    set({ user: null, accessToken: null, status: "anonymous", error: null });
    if (oidcUser) {
      await manager.signoutRedirect();
    }
  },
}));

export function getApiAccessToken() {
  const state = useAuthStore.getState();
  return state.mode === "oidc" ? state.accessToken : null;
}

export async function ensureApiAccessToken(options: { forceRefresh?: boolean; minValidSeconds?: number } = {}) {
  const state = useAuthStore.getState();
  if (state.mode !== "oidc") {
    return null;
  }

  /*
   * OIDC access token 是短时凭证，Keycloak 默认几分钟到几十分钟就会过期。
   * 过去前端只在页面启动时读取一次 token，用户停留一段时间后再点“保存/预检查/字段映射”
   * 就会把过期 token 原样发给 gateway，后端只能返回 401，刷新页面才会重新 bootstrap。
   *
   * 这里把“请求前主动续期”和“401 后强制续期重试”都收敛到 authStore：
   * 1. 正常请求前，如果 token 仍有足够有效期，就直接复用，避免每次接口都打 Keycloak；
   * 2. token 快过期或调用方 forceRefresh=true 时，使用 oidc-client-ts 的 signinSilent；
   * 3. 多个接口同时触发续期时复用同一个 Promise，避免并发打开多个 silent renew 流程；
   * 4. 续期失败时清理本地登录态，让 API 客户端返回“登录已过期，请重新登录”的明确提示。
   */
  const minValidSeconds = options.minValidSeconds ?? 60;
  const manager = getUserManager();
  const currentUser = await manager.getUser();
  const hasUsableToken = currentUser
    && !currentUser.expired
    && (currentUser.expires_in == null || currentUser.expires_in > minValidSeconds);

  if (!options.forceRefresh && hasUsableToken) {
    useAuthStore.setState({
      user: mapOidcUser(currentUser),
      accessToken: currentUser.access_token,
      status: "authenticated",
      error: null,
    });
    return currentUser.access_token;
  }

  if (!oidcRenewPromise) {
    oidcRenewPromise = manager.signinSilent()
      .then((renewedUser) => {
        if (!renewedUser || renewedUser.expired) {
          throw new Error("OIDC silent renew returned an expired session");
        }
        useAuthStore.setState({
          user: mapOidcUser(renewedUser),
          accessToken: renewedUser.access_token,
          status: "authenticated",
          error: null,
        });
        return renewedUser.access_token;
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "OIDC silent renew failed";
        useAuthStore.setState({
          user: null,
          accessToken: null,
          status: "anonymous",
          error: message,
        });
        return null;
      })
      .finally(() => {
        oidcRenewPromise = null;
      });
  }

  return oidcRenewPromise;
}
