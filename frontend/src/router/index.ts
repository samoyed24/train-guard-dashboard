import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";

import DashboardLayout from "../views/DashboardLayout.vue";
import LoginView from "../views/LoginView.vue";
import RegisterView from "../views/RegisterView.vue";
import ApplicationsView from "../views/ApplicationsView.vue";
import ConfigCenterView from "../views/ConfigCenterView.vue";
import MetricsView from "../views/MetricsView.vue";

const routes = [
  { path: "/login", component: LoginView, meta: { title: "登录" } },
  { path: "/register", component: RegisterView, meta: { title: "注册" } },
  {
    path: "/",
    component: DashboardLayout,
    meta: { requiresAuth: true, title: "控制台" },
    children: [
      { path: "", redirect: "/apps" },
      { path: "apps", component: ApplicationsView, meta: { title: "应用管理" } },
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
    return "/apps";
  }

  return true;
});

export default router;
