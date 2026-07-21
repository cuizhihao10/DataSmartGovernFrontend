import type { PlatformApiResponse, RequestMeta, WithMeta } from "@/types/domain";
import { authMode } from "@/auth/config";
import { ensureApiAccessToken, getApiAccessToken } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
const enableMockFallback = import.meta.env.VITE_ENABLE_MOCK_FALLBACK !== "false";
const workspaceQueryKeys = ["workspaceId", "workspace_id", "workspaceKey", "workspace_key", "workspaceName", "workspace_name"];
const workspaceBodyKeys = new Set(workspaceQueryKeys.map((key) => key.toLowerCase()));
const projectContextHeader = "X-DataSmart-Project-Id";

function isProjectScopedBusinessPath(path: string) {
  return ["/datasource", "/sync", "/task", "/quality", "/agent"]
    .some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function isAgentWorkspacePath(path: string) {
  return path.startsWith("/agent/") || path === "/agent" || path.startsWith("/internal/agent-runtime/");
}

function sanitizeBusinessPath(path: string) {
  if (isAgentWorkspacePath(path)) {
    return path;
  }
  const url = new URL(path, "http://datasmart.local");
  workspaceQueryKeys.forEach((key) => url.searchParams.delete(key));
  return `${url.pathname}${url.search}${url.hash}`;
}

function stripWorkspaceFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripWorkspaceFields);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !workspaceBodyKeys.has(key.toLowerCase()))
      .map(([key, item]) => [key, stripWorkspaceFields(item)]),
  );
}

function sanitizeJsonBody(path: string, body: BodyInit | null | undefined) {
  if (isAgentWorkspacePath(path) || typeof body !== "string" || !body.trim()) {
    return body;
  }
  try {
    /*
     * FlashSync 用户侧业务已经收敛为“租户 -> 项目 -> 数据源/同步任务”，workspace 不再是表单、查询或创建请求的一部分。
     * 这里在 API 客户端底层做一次 JSON body 清洗，是为了兜住旧表单状态、浏览器缓存、导入模板或局部页面遗漏：
     * - Agent 路由保留 workspace，因为它表示工具执行沙箱；
     * - 普通业务路由删除 workspaceId/workspaceKey/workspaceName，避免后端继续收到不可见层级。
     */
    return JSON.stringify(stripWorkspaceFields(JSON.parse(body)));
  } catch {
    return body;
  }
}

function joinUrl(baseUrl: string, path: string) {
  const cleanBase = baseUrl.replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

function isPlatformEnvelope<T>(value: unknown): value is PlatformApiResponse<T> {
  if (!value || typeof value !== "object") {
    return false;
  }
  return "code" in value && "data" in value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readStringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function readFieldErrorMessages(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter(isRecord)
    .map((item) => {
      const field = typeof item.field === "string" ? item.field : "";
      const message = typeof item.message === "string" ? item.message : "";
      return [field, message].filter(Boolean).join(" ");
    })
    .filter(Boolean);
}

function uniqueMessages(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function platformErrorMessage(payload: PlatformApiResponse<unknown>, status: number) {
  const data = isRecord(payload.data) ? payload.data : undefined;
  const details = readStringList(data?.details);
  const fieldErrors = readFieldErrorMessages(data?.fieldErrors);
  const suggestions = readStringList(data?.suggestions);
  // 后端错误体会把“总体错误、字段错误、修复建议、traceId”拆开放在不同字段里。
  // 前端弹窗通常只接收一个 Error.message，因此这里把低敏、可展示的信息合并成一段文本。
  // 这样用户看到的不再是 HTTP 500/400，而是“哪个字段错了、为什么错、下一步怎么修”。
  const messages = uniqueMessages([
    payload.message || payload.reason || `HTTP ${status}`,
    ...details,
    ...fieldErrors,
    ...suggestions.map((item) => `建议：${item}`),
    payload.traceId ? `traceId: ${payload.traceId}` : "",
  ]);
  return messages.join("；");
}

function fallbackHttpErrorMessage(payload: unknown, status: number) {
  if (status === 401) {
    return "登录状态已过期或无效，请重新登录后再继续操作。";
  }
  /*
   * Gateway 容器发布或短暂重启时，前置 Nginx 可能返回自己的 HTML 错误页。HTML 不是业务错误
   * 详情，直接放进 Alert/Message 既无法帮助用户，也会把整段 `<html>...` 暴露到页面。
   * 这里只对非平台信封的网关类状态做低敏归一化；Java/Python 返回的结构化 JSON 仍由上面的
   * platformErrorMessage 展示真实原因、修复建议和 traceId。
   */
  if (status === 502) {
    return "服务网关暂时无法连接后端，请稍后重试；系统可能正在发布或恢复服务。";
  }
  if (status === 503) {
    return "服务暂时不可用，请稍后重试；如果持续出现，请联系管理员检查服务健康状态。";
  }
  if (status === 504) {
    return "服务处理超时，请稍后重试；本次请求尚未获得后端确认。";
  }
  if (isRecord(payload)) {
    const message = typeof payload.message === "string" ? payload.message : undefined;
    const error = typeof payload.error === "string" ? payload.error : undefined;
    const path = typeof payload.path === "string" ? payload.path : undefined;
    return [message || error || `HTTP ${status}`, path ? `path: ${path}` : ""].filter(Boolean).join("；");
  }
  if (typeof payload === "string" && payload.trim()) {
    const text = payload.trim();
    return /<\/?(?:html|head|body|title|center|h1)\b/i.test(text)
      ? `服务请求失败（HTTP ${status}），请稍后重试。`
      : text;
  }
  return `HTTP ${status}`;
}

function throwApiErrorFromPayload(payload: unknown, status: number): never {
  if (isPlatformEnvelope<unknown>(payload)) {
    throw new ApiError(platformErrorMessage(payload, status), {
      status,
      reason: payload.reason,
      traceId: payload.traceId,
    });
  }
  throw new ApiError(fallbackHttpErrorMessage(payload, status), { status });
}

function throwPlatformEnvelopeError(payload: PlatformApiResponse<unknown>, status: number): never {
  throw new ApiError(platformErrorMessage(payload, status), {
    status,
    reason: payload.reason,
    traceId: payload.traceId,
  });
}

async function applyAuthHeader(headers: Headers, forceRefresh = false) {
  const accessToken = forceRefresh
    ? await ensureApiAccessToken({ forceRefresh: true, minValidSeconds: 1 })
    : await ensureApiAccessToken({ minValidSeconds: 60 }) ?? getApiAccessToken();
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
}

async function buildHeaders(
  path: string,
  initHeaders: HeadersInit | undefined,
  accept: string,
  contentType?: string,
  forceRefresh = false,
) {
  const headers = new Headers(initHeaders);
  headers.set("Accept", accept);
  if (contentType) {
    headers.set("Content-Type", contentType);
  }
  await applyAuthHeader(headers, forceRefresh);
  const selectedProjectId = useUiStore.getState().selectedProjectId;
  if (isProjectScopedBusinessPath(path) && /^\d+$/.test(selectedProjectId || "") && Number(selectedProjectId) > 0) {
    headers.set(projectContextHeader, selectedProjectId as string);
  } else {
    headers.delete(projectContextHeader);
  }
  if (!isAgentWorkspacePath(path)) {
    headers.delete("X-DataSmart-Workspace-Id");
    headers.delete("X-DataSmart-Workspace-Risk-Level");
  }
  return headers;
}

function fileNameFromDisposition(value: string | null) {
  if (!value) return undefined;
  const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1].replace(/"/g, ""));
  const quotedMatch = value.match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) return quotedMatch[1];
  const plainMatch = value.match(/filename=([^;]+)/i);
  return plainMatch?.[1]?.trim();
}

export class ApiError extends Error {
  readonly status?: number;
  readonly reason?: string;
  readonly traceId?: string;

  constructor(message: string, options: { status?: number; reason?: string; traceId?: string } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.reason = options.reason;
    this.traceId = options.traceId;
  }
}

async function fetchWithAuthRetry(
  path: string,
  init: RequestInit | undefined,
  accept: string,
  contentType?: string,
) {
  const sanitizedPath = sanitizeBusinessPath(path);
  const url = joinUrl(apiBaseUrl, sanitizedPath);
  const body = sanitizeJsonBody(sanitizedPath, init?.body);
  const buildInit = async (forceRefresh = false): Promise<RequestInit> => ({
    ...init,
    body,
    headers: await buildHeaders(sanitizedPath, init?.headers, accept, contentType, forceRefresh),
  });

  /*
   * 所有业务接口统一走这里，是为了把登录态恢复变成“平台能力”而不是散落在每个页面的补丁。
   * Keycloak access token 过期时 gateway 返回 401 是正确行为，但用户体验上不能要求用户刷新页面。
   * 因此这里采用两段式防护：
   * - 第一次请求前由 buildHeaders 主动检查 token 剩余有效期，快过期就静默续期；
   * - 如果服务端仍返回 401，再强制 silent renew 一次并重放原请求。
   * 重放只做一次，避免凭证确实失效时出现无限循环，也避免重复提交有副作用的业务请求。
   */
  let response = await fetch(url, await buildInit(false));
  if (response.status === 401 && authMode === "oidc") {
    const refreshedToken = await ensureApiAccessToken({ forceRefresh: true, minValidSeconds: 1 });
    if (refreshedToken) {
      response = await fetch(url, await buildInit(false));
    }
  }
  return response;
}

export async function request<T>(path: string, init?: RequestInit): Promise<WithMeta<T>> {
  const sanitizedPath = sanitizeBusinessPath(path);
  const response = await fetchWithAuthRetry(sanitizedPath, init, "application/json", "application/json");

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    throwApiErrorFromPayload(payload, response.status);
  }

  if (isPlatformEnvelope<T>(payload)) {
    if (payload.code !== 0) {
      throwPlatformEnvelopeError(payload, response.status);
    }
    return {
      data: payload.data,
      meta: {
        source: "api",
        traceId: payload.traceId,
        message: payload.message,
      },
    };
  }

  return {
    data: payload as T,
    meta: {
      source: "api",
    },
  };
}

export async function requestForm<T>(path: string, formData: FormData, init?: RequestInit): Promise<WithMeta<T>> {
  const sanitizedPath = sanitizeBusinessPath(path);
  const response = await fetchWithAuthRetry(sanitizedPath, {
    ...init,
    method: init?.method ?? "POST",
    body: formData,
  }, "application/json");

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    throwApiErrorFromPayload(payload, response.status);
  }

  if (isPlatformEnvelope<T>(payload)) {
    if (payload.code !== 0) {
      throwPlatformEnvelopeError(payload, response.status);
    }
    return {
      data: payload.data,
      meta: {
        source: "api",
        traceId: payload.traceId,
        message: payload.message,
      },
    };
  }

  return {
    data: payload as T,
    meta: {
      source: "api",
    },
  };
}

export async function requestFile(path: string, init?: RequestInit) {
  const sanitizedPath = sanitizeBusinessPath(path);
  const response = await fetchWithAuthRetry(sanitizedPath, init, "*/*");

  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const payload = await response.json();
      throwApiErrorFromPayload(payload, response.status);
    }
    throw new ApiError(
      response.status === 401 ? "登录状态已过期，请重新登录后再继续操作。" : `HTTP ${response.status}`,
      { status: response.status },
    );
  }

  return {
    data: {
      blob: await response.blob(),
      fileName: fileNameFromDisposition(response.headers.get("content-disposition")),
      contentType: response.headers.get("content-type") ?? undefined,
    },
    meta: {
      source: "api" as const,
    },
  };
}

export async function requestWithFallback<T>(
  path: string,
  fallback: T,
  init?: RequestInit,
): Promise<WithMeta<T>> {
  const allowMockFallback = enableMockFallback && authMode === "mock";
  if (!allowMockFallback) {
    return request<T>(path, init);
  }

  try {
    return await request<T>(path, init);
  } catch (error) {
    const meta: RequestMeta = {
      source: "mock",
      message: error instanceof Error ? error.message : "mock fallback",
    };
    return { data: fallback, meta };
  }
}
