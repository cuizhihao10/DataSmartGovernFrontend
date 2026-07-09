# 前端 Docker Compose 运行说明

## 运行入口

前端已经接入后端仓库的 `docker-compose.application.yml`。如果只想构建并启动前端容器，可以在后端仓库目录执行：

```powershell
docker compose -f docker-compose.yml -f docker-compose.application.yml up -d --build frontend
```

如果要启动完整平台，可以执行：

```powershell
docker compose -f docker-compose.yml -f docker-compose.application.yml up -d --build
```

启动后前端访问地址仍然是：

```text
http://localhost:5173
```

## 为什么容器内不用 Vite Dev Server

本地开发时使用 `npm run dev`，Vite 会提供热更新和开发代理，适合快速调试页面。

Docker Compose 中采用更接近生产的方式：

1. Node 构建阶段执行 `npm ci` 和 `npm run build`，生成 `dist` 静态产物。
2. Nginx 运行阶段只保留静态资源和代理配置，不携带源码、`node_modules` 或构建工具。
3. `/api` 请求由 Nginx 在 Compose 网络内转发到 `gateway:8080`，浏览器不需要直接访问后端微服务。
4. React Router 的页面刷新、深链跳转和 OIDC callback 都通过 `try_files ... /index.html` 回退到前端路由。

这种设计的好处是：镜像更小、启动更稳定、运行时攻击面更少，也更接近后续客户环境中的前端部署方式。

## Vite 环境变量的注意事项

`VITE_*` 变量会在构建期写入静态 JS 产物，而不是容器启动后动态读取。

因此，如果需要调整认证模式、OIDC 地址、API 前缀或前端标题，需要重新构建镜像：

```powershell
docker compose -f docker-compose.yml -f docker-compose.application.yml build frontend
docker compose -f docker-compose.yml -f docker-compose.application.yml up -d frontend
```

当前 Compose 默认配置：

- `VITE_API_BASE_URL=/api`
- `VITE_AUTH_MODE=oidc`
- `VITE_ENABLE_MOCK_FALLBACK=false`
- `VITE_OIDC_AUTHORITY=http://localhost:18080/realms/datasmart`
- `VITE_OIDC_CLIENT_ID=datasmart-gateway`
- `VITE_OIDC_REDIRECT_URI=http://localhost:5173/auth/callback`

## 与后端网关的关系

前端容器只代理到 `gateway`，不会直接代理到 `task-management`、`datasource-management`、`data-sync` 等业务微服务。

原因是网关承担统一认证、鉴权、审计、路由、限流和跨服务策略控制。如果前端绕过网关直连业务服务，就会破坏平台的安全边界和可观测边界。
