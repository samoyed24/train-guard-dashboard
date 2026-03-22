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
        <el-menu-item index="/projects">{{ t("routes.apps") }}</el-menu-item>
        <el-menu-item index="/access-keys">{{ t("routes.accessKeys") }}</el-menu-item>
        <el-menu-item index="/team">{{ t("routes.team") }}</el-menu-item>
        <el-menu-item index="/configs">{{ t("routes.configs") }}</el-menu-item>
        <el-menu-item index="/metrics">{{ t("routes.metrics") }}</el-menu-item>
      </el-menu>

      <div class="sidebar-foot" v-if="showApiModeBadge && isMockMode">
        <span class="dot"></span>
        <span>mock mode</span>
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
        <div class="topbar-actions">
          <span class="topbar-icon-slot">
            <el-badge class="topbar-badge" :hidden="!showNotificationBadge || unreadNoticeCount <= 0" :value="unreadNoticeCount">
              <el-button class="ghost-btn icon-btn" circle @click="openNotifications">
                <el-icon><Bell /></el-icon>
              </el-button>
            </el-badge>
          </span>
          <span class="topbar-icon-slot">
            <el-button class="ghost-btn icon-btn" circle @click="openMessages">
              <el-icon><Message /></el-icon>
            </el-button>
          </span>
          <span class="topbar-icon-slot">
            <el-button class="ghost-btn icon-btn" circle @click="settingsVisible = true">
              <el-icon><Setting /></el-icon>
            </el-button>
          </span>

          <el-dropdown trigger="click" @command="onAvatarCommand">
            <button class="user-trigger" type="button">
              <span class="user-badge">{{ userInitial }}</span>
              <span class="user-name">{{ auth.user?.name || t("common.unknown") }}</span>
              <el-icon class="user-arrow"><ArrowDown /></el-icon>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="email" disabled>
                  {{ auth.user?.email || t("common.unknown") }}
                </el-dropdown-item>
                <el-dropdown-item divided command="logout">
                  {{ t("layout.logout") }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
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

    <el-drawer v-model="settingsVisible" :title="t('layout.settingsTitle')" size="360px" append-to-body>
      <p class="settings-intro">{{ t("layout.settingsIntro") }}</p>
        <div class="settings-list">
        <div class="settings-item">
          <span>{{ t("layout.themeMode") }}</span>
          <el-switch v-model="isDarkMode" :active-action-icon="Moon" :inactive-action-icon="Sunny" />
        </div>
        <div class="settings-item">
          <span>{{ t("layout.languageSetting") }}</span>
          <el-radio-group v-model="selectedLocale" size="small" @change="onLocaleChange">
            <el-radio-button label="zh-CN">{{ t("common.zhCN") }}</el-radio-button>
            <el-radio-button label="en-US">{{ t("common.enUS") }}</el-radio-button>
          </el-radio-group>
        </div>
        <div class="settings-item">
          <span>{{ t("layout.showApiModeBadge") }}</span>
          <el-switch v-model="showApiModeBadge" />
        </div>
        <div class="settings-item">
          <span>{{ t("layout.showNotificationBadge") }}</span>
          <el-switch v-model="showNotificationBadge" />
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { ArrowDown, Bell, Message, Setting, Moon, Sunny } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { setLocale, type AppLocale } from "../i18n";
import { useAuthStore } from "../stores/auth";

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const { t, locale } = useI18n();
const apiMode = String(import.meta.env.VITE_API_MODE ?? "mock").toUpperCase();
const isMockMode = apiMode === "MOCK";
const selectedLocale = ref(locale.value as AppLocale);
const settingsVisible = ref(false);
const unreadNoticeCount = ref(3);
const showApiModeBadge = ref(readBool("ui_show_api_mode_badge", true));
const showNotificationBadge = ref(readBool("ui_show_notification_badge", true));
const isDarkMode = ref(readThemeMode() === "dark");
let themeSwitchTimer: number | undefined;

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

function readBool(key: string, fallback: boolean): boolean {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  return raw === "1";
}

function readThemeMode(): "light" | "dark" {
  const stored = localStorage.getItem("ui_theme_mode");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(isDark: boolean) {
  document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  localStorage.setItem("ui_theme_mode", isDark ? "dark" : "light");
}

function refreshTablePaintForChrome() {
  requestAnimationFrame(() => {
    const tables = Array.from(document.querySelectorAll(".data-table.el-table")) as HTMLElement[];
    tables.forEach((table) => {
      table.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
      // Force a reflow so row background is recalculated after theme variable changes.
      void table.offsetHeight;
      table.classList.add("theme-repaint");
    });

    requestAnimationFrame(() => {
      tables.forEach((table) => table.classList.remove("theme-repaint"));
    });
  });
}

const onLocaleChange = (value: AppLocale) => {
  setLocale(value);
  selectedLocale.value = value;
};

watch(showApiModeBadge, (value) => {
  localStorage.setItem("ui_show_api_mode_badge", value ? "1" : "0");
});

watch(showNotificationBadge, (value) => {
  localStorage.setItem("ui_show_notification_badge", value ? "1" : "0");
});

watch(
  isDarkMode,
  async (value) => {
    document.documentElement.classList.add("theme-switching");
    applyTheme(value);
    await nextTick();
    refreshTablePaintForChrome();
    window.dispatchEvent(new Event("resize"));
    if (themeSwitchTimer !== undefined) {
      window.clearTimeout(themeSwitchTimer);
    }
    themeSwitchTimer = window.setTimeout(() => {
      document.documentElement.classList.remove("theme-switching");
    }, 180);
  },
  { immediate: true },
);

const openNotifications = () => {
  ElMessage.info(t("layout.notificationsPlaceholder"));
};

const openMessages = () => {
  ElMessage.info(t("layout.messagesPlaceholder"));
};

const onAvatarCommand = async (command: string | number | object) => {
  if (command === "logout") {
    await logout();
  }
};

const logout = async () => {
  await auth.logout();
  router.push("/login");
};
</script>
