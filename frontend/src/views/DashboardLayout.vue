<template>
  <div class="dashboard-shell">
    <aside class="dashboard-sidebar">
      <div class="brand-block">
        <p class="brand-kicker">Train Guard</p>
        <h1>Control Hub</h1>
        <span>Model Ops / Configuration</span>
      </div>

      <el-menu class="nav-menu" :default-active="route.path" router>
        <el-menu-item index="/apps">应用管理</el-menu-item>
        <el-menu-item index="/configs">配置中心</el-menu-item>
        <el-menu-item index="/metrics">训练数据</el-menu-item>
      </el-menu>

      <div class="sidebar-foot">
        <span class="dot"></span>
        <span>API MODE {{ apiMode }}</span>
      </div>
    </aside>

    <main class="dashboard-main">
      <header class="dashboard-topbar">
        <div class="topbar-heading">
          <p class="topbar-kicker">Train Guard Dashboard</p>
          <h2>{{ pageTitle }}</h2>
        </div>
        <div class="topbar-user">
          <span class="user-badge">{{ userInitial }}</span>
          <span class="user-name">{{ auth.user?.name || "未登录" }}</span>
          <el-button size="small" class="ghost-btn" @click="logout">退出</el-button>
        </div>
      </header>

      <section class="dashboard-content">
        <nav class="dashboard-breadcrumb-wrap" aria-label="Breadcrumb">
          <el-breadcrumb class="dashboard-breadcrumb" separator="/">
            <el-breadcrumb-item
              v-for="(item, index) in breadcrumbItems"
              :key="item.path + item.title"
            >
              <router-link
                v-if="index < breadcrumbItems.length - 1"
                :to="item.path === '/' ? '/apps' : item.path"
              >
                {{ item.title }}
              </router-link>
              <span v-else>{{ item.title }}</span>
            </el-breadcrumb-item>
          </el-breadcrumb>
        </nav>

        <router-view v-slot="{ Component, route: childRoute }">
          <transition name="page-fade-slide" mode="out-in">
            <component :is="Component" :key="childRoute.fullPath" />
          </transition>
        </router-view>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useAuthStore } from "../stores/auth";

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const apiMode = String(import.meta.env.VITE_API_MODE ?? "mock").toUpperCase();

const breadcrumbItems = computed(() => {
  return route.matched
    .filter((record) => typeof record.meta?.title === "string")
    .map((record) => ({
      title: String(record.meta.title),
      path: record.path,
    }));
});

const pageTitle = computed(() => breadcrumbItems.value[breadcrumbItems.value.length - 1]?.title || "控制台");
const userInitial = computed(() => (auth.user?.name || "U").slice(0, 1).toUpperCase());

const logout = async () => {
  await auth.logout();
  router.push("/login");
};
</script>
