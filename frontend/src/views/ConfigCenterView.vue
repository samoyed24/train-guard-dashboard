<template>
  <div class="page-wrap dashboard-page">
    <section class="card">
      <div class="panel-head">
        <div>
          <p class="panel-kicker">Config Center</p>
          <h3>{{ t("configs.title") }}</h3>
          <p class="panel-desc">{{ t("configs.desc") }}</p>
        </div>
      </div>

      <div class="panel-meta">
        <span class="info-chip" v-if="selectedProject">{{ t("configs.currentApp", { name: selectedProject.name }) }}</span>
      </div>

      <el-select
        v-model="selectedProjectId"
        :placeholder="t('configs.selectApp')"
        class="app-select"
        @change="onChangeProject"
      >
        <el-option
          v-for="item in projects"
          :key="item.id"
          :label="item.name + ' (' + item.project_id + ')'"
          :value="item.id"
        />
      </el-select>

      <div class="config-endpoint-card" v-if="selectedProject">
        <div>
          <p class="config-endpoint-title">{{ t("configs.fetchApiTitle") }}</p>
          <p class="panel-desc">{{ t("configs.fetchApiDesc") }}</p>
        </div>
        <div class="config-endpoint-row">
          <el-input :model-value="configFetchUrl" readonly />
          <el-button @click="copyFetchApiUrl">{{ t("configs.copyFetchApiUrl") }}</el-button>
        </div>
      </div>

      <div class="editor-wrap">
        <el-form :model="configForm" label-width="136px" class="config-form">
          <div class="config-grid">
            <section class="config-block config-block--full">
              <el-form-item :label="t('configs.reportUrl')">
                <el-input :model-value="reportEndpoint" readonly />
                <p class="field-hint">{{ t("configs.reportUrlHint") }}</p>
              </el-form-item>
              <el-form-item :label="t('configs.heartbeatInterval')">
                <el-input-number v-model="configForm.heartbeatInterval" :min="5" :max="60" :step="1" />
                <p class="field-hint">{{ t("configs.heartbeatHint") }}</p>
              </el-form-item>
              <el-form-item :label="t('configs.timeout')">
                <el-input-number v-model="configForm.timeout" :min="1" :max="120" :step="1" />
              </el-form-item>
              <el-form-item :label="t('configs.retryCount')">
                <el-input-number v-model="configForm.retryCount" :min="0" :max="10" :step="1" />
              </el-form-item>
              <el-form-item :label="t('configs.uploadFrequency')">
                <el-select v-model="configForm.uploadFrequency">
                  <el-option :label="t('configs.byEpoch')" value="epoch" />
                  <el-option :label="t('configs.byStep')" value="step" />
                  <el-option :label="t('configs.byTime')" value="time" />
                </el-select>
              </el-form-item>
              <el-form-item :label="t('configs.uploadInterval')">
                <el-input-number v-model="configForm.uploadInterval" :min="1" :max="100000" :step="1" />
                <p class="field-hint">{{ t("configs.uploadIntervalHint", { unit: uploadIntervalUnitLabel }) }}</p>
              </el-form-item>
            </section>
          </div>
        </el-form>

        <div class="action-row">
          <el-button type="primary" @click="saveVersion">{{ t("configs.saveVersion") }}</el-button>
          <el-button @click="fillTemplate">{{ t("configs.resetTemplate") }}</el-button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { useI18n } from "vue-i18n";
import http from "../api/http";

interface ProjectItem {
  id: number;
  name: string;
  project_id: string;
}

interface ConfigVersion {
  id: number;
  version: number;
  is_active: boolean;
  content: unknown;
  created_at: string;
}

interface ConfigFormModel {
  heartbeatInterval: number;
  timeout: number;
  retryCount: number;
  uploadFrequency: "epoch" | "step" | "time";
  uploadInterval: number;
}

interface ConfigPayload {
  server: {
    heartbeat_interval_seconds: number;
    timeout: number;
    retry_count: number;
  };
  agent: {
    upload_frequency: "epoch" | "step" | "time";
    upload_interval: number;
  };
}

const { t } = useI18n();
const projects = ref<ProjectItem[]>([]);
const selectedProjectId = ref<number | null>(null);
const configs = ref<ConfigVersion[]>([]);
const configForm = reactive<ConfigFormModel>(createTemplateForm());
const selectedProject = computed(() => projects.value.find((item) => item.id === selectedProjectId.value) || null);
const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");
const configFetchUrl = computed(() => `${apiBaseUrl}/api/agent/config/fetch`);
const reportEndpoint = computed(() => {
  if (!selectedProject.value) {
    return `${apiBaseUrl}/api/metrics/ingest`;
  }
  return `${apiBaseUrl}/api/metrics/ingest?project_id=${selectedProject.value.project_id}`;
});
const uploadIntervalUnitLabel = computed(() => {
  if (configForm.uploadFrequency === "epoch") return t("configs.intervalEpochUnit");
  if (configForm.uploadFrequency === "step") return t("configs.intervalStepUnit");
  return t("configs.intervalTimeUnit");
});

const formatDate = (value: string) => {
  if (!value) return "-";
  return value.replace("T", " ").replace("Z", "");
};

function createTemplateForm(): ConfigFormModel {
  return {
    heartbeatInterval: 15,
    timeout: 10,
    retryCount: 3,
    uploadFrequency: "epoch",
    uploadInterval: 1,
  };
}

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const toNumber = (value: unknown, fallback: number): number => {
  const raw = typeof value === "number" ? value : Number(value);
  return Number.isFinite(raw) ? raw : fallback;
};

const toInt = (value: unknown, fallback: number, min: number, max?: number): number => {
  const normalized = Math.max(min, Math.trunc(toNumber(value, fallback)));
  return typeof max === "number" ? Math.min(max, normalized) : normalized;
};

const normalizeFrequency = (value: unknown): "epoch" | "step" | "time" => {
  return value === "step" || value === "time" ? value : "epoch";
};

const fillTemplate = () => {
  Object.assign(configForm, createTemplateForm());
};

const fillFormFromContent = (content: unknown) => {
  const template = createTemplateForm();
  const root = asObject(content);
  if (!root) {
    Object.assign(configForm, template);
    return;
  }

  const server = asObject(root.server);
  const agent = asObject(root.agent);

  Object.assign(configForm, {
    heartbeatInterval: toInt(server?.heartbeat_interval_seconds, template.heartbeatInterval, 5, 60),
    timeout: toInt(server?.timeout, template.timeout, 1, 120),
    retryCount: toInt(server?.retry_count, template.retryCount, 0, 10),
    uploadFrequency: normalizeFrequency(agent?.upload_frequency),
    uploadInterval: toInt(agent?.upload_interval, template.uploadInterval, 1),
  });
};

const syncFormFromCurrentConfigs = () => {
  const current = configs.value.find((item) => item.is_active) ?? configs.value[0];
  if (current?.content) {
    fillFormFromContent(current.content);
    return;
  }
  fillTemplate();
};

const buildPayload = (): ConfigPayload => {
  const template = createTemplateForm();
  return {
    server: {
      heartbeat_interval_seconds: toInt(configForm.heartbeatInterval, template.heartbeatInterval, 5, 60),
      timeout: toInt(configForm.timeout, template.timeout, 1, 120),
      retry_count: toInt(configForm.retryCount, template.retryCount, 0, 10),
    },
    agent: {
      upload_frequency: normalizeFrequency(configForm.uploadFrequency),
      upload_interval: toInt(configForm.uploadInterval, template.uploadInterval, 1),
    },
  };
};

const loadProjects = async () => {
  const { data } = await http.get<ProjectItem[]>("/api/projects");
  projects.value = data;

  if (!data.length) {
    selectedProjectId.value = null;
    configs.value = [];
    fillTemplate();
    return;
  }

  const hasCurrent = selectedProjectId.value ? data.some((item) => item.id === selectedProjectId.value) : false;
  if (!hasCurrent) {
    selectedProjectId.value = data[0].id;
  }

  await onChangeProject();
};

const loadConfigs = async () => {
  if (!selectedProjectId.value) {
    configs.value = [];
    return;
  }

  const { data } = await http.get<ConfigVersion | null>(`/api/projects/${selectedProjectId.value}/config`);
  configs.value = data ? [data] : [];
};

const onChangeProject = async () => {
  await loadConfigs();
  syncFormFromCurrentConfigs();
};

const copyFetchApiUrl = async () => {
  try {
    await navigator.clipboard.writeText(configFetchUrl.value);
    ElMessage.success(t("configs.fetchApiCopied"));
  } catch {
    ElMessage.error(t("configs.fetchApiCopyFailed"));
  }
};

const saveVersion = async () => {
  if (!selectedProjectId.value) {
    ElMessage.warning(t("configs.selectAppFirst"));
    return;
  }

  try {
    const content = buildPayload();
    await http.put(`/api/projects/${selectedProjectId.value}/config`, { content });
    ElMessage.success(t("configs.versionSaved"));
    await loadConfigs();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || t("configs.saveFailed"));
  }
};

onMounted(async () => {
  fillTemplate();
  await loadProjects();
});
</script>
