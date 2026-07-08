import type { ThemeConfig } from "antd";

export const themeConfig: ThemeConfig = {
  token: {
    colorPrimary: "#2563eb",
    colorSuccess: "#0f9f6e",
    colorWarning: "#d97706",
    colorError: "#dc2626",
    colorInfo: "#2563eb",
    colorTextBase: "#172033",
    colorBgLayout: "#f5f7fb",
    borderRadius: 6,
    wireframe: false,
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },
  components: {
    Layout: {
      siderBg: "#172033",
      triggerBg: "#172033",
      headerBg: "#ffffff",
    },
    Menu: {
      darkItemBg: "#172033",
      darkSubMenuItemBg: "#111827",
      darkItemSelectedBg: "#2563eb",
      itemBorderRadius: 6,
    },
    Card: {
      borderRadiusLG: 8,
    },
    Table: {
      headerBg: "#f7f9fc",
      borderColor: "#e6ebf2",
    },
  },
};
