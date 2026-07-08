# DataSmart Govern Frontend

企业级多智能体数据治理平台前端控制台。

## 技术栈

- Vite
- React 18
- TypeScript
- Ant Design 5
- React Router
- TanStack Query
- Zustand

## 本地运行

```powershell
npm install
npm run dev
```

默认通过 `/api` 访问 `DataSmartGovernBackend` 的 gateway。后端未启动时，前端会使用本地 mock 数据保持页面可浏览。

OIDC 模式下请使用 `http://localhost:5173` 打开前端，和 Keycloak client 的 redirect URI 保持同源。

## 登录模式

默认使用本地 mock 登录：

```text
VITE_AUTH_MODE=mock
```

可用本地账号来自后端 Keycloak realm 样例：

```text
project-owner / DataSmart@123
operator / DataSmart@123
auditor / DataSmart@123
platform-admin / DataSmart@123
```

联调 Keycloak 时改为：

```text
VITE_AUTH_MODE=oidc
VITE_OIDC_AUTHORITY=http://localhost:18080/realms/datasmart
VITE_OIDC_CLIENT_ID=datasmart-gateway
```

OIDC 模式使用 Authorization Code + PKCE，登录后前端只把 `Authorization: Bearer <access_token>` 发送给 gateway，不伪造 `X-DataSmart-*` 身份 Header。

## 目录说明

- `src/api`: 网关 API 适配和 mock fallback
- `src/components`: 控制台通用组件
- `src/pages`: 产品页面
- `src/store`: 轻量 UI 状态
- `src/types`: 领域类型
