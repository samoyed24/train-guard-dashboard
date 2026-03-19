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
import { reactive } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { useAuthStore } from "../stores/auth";

const router = useRouter();
const auth = useAuthStore();
const form = reactive({ name: "", email: "", password: "" });

const onSubmit = async () => {
  try {
    await auth.register(form.name, form.email, form.password);
    ElMessage.success("注册成功，请登录");
    router.push("/login");
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "注册失败");
  }
};
</script>
