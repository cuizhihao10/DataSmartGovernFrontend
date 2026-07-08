import { Spin } from "antd";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";

export function AuthProvider({ children }: { children: ReactNode }) {
  const status = useAuthStore((state) => state.status);
  const bootstrap = useAuthStore((state) => state.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  if (status === "bootstrapping") {
    return (
      <div className="auth-loading">
        <Spin size="large" />
      </div>
    );
  }

  return children;
}
