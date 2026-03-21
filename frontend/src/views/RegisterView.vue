<template>
  <div class="auth-scene">
    <div class="auth-card">
      <aside class="auth-hero">
        <p class="auth-kicker">Train Guard</p>
        <h1>创建你的团队账号</h1>
        <p>从这里开始管理模型训练应用、配置发布流程和指标回传链路。</p>
        <ul class="auth-points">
          <li>支持多应用隔离管理</li>
          <li>统一配置下发给 Agent</li>
          <li>保留训练上报历史数据</li>
        </ul>
      </aside>

      <section class="auth-form-panel">
        <h2>注册账号</h2>
        <p>填写信息后即可创建新账号。</p>
        <el-form class="auth-form" :model="form" label-width="72px" @submit.prevent>
          <el-form-item label="姓名">
            <el-input v-model="form.name" placeholder="请输入姓名" />
          </el-form-item>
          <el-form-item label="邮箱">
            <el-input v-model="form.email" placeholder="you@example.com" />
          </el-form-item>
          <el-form-item label="验证码">
            <el-row :gutter="10" style="width: 100%">
              <el-col :span="15">
                <el-input v-model="form.verificationCode" placeholder="请输入 6 位验证码" maxlength="6" />
              </el-col>
              <el-col :span="9">
                <el-button :loading="sendingCode" :disabled="countdown > 0" style="width: 100%" @click="onSendCode">
                  {{ countdown > 0 ? `${countdown}s 后重试` : "发送验证码" }}
                </el-button>
              </el-col>
            </el-row>
          </el-form-item>
          <el-form-item label="密码">
            <el-input v-model="form.password" show-password type="password" placeholder="至少 6 位" />
          </el-form-item>
          <el-button type="primary" @click="onSubmit">创建账号</el-button>
        </el-form>
        <p class="auth-link">
          已有账号？<router-link to="/login">去登录</router-link>
        </p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onUnmounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { useAuthStore } from "../stores/auth";

const router = useRouter();
const auth = useAuthStore();
const form = reactive({ name: "", email: "", verificationCode: "", password: "" });
const sendingCode = ref(false);
const countdown = ref(0);
let countdownTimer: ReturnType<typeof setInterval> | null = null;

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
    ElMessage.warning("请先输入有效邮箱");
    return;
  }

  sendingCode.value = true;
  try {
    await auth.sendRegisterEmailCode(email);
    ElMessage.success("验证码已发送，请查收邮箱");
    startCountdown(60);
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "发送验证码失败");
  } finally {
    sendingCode.value = false;
  }
};

const onSubmit = async () => {
  try {
    await auth.register(form.name, form.email, form.password, form.verificationCode);
    ElMessage.success("注册成功，请登录");
    router.push("/login");
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "注册失败");
  }
};

onUnmounted(() => {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
});
</script>
