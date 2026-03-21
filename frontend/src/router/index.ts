import { createRouter, createWebHistory } from "vue-router";
import { i18n } from "../i18n";
import { useAuthStore } from "../stores/auth";

import DashboardLayout from "../views/DashboardLayout.vue";
import LoginView from "../views/LoginView.vue";
import RegisterView from "../views/RegisterView.vue";
import DashboardHomeView from "../views/DashboardHomeView.vue";
import ApplicationsView from "../views/ApplicationsView.vue";
import ConfigCenterView from "../views/ConfigCenterView.vue";
import MetricsView from "../views/MetricsView.vue";
import TeamManagementView from "../views/TeamManagementView.vue";

const routes = [
  { path: "/login", component: LoginView, meta: { titleKey: "routes.login" } },
  { path: "/register", component: RegisterView, meta: { titleKey: "routes.register" } },
  {
    path: "/",
    component: DashboardLayout,
    meta: { requiresAuth: true, titleKey: "routes.dashboard" },
    children: [
      { path: "", redirect: "/dashboard" },
      { path: "dashboard", component: DashboardHomeView, meta: { titleKey: "routes.dashboardHome" } },
      { path: "apps", component: ApplicationsView, meta: { titleKey: "routes.apps" } },
      { path: "team", component: TeamManagementView, meta: { titleKey: "routes.team" } },
      { path: "configs", component: ConfigCenterView, meta: { titleKey: "routes.configs" } },
      { path: "metrics", component: MetricsView, meta: { titleKey: "routes.metrics" } },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.beforeEach(async (to) => {
  const store = useAuthStore();
  const token = localStorage.getItem("token");

  if (to.meta.requiresAuth && !token) {
    return "/login";
  }

  if (token && !store.user) {
    try {
      await store.fetchMe();
    } catch {
      return "/login";
    }
  }

  if ((to.path === "/login" || to.path === "/register") && token) {
    return "/dashboard";
  }

  return true;
});

router.afterEach((to) => {
  const titleKey = typeof to.meta?.titleKey === "string" ? String(to.meta.titleKey) : "common.dashboard";
  document.title = `${i18n.global.t(titleKey)} · ${i18n.global.t("common.appName")}`;
});

export default router;
