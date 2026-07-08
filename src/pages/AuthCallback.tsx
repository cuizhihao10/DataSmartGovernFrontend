import { Alert, Button, Card, Result, Spin } from "antd";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";

let oidcCallbackUrl: string | null = null;
let oidcCallbackPromise: Promise<void> | null = null;

function consumeOidcCallbackOnce(callbackUrl: string, completeOidcLogin: () => Promise<void>) {
  if (oidcCallbackUrl !== callbackUrl) {
    oidcCallbackUrl = callbackUrl;
    oidcCallbackPromise = completeOidcLogin();
  }
  return oidcCallbackPromise ?? Promise.reject(new Error("OIDC callback was not initialized"));
}

export function AuthCallback() {
  const navigate = useNavigate();
  const completeOidcLogin = useAuthStore((state) => state.completeOidcLogin);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    consumeOidcCallbackOnce(window.location.href, completeOidcLogin)
      .then(() => {
        if (active) {
          navigate("/dashboard", { replace: true });
        }
      })
      .catch((callbackError: unknown) => {
        if (active) {
          setError(callbackError instanceof Error ? callbackError.message : "登录回调失败");
        }
      });
    return () => {
      active = false;
    };
  }, [completeOidcLogin, navigate]);

  if (error) {
    return (
      <div className="login-page">
        <Card className="login-card">
          <Result
            status="error"
            title="登录回调失败"
            subTitle={<Alert type="error" showIcon message={error} />}
            extra={
              <Button type="primary" onClick={() => navigate("/login", { replace: true })}>
                返回登录
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="auth-loading">
      <Spin size="large" />
    </div>
  );
}
