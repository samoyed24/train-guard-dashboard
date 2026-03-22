<template>
  <div class="auth-scene">
    <div class="auth-card">
      <aside class="auth-hero">
        <p class="auth-kicker">{{ t("common.appName") }}</p>
        <h1>{{ t("auth.heroLoginTitle") }}</h1>
        <p>{{ t("auth.heroLoginDesc") }}</p>
        <ul class="auth-points">
          <li v-for="point in heroPoints" :key="point">{{ point }}</li>
        </ul>
      </aside>

      <section class="auth-form-panel">
        <div class="auth-control-row">
          <el-dropdown trigger="click" @command="onLocaleCommand">
            <button class="auth-locale-trigger" type="button">
              <span class="auth-locale-icon" aria-hidden="true">🌐</span>
              <span>{{ selectedLocale === "zh-CN" ? t("common.zhCN") : t("common.enUS") }}</span>
              <el-icon><ArrowDown /></el-icon>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="zh-CN">{{ t("common.zhCN") }}</el-dropdown-item>
                <el-dropdown-item command="en-US">{{ t("common.enUS") }}</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <div class="auth-theme-toggle">
            <span>{{ t("layout.themeMode") }}</span>
            <el-switch v-model="isDarkMode" :active-action-icon="Moon" :inactive-action-icon="Sunny" />
          </div>
        </div>
        <h2>{{ t("auth.loginTitle") }}</h2>
        <p>{{ t("auth.loginDesc") }}</p>
        <el-form class="auth-form" :model="form" label-width="72px" @submit.prevent>
          <el-form-item :label="t('auth.email')">
            <el-input v-model="form.email" placeholder="you@example.com" />
          </el-form-item>
          <el-form-item :label="t('auth.password')">
            <el-input v-model="form.password" show-password type="password" :placeholder="t('auth.inputPassword')" />
          </el-form-item>
          <el-button type="primary" @click="onLogin">{{ t("auth.login") }}</el-button>
        </el-form>
        <p class="auth-link">
          {{ t("auth.noAccount") }}<router-link to="/register">{{ t("auth.goRegister") }}</router-link>
        </p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { ArrowDown, Moon, Sunny } from "@element-plus/icons-vue";
import { useI18n } from "vue-i18n";
import { setLocale, type AppLocale } from "../i18n";
import { useAuthStore } from "../stores/auth";

const router = useRouter();
const auth = useAuthStore();
const { t, tm, locale } = useI18n();

const isMockMode = String(import.meta.env.VITE_API_MODE ?? "mock").toLowerCase() === "mock";
const prefillEmail = isMockMode ? String(import.meta.env.VITE_MOCK_LOGIN_EMAIL ?? "") : "";
const prefillPassword = isMockMode ? String(import.meta.env.VITE_MOCK_LOGIN_PASSWORD ?? "") : "";

const form = reactive({ email: prefillEmail, password: prefillPassword });
const heroPoints = computed(() => tm("auth.heroLoginPoints") as string[]);
const isDarkMode = ref(readThemeMode() === "dark");
const selectedLocale = ref(locale.value as AppLocale);

function readThemeMode(): "light" | "dark" {
  const stored = localStorage.getItem("ui_theme_mode");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(isDark: boolean) {
  const mode = isDark ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", mode);
  localStorage.setItem("ui_theme_mode", mode);
}

watch(
  isDarkMode,
  (value) => {
    applyTheme(value);
  },
  { immediate: true },
);

const onLocaleChange = (value: AppLocale) => {
  setLocale(value);
  selectedLocale.value = value;
};

const onLocaleCommand = (value: string | number | object) => {
  if (value === "zh-CN" || value === "en-US") {
    onLocaleChange(value);
  }
};

const onLogin = async () => {
  try {
    await auth.login(form.email, form.password);
    ElMessage.success(t("auth.loginSuccess"));
    router.push("/dashboard");
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || t("auth.loginFailed"));
  }
};
</script>
