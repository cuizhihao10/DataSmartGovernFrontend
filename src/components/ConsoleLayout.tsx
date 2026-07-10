import {
  ApartmentOutlined,
  ApiOutlined,
  AuditOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  ClusterOutlined,
  CloudSyncOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  SafetyCertificateOutlined,
  ScheduleOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Avatar, Button, Layout, Menu, Select, Space, Tag, Typography } from "antd";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "@/api/endpoints";
import { useAuthStore } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";
import type { NavItem } from "@/types/domain";
import { labelOf, actorRoleLabels } from "@/utils/labels";

const { Header, Sider, Content } = Layout;

const navItems: Array<NavItem & { menuCode: string }> = [
  { key: "dashboard", menuCode: "dashboard", path: "/dashboard", label: "总览", icon: <BarChartOutlined /> },
  { key: "datasources", menuCode: "datasource", path: "/datasources", label: "数据源管理", icon: <DatabaseOutlined /> },
  { key: "sync", menuCode: "data-sync", path: "/sync", label: "数据同步", icon: <CloudSyncOutlined /> },
  { key: "tasks", menuCode: "task", path: "/tasks", label: "任务中心", icon: <ScheduleOutlined /> },
  { key: "quality", menuCode: "quality", path: "/quality", label: "数据质量", icon: <ExperimentOutlined /> },
  { key: "agent", menuCode: "agent-runtime", path: "/agent", label: "智能体助手", icon: <ClusterOutlined /> },
  { key: "observability", menuCode: "observability", path: "/observability", label: "运行监控", icon: <ApiOutlined /> },
  { key: "approvals", menuCode: "approval-center", path: "/approvals", label: "申请与审批", icon: <AuditOutlined /> },
  { key: "project-members", menuCode: "project-members", path: "/project-members", label: "项目成员", icon: <TeamOutlined /> },
  { key: "tenants", menuCode: "tenant-management", path: "/tenants", label: "租户管理", icon: <ApartmentOutlined /> },
  { key: "permissions", menuCode: "permission", path: "/permissions", label: "权限管理", icon: <SafetyCertificateOutlined /> },
  { key: "closure", menuCode: "closure", path: "/closure", label: "闭环验收", icon: <CheckCircleOutlined /> },
];

const fallbackMenuCodesByRole: Record<string, string[]> = {
  ORDINARY_USER: ["dashboard", "datasource", "data-sync", "task", "agent-runtime", "approval-center", "project-members"],
  PROJECT_OWNER: ["dashboard", "datasource", "data-sync", "task", "quality", "agent-runtime", "approval-center", "project-members"],
  OPERATOR: ["dashboard", "data-sync", "task", "observability", "approval-center", "project-members"],
  AUDITOR: ["dashboard", "agent-runtime", "observability", "project-members"],
  TENANT_ADMINISTRATOR: navItems
    .filter((item) => item.menuCode !== "tenant-management")
    .map((item) => item.menuCode),
  PLATFORM_ADMINISTRATOR: navItems.map((item) => item.menuCode),
};

export function ConsoleLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const collapsed = useUiStore((state) => state.collapsed);
  const setCollapsed = useUiStore((state) => state.setCollapsed);
  const selectedProjectId = useUiStore((state) => state.selectedProjectId);
  const setSelectedProjectId = useUiStore((state) => state.setSelectedProjectId);
  const setDiscoveredProjectOptions = useUiStore((state) => state.setProjectOptions);
  const authUser = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const sessionQuery = useQuery({
    queryKey: ["layout-gateway-session"],
    queryFn: api.getSession,
    retry: false,
  });
  const session = sessionQuery.data?.data;
  const actorRole = String(session?.actorRole ?? authUser?.actorRole ?? "").trim().toUpperCase();
  const administratorScope = ["TENANT_ADMINISTRATOR", "PLATFORM_ADMINISTRATOR"].includes(actorRole);
  const projectQuery = useQuery({
    queryKey: ["layout-permission-projects", session?.tenantId, session?.actorId, actorRole],
    queryFn: () => api.listProjects({ current: 1, size: 100, onlyMine: !administratorScope }),
    enabled: Boolean(session?.authenticated),
    retry: false,
  });
  const menuQuery = useQuery({
    queryKey: ["layout-permission-menus", session?.tenantId ?? authUser?.tenantId, actorRole],
    queryFn: () => api.listPermissionMenus(session?.tenantId ?? authUser?.tenantId, actorRole),
    enabled: Boolean(actorRole),
    retry: false,
  });
  const visibleNavItems = useMemo(() => {
    const apiMenuCodes = menuQuery.data?.data
      .filter((menu) => menu.enabled)
      .map((menu) => menu.menuCode);
    const menuCodes = menuQuery.data?.meta.source === "api"
      ? new Set(apiMenuCodes)
      : new Set(fallbackMenuCodesByRole[actorRole] ?? ["dashboard"]);
    return navItems.filter((item) => menuCodes.has(item.menuCode));
  }, [actorRole, menuQuery.data?.data, menuQuery.data?.meta.source]);
  const projectOptions = useMemo(() => {
    const optionMap = new Map<string, { value: string; label: string; tenantId?: number; tenantName?: string }>();
    (projectQuery.data?.data.records ?? []).forEach((project) => {
      optionMap.set(String(project.projectId), {
        value: String(project.projectId),
        label: actorRole === "PLATFORM_ADMINISTRATOR"
          ? `${project.tenantName || `租户 ${project.tenantId ?? "未知"}`} / ${project.projectName}`
          : project.projectName,
        tenantId: project.tenantId,
        tenantName: project.tenantName,
      });
    });
    session?.authorizedProjects?.forEach((project) => {
      const id = project.projectId ?? project.id;
      if (id != null && !optionMap.has(String(id))) {
        optionMap.set(String(id), {
          value: String(id),
          label: project.projectName ?? project.name ?? `未找到项目名称（ID ${id}）`,
          tenantId: project.tenantId,
        });
      }
    });
    session?.authorizedProjectIds?.forEach((id) => {
      if (!optionMap.has(String(id))) {
        optionMap.set(String(id), {
          value: String(id),
          label: `未找到项目名称（ID ${id}）`,
        });
      }
    });
    return Array.from(optionMap.values());
  }, [actorRole, projectQuery.data?.data.records, session?.authorizedProjectIds, session?.authorizedProjects]);
  const activeKey = visibleNavItems.find((item) => location.pathname.startsWith(item.path))?.key
    ?? visibleNavItems[0]?.key
    ?? "dashboard";

  useEffect(() => {
    /*
     * 项目切换器是整个控制台的数据范围入口，不能把上一个登录用户在业务列表里“发现到”的项目继续留给新用户。
     * 有 Keycloak/gateway session 时，授权项目集合才是可信来源；页面列表反推出来的项目只作为开发/异常场景兜底。
     */
    setSelectedProjectId(undefined);
    setDiscoveredProjectOptions([]);
  }, [authUser?.id, session?.actorId, setDiscoveredProjectOptions, setSelectedProjectId]);

  useEffect(() => {
    setDiscoveredProjectOptions(projectOptions);
  }, [projectOptions, setDiscoveredProjectOptions]);

  useEffect(() => {
    if (!projectOptions.length) {
      if (selectedProjectId) {
        setSelectedProjectId(undefined);
      }
      return;
    }
    if (!selectedProjectId || !projectOptions.some((option) => option.value === selectedProjectId)) {
      setSelectedProjectId(projectOptions[0].value);
    }
  }, [projectOptions, selectedProjectId, setSelectedProjectId]);

  useEffect(() => {
    if (menuQuery.data?.meta.source !== "api") {
      return;
    }
    const requestedMenu = navItems.find((item) => location.pathname.startsWith(item.path));
    if (requestedMenu && !visibleNavItems.some((item) => item.key === requestedMenu.key)) {
      navigate(visibleNavItems[0]?.path ?? "/dashboard", { replace: true });
    }
  }, [location.pathname, menuQuery.data?.meta.source, navigate, visibleNavItems]);

  return (
    <Layout className="app-shell">
      <Sider
        className="app-sider"
        collapsible
        collapsed={collapsed}
        trigger={null}
        width={232}
        collapsedWidth={64}
        breakpoint="lg"
        onBreakpoint={setCollapsed}
      >
        <div className="app-logo">
          <span className="app-logo-mark">
            <ApartmentOutlined />
          </span>
          {!collapsed ? <span className="app-logo-text">DataSmart Govern</span> : null}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[activeKey]}
          items={visibleNavItems.map((item) => ({
            key: item.key,
            icon: item.icon,
            label: item.label,
            onClick: () => navigate(item.path),
          }))}
        />
      </Sider>
      <Layout className="app-main-layout" style={{ marginLeft: collapsed ? 64 : 232 }}>
        <Header className="app-header">
          <Space size={12}>
            <Button
              type="text"
              aria-label={collapsed ? "展开导航" : "收起导航"}
              title={collapsed ? "展开导航" : "收起导航"}
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
            />
            <Typography.Text strong className="header-title">
              企业级多智能体数据治理平台
            </Typography.Text>
            <Tag color="blue">开发控制台</Tag>
          </Space>
          <Space size={10}>
            <Tag color="green">网关 8080</Tag>
            {projectOptions.length ? (
              <Select
                size="small"
                value={selectedProjectId ?? projectOptions[0]?.value}
                options={projectOptions}
                onChange={setSelectedProjectId}
                showSearch
                optionFilterProp="label"
                style={{ width: 240 }}
                aria-label="切换项目"
              />
            ) : null}
            {session || authUser ? <Tag color="blue">{labelOf(session?.actorRole ?? authUser?.actorRole, actorRoleLabels)}</Tag> : null}
            <Avatar style={{ backgroundColor: "#2563eb" }}>
              {authUser?.displayName?.slice(0, 1) ?? "C"}
            </Avatar>
            <Button
              type="text"
              aria-label="退出登录"
              title="退出登录"
              icon={<LogoutOutlined />}
              onClick={() => void logout()}
            />
          </Space>
        </Header>
        <Content className="app-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
