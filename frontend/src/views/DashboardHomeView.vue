<template>
  <div class="page-wrap dashboard-page">
    <section class="card overview-hero" v-loading="loadingOverview">
      <div class="panel-head">
        <div>
          <p class="panel-kicker">Dashboard</p>
          <h3>训练全局概览</h3>
          <p class="panel-desc">统一查看应用、训练运行和最新指标活动，快速进入重点异常 Run。</p>
        </div>
        <div class="action-row">
          <el-button class="ghost-btn" @click="loadOverview">刷新数据</el-button>
          <el-button type="primary" @click="goMetrics">查看训练数据</el-button>
        </div>
      </div>

      <div class="overview-stats">
        <div class="overview-stat-pill">
          <span>应用总数</span>
          <strong>{{ apps.length }}</strong>
        </div>
        <div class="overview-stat-pill">
          <span>Run 总数</span>
          <strong>{{ allRuns.length }}</strong>
        </div>
        <div class="overview-stat-pill">
          <span>24h 活跃 Run</span>
          <strong>{{ activeRuns24h }}</strong>
        </div>
        <div class="overview-stat-pill">
          <span>最近上报</span>
          <strong>{{ latestReportLabel }}</strong>
        </div>
      </div>
    </section>

    <section class="card overview-grid-card">
      <div class="overview-grid">
        <div class="overview-col">
          <div class="panel-head">
            <div>
              <p class="panel-kicker">Top Apps</p>
              <h3>应用活跃度排名</h3>
            </div>
          </div>

          <div class="app-rank-list" v-if="appRunStats.length">
            <div class="app-rank-item" v-for="item in appRunStats" :key="item.appPk">
              <div class="app-rank-head">
                <strong>{{ item.name }}</strong>
                <span class="mono-text">{{ item.appId }}</span>
                <em>{{ item.runCount }} Runs</em>
              </div>
              <div class="app-rank-bar">
                <span :style="{ width: `${item.ratio}%` }"></span>
              </div>
            </div>
          </div>

          <el-empty v-else description="暂无应用活跃数据" />
        </div>

        <div class="overview-col">
          <div class="panel-head">
            <div>
              <p class="panel-kicker">Recent Runs</p>
              <h3>最近运行</h3>
            </div>
            <el-button class="ghost-btn" size="small" @click="goApps">管理应用</el-button>
          </div>

          <el-table
            class="data-table recent-runs-table"
            :data="recentRuns"
            border
            empty-text="暂无运行数据"
            @row-click="onSelectRun"
          >
            <el-table-column prop="appName" label="应用" min-width="120" />
            <el-table-column prop="train_id" label="Train ID" min-width="140" />
            <el-table-column prop="last_seen_at" label="最近上报" min-width="160">
              <template #default="scope">{{ formatDate(scope.row.last_seen_at) }}</template>
            </el-table-column>
          </el-table>
          <p class="table-empty-note">点击某一行可切换下方指标脉搏。</p>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="panel-head">
        <div>
          <p class="panel-kicker">Metric Pulse</p>
          <h3>指标脉搏 {{ featuredMetricName ? `· ${featuredMetricName}` : "" }}</h3>
          <p class="panel-desc">
            {{ featuredRun ? `当前运行：${featuredRun.appName} / ${featuredRun.train_id}` : "暂无可展示运行" }}
          </p>
        </div>
        <el-button class="ghost-btn" :disabled="!featuredRun" @click="goMetrics">前往训练数据页</el-button>
      </div>

      <div class="pulse-summary" v-if="featuredRun">
        <div class="pulse-stat-pill">
          <span>样本点</span>
          <strong>{{ featuredMetricPoints.length }}</strong>
        </div>
        <div class="pulse-stat-pill">
          <span>最新值</span>
          <strong>{{ featuredLatestLabel }}</strong>
        </div>
        <div class="pulse-stat-pill">
          <span>最小值</span>
          <strong>{{ featuredMinLabel }}</strong>
        </div>
        <div class="pulse-stat-pill">
          <span>最大值</span>
          <strong>{{ featuredMaxLabel }}</strong>
        </div>
      </div>

      <div class="pulse-chart-card" v-loading="loadingFeature">
        <template v-if="featuredMetricPoints.length">
          <svg class="pulse-chart" :viewBox="`0 0 ${pulseChartWidth} ${pulseChartHeight}`" preserveAspectRatio="none">
            <line
              v-for="tick in pulseGridLines"
              :key="`pulse-grid-${tick}`"
              class="pulse-grid-line"
              :x1="pulsePaddingX"
              :x2="pulseChartWidth - pulsePaddingX"
              :y1="tick"
              :y2="tick"
            />
            <polyline class="pulse-line" :points="pulsePolyline" />
            <circle
              v-for="point in pulseChartPoints"
              :key="point.id"
              class="pulse-point"
              :cx="point.x"
              :cy="point.y"
              r="2.8"
            />
          </svg>

          <div class="metric-axis-labels">
            <span>{{ pulseStartLabel }}</span>
            <span>{{ pulseEndLabel }}</span>
          </div>
        </template>

        <el-empty v-else description="当前运行暂无可绘制指标" />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";

import http from "../api/http";

interface AppItem {
  id: number;
  name: string;
  app_id: string;
  created_at: string;
}

interface RunItem {
  id: number;
  train_id: string;
  first_seen_at: string;
  last_seen_at: string;
}

interface DashboardRunItem extends RunItem {
  appPk: number;
  appName: string;
  appId: string;
}

interface MetricSeriesPoint {
  id: number;
  value: number;
  step: number | null;
  epoch: number | null;
  event_time: string;
}

interface MetricSeriesResponse {
  selected_metric: string | null;
  points: MetricSeriesPoint[];
}

interface ChartPoint {
  id: number;
  x: number;
  y: number;
}

interface AppRunStat {
  appPk: number;
  name: string;
  appId: string;
  runCount: number;
  ratio: number;
}

const router = useRouter();

const pulseChartWidth = 900;
const pulseChartHeight = 260;
const pulsePaddingX = 24;
const pulsePaddingY = 20;

const loadingOverview = ref(false);
const loadingFeature = ref(false);

const apps = ref<AppItem[]>([]);
const allRuns = ref<DashboardRunItem[]>([]);

const featuredRun = ref<DashboardRunItem | null>(null);
const featuredMetricName = ref("");
const featuredMetricPoints = ref<MetricSeriesPoint[]>([]);

const recentRuns = computed(() => allRuns.value.slice(0, 8));

const activeRuns24h = computed(() => {
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  return allRuns.value.filter((item) => {
    const ts = toTimestamp(item.last_seen_at);
    return ts > 0 && now - ts <= oneDayMs;
  }).length;
});

const latestReportLabel = computed(() => {
  const latest = allRuns.value[0]?.last_seen_at;
  return latest ? formatRelativeTime(latest) : "-";
});

const appRunStats = computed<AppRunStat[]>(() => {
  if (!allRuns.value.length) {
    return [];
  }

  const runCountMap = new Map<number, number>();
  for (const run of allRuns.value) {
    runCountMap.set(run.appPk, (runCountMap.get(run.appPk) ?? 0) + 1);
  }

  const values = Array.from(runCountMap.values());
  const maxRuns = values.length ? Math.max(...values) : 1;

  return apps.value
    .map((app) => {
      const runCount = runCountMap.get(app.id) ?? 0;
      return {
        appPk: app.id,
        name: app.name,
        appId: app.app_id,
        runCount,
        ratio: runCount <= 0 ? 0 : Math.max(8, Math.round((runCount / maxRuns) * 100)),
      };
    })
    .sort((a, b) => b.runCount - a.runCount)
    .slice(0, 6);
});

const featuredLatestLabel = computed(() => formatMetricValue(featuredMetricPoints.value[featuredMetricPoints.value.length - 1]?.value));
const featuredMinLabel = computed(() => {
  if (!featuredMetricPoints.value.length) return "-";
  return formatMetricValue(Math.min(...featuredMetricPoints.value.map((item) => item.value)));
});
const featuredMaxLabel = computed(() => {
  if (!featuredMetricPoints.value.length) return "-";
  return formatMetricValue(Math.max(...featuredMetricPoints.value.map((item) => item.value)));
});

const pulseChartPoints = computed<ChartPoint[]>(() => {
  const data = featuredMetricPoints.value;
  if (!data.length) return [];

  const innerWidth = pulseChartWidth - pulsePaddingX * 2;
  const innerHeight = pulseChartHeight - pulsePaddingY * 2;
  const min = Math.min(...data.map((item) => item.value));
  const max = Math.max(...data.map((item) => item.value));
  const span = max - min || 1;
  const denominator = Math.max(data.length - 1, 1);

  return data.map((item, index) => {
    const xRatio = data.length === 1 ? 0.5 : index / denominator;
    const yRatio = (item.value - min) / span;

    return {
      id: item.id,
      x: pulsePaddingX + xRatio * innerWidth,
      y: pulsePaddingY + (1 - yRatio) * innerHeight,
    };
  });
});

const pulsePolyline = computed(() => pulseChartPoints.value.map((point) => `${point.x},${point.y}`).join(" "));
const pulseStartLabel = computed(() => formatPulseXLabel(featuredMetricPoints.value[0]));
const pulseEndLabel = computed(() => formatPulseXLabel(featuredMetricPoints.value[featuredMetricPoints.value.length - 1]));

const pulseGridLines = computed(() => {
  const innerHeight = pulseChartHeight - pulsePaddingY * 2;
  const steps = 4;
  return Array.from({ length: steps + 1 }, (_, idx) => pulsePaddingY + (idx / steps) * innerHeight);
});

const loadOverview = async () => {
  loadingOverview.value = true;
  try {
    const { data } = await http.get<AppItem[]>("/api/apps");
    apps.value = data;

    if (!data.length) {
      allRuns.value = [];
      clearFeaturedRun();
      return;
    }

    const groupedRuns = await Promise.all(
      data.map(async (app) => {
        try {
          const response = await http.get<RunItem[]>(`/api/apps/${app.id}/runs`);
          return response.data.map(
            (run): DashboardRunItem => ({
              ...run,
              appPk: app.id,
              appName: app.name,
              appId: app.app_id,
            }),
          );
        } catch {
          return [] as DashboardRunItem[];
        }
      }),
    );

    const mergedRuns = groupedRuns
      .flat()
      .sort((a, b) => toTimestamp(b.last_seen_at) - toTimestamp(a.last_seen_at));

    allRuns.value = mergedRuns;

    if (!mergedRuns.length) {
      clearFeaturedRun();
      return;
    }

    await loadFeaturedMetric(mergedRuns[0]);
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || "加载首页概览失败");
  } finally {
    loadingOverview.value = false;
  }
};

const loadFeaturedMetric = async (run: DashboardRunItem) => {
  featuredRun.value = run;
  featuredMetricName.value = "";
  featuredMetricPoints.value = [];

  loadingFeature.value = true;
  try {
    const { data } = await http.get<MetricSeriesResponse>(`/api/apps/${run.appPk}/runs/${run.id}/metrics/series?limit=80`);
    featuredMetricName.value = data.selected_metric || "";

    featuredMetricPoints.value = (Array.isArray(data.points) ? data.points : [])
      .map((point) => ({
        id: Number(point.id),
        value: Number(point.value),
        step: point.step ?? null,
        epoch: point.epoch ?? null,
        event_time: String(point.event_time || ""),
      }))
      .filter((point) => Number.isFinite(point.value));
  } catch {
    ElMessage.warning("加载概览指标失败");
  } finally {
    loadingFeature.value = false;
  }
};

const clearFeaturedRun = () => {
  featuredRun.value = null;
  featuredMetricName.value = "";
  featuredMetricPoints.value = [];
};

const onSelectRun = async (row: DashboardRunItem) => {
  await loadFeaturedMetric(row);
};

const goMetrics = () => {
  router.push("/metrics");
};

const goApps = () => {
  router.push("/apps");
};

const toTimestamp = (value: string): number => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDate = (value: string) => {
  if (!value) return "-";
  return value.replace("T", " ").replace("Z", "");
};

const formatRelativeTime = (value: string) => {
  const ts = toTimestamp(value);
  if (!ts) return "-";

  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return `${diffSec}s 前`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m 前`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h 前`;

  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d 前`;
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

const formatPulseXLabel = (point: MetricSeriesPoint | undefined) => {
  if (!point) return "-";
  if (point.step !== null && point.step !== undefined) return `step ${point.step}`;
  if (point.epoch !== null && point.epoch !== undefined) return `epoch ${point.epoch}`;
  return formatDate(point.event_time);
};

onMounted(loadOverview);
</script>
