import { createRouter, createWebHistory } from "vue-router";
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
  { path: "/login", component: LoginView, meta: { title: "登录" } },
  { path: "/register", component: RegisterView, meta: { title: "注册" } },
  {
    path: "/",
    component: DashboardLayout,
    meta: { requiresAuth: true, title: "控制台" },
    children: [
      { path: "", redirect: "/dashboard" },
      { path: "dashboard", component: DashboardHomeView, meta: { title: "概览看板" } },
      { path: "apps", component: ApplicationsView, meta: { title: "应用管理" } },
      { path: "team", component: TeamManagementView, meta: { title: "团队管理" } },
      { path: "configs", component: ConfigCenterView, meta: { title: "配置中心" } },
      { path: "metrics", component: MetricsView, meta: { title: "训练数据" } },
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

export default router;
