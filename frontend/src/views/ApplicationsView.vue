<template>
  <div class="page-wrap dashboard-page">
    <section class="card">
      <div class="panel-head">
        <div>
          <p class="panel-kicker">Applications</p>
          <h3>应用管理</h3>
          <p class="panel-desc">创建并管理训练应用，系统会为每个应用生成唯一 app_id 与 app_secret。</p>
        </div>
        <el-button type="primary" @click="openCreate">新建应用</el-button>
      </div>

      <div class="stat-strip">
        <div class="stat-pill">
          <span>应用总数</span>
          <strong>{{ apps.length }}</strong>
        </div>
        <div class="stat-pill">
          <span>最新 App ID</span>
          <strong class="mono-text">{{ latestAppId }}</strong>
        </div>
        <div class="stat-pill">
          <span>凭证状态</span>
          <strong>已启用</strong>
        </div>
      </div>

      <el-table class="data-table" :data="apps" border empty-text="暂无应用，点击右上角创建">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="name" label="应用名" min-width="160" />
        <el-table-column prop="app_id" label="App ID" min-width="220">
          <template #default="scope">
            <span class="mono-text">{{ scope.row.app_id }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" min-width="180">
          <template #default="scope">
            {{ formatDate(scope.row.created_at) }}
          </template>
        </el-table-column>
      </el-table>
    </section>

    <el-dialog v-model="visible" title="新建应用" width="460px" destroy-on-close>
      <el-form :model="form" label-width="88px">
        <el-form-item label="应用名">
          <el-input v-model="form.name" placeholder="例如：image-classifier" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" @click="create">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="secretVisible" title="应用密钥（仅显示一次）" width="680px">
      <el-alert type="warning" show-icon :closable="false" title="请妥善保存 app_secret，后续不会再次明文返回。" />
      <pre class="secret-output" style="margin-top: 12px;">{{ latestSecret }}</pre>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import http from "../api/http";

const apps = ref<any[]>([]);
const visible = ref(false);
const secretVisible = ref(false);
const latestSecret = ref("");
const form = reactive({ name: "" });
const latestAppId = computed(() => apps.value[0]?.app_id || "--");

const loadApps = async () => {
  const { data } = await http.get("/api/apps");
  apps.value = data;
};

const formatDate = (value: string) => {
  if (!value) return "-";
  return value.replace("T", " ").replace("Z", "");
};

const openCreate = () => {
  form.name = "";
  visible.value = true;
};

const create = async () => {
  const name = form.name.trim();
  if (!name) {
    ElMessage.warning("请输入应用名");
    return;
  }

  try {
    const { data } = await http.post("/api/apps", { name });
    latestSecret.value = JSON.stringify({ app_id: data.app_id, app_secret: data.app_secret }, null, 2);
    secretVisible.value = true;
    visible.value = false;
    await loadApps();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "创建失败");
  }
};

onMounted(loadApps);
</script>
