<template>
  <div class="auth-scene">
    <div class="auth-card">
      <aside class="auth-hero">
        <p class="auth-kicker">{{ t("common.appName") }}</p>
        <h1>{{ t("auth.heroRegisterTitle") }}</h1>
        <p>{{ t("auth.heroRegisterDesc") }}</p>
        <ul class="auth-points">
          <li v-for="point in heroPoints" :key="point">{{ point }}</li>
        </ul>
      </aside>

      <section class="auth-form-panel">
        <h2>{{ t("auth.registerTitle") }}</h2>
        <p>{{ t("auth.registerDesc") }}</p>
        <el-form class="auth-form" :model="form" label-width="72px" @submit.prevent>
          <el-form-item :label="t('auth.name')">
            <el-input v-model="form.name" :placeholder="t('auth.inputName')" />
          </el-form-item>
          <el-form-item :label="t('auth.email')">
            <el-input v-model="form.email" placeholder="you@example.com" />
          </el-form-item>
          <el-form-item :label="t('auth.verificationCode')">
            <el-row :gutter="10" style="width: 100%">
              <el-col :span="15">
                <el-input v-model="form.verificationCode" :placeholder="t('auth.inputCode')" maxlength="6" />
              </el-col>
              <el-col :span="9">
                <el-button :loading="sendingCode" :disabled="countdown > 0" style="width: 100%" @click="onSendCode">
                  {{ countdown > 0 ? t("auth.retryAfter", { seconds: countdown }) : t("auth.sendCode") }}
                </el-button>
              </el-col>
            </el-row>
          </el-form-item>
          <el-form-item :label="t('auth.password')">
            <el-input v-model="form.password" show-password type="password" :placeholder="t('auth.passwordHint')" />
          </el-form-item>
          <el-button type="primary" @click="onSubmit">{{ t("auth.register") }}</el-button>
        </el-form>
        <p class="auth-link">
          {{ t("auth.hasAccount") }}<router-link to="/login">{{ t("auth.goLogin") }}</router-link>
        </p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { useI18n } from "vue-i18n";
import { useAuthStore } from "../stores/auth";

const router = useRouter();
const auth = useAuthStore();
const { t, tm } = useI18n();
const form = reactive({ name: "", email: "", verificationCode: "", password: "" });
const sendingCode = ref(false);
const countdown = ref(0);
let countdownTimer: ReturnType<typeof setInterval> | null = null;
const heroPoints = computed(() => tm("auth.heroRegisterPoints") as string[]);

const startCountdown = (seconds = 60) => {
  countdown.value = seconds;
  if (countdownTimer) {
    clearInterval(countdownTimer);
  }
  countdownTimer = setInterval(() => {
    if (countdown.value <= 1) {
      countdown.value = 0;
      if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
      }
      return;
    }
    countdown.value -= 1;
  }, 1000);
};

const onSendCode = async () => {
  const email = form.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    ElMessage.warning(t("auth.emailInvalid"));
    return;
  }

  sendingCode.value = true;
  try {
    await auth.sendRegisterEmailCode(email);
    ElMessage.success(t("auth.sendCodeSuccess"));
    startCountdown(60);
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || t("auth.sendCodeFailed"));
  } finally {
    sendingCode.value = false;
  }
};

const onSubmit = async () => {
  try {
    await auth.register(form.name, form.email, form.password, form.verificationCode);
    ElMessage.success(t("auth.registerSuccess"));
    router.push("/login");
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || t("auth.registerFailed"));
  }
};

onUnmounted(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
});
</script>
