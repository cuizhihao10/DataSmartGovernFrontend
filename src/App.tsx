import { createBrowserRouter, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/auth/ProtectedRoute";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { AgentConsole } from "@/pages/AgentConsole";
import { ApprovalCenter } from "@/pages/ApprovalCenter";
import { AuthCallback } from "@/pages/AuthCallback";
import { Closure } from "@/pages/Closure";
import { Dashboard } from "@/pages/Dashboard";
import { DataSources } from "@/pages/DataSources";
import { DataSync } from "@/pages/DataSync";
import { Login } from "@/pages/Login";
import { Observability } from "@/pages/Observability";
import { Permissions } from "@/pages/Permissions";
import { ProjectMembers } from "@/pages/ProjectMembers";
import { Quality } from "@/pages/Quality";
import { Tasks } from "@/pages/Tasks";
import { TenantManagement } from "@/pages/TenantManagement";

export const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  { path: "/auth/callback", element: <AuthCallback /> },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <ConsoleLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <Dashboard /> },
      { path: "datasources", element: <DataSources /> },
      { path: "sync", element: <DataSync /> },
      { path: "tasks", element: <Tasks /> },
      { path: "quality", element: <Quality /> },
      { path: "agent", element: <AgentConsole /> },
      { path: "approvals", element: <ApprovalCenter /> },
      { path: "project-members", element: <ProjectMembers /> },
      { path: "observability", element: <Observability /> },
      { path: "permissions", element: <Permissions /> },
      { path: "tenants", element: <TenantManagement /> },
      { path: "closure", element: <Closure /> },
    ],
  },
]);
