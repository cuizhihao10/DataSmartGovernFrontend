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

## Agent 历史会话能力（2026-08-05）

智能助手页面已经接入后端 durable Agent session：

- 左侧会话栏只展示当前项目、当前用户可访问的历史会话，并区分进行中与已归档会话。
- 用户可以置顶、取消置顶、归档、恢复会话；这些操作更新后端会话事实，不只保存在浏览器状态中。
- 智能助手只保留一个协作窗口：未开始时用于提交新目标，打开历史后同一位置变为追问输入；只有左侧“+”明确创建新会话。
- 打开历史会话时恢复用户可见消息；继续追问显式携带原 `agentRuntimeSessionId`，只在该 session 下创建新的 Run。
- 历史回合按“用户输入 → 处理过程 → Agent 回答”重建。处理过程默认折叠为状态和耗时，展开后展示持久化
  Run 中的公开模型决策、真实工具/API 审计、脱敏参数、低敏结构化结果、错误证据和每一步耗时。
- 切换项目时主动清空当前会话、执行结果和补充输入，避免前一个项目的会话状态残留到新项目。
- 前端不会显示或保存模型隐藏推理，只展示经过治理、允许用户查看的公开模型输出和可审计执行事实。

本轮验证已通过 `npm run lint` 与 `npm run build`。Vite 仍提示主 JavaScript bundle 大于 `500kB`，后续应按页面和大型依赖做路由级拆包，但该 warning 不阻断当前功能交付。

## Agent 补参失败恢复（2026-08-05）

- Agent 已完成数据源、对象映射和字段映射核对，但 Java 控制面接入失败时，页面会保留当前表单，不再只显示一次性错误弹窗。
- 常驻恢复面板会展示保留的数据源 ID、对象映射数量、同步字段数量以及后端返回的具体低敏原因和修复建议。
- 用户可以直接使用当前配置重试、继续自然语言补充或纠偏、打开高级配置检查，或在确有旧 Run 正在执行时新建会话重试。
- 重试读取当前页面表单中的最新配置，不使用上一轮成功响应里的旧缺参快照；旧的“待补充”提示在恢复期间不再覆盖当前真实配置状态。
- 本轮 `npm run lint` 和 `npm run build` 均通过；生产构建仍只有既有的大 bundle warning。

## Agent 单回合连续处理（2026-08-05）

- 一条用户目标可以包含多次模型规划、工具调用、任务缺项填写、预览确认、自动续跑和失败恢复，但不会再为每个
  内部 Run 重复显示最初的用户输入。
- 只有初始目标和用户在会话输入框中真正发送的自然语言补充/纠偏生成用户气泡；高级配置保存与审批按钮是可审计
  动作事实，不伪装成追问。
- 历史 Run 按来源显示“已提交任务配置”“已完成确认操作”“Agent 自动继续”“Agent 故障恢复”等标签，过程
  默认折叠，展开后继续展示公开模型输出、真实工具/API、脱敏参数、结果和错误证据。
- 旧会话在后端 V4 迁移执行前也会保守隐藏完全重复 objective 的遗留 USER 记录；不同内容的真实历史追问不会被
  文本去重。新会话依赖后端明确来源，因此用户有意重复一句话仍会被正确保留。
- 本轮 `npm run lint` 与 `npm run build` 均通过；Vite 仍只有既有的大 bundle warning。

## Agent 历史失败自助恢复（2026-08-05）

- 打开失败历史会话时，页面从持久化审计恢复任务名称、同步/写入模式、数据源、对象与字段映射、WHERE、SQL 和调度
  配置，不再把历史页面当作只读播放记录。
- 缺参判断以当前已恢复配置为准：旧连接测试失败不会覆盖后来已经确认的数据源 ID，非映射类失败也不会凭空要求
  用户重填对象映射或字段映射。
- 失败面板区分“真实缺项”和“业务/工具失败”。确有缺项时优先提交补充；配置完整时优先让 Agent 继续诊断，
  同时保留“使用当前配置重新核对”和“打开高级配置”人工接管入口。
- 历史会话输入框中的自然语言会即时生成用户气泡，并复用当前 runtime session 创建新 Run；表单、审批和系统恢复
  不生成用户气泡。旧版本中重复 objective 且缺少 `latestUserMessage` 证据的伪追问会被兼容隐藏。
- 真实页面回归确认源端 `#27`、目标端 `#28`、2 条对象映射和 10 个同步字段均可恢复，诊断和高级编辑按钮可用。
  `npm run lint` 与 `npm run build` 通过；Vite 仅保留既有的大 bundle warning。

## Agent 任务提交终态（2026-08-05）

- Agent 创建的即时任务在 `sync.task.run` 成功后进入只读终态；定期与实时任务在 `sync.task.publish` 成功后进入只读终态。
- 进入终态后保留 Agent 过程、最终结果、任务 ID、执行 ID、任务列表入口和当前会话输入框，但移除本轮旧任务的补参、编辑、审核、确认与拒绝入口，避免同一任务重复提交。
- 重新打开历史会话时，前端会同时检查持久化工具审计和工具结果；已提交任务只恢复成功结果卡，失败、缺参和待审批任务仍恢复原有 Agent 诊断与人工接管能力。

## 六 Agent 协作可观察性（2026-08-07）

- “与 Agent 协作”把 `DATASOURCE_AGENT`、`DATA_SYNC_AGENT`、`PRECHECK_AGENT`、`KNOWLEDGE_AGENT`、`RECOVERY_AGENT` 和 `MONITOR_AGENT` 的公开结果投影到同一条过程时间线；每项结果会显示处理中、完成、失败、待补参或待审批状态，并保留对应 Specialist 明细面板。
- 实时 NDJSON 过程先展示流式 Specialist 动作，最终 Durable 计划或会话消息到达后按稳定的 Agent/turn 标识覆盖临时状态，避免同一 Agent 在主时间线重复出现两次。
- 历史会话的过程折叠条同样恢复 Specialist 结果、低敏工具活动、证据引用、缺参和审批状态；展开后可使用已有的补参、审批定位、故障诊断和任务详情入口。不会显示模型隐藏推理、原始 prompt、凭据或工具参数。
- Agent 结果兼容 Java camelCase 与 Python snake_case 的批次、对象映射、字段映射和审批字段；源/目标表、字段类型、WHERE、显式禁用字段等信息能进入统一的任务审核表单和手工编辑器。
- `sync.task.run` 或定期/实时任务的 `sync.task.publish` 成功后，旧 Run 的补参、审批、编辑和重复提交入口会一并收起；任务详情跳转与会话续聊仍然可用。
- 本轮 `npm run lint` 和 `npm run build` 均通过；Vite 仍提示主 JavaScript bundle 大于 `500kB`，属于现有拆包优化项，不阻断本次前端功能。

## Agent 生命周期 Run 选择（2026-08-07）

- 完整任务生命周期同时存在 `controlPlaneIngestion` 与 Durable turn 时，前端始终选择最后一个拥有完整 `sessionId/runId` 的 Durable turn；该 Run 才包含草稿、预检查、审批、发布与执行工具，避免误确认首轮数据源元数据 Run。
- 只有后端确实未返回任何完整 Durable turn 时，页面才回退到 `controlPlaneIngestion`。会话绑定、历史消息关联、审计轮询与确认按钮复用同一个选择函数，防止页面不同区域观察或提交不同 Run。
- 可执行回归测试：`npm run test:agent-control-plane`，覆盖生命周期 Run 优先、回退、忽略部分标识与拒绝拼接不完整标识四种情况。

## 受治理执行与实时审计（2026-08-09）

- 每个 Durable Run 都必须经过当前用户的明确确认；续跑发现新的 `WAITING_CONFIRMATION`、`requiresConfirmation=true` 或待审批工具时会停止自动链路，并把新的 Run 留回现有审核入口，不复用首轮确认。
- Agent Console 的会话、运行、Specialist durable fact 查询都带当前项目范围；切换项目会清理旧的活动选择，避免跨项目复用浏览器缓存。
- Console 通过运行事件 WebSocket `/api/agent/events/ws` 接收低敏事件。握手协商 `datasmart-agent-events-v1` 子协议；存在 OIDC access token 时，第二个子协议为 `datasmart-bearer-v1.<base64url-access-token>`。令牌不会出现在 URL（包括查询参数）或控制帧中。
- WebSocket 错误会通过错误回调报告。连接关闭、Socket 不可用或 access token 获取失败时，客户端先进行 REST 回放，再按指数退避重连；REST 回放失败会报告错误并使当前项目范围的运行事件查询失效。订阅、ack 和回放共同补偿同一运行时间线；原始 prompt、SQL、工具参数、连接信息和模型正文不进入页面。
- DataSync 的 Agent 任务深链只在任务详情成功加载后消费；网关或服务短暂失败提供重试，`401/403/404` 则按项目权限/资源不存在的稳定结果处理。
- 可执行回归测试：`npm run test:api-adapter-contract`、`npm run test:agent-confirmation-gate`、`npm run test:agent-console-live-contract`、`npm run test:data-sync-agent-locator`，以及既有的 `npm run test:agent-control-plane` 和 `npm run test:agent-specialist-audit`。
