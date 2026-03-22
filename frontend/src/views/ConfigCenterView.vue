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
        <span class="info-chip" v-if="selectedApp">{{ t("configs.currentApp", { name: selectedApp.name }) }}</span>
        <span class="info-chip">{{ t("configs.versionCount", { count: configs.length }) }}</span>
        <span class="info-chip">{{ t("configs.activeVersion", { version: activeConfigVersionLabel }) }}</span>
      </div>

      <el-select v-model="selectedAppId" :placeholder="t('configs.selectApp')" class="app-select" @change="onChangeApp">
        <el-option v-for="item in apps" :key="item.id" :label="item.name + ' (' + item.app_id + ')'" :value="item.id" />
      </el-select>

      <div class="editor-wrap">
        <p class="panel-desc">{{ t("configs.addVersion") }}</p>
        <el-form :model="configForm" label-width="136px" class="config-form">
          <div class="config-grid">
            <section class="config-block">
              <p class="config-block-title">{{ t("configs.server") }}</p>
              <el-form-item :label="t('configs.reportUrl')">
                <el-input
                  v-model="configForm.serverUrl"
                  :placeholder="t('configs.templateUrl')"
                />
              </el-form-item>
              <el-form-item :label="t('configs.timeout')">
                <el-input-number v-model="configForm.timeout" :min="1" :max="120" :step="1" />
              </el-form-item>
              <el-form-item :label="t('configs.retryCount')">
                <el-input-number v-model="configForm.retryCount" :min="0" :max="10" :step="1" />
              </el-form-item>
            </section>

            <section class="config-block">
              <p class="config-block-title">{{ t("configs.agent") }}</p>
              <el-form-item :label="t('configs.uploadFrequency')">
                <el-select
                  v-model="configForm.uploadFrequency"
                  filterable
                  allow-create
                  default-first-option
                  :placeholder="t('configs.selectOrInput')"
                >
                  <el-option :label="t('configs.byEpoch')" value="epoch" />
                  <el-option :label="t('configs.byStep')" value="step" />
                  <el-option :label="t('configs.byTime')" value="time" />
                </el-select>
              </el-form-item>
              <el-form-item :label="t('configs.uploadInterval')">
                <el-input-number v-model="configForm.uploadInterval" :min="1" :max="100000" :step="1" />
              </el-form-item>
              <el-form-item :label="t('configs.asyncReport')">
                <el-switch v-model="configForm.enableAsync" />
              </el-form-item>
            </section>

            <section class="config-block config-block--full">
              <p class="config-block-title">{{ t("configs.metrics") }}</p>
              <el-form-item :label="t('configs.includeSystemInfo')">
                <el-switch v-model="configForm.includeSystemInfo" />
              </el-form-item>
            </section>
          </div>
        </el-form>
        <div class="action-row">
          <el-button type="primary" @click="saveVersion">{{ t("configs.saveVersion") }}</el-button>
          <el-button @click="fillTemplate">{{ t("configs.resetTemplate") }}</el-button>
          <el-button :disabled="!configs.length" @click="refillFromCurrentVersion">{{ t("configs.refillCurrent") }}</el-button>
        </div>
      </div>
    </section>

    <section class="card">
      <h3>{{ t("configs.versionList") }}</h3>
      <el-table class="data-table" :data="configs" border :empty-text="t('configs.noVersion')">
        <el-table-column prop="version" :label="t('configs.version')" width="90" />
        <el-table-column prop="is_active" :label="t('configs.active')" width="90">
          <template #default="scope">
            <span>{{ scope.row.is_active ? t("common.yes") : t("common.no") }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" :label="t('apps.createdAt')" min-width="180">
          <template #default="scope">{{ formatDate(scope.row.created_at) }}</template>
        </el-table-column>
        <el-table-column :label="t('configs.actions')" width="120">
          <template #default="scope">
            <el-button size="small" type="success" @click="publish(scope.row.id)">{{ t("configs.publish") }}</el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { useI18n } from "vue-i18n";
import http from "../api/http";

interface AppItem {
  id: number;
  name: string;
  app_id: string;
}

interface ConfigVersion {
  id: number;
  version: number;
  is_active: boolean;
  content: unknown;
  created_at: string;
}

interface ConfigFormModel {
  serverUrl: string;
  timeout: number;
  retryCount: number;
  uploadFrequency: string;
  uploadInterval: number;
  enableAsync: boolean;
  includeSystemInfo: boolean;
}

interface ConfigPayload {
  server: {
    url: string;
    timeout: number;
    retry_count: number;
  };
  agent: {
    upload_frequency: string;
    upload_interval: number;
    enable_async: boolean;
  };
  metrics: {
    include_system_info: boolean;
  };
}

const apps = ref<AppItem[]>([]);
const { t } = useI18n();
const selectedAppId = ref<number | null>(null);
const configs = ref<ConfigVersion[]>([]);
const configForm = reactive<ConfigFormModel>(createTemplateForm());
const selectedApp = computed(() => apps.value.find((item) => item.id === selectedAppId.value) || null);
const activeConfigVersionLabel = computed(() => {
  const active = configs.value.find((item) => item.is_active);
  return active ? `v${active.version}` : "-";
});

const formatDate = (value: string) => {
  if (!value) return "-";
  return value.replace("T", " ").replace("Z", "");
};

function createTemplateForm(): ConfigFormModel {
  return {
    serverUrl: t("configs.templateUrl"),
    timeout: 10,
    retryCount: 3,
    uploadFrequency: "epoch",
    uploadInterval: 1,
    enableAsync: true,
    includeSystemInfo: true,
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

const toBoolean = (value: unknown, fallback: boolean): boolean => {
  return typeof value === "boolean" ? value : fallback;
};

const toInt = (value: unknown, fallback: number, min: number): number => {
  return Math.max(min, Math.trunc(toNumber(value, fallback)));
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
  const metrics = asObject(root.metrics);

  Object.assign(configForm, {
    serverUrl: typeof server?.url === "string" ? server.url : template.serverUrl,
    timeout: toInt(server?.timeout, template.timeout, 1),
    retryCount: toInt(server?.retry_count, template.retryCount, 0),
    uploadFrequency:
      typeof agent?.upload_frequency === "string" && agent.upload_frequency
        ? agent.upload_frequency
        : template.uploadFrequency,
    uploadInterval: toInt(agent?.upload_interval, template.uploadInterval, 1),
    enableAsync: toBoolean(agent?.enable_async, template.enableAsync),
    includeSystemInfo: toBoolean(metrics?.include_system_info, template.includeSystemInfo),
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

const refillFromCurrentVersion = () => {
  syncFormFromCurrentConfigs();
  const current = configs.value.find((item) => item.is_active) ?? configs.value[0];
  if (current) {
    ElMessage.success(t("configs.refilledVersion", { version: current.version }));
  }
};

const buildPayload = (): ConfigPayload => {
  const template = createTemplateForm();
  return {
    server: {
      url: configForm.serverUrl.trim(),
      timeout: toInt(configForm.timeout, template.timeout, 1),
      retry_count: toInt(configForm.retryCount, template.retryCount, 0),
    },
    agent: {
      upload_frequency: configForm.uploadFrequency.trim() || template.uploadFrequency,
      upload_interval: toInt(configForm.uploadInterval, template.uploadInterval, 1),
      enable_async: !!configForm.enableAsync,
    },
    metrics: {
      include_system_info: !!configForm.includeSystemInfo,
    },
  };
};

const loadApps = async () => {
  const { data } = await http.get<AppItem[]>("/api/apps");
  apps.value = data;

  if (!data.length) {
    selectedAppId.value = null;
    configs.value = [];
    fillTemplate();
    return;
  }

  const hasCurrent = selectedAppId.value ? data.some((item) => item.id === selectedAppId.value) : false;
  if (!hasCurrent) {
    selectedAppId.value = data[0].id;
  }

  await onChangeApp();
};

const loadConfigs = async () => {
  if (!selectedAppId.value) {
    configs.value = [];
    return;
  }

  const { data } = await http.get<ConfigVersion[]>(`/api/apps/${selectedAppId.value}/configs`);
  configs.value = data;
};

const onChangeApp = async () => {
  await loadConfigs();
  syncFormFromCurrentConfigs();
};

const saveVersion = async () => {
  if (!selectedAppId.value) {
    ElMessage.warning(t("configs.selectAppFirst"));
    return;
  }

  const url = configForm.serverUrl.trim();
  if (!url) {
    ElMessage.warning(t("configs.inputReportUrl"));
    return;
  }

  try {
    const content = buildPayload();
    await http.post(`/api/apps/${selectedAppId.value}/configs`, { content });
    ElMessage.success(t("configs.versionSaved"));
    await loadConfigs();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || t("configs.saveFailed"));
  }
};

const publish = async (id: number) => {
  if (!selectedAppId.value) return;
  try {
    await http.post(`/api/apps/${selectedAppId.value}/configs/${id}/publish`);
    ElMessage.success(t("configs.published"));
    await loadConfigs();
  } catch {
    ElMessage.error(t("configs.publishFailed"));
  }
};

onMounted(async () => {
  fillTemplate();
  await loadApps();
});
</script>
