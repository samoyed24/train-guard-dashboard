<template>
  <div class="page-wrap dashboard-page">
    <section class="card">
      <div class="panel-head">
        <div>
          <p class="panel-kicker">Metrics</p>
          <h3>训练数据</h3>
          <p class="panel-desc">按应用查看训练运行记录，点击某个 Run 可查看最近指标明细。</p>
        </div>
      </div>

      <div class="stat-strip">
        <div class="stat-pill">
          <span>应用数</span>
          <strong>{{ apps.length }}</strong>
        </div>
        <div class="stat-pill">
          <span>Run 数</span>
          <strong>{{ runs.length }}</strong>
        </div>
        <div class="stat-pill">
          <span>指标条数</span>
          <strong>{{ records.length }}</strong>
        </div>
      </div>

      <el-select v-model="selectedAppId" placeholder="选择应用" class="app-select" @change="loadRuns">
        <el-option v-for="item in apps" :key="item.id" :label="item.name + ' (' + item.app_id + ')'" :value="item.id" />
      </el-select>

      <el-table class="data-table table-wrap" :data="runs" border empty-text="暂无训练运行记录" @row-click="selectRun">
        <el-table-column prop="train_id" label="Train ID" />
        <el-table-column prop="first_seen_at" label="首次上报" min-width="170">
          <template #default="scope">{{ formatDate(scope.row.first_seen_at) }}</template>
        </el-table-column>
        <el-table-column prop="last_seen_at" label="最近上报" min-width="170">
          <template #default="scope">{{ formatDate(scope.row.last_seen_at) }}</template>
        </el-table-column>
      </el-table>
    </section>

    <section class="card" v-if="selectedRunId">
      <h3>最近指标（Run: {{ selectedRunId }}）</h3>
      <el-table class="data-table" :data="records" border empty-text="暂无指标记录">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="received_at" label="接收时间" width="220">
          <template #default="scope">{{ formatDate(scope.row.received_at) }}</template>
        </el-table-column>
        <el-table-column label="Payload">
          <template #default="scope">
            <pre class="payload-block">{{ JSON.stringify(scope.row.payload, null, 2) }}</pre>
          </template>
        </el-table-column>
      </el-table>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import http from "../api/http";

const apps = ref<any[]>([]);
const runs = ref<any[]>([]);
const records = ref<any[]>([]);
const selectedAppId = ref<number | null>(null);
const selectedRunId = ref<number | null>(null);

const formatDate = (value: string) => {
  if (!value) return "-";
  return value.replace("T", " ").replace("Z", "");
};

const loadApps = async () => {
  const { data } = await http.get("/api/apps");
  apps.value = data;
  if (data.length && !selectedAppId.value) {
    selectedAppId.value = data[0].id;
    await loadRuns();
  }
};

const loadRuns = async () => {
  if (!selectedAppId.value) return;
  const { data } = await http.get(`/api/apps/${selectedAppId.value}/runs`);
  runs.value = data;
  records.value = [];
  selectedRunId.value = null;
};

const selectRun = async (row: any) => {
  if (!selectedAppId.value) return;
  try {
    selectedRunId.value = row.id;
    const { data } = await http.get(`/api/apps/${selectedAppId.value}/runs/${row.id}/metrics?limit=30`);
    records.value = data;
  } catch {
    ElMessage.error("加载指标失败");
  }
};

onMounted(loadApps);
</script>
