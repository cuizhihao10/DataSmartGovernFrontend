# 前端镜像采用“构建阶段 + 运行阶段”的多阶段模式：
# 1. build 阶段使用 Node 安装依赖并执行 Vite 构建；
# 2. runtime 阶段只保留 Nginx 和 dist 静态产物，不把 node_modules、源码历史或构建工具带进运行镜像。
# 这样比容器中直接跑 `npm run dev` 更接近生产部署，也能降低镜像体积和攻击面。

ARG NODE_IMAGE=docker.m.daocloud.io/library/node:22-alpine
ARG NGINX_IMAGE=docker.m.daocloud.io/library/nginx:1.27-alpine

FROM ${NODE_IMAGE} AS build

WORKDIR /app

# 先复制依赖清单，再执行 npm ci，是为了利用 Docker layer cache：
# 只要 package.json/package-lock.json 没变，后续修改业务代码时不会重复下载全部依赖。
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite 的 VITE_* 变量会在构建期写入前端产物，而不是容器启动后动态读取。
# 因此这些参数由 Compose 的 build.args 注入，保证前端静态资源里使用正确的 API、认证和 OIDC 地址。
ARG VITE_API_BASE_URL=/api
ARG VITE_ENABLE_MOCK_FALLBACK=false
ARG VITE_APP_TITLE=DataSmart Govern
ARG VITE_AUTH_MODE=oidc
ARG VITE_OIDC_AUTHORITY=http://localhost:18080/realms/datasmart
ARG VITE_OIDC_CLIENT_ID=datasmart-gateway
ARG VITE_OIDC_SCOPE="openid profile email"
ARG VITE_OIDC_REDIRECT_URI=http://localhost:5173/auth/callback
ARG VITE_OIDC_POST_LOGOUT_REDIRECT_URI=http://localhost:5173/login

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_ENABLE_MOCK_FALLBACK=${VITE_ENABLE_MOCK_FALLBACK}
ENV VITE_APP_TITLE=${VITE_APP_TITLE}
ENV VITE_AUTH_MODE=${VITE_AUTH_MODE}
ENV VITE_OIDC_AUTHORITY=${VITE_OIDC_AUTHORITY}
ENV VITE_OIDC_CLIENT_ID=${VITE_OIDC_CLIENT_ID}
ENV VITE_OIDC_SCOPE=${VITE_OIDC_SCOPE}
ENV VITE_OIDC_REDIRECT_URI=${VITE_OIDC_REDIRECT_URI}
ENV VITE_OIDC_POST_LOGOUT_REDIRECT_URI=${VITE_OIDC_POST_LOGOUT_REDIRECT_URI}

RUN npm run build

FROM ${NGINX_IMAGE} AS runtime

# 自定义站点配置负责两件事：
# 1. React Router 的前端路由全部回退到 index.html；
# 2. `/api` 统一反向代理到 Compose 网络中的 gateway 服务，浏览器仍然只访问 localhost:5173。
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# Nginx Alpine 镜像内置 busybox wget，可用于轻量健康检查。
# 健康检查只验证静态站点容器本身是否能响应，不把后端 gateway 健康混入前端容器健康状态。
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz || exit 1
