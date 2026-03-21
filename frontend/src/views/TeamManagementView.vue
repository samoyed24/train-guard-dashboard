<template>
  <div class="page-wrap dashboard-page">
    <section class="card" v-if="hasTeam">
      <div class="panel-head">
        <div>
          <p class="panel-kicker">{{ t("team.workspace") }}</p>
          <h3>{{ t("team.title") }}</h3>
          <p class="panel-desc">{{ t("team.desc") }}</p>
        </div>
        <el-button type="primary" :disabled="!canInvite" @click="openInviteDialog">{{ t("team.inviteMember") }}</el-button>
      </div>

      <div class="stat-strip team-stat-strip">
        <div class="stat-pill">
          <span>{{ t("team.currentTeam") }}</span>
          <strong>{{ teamStore.team?.name || "--" }}</strong>
        </div>
        <div class="stat-pill">
          <span>{{ t("team.memberCount") }}</span>
          <strong>{{ teamStore.members.length }}</strong>
        </div>
        <div class="stat-pill">
          <span>{{ t("team.pendingInvites") }}</span>
          <strong>{{ pendingInvites.length }}</strong>
        </div>
        <div class="stat-pill">
          <span>{{ t("team.myRole") }}</span>
          <strong>{{ roleLabel(teamStore.myRole) }}</strong>
        </div>
      </div>

      <div class="team-permission-grid">
        <div class="team-permission-card">
          <h4>{{ t("team.permissionOverview") }}</h4>
          <ul>
            <li>{{ t("team.invitePermission", { value: yesNo(teamStore.permissions.invite_members) }) }}</li>
            <li>{{ t("team.memberManage", { value: yesNo(teamStore.permissions.manage_members) }) }}</li>
            <li>{{ t("team.roleManage", { value: yesNo(teamStore.permissions.manage_roles) }) }}</li>
            <li>{{ t("team.auditView", { value: yesNo(teamStore.permissions.view_audit) }) }}</li>
          </ul>
        </div>
        <div class="team-permission-card">
          <h4>{{ t("team.roleInfo") }}</h4>
          <ul>
            <li>{{ t("team.roleAdminDesc") }}</li>
            <li>{{ t("team.roleMemberDesc") }}</li>
          </ul>
        </div>
      </div>
    </section>

    <section class="card" v-if="hasTeam">
      <div class="panel-head">
        <div>
          <p class="panel-kicker">Members</p>
          <h3>{{ t("team.members") }}</h3>
        </div>
      </div>

      <div class="table-wrap table-wrap--x">
        <el-table class="data-table" :data="teamStore.members" border :empty-text="t('team.noMembers')">
          <el-table-column prop="name" :label="t('team.name')" min-width="130" />
          <el-table-column prop="email" :label="t('team.email')" min-width="220" />
          <el-table-column :label="t('team.role')" width="160">
            <template #default="scope">
              <el-tag :type="scope.row.role === 'team_admin' ? 'success' : 'info'" effect="light">
                {{ roleLabel(scope.row.role) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="joined_at" :label="t('team.joinedAt')" min-width="170">
            <template #default="scope">{{ formatDate(scope.row.joined_at) }}</template>
          </el-table-column>
          <el-table-column :label="t('team.actions')" min-width="220">
            <template #default="scope">
              <div class="action-row">
                <el-button
                  v-if="canManageRoles && !isSelf(scope.row.user_id)"
                  size="small"
                  @click="toggleRole(scope.row.id, scope.row.role)"
                >
                  {{ t("team.setRole", { role: scope.row.role === "team_admin" ? t("team.roleMember") : t("team.roleAdmin") }) }}
                </el-button>
                <el-button
                  v-if="canManageMembers && !isSelf(scope.row.user_id)"
                  size="small"
                  type="danger"
                  plain
                  @click="removeMember(scope.row.id)"
                >
                  {{ t("team.remove") }}
                </el-button>
                <span v-if="isSelf(scope.row.user_id)" class="table-empty-note">{{ t("team.currentAccount") }}</span>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </section>

    <section class="card" v-if="hasTeam">
      <div class="panel-head">
        <div>
          <p class="panel-kicker">Invitations</p>
          <h3>{{ t("team.invitations") }}</h3>
        </div>
      </div>

      <div class="table-wrap table-wrap--x">
        <el-table class="data-table" :data="teamStore.invites" border :empty-text="t('team.noInvites')">
          <el-table-column prop="email" :label="t('team.inviteEmail')" min-width="220" />
          <el-table-column :label="t('team.role')" width="140">
            <template #default="scope">{{ roleLabel(scope.row.role) }}</template>
          </el-table-column>
          <el-table-column :label="t('team.status')" width="130">
            <template #default="scope">
              <el-tag :type="inviteStatusType(scope.row.status)" effect="light">{{ inviteStatusLabel(scope.row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column :label="t('team.inviteCode')" min-width="240">
            <template #default="scope">
              <span class="mono-text">{{ scope.row.token }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="created_at" :label="t('apps.createdAt')" min-width="170">
            <template #default="scope">{{ formatDate(scope.row.created_at) }}</template>
          </el-table-column>
          <el-table-column :label="t('team.actions')" min-width="260">
            <template #default="scope">
              <div class="action-row">
                <el-button size="small" @click="copyInviteToken(scope.row.token)">{{ t("team.copyCode") }}</el-button>
                <el-button
                  v-if="canInvite && scope.row.status === 'pending'"
                  size="small"
                  type="danger"
                  plain
                  @click="revokeInvite(scope.row.id)"
                >
                  {{ t("team.revoke") }}
                </el-button>
                <el-button
                  v-if="canAcceptInvite(scope.row)"
                  size="small"
                  type="primary"
                  plain
                  @click="acceptInvite(scope.row.id)"
                >
                  {{ t("team.acceptInvite") }}
                </el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </section>

    <section class="card" v-else>
      <div class="panel-head">
        <div>
          <p class="panel-kicker">Join Team</p>
          <h3>{{ t("team.joinTeam") }}</h3>
          <p class="panel-desc">{{ t("team.joinDesc") }}</p>
        </div>
      </div>
      <div class="action-row">
        <el-input v-model="joinToken" :placeholder="t('team.joinPlaceholder')" clearable />
        <el-button type="primary" :loading="joining" @click="joinTeam">{{ t("team.joinTeam") }}</el-button>
      </div>
    </section>

    <el-dialog v-model="inviteVisible" :title="t('team.inviteDialogTitle')" width="500px" destroy-on-close>
      <el-form label-width="92px">
        <el-form-item :label="t('team.email')">
          <el-input v-model="inviteForm.email" :placeholder="t('team.emailPlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('team.role')">
          <el-select v-model="inviteForm.role" style="width: 100%">
            <el-option :label="t('team.roleAdmin')" value="team_admin" />
            <el-option :label="t('team.roleMember')" value="team_member" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="inviteVisible = false">{{ t("common.cancel") }}</el-button>
        <el-button type="primary" :loading="submittingInvite" @click="submitInvite">{{ t("team.sendInvite") }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useI18n } from "vue-i18n";
import { useAuthStore } from "../stores/auth";
import { useTeamStore, type TeamInvite, type TeamRole } from "../stores/team";

const auth = useAuthStore();
const teamStore = useTeamStore();
const { t } = useI18n();

const inviteVisible = ref(false);
const submittingInvite = ref(false);
const inviteForm = reactive<{ email: string; role: TeamRole }>({
  email: "",
  role: "team_member",
});

const canInvite = computed(() => teamStore.permissions.invite_members);
const canManageMembers = computed(() => teamStore.permissions.manage_members);
const canManageRoles = computed(() => teamStore.permissions.manage_roles);
const pendingInvites = computed(() => teamStore.invites.filter((item) => item.status === "pending"));
const hasTeam = computed(() => !!teamStore.team);

const joinToken = ref("");
const joining = ref(false);

onMounted(async () => {
  await loadTeam();
});

const loadTeam = async () => {
  try {
    await teamStore.fetchCurrentTeam();
  } catch (error: any) {
    const message = error?.response?.data?.message || t("team.loadTeamFailed");
    if (error?.response?.status === 404) {
      ElMessage.info(t("team.notInTeam"));
      return;
    }
    ElMessage.error(message);
  }
};

const yesNo = (value: boolean) => (value ? t("common.enabled") : t("common.disabled"));

const roleLabel = (role: TeamRole | null) => {
  if (role === "team_admin") return t("team.roleAdmin");
  if (role === "team_member") return t("team.roleMember");
  return t("team.selfFallback");
};

const inviteStatusLabel = (status: TeamInvite["status"]) => {
  if (status === "pending") return t("team.pending");
  if (status === "accepted") return t("team.accepted");
  return t("team.revoked");
};

const inviteStatusType = (status: TeamInvite["status"]) => {
  if (status === "pending") return "warning";
  if (status === "accepted") return "success";
  return "info";
};

const formatDate = (value: string | null) => {
  if (!value) return "-";
  return value.replace("T", " ").replace("Z", "");
};

const isSelf = (userId: number) => userId === auth.user?.id;

const openInviteDialog = () => {
  if (!canInvite.value) {
    ElMessage.warning(t("team.noInvitePermission"));
    return;
  }
  inviteForm.email = "";
  inviteForm.role = "team_member";
  inviteVisible.value = true;
};

const submitInvite = async () => {
  const email = inviteForm.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    ElMessage.warning(t("team.inputValidEmail"));
    return;
  }

  submittingInvite.value = true;
  try {
    await teamStore.createInvite(email, inviteForm.role);
    inviteVisible.value = false;
    ElMessage.success(t("team.inviteCreated"));
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || t("team.createInviteFailed"));
  } finally {
    submittingInvite.value = false;
  }
};

const copyInviteToken = async (token: string) => {
  try {
    await navigator.clipboard.writeText(token);
    ElMessage.success(t("team.codeCopied"));
  } catch {
    ElMessage.warning(t("team.copyFailed"));
  }
};

const revokeInvite = async (inviteId: number) => {
  try {
    await teamStore.revokeInvite(inviteId);
    ElMessage.success(t("team.inviteRevoked"));
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || t("team.revokeFailed"));
  }
};

const canAcceptInvite = (invite: TeamInvite) => {
  return invite.status === "pending" && invite.email === auth.user?.email;
};

const acceptInvite = async (inviteId: number) => {
  try {
    await teamStore.acceptInvite(inviteId);
    ElMessage.success(t("team.joinedTeam"));
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || t("team.acceptInviteFailed"));
  }
};

const toggleRole = async (memberId: number, role: TeamRole) => {
  const nextRole: TeamRole = role === "team_admin" ? "team_member" : "team_admin";

  try {
    await teamStore.updateMemberRole(memberId, nextRole);
    ElMessage.success(t("team.roleUpdated"));
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || t("team.roleUpdateFailed"));
  }
};

const removeMember = async (memberId: number) => {
  try {
    await ElMessageBox.confirm(t("team.removeConfirmMessage"), t("team.removeConfirmTitle"), {
      type: "warning",
      confirmButtonText: t("team.removeAction"),
      cancelButtonText: t("common.cancel"),
    });
    await teamStore.removeMember(memberId);
    ElMessage.success(t("team.removeMemberDone"));
  } catch (error: any) {
    if (error === "cancel") return;
    ElMessage.error(error?.response?.data?.message || t("team.removeFailed"));
  }
};

const joinTeam = async () => {
  const token = joinToken.value.trim();
  if (!token) {
    ElMessage.warning(t("team.inputInviteCode"));
    return;
  }

  joining.value = true;
  try {
    await teamStore.joinByInviteToken(token);
    joinToken.value = "";
    ElMessage.success(t("team.joinSuccess"));
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || t("team.joinFailed"));
  } finally {
    joining.value = false;
  }
};
</script>
