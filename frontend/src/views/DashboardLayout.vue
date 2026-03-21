<template>
  <div class="dashboard-shell">
    <aside class="dashboard-sidebar">
      <div class="brand-block">
        <p class="brand-kicker">{{ t("common.appName") }}</p>
        <h1>{{ t("layout.brandTitle") }}</h1>
        <span>{{ t("layout.brandSubtitle") }}</span>
      </div>

      <el-menu class="nav-menu" :default-active="route.path" router>
        <el-menu-item index="/dashboard">{{ t("routes.dashboardHome") }}</el-menu-item>
        <el-menu-item index="/apps">{{ t("routes.apps") }}</el-menu-item>
        <el-menu-item index="/team">{{ t("routes.team") }}</el-menu-item>
        <el-menu-item index="/configs">{{ t("routes.configs") }}</el-menu-item>
        <el-menu-item index="/metrics">{{ t("routes.metrics") }}</el-menu-item>
      </el-menu>

      <div class="sidebar-foot">
        <span class="dot"></span>
        <span>{{ t("layout.apiMode") }} {{ apiMode }}</span>
      </div>
    </aside>

    <main class="dashboard-main">
      <header class="dashboard-topbar">
        <div class="topbar-heading">
          <p class="topbar-kicker">{{ t("layout.topbarKicker") }}</p>
          <el-breadcrumb class="dashboard-breadcrumb" separator="/">
            <el-breadcrumb-item
              v-for="(item, index) in breadcrumbItems"
              :key="item.path + item.label"
            >
              <router-link
                v-if="index < breadcrumbItems.length - 1"
                :to="item.path === '/' ? '/dashboard' : item.path"
              >
                {{ item.label }}
              </router-link>
              <span v-else>{{ item.label }}</span>
            </el-breadcrumb-item>
          </el-breadcrumb>
          <h2>{{ pageTitle }}</h2>
        </div>
        <div class="topbar-user">
          <el-select v-model="selectedLocale" size="small" style="width: 122px" @change="onLocaleChange">
            <el-option v-for="option in localeOptions" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>
          <span class="user-badge">{{ userInitial }}</span>
          <span class="user-name">{{ auth.user?.name || t("common.unknown") }}</span>
          <el-button size="small" class="ghost-btn" @click="logout">{{ t("layout.logout") }}</el-button>
        </div>
      </header>

      <section class="dashboard-content">
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
import { computed, ref } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { setLocale, type AppLocale } from "../i18n";
import { useAuthStore } from "../stores/auth";

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const { t, locale } = useI18n();
const apiMode = String(import.meta.env.VITE_API_MODE ?? "mock").toUpperCase();
const selectedLocale = ref(locale.value as AppLocale);

const localeOptions = computed(() => [
  { value: "zh-CN", label: t("common.zhCN") },
  { value: "en-US", label: t("common.enUS") },
]);

const breadcrumbItems = computed(() => {
  return route.matched
    .filter((record) => typeof record.meta?.titleKey === "string")
    .map((record) => ({
      label: t(String(record.meta.titleKey)),
      path: record.path,
    }));
});

const pageTitle = computed(() => breadcrumbItems.value[breadcrumbItems.value.length - 1]?.label || t("common.dashboard"));
const userInitial = computed(() => (auth.user?.name || "U").slice(0, 1).toUpperCase());

const onLocaleChange = (value: AppLocale) => {
  setLocale(value);
  selectedLocale.value = value;
};

const logout = async () => {
  await auth.logout();
  router.push("/login");
};
</script>
