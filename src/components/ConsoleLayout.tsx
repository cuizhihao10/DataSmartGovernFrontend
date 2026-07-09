import {
  ApartmentOutlined,
  ApiOutlined,
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

const navItems: NavItem[] = [
  { key: "dashboard", path: "/dashboard", label: "总览", icon: <BarChartOutlined /> },
  { key: "datasources", path: "/datasources", label: "数据源管理", icon: <DatabaseOutlined /> },
  { key: "sync", path: "/sync", label: "数据同步", icon: <CloudSyncOutlined /> },
  { key: "tasks", path: "/tasks", label: "任务中心", icon: <ScheduleOutlined /> },
  { key: "quality", path: "/quality", label: "数据质量", icon: <ExperimentOutlined /> },
  { key: "agent", path: "/agent", label: "智能体助手", icon: <ClusterOutlined /> },
  { key: "observability", path: "/observability", label: "运行监控", icon: <ApiOutlined /> },
  { key: "permissions", path: "/permissions", label: "权限管理", icon: <SafetyCertificateOutlined /> },
  { key: "closure", path: "/closure", label: "闭环验收", icon: <CheckCircleOutlined /> },
];

export function ConsoleLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const collapsed = useUiStore((state) => state.collapsed);
  const setCollapsed = useUiStore((state) => state.setCollapsed);
  const selectedProjectId = useUiStore((state) => state.selectedProjectId);
  const setSelectedProjectId = useUiStore((state) => state.setSelectedProjectId);
  const discoveredProjectOptions = useUiStore((state) => state.projectOptions);
  const setDiscoveredProjectOptions = useUiStore((state) => state.setProjectOptions);
  const authUser = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const sessionQuery = useQuery({
    queryKey: ["layout-gateway-session"],
    queryFn: api.getSession,
    retry: false,
  });
  const session = sessionQuery.data?.data;
  const sessionProjectOptions = useMemo(() => {
    if (session?.authorizedProjects?.length) {
      return session.authorizedProjects
        .map((project) => {
          const id = project.projectId ?? project.id;
          if (id == null) return null;
          return {
            value: String(id),
            label: project.projectName ?? project.name ?? `项目 ${id}`,
          };
        })
        .filter((option): option is { value: string; label: string } => Boolean(option));
    }
    const ids = session?.authorizedProjectIds?.length ? session.authorizedProjectIds : [];
    return Array.from(new Set(ids.map((id) => String(id)))).map((id) => ({ value: id, label: session?.projectName ?? `项目 ${id}` }));
  }, [session?.authorizedProjectIds, session?.authorizedProjects, session?.projectName]);
  const projectOptions = useMemo(() => {
    if (sessionProjectOptions.length) {
      return sessionProjectOptions;
    }
    const optionMap = new Map<string, { value: string; label: string }>();
    discoveredProjectOptions.forEach((option) => {
      if (option.value && !optionMap.has(option.value)) {
        optionMap.set(option.value, option);
      }
    });
    return Array.from(optionMap.values());
  }, [discoveredProjectOptions, sessionProjectOptions]);
  const activeKey = navItems.find((item) => location.pathname.startsWith(item.path))?.key ?? "dashboard";

  useEffect(() => {
    /*
     * 项目切换器是整个控制台的数据范围入口，不能把上一个登录用户在业务列表里“发现到”的项目继续留给新用户。
     * 有 Keycloak/gateway session 时，授权项目集合才是可信来源；页面列表反推出来的项目只作为开发/异常场景兜底。
     */
    setSelectedProjectId(undefined);
    setDiscoveredProjectOptions([]);
  }, [authUser?.id, session?.actorId, setDiscoveredProjectOptions, setSelectedProjectId]);

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

  return (
    <Layout className="app-shell">
      <Sider
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
          items={navItems.map((item) => ({
            key: item.key,
            icon: item.icon,
            label: item.label,
            onClick: () => navigate(item.path),
          }))}
        />
      </Sider>
      <Layout>
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
                style={{ width: 132 }}
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
