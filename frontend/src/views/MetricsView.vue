<template>
  <div class="page-wrap dashboard-page">
    <section class="card">
      <div class="panel-head">
        <div>
          <p class="panel-kicker">Metrics</p>
          <h3>训练数据</h3>
          <p class="panel-desc">按应用选择训练 Run，并在下方按指标查看时序图表。</p>
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
          <span>当前指标点</span>
          <strong>{{ metricPoints.length }}</strong>
        </div>
      </div>

      <el-select v-model="selectedAppId" placeholder="选择应用" class="app-select" @change="loadRuns">
        <el-option v-for="item in apps" :key="item.id" :label="item.name + ' (' + item.app_id + ')'" :value="item.id" />
      </el-select>

      <el-table
        class="data-table table-wrap run-table"
        :data="runs"
        border
        highlight-current-row
        empty-text="暂无训练运行记录"
        :row-class-name="getRunRowClass"
        @row-click="onRunRowClick"
      >
        <el-table-column prop="train_id" label="Train ID">
          <template #default="scope">
            <span class="run-id-pill" :class="{ 'is-active': scope.row.id === selectedRunId }">
              {{ scope.row.train_id }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="first_seen_at" label="首次上报" min-width="170">
          <template #default="scope">{{ formatDate(scope.row.first_seen_at) }}</template>
        </el-table-column>
        <el-table-column prop="last_seen_at" label="最近上报" min-width="170">
          <template #default="scope">{{ formatDate(scope.row.last_seen_at) }}</template>
        </el-table-column>
      </el-table>

      <p class="table-empty-note run-hint" v-if="runs.length && !selectedRunId">
        点击任意 Run 行，加载该 Run 的指标曲线。
      </p>
    </section>

    <section class="card" v-if="selectedRunId">
      <div class="panel-head">
        <div>
          <p class="panel-kicker">Run Dashboard</p>
          <h3>指标图表（{{ selectedRunTrainId || `Run ${selectedRunId}` }}）</h3>
          <p class="panel-desc">按指标拆分查看趋势，支持快速切换 loss / acc / lr 等数值指标。</p>
        </div>
        <div class="chart-toolbar">
          <el-select
            v-model="selectedMetric"
            class="metric-select"
            placeholder="选择指标"
            :disabled="!metricNames.length"
            @change="onMetricChange"
          >
            <el-option v-for="name in metricNames" :key="name" :label="name" :value="name" />
          </el-select>
          <el-button class="ghost-btn" :disabled="!selectedRunId" @click="reloadSeries">刷新</el-button>
        </div>
      </div>

      <div class="metric-board" v-loading="loadingSeries">
        <div class="metric-quick-stats">
          <div class="metric-quick-stat">
            <span>当前指标</span>
            <strong>{{ selectedMetric || "-" }}</strong>
          </div>
          <div class="metric-quick-stat">
            <span>最新值</span>
            <strong>{{ latestValueLabel }}</strong>
          </div>
          <div class="metric-quick-stat">
            <span>最小值</span>
            <strong>{{ minValueLabel }}</strong>
          </div>
          <div class="metric-quick-stat">
            <span>最大值</span>
            <strong>{{ maxValueLabel }}</strong>
          </div>
        </div>

        <div class="metric-chart-card" v-if="metricPoints.length">
          <svg class="metric-chart" :viewBox="`0 0 ${chartWidth} ${chartHeight}`" preserveAspectRatio="none">
            <line
              v-for="tick in chartYTicks"
              :key="`tick-${tick.y}`"
              class="metric-grid-line"
              :x1="chartPaddingX"
              :x2="chartWidth - chartPaddingX"
              :y1="tick.y"
              :y2="tick.y"
            />

            <polyline class="metric-line" :points="chartPolyline" />

            <circle
              v-for="point in chartPoints"
              :key="point.id"
              class="metric-point"
              :cx="point.x"
              :cy="point.y"
              r="2.8"
            />
          </svg>

          <div class="metric-axis-labels">
            <span>{{ firstXAxisLabel }}</span>
            <span>{{ lastXAxisLabel }}</span>
          </div>
        </div>

        <el-empty v-else description="该 Run 暂无可绘制的数值指标" />
      </div>

      <el-table class="data-table table-wrap" :data="reversedMetricPoints" border empty-text="暂无指标点数据">
        <el-table-column prop="event_time" label="时间" min-width="170">
          <template #default="scope">{{ formatDate(scope.row.event_time) }}</template>
        </el-table-column>
        <el-table-column prop="step" label="Step" width="100">
          <template #default="scope">{{ scope.row.step ?? "-" }}</template>
        </el-table-column>
        <el-table-column prop="epoch" label="Epoch" width="100">
          <template #default="scope">{{ scope.row.epoch ?? "-" }}</template>
        </el-table-column>
        <el-table-column prop="value" :label="selectedMetric ? `${selectedMetric} 值` : '值'" min-width="180">
          <template #default="scope">{{ formatMetricValue(scope.row.value) }}</template>
        </el-table-column>
      </el-table>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import http from "../api/http";

interface AppItem {
  id: number;
  name: string;
  app_id: string;
}

interface RunItem {
  id: number;
  train_id: string;
  first_seen_at: string;
  last_seen_at: string;
}

interface MetricPoint {
  id: number;
  metric_name: string;
  value: number;
  step: number | null;
  epoch: number | null;
  event_time: string;
}

interface MetricSeriesResponse {
  run_id: number;
  train_id: string;
  metric_names: string[];
  selected_metric: string | null;
  points: MetricPoint[];
}

interface ChartPoint {
  id: number;
  x: number;
  y: number;
}

const chartWidth = 900;
const chartHeight = 280;
const chartPaddingX = 24;
const chartPaddingY = 20;

const apps = ref<AppItem[]>([]);
const runs = ref<RunItem[]>([]);
const metricNames = ref<string[]>([]);
const metricPoints = ref<MetricPoint[]>([]);
const selectedAppId = ref<number | null>(null);
const selectedRunId = ref<number | null>(null);
const selectedRunTrainId = ref("");
const selectedMetric = ref("");
const loadingSeries = ref(false);

const reversedMetricPoints = computed(() => [...metricPoints.value].reverse());

const latestValueLabel = computed(() => formatMetricValue(metricPoints.value[metricPoints.value.length - 1]?.value));

const minValueLabel = computed(() => {
  if (!metricPoints.value.length) return "-";
  return formatMetricValue(Math.min(...metricPoints.value.map((item) => item.value)));
});

const maxValueLabel = computed(() => {
  if (!metricPoints.value.length) return "-";
  return formatMetricValue(Math.max(...metricPoints.value.map((item) => item.value)));
});

const chartPoints = computed<ChartPoint[]>(() => {
  const data = metricPoints.value;
  if (!data.length) return [];

  const innerWidth = chartWidth - chartPaddingX * 2;
  const innerHeight = chartHeight - chartPaddingY * 2;
  const min = Math.min(...data.map((item) => item.value));
  const max = Math.max(...data.map((item) => item.value));
  const span = max - min || 1;
  const denominator = Math.max(data.length - 1, 1);

  return data.map((item, index) => {
    const ratioX = data.length === 1 ? 0.5 : index / denominator;
    const ratioY = (item.value - min) / span;
    return {
      id: item.id,
      x: chartPaddingX + ratioX * innerWidth,
      y: chartPaddingY + (1 - ratioY) * innerHeight,
    };
  });
});

const chartPolyline = computed(() => chartPoints.value.map((point) => `${point.x},${point.y}`).join(" "));

const chartYTicks = computed(() => {
  const data = metricPoints.value;
  if (!data.length) return [] as Array<{ y: number; value: number }>;

  const max = Math.max(...data.map((item) => item.value));
  const min = Math.min(...data.map((item) => item.value));
  const span = max - min || 1;
  const innerHeight = chartHeight - chartPaddingY * 2;
  const steps = 4;

  return Array.from({ length: steps + 1 }, (_, index) => {
    const ratio = index / steps;
    return {
      y: chartPaddingY + ratio * innerHeight,
      value: max - span * ratio,
    };
  });
});

const firstXAxisLabel = computed(() => formatXAxisLabel(metricPoints.value[0]));
const lastXAxisLabel = computed(() => formatXAxisLabel(metricPoints.value[metricPoints.value.length - 1]));

const formatDate = (value: string) => {
  if (!value) return "-";
  return value.replace("T", " ").replace("Z", "");
};

const formatXAxisLabel = (point: MetricPoint | undefined) => {
  if (!point) return "-";
  if (point.step !== null && point.step !== undefined) return `step ${point.step}`;
  if (point.epoch !== null && point.epoch !== undefined) return `epoch ${point.epoch}`;
  return formatDate(point.event_time);
};

const formatMetricValue = (value: number | null | undefined) => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  const abs = Math.abs(value);
  if (abs >= 1000) {
    return value.toFixed(2);
  }

  if (abs >= 1) {
    return value.toFixed(4);
  }

  return value.toFixed(6);
};

const loadApps = async () => {
  try {
    const { data } = await http.get<AppItem[]>("/api/apps");
    apps.value = data;

    if (!data.length) {
      selectedAppId.value = null;
      runs.value = [];
      resetRunSelection();
      return;
    }

    if (!selectedAppId.value || !data.some((item) => item.id === selectedAppId.value)) {
      selectedAppId.value = data[0].id;
    }

    await loadRuns();
  } catch {
    ElMessage.error("加载应用失败");
  }
};

const loadRuns = async () => {
  if (!selectedAppId.value) {
    runs.value = [];
    resetRunSelection();
    return;
  }

  try {
    const previousRunId = selectedRunId.value;
    const { data } = await http.get<RunItem[]>(`/api/apps/${selectedAppId.value}/runs`);
    runs.value = data;

    if (!data.length) {
      resetRunSelection();
      return;
    }

    const nextRun = data.find((item) => item.id === previousRunId) ?? data[0];
    await selectRun(nextRun);
  } catch {
    ElMessage.error("加载训练运行失败");
  }
};

const resetRunSelection = () => {
  selectedRunId.value = null;
  selectedRunTrainId.value = "";
  selectedMetric.value = "";
  metricNames.value = [];
  metricPoints.value = [];
};

const loadSeries = async (runId: number, metric?: string) => {
  if (!selectedAppId.value) return;

  loadingSeries.value = true;
  try {
    const query = new URLSearchParams({ limit: "300" });
    if (metric) {
      query.set("metric", metric);
    }

    const { data } = await http.get<MetricSeriesResponse>(
      `/api/apps/${selectedAppId.value}/runs/${runId}/metrics/series?${query.toString()}`,
    );

    metricNames.value = Array.isArray(data.metric_names) ? data.metric_names : [];
    selectedMetric.value = data.selected_metric || "";
    metricPoints.value = (Array.isArray(data.points) ? data.points : [])
      .map((item) => ({
        id: Number(item.id),
        metric_name: String(item.metric_name || ""),
        value: Number(item.value),
        step: item.step ?? null,
        epoch: item.epoch ?? null,
        event_time: String(item.event_time || ""),
      }))
      .filter((item) => Number.isFinite(item.value));
  } catch {
    ElMessage.error("加载指标失败");
  } finally {
    loadingSeries.value = false;
  }
};

const selectRun = async (row: RunItem) => {
  selectedRunId.value = row.id;
  selectedRunTrainId.value = row.train_id;
  selectedMetric.value = "";
  metricNames.value = [];
  metricPoints.value = [];
  await loadSeries(row.id);
};

const onMetricChange = async (metric: string) => {
  if (!selectedRunId.value || !metric) return;
  await loadSeries(selectedRunId.value, metric);
};

const reloadSeries = async () => {
  if (!selectedRunId.value) return;
  await loadSeries(selectedRunId.value, selectedMetric.value || undefined);
};

const onRunRowClick = async (row: RunItem) => {
  await selectRun(row);
};

const getRunRowClass = ({ row }: { row: RunItem }) => {
  return row.id === selectedRunId.value ? "run-row is-selected" : "run-row";
};

onMounted(loadApps);
</script>
