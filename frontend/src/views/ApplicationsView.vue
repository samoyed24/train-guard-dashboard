<template>
  <div class="page-wrap dashboard-page">
    <section class="card">
      <div class="panel-head">
        <div>
          <p class="panel-kicker">Projects</p>
          <h3>{{ t("apps.title") }}</h3>
          <p class="panel-desc">{{ t("apps.desc") }}</p>
        </div>
        <el-button type="primary" @click="openCreate">{{ t("apps.createApp") }}</el-button>
      </div>

      <div class="stat-strip">
        <div class="stat-pill">
          <span>{{ t("apps.appTotal") }}</span>
          <strong>{{ projects.length }}</strong>
        </div>
        <div class="stat-pill">
          <span>{{ t("apps.latestAppId") }}</span>
          <strong class="mono-text">{{ latestProjectId }}</strong>
        </div>
        <div class="stat-pill">
          <span>{{ t("apps.credentialStatus") }}</span>
          <strong>{{ t("common.enabled") }}</strong>
        </div>
      </div>

      <el-table class="data-table" :data="projects" border :empty-text="t('apps.noApps')">
        <el-table-column prop="id" :label="t('apps.id')" width="70" />
        <el-table-column prop="name" :label="t('apps.appName')" min-width="160" />
        <el-table-column prop="project_id" :label="t('apps.appId')" min-width="220">
          <template #default="scope">
            <span class="mono-text">{{ scope.row.project_id }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" :label="t('apps.createdAt')" min-width="180">
          <template #default="scope">
            {{ formatDate(scope.row.created_at) }}
          </template>
        </el-table-column>
      </el-table>
    </section>

    <el-dialog v-model="visible" :title="t('apps.createDialogTitle')" width="460px" destroy-on-close>
      <el-form :model="form" label-width="88px">
        <el-form-item :label="t('apps.appName')">
          <el-input v-model="form.name" :placeholder="t('apps.appNamePlaceholder')" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="visible = false">{{ t("common.cancel") }}</el-button>
        <el-button type="primary" @click="create">{{ t("common.create") }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="secretVisible" :title="t('apps.secretTitle')" width="680px">
      <el-alert type="warning" show-icon :closable="false" :title="t('apps.secretWarning')" />
      <pre class="secret-output" style="margin-top: 12px;">{{ latestSecret }}</pre>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { useI18n } from "vue-i18n";
import http from "../api/http";

const { t } = useI18n();
const projects = ref<any[]>([]);
const visible = ref(false);
const secretVisible = ref(false);
const latestSecret = ref("");
const form = reactive({ name: "" });
const latestProjectId = computed(() => projects.value[0]?.project_id || "--");

const loadProjects = async () => {
  const { data } = await http.get("/api/projects");
  projects.value = data;
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
    ElMessage.warning(t("apps.inputAppName"));
    return;
  }

  try {
    const { data } = await http.post("/api/projects", { name });
    latestSecret.value = JSON.stringify(
      {
        project_id: data.project_id,
        project_secret: data.project_secret,
      },
      null,
      2,
    );
    secretVisible.value = true;
    visible.value = false;
    await loadProjects();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || t("apps.createFailed"));
  }
};

onMounted(loadProjects);
</script>
