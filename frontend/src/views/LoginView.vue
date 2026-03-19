<template>
  <div class="auth-scene">
    <div class="auth-card">
      <aside class="auth-hero">
        <p class="auth-kicker">Train Guard</p>
        <h1>训练可视化控制台</h1>
        <p>统一查看应用配置、版本发布与训练指标变化，快速定位异常训练任务。</p>
        <ul class="auth-points">
          <li>应用凭证集中管理</li>
          <li>配置版本化与发布</li>
          <li>训练指标实时浏览</li>
        </ul>
      </aside>

      <section class="auth-form-panel">
        <h2>欢迎登录</h2>
        <p>输入账号信息进入工作台。</p>
        <el-form class="auth-form" :model="form" label-width="72px" @submit.prevent>
          <el-form-item label="邮箱">
            <el-input v-model="form.email" placeholder="you@example.com" />
          </el-form-item>
          <el-form-item label="密码">
            <el-input v-model="form.password" show-password type="password" placeholder="请输入密码" />
          </el-form-item>
          <el-button type="primary" @click="onLogin">登录</el-button>
        </el-form>
        <p class="auth-link">
          没有账号？<router-link to="/register">去注册</router-link>
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
const form = reactive({ email: "", password: "" });

const onLogin = async () => {
  try {
    await auth.login(form.email, form.password);
    ElMessage.success("登录成功");
    router.push("/apps");
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "登录失败");
  }
};
</script>
