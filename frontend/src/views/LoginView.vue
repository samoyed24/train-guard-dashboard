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
import { computed, reactive } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { useI18n } from "vue-i18n";
import { useAuthStore } from "../stores/auth";

const router = useRouter();
const auth = useAuthStore();
const { t, tm } = useI18n();

const isMockMode = String(import.meta.env.VITE_API_MODE ?? "mock").toLowerCase() === "mock";
const prefillEmail = isMockMode ? String(import.meta.env.VITE_MOCK_LOGIN_EMAIL ?? "") : "";
const prefillPassword = isMockMode ? String(import.meta.env.VITE_MOCK_LOGIN_PASSWORD ?? "") : "";

const form = reactive({ email: prefillEmail, password: prefillPassword });
const heroPoints = computed(() => tm("auth.heroLoginPoints") as string[]);

const onLogin = async () => {
  try {
    await auth.login(form.email, form.password);
    ElMessage.success(t("auth.loginSuccess"));
    router.push("/apps");
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || t("auth.loginFailed"));
  }
};
</script>
