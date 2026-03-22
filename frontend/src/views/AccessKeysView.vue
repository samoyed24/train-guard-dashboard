<template>
  <div class="page-wrap dashboard-page">
    <section class="card">
      <div class="panel-head">
        <div>
          <p class="panel-kicker">Access Keys</p>
          <h3>{{ t("accessKeys.title") }}</h3>
          <p class="panel-desc">{{ t("accessKeys.desc") }}</p>
        </div>
        <el-button type="primary" @click="openCreate">{{ t("accessKeys.createKey") }}</el-button>
      </div>

      <div class="stat-strip">
        <div class="stat-pill">
          <span>{{ t("accessKeys.total") }}</span>
          <strong>{{ accessKeys.length }}</strong>
        </div>
        <div class="stat-pill">
          <span>{{ t("accessKeys.activeTotal") }}</span>
          <strong>{{ activeKeyCount }}</strong>
        </div>
        <div class="stat-pill">
          <span>{{ t("accessKeys.latestAk") }}</span>
          <strong class="mono-text">{{ latestAkId }}</strong>
        </div>
      </div>

      <el-table class="data-table" :data="accessKeys" border :empty-text="t('accessKeys.noKeys')">
        <el-table-column prop="id" :label="t('accessKeys.id')" width="70" />
        <el-table-column prop="name" :label="t('accessKeys.name')" min-width="180" />
        <el-table-column prop="access_key_id" :label="t('accessKeys.akId')" min-width="240">
          <template #default="scope">
            <span class="mono-text">{{ scope.row.access_key_id }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="is_active" :label="t('accessKeys.status')" width="120">
          <template #default="scope">
            <el-tag :type="scope.row.is_active ? 'success' : 'info'">
              {{ scope.row.is_active ? t("common.enabled") : t("accessKeys.inactive") }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" :label="t('accessKeys.createdAt')" min-width="180">
          <template #default="scope">
            {{ formatDate(scope.row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column :label="t('accessKeys.actions')" width="130">
          <template #default="scope">
            <el-button
              size="small"
              type="danger"
              plain
              :disabled="!scope.row.is_active"
              @click="revoke(scope.row)"
            >
              {{ t("accessKeys.revoke") }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <el-dialog v-model="visible" :title="t('accessKeys.createDialogTitle')" width="460px" destroy-on-close>
      <el-form :model="form" label-width="96px">
        <el-form-item :label="t('accessKeys.name')">
          <el-input v-model="form.name" :placeholder="t('accessKeys.namePlaceholder')" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="visible = false">{{ t("common.cancel") }}</el-button>
        <el-button type="primary" @click="create">{{ t("common.create") }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="secretVisible" :title="t('accessKeys.secretTitle')" width="720px">
      <el-alert type="warning" show-icon :closable="false" :title="t('accessKeys.secretWarning')" />
      <pre class="secret-output" style="margin-top: 12px;">{{ latestSecret }}</pre>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useI18n } from "vue-i18n";
import http from "../api/http";

interface AccessKeyItem {
  id: number;
  name: string;
  access_key_id: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

const { t } = useI18n();
const accessKeys = ref<AccessKeyItem[]>([]);
const visible = ref(false);
const secretVisible = ref(false);
const latestSecret = ref("");
const form = reactive({ name: "" });

const activeKeyCount = computed(() => accessKeys.value.filter((item) => item.is_active).length);
const latestAkId = computed(() => accessKeys.value[0]?.access_key_id || "--");

const formatDate = (value: string | null) => {
  if (!value) return "-";
  return value.replace("T", " ").replace("Z", "");
};

const loadAccessKeys = async () => {
  const { data } = await http.get("/api/access-keys");
  accessKeys.value = data;
};

const openCreate = () => {
  form.name = "";
  visible.value = true;
};

const create = async () => {
  const name = form.name.trim();
  if (!name) {
    ElMessage.warning(t("accessKeys.inputName"));
    return;
  }

  try {
    const { data } = await http.post("/api/access-keys", { name });
    latestSecret.value = JSON.stringify(
      {
        access_key_id: data.access_key_id,
        secret_key: data.secret_key,
      },
      null,
      2,
    );
    secretVisible.value = true;
    visible.value = false;
    await loadAccessKeys();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || t("accessKeys.createFailed"));
  }
};

const revoke = async (row: AccessKeyItem) => {
  try {
    await ElMessageBox.confirm(t("accessKeys.revokeConfirmMessage", { name: row.name }), t("accessKeys.revokeConfirmTitle"), {
      type: "warning",
    });
  } catch {
    return;
  }

  try {
    await http.delete(`/api/access-keys/${row.id}`);
    ElMessage.success(t("accessKeys.revoked"));
    await loadAccessKeys();
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || t("accessKeys.revokeFailed"));
  }
};

onMounted(loadAccessKeys);
</script>
