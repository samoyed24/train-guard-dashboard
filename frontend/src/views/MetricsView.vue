<template>
  <div class="page-wrap dashboard-page">
    <section class="card">
      <div class="panel-head">
        <div>
          <p class="panel-kicker">Metrics</p>
          <h3>{{ t("metrics.title") }}</h3>
          <p class="panel-desc">{{ t("metrics.desc") }}</p>
        </div>
      </div>

      <div class="stat-strip">
        <div class="stat-pill">
          <span>{{ t("metrics.appCount") }}</span>
          <strong>{{ projects.length }}</strong>
        </div>
        <div class="stat-pill">
          <span>{{ t("metrics.runCount") }}</span>
          <strong>{{ runs.length }}</strong>
        </div>
        <div class="stat-pill">
          <span>{{ t("metrics.currentPoints") }}</span>
          <strong>{{ metricPoints.length }}</strong>
        </div>
      </div>

      <el-select v-model="selectedProjectId" :placeholder="t('metrics.selectApp')" class="app-select" @change="loadRuns">
        <el-option v-for="item in projects" :key="item.id" :label="item.name + ' (' + item.project_id + ')'" :value="item.id" />
      </el-select>

      <el-table
        class="data-table table-wrap run-table"
        :data="runs"
        border
        highlight-current-row
        :empty-text="t('metrics.noRuns')"
        :row-class-name="getRunRowClass"
        @row-click="onRunRowClick"
      >
        <el-table-column prop="train_id" :label="t('metrics.trainId')">
          <template #default="scope">
            <span class="run-id-pill" :class="{ 'is-active': scope.row.id === selectedRunId }">
              {{ scope.row.train_id }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="first_seen_at" :label="t('metrics.firstSeen')" min-width="170">
          <template #default="scope">{{ formatDate(scope.row.first_seen_at) }}</template>
        </el-table-column>
        <el-table-column prop="last_seen_at" :label="t('metrics.lastSeen')" min-width="170">
          <template #default="scope">{{ formatDate(scope.row.last_seen_at) }}</template>
        </el-table-column>
      </el-table>

      <p class="table-empty-note run-hint" v-if="runs.length && !selectedRunId">
        {{ t("metrics.runHint") }}
      </p>
    </section>

    <section class="card" v-if="selectedRunId">
      <div class="panel-head">
        <div>
          <p class="panel-kicker">Run Dashboard</p>
          <h3>{{ t("metrics.metricChartTitle", { run: selectedRunTrainId || t('metrics.runFallback', { id: selectedRunId }) }) }}</h3>
          <p class="panel-desc">{{ t("metrics.metricChartDesc") }}</p>
        </div>
        <div class="chart-toolbar">
          <el-select
            v-model="selectedMetric"
            class="metric-select"
            :placeholder="t('metrics.selectMetric')"
            :disabled="!metricNames.length"
            @change="onMetricChange"
          >
            <el-option v-for="name in metricNames" :key="name" :label="name" :value="name" />
          </el-select>
          <el-button class="ghost-btn" :disabled="!selectedRunId" @click="reloadSeries">{{ t("common.refresh") }}</el-button>
        </div>
      </div>

      <div class="metric-board" v-loading="loadingSeries">
        <div class="metric-quick-stats">
          <div class="metric-quick-stat">
            <span>{{ t("metrics.currentMetric") }}</span>
            <strong>{{ selectedMetric || "-" }}</strong>
          </div>
          <div class="metric-quick-stat">
            <span>{{ t("metrics.latestValue") }}</span>
            <strong>{{ latestValueLabel }}</strong>
          </div>
          <div class="metric-quick-stat">
            <span>{{ t("metrics.minValue") }}</span>
            <strong>{{ minValueLabel }}</strong>
          </div>
          <div class="metric-quick-stat">
            <span>{{ t("metrics.maxValue") }}</span>
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

        <el-empty v-else :description="t('metrics.noNumericMetric')" />
      </div>

      <el-table class="data-table table-wrap" :data="reversedMetricPoints" border :empty-text="t('metrics.noPoints')">
        <el-table-column prop="event_time" :label="t('metrics.time')" min-width="170">
          <template #default="scope">{{ formatDate(scope.row.event_time) }}</template>
        </el-table-column>
        <el-table-column prop="step" label="Step" width="100">
          <template #default="scope">{{ scope.row.step ?? "-" }}</template>
        </el-table-column>
        <el-table-column prop="epoch" label="Epoch" width="100">
          <template #default="scope">{{ scope.row.epoch ?? "-" }}</template>
        </el-table-column>
        <el-table-column
          prop="value"
          :label="selectedMetric ? t('metrics.metricValue', { metric: selectedMetric }) : t('metrics.value')"
          min-width="180"
        >
          <template #default="scope">{{ formatMetricValue(scope.row.value) }}</template>
        </el-table-column>
      </el-table>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { useI18n } from "vue-i18n";
import http from "../api/http";

interface AppItem {
  id: number;
  name: string;
  project_id: string;
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
const { t } = useI18n();

const projects = ref<AppItem[]>([]);
const runs = ref<RunItem[]>([]);
const metricNames = ref<string[]>([]);
const metricPoints = ref<MetricPoint[]>([]);
const selectedProjectId = ref<number | null>(null);
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
  if (point.step !== null && point.step !== undefined) return t("metrics.step", { value: point.step });
  if (point.epoch !== null && point.epoch !== undefined) return t("metrics.epoch", { value: point.epoch });
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

const loadProjects = async () => {
  try {
    const { data } = await http.get<AppItem[]>("/api/projects");
    projects.value = data;

    if (!data.length) {
      selectedProjectId.value = null;
      runs.value = [];
      resetRunSelection();
      return;
    }

    if (!selectedProjectId.value || !data.some((item) => item.id === selectedProjectId.value)) {
      selectedProjectId.value = data[0].id;
    }

    await loadRuns();
  } catch {
    ElMessage.error(t("metrics.loadAppsFailed"));
  }
};

const loadRuns = async () => {
  if (!selectedProjectId.value) {
    runs.value = [];
    resetRunSelection();
    return;
  }

  try {
    const previousRunId = selectedRunId.value;
    const { data } = await http.get<RunItem[]>(`/api/projects/${selectedProjectId.value}/runs`);
    runs.value = data;

    if (!data.length) {
      resetRunSelection();
      return;
    }

    const nextRun = data.find((item) => item.id === previousRunId) ?? data[0];
    await selectRun(nextRun);
  } catch {
    ElMessage.error(t("metrics.loadRunsFailed"));
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
  if (!selectedProjectId.value) return;

  loadingSeries.value = true;
  try {
    const query = new URLSearchParams({ limit: "300" });
    if (metric) {
      query.set("metric", metric);
    }

    const { data } = await http.get<MetricSeriesResponse>(
      `/api/projects/${selectedProjectId.value}/runs/${runId}/metrics/series?${query.toString()}`,
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
    ElMessage.error(t("metrics.loadMetricFailed"));
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

onMounted(loadProjects);
</script>
