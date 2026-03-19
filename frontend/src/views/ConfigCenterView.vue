<template>
  <div class="page-wrap dashboard-page">
    <section class="card">
      <div class="panel-head">
        <div>
          <p class="panel-kicker">Config Center</p>
          <h3>配置中心</h3>
          <p class="panel-desc">按应用管理配置版本，并一键发布激活版本供 Agent 拉取。</p>
        </div>
      </div>

      <div class="panel-meta">
        <span class="info-chip" v-if="selectedApp">当前应用：{{ selectedApp.name }}</span>
        <span class="info-chip">版本数：{{ configs.length }}</span>
        <span class="info-chip">激活版本：v{{ activeConfigVersion }}</span>
      </div>

      <el-select v-model="selectedAppId" placeholder="选择应用" class="app-select" @change="onChangeApp">
        <el-option v-for="item in apps" :key="item.id" :label="item.name + ' (' + item.app_id + ')'" :value="item.id" />
      </el-select>

      <div class="editor-wrap">
        <p class="panel-desc">新增配置版本（JSON）</p>
        <el-input v-model="jsonText" class="json-editor" type="textarea" :rows="12" />
        <div class="action-row">
          <el-button type="primary" @click="saveVersion">保存版本</el-button>
          <el-button @click="fillTemplate">填充模板</el-button>
        </div>
      </div>
    </section>

    <section class="card">
      <h3>版本列表</h3>
      <el-table class="data-table" :data="configs" border empty-text="暂无配置版本，请先保存一版配置">
        <el-table-column prop="version" label="版本" width="90" />
        <el-table-column prop="is_active" label="激活" width="90">
          <template #default="scope">
            <span>{{ scope.row.is_active ? "是" : "否" }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" min-width="180">
          <template #default="scope">{{ formatDate(scope.row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="scope">
            <el-button size="small" type="success" @click="publish(scope.row.id)">发布</el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import http from "../api/http";

const apps = ref<any[]>([]);
const selectedAppId = ref<number | null>(null);
const configs = ref<any[]>([]);
const jsonText = ref("{}");
const selectedApp = computed(() => apps.value.find((item) => item.id === selectedAppId.value) || null);
const activeConfigVersion = computed(() => configs.value.find((item) => item.is_active)?.version ?? "-");

const formatDate = (value: string) => {
  if (!value) return "-";
  return value.replace("T", " ").replace("Z", "");
};

const fillTemplate = () => {
  jsonText.value = JSON.stringify(
    {
      server: {
        url: "http://localhost:8000/api/metrics/ingest?app_id=YOUR_APP_ID&app_secret=YOUR_APP_SECRET",
        timeout: 10,
        retry_count: 3,
      },
      agent: {
        upload_frequency: "epoch",
        upload_interval: 1,
        enable_async: true,
      },
      metrics: {
        include_system_info: true,
      },
    },
    null,
    2,
  );
};

const loadApps = async () => {
  const { data } = await http.get("/api/apps");
  apps.value = data;
  if (data.length && !selectedAppId.value) {
    selectedAppId.value = data[0].id;
    await loadConfigs();
  }
};

const loadConfigs = async () => {
  if (!selectedAppId.value) return;
  const { data } = await http.get(`/api/apps/${selectedAppId.value}/configs`);
  configs.value = data;
};

const onChangeApp = async () => {
  await loadConfigs();
};

const saveVersion = async () => {
  if (!selectedAppId.value) return;
  try {
    const content = JSON.parse(jsonText.value);
    await http.post(`/api/apps/${selectedAppId.value}/configs`, { content });
    ElMessage.success("版本已保存");
    await loadConfigs();
  } catch {
    ElMessage.error("JSON 格式错误或保存失败");
  }
};

const publish = async (id: number) => {
  if (!selectedAppId.value) return;
  try {
    await http.post(`/api/apps/${selectedAppId.value}/configs/${id}/publish`);
    ElMessage.success("已发布");
    await loadConfigs();
  } catch {
    ElMessage.error("发布失败");
  }
};

onMounted(async () => {
  fillTemplate();
  await loadApps();
});
</script>
