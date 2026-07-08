import { ApartmentOutlined, LoginOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Form, Input, Space, Tag, Typography } from "antd";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { oidcConfig } from "@/auth/config";
import { mockUsers } from "@/auth/mockUsers";
import { useAuthStore } from "@/store/authStore";

interface LoginFormValues {
  username: string;
  password: string;
}

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const mode = useAuthStore((state) => state.mode);
  const status = useAuthStore((state) => state.status);
  const error = useAuthStore((state) => state.error);
  const loginWithMock = useAuthStore((state) => state.loginWithMock);
  const loginWithOidc = useAuthStore((state) => state.loginWithOidc);
  const from = (location.state as { from?: string } | null)?.from || "/dashboard";

  if (status === "authenticated") {
    return <Navigate to={from} replace />;
  }

  const submitMockLogin = async (values: LoginFormValues) => {
    const ok = await loginWithMock(values.username, values.password);
    if (ok) {
      navigate(from, { replace: true });
    }
  };

  return (
    <div className="login-page">
      <Card className="login-card">
        <Space direction="vertical" size={22} style={{ width: "100%" }}>
          <div className="login-brand">
            <span className="login-mark">
              <ApartmentOutlined />
            </span>
            <div>
              <Typography.Title level={3} style={{ margin: 0 }}>
                DataSmart Govern
              </Typography.Title>
              <Typography.Text type="secondary">统一身份入口</Typography.Text>
            </div>
          </div>

          {error ? <Alert type="error" showIcon message={error} /> : null}

          {mode === "mock" ? (
            <Form<LoginFormValues>
              layout="vertical"
              initialValues={{ username: mockUsers[0]?.username }}
              onFinish={submitMockLogin}
            >
              <Form.Item name="username" label="账号" rules={[{ required: true, message: "请输入账号" }]}>
                <Input autoComplete="username" placeholder="project-owner" />
              </Form.Item>
              <Form.Item name="password" label="密码" rules={[{ required: true, message: "请输入密码" }]}>
                <Input.Password autoComplete="current-password" placeholder="DataSmart@123" />
              </Form.Item>
              <Button block type="primary" htmlType="submit" icon={<LoginOutlined />} data-testid="mock-login-submit">
                进入控制台
              </Button>
            </Form>
          ) : (
            <Space direction="vertical" size={14} style={{ width: "100%" }}>
              <Button block type="primary" icon={<SafetyCertificateOutlined />} onClick={loginWithOidc}>
                统一认证登录（Keycloak）
              </Button>
              <Card size="small">
                <Space direction="vertical" size={6}>
                  <Typography.Text type="secondary">认证地址</Typography.Text>
                  <Typography.Text className="mono">{oidcConfig.authority}</Typography.Text>
                  <Typography.Text type="secondary">客户端</Typography.Text>
                  <Tag color="blue">{oidcConfig.clientId}</Tag>
                </Space>
              </Card>
            </Space>
          )}
        </Space>
      </Card>
    </div>
  );
}
