<template>
  <div class="page-wrap dashboard-page">
    <section class="card" v-if="hasTeam">
      <div class="panel-head">
        <div>
          <p class="panel-kicker">Team Workspace</p>
          <h3>团队管理</h3>
          <p class="panel-desc">管理团队成员、角色权限与邀请状态。当前支持团队管理员与团队成员两种角色。</p>
        </div>
        <el-button type="primary" :disabled="!canInvite" @click="openInviteDialog">邀请成员</el-button>
      </div>

      <div class="stat-strip team-stat-strip">
        <div class="stat-pill">
          <span>当前团队</span>
          <strong>{{ teamStore.team?.name || "--" }}</strong>
        </div>
        <div class="stat-pill">
          <span>成员数量</span>
          <strong>{{ teamStore.members.length }}</strong>
        </div>
        <div class="stat-pill">
          <span>待处理邀请</span>
          <strong>{{ pendingInvites.length }}</strong>
        </div>
        <div class="stat-pill">
          <span>我的角色</span>
          <strong>{{ roleLabel(teamStore.myRole) }}</strong>
        </div>
      </div>

      <div class="team-permission-grid">
        <div class="team-permission-card">
          <h4>权限概览</h4>
          <ul>
            <li>邀请成员：{{ yesNo(teamStore.permissions.invite_members) }}</li>
            <li>成员管理：{{ yesNo(teamStore.permissions.manage_members) }}</li>
            <li>角色调整：{{ yesNo(teamStore.permissions.manage_roles) }}</li>
            <li>审计查看：{{ yesNo(teamStore.permissions.view_audit) }}</li>
          </ul>
        </div>
        <div class="team-permission-card">
          <h4>角色说明</h4>
          <ul>
            <li>团队管理员：可邀请成员、修改角色、移除成员。</li>
            <li>团队成员：只读团队信息，可查看邀请与权限状态。</li>
          </ul>
        </div>
      </div>
    </section>

    <section class="card" v-if="hasTeam">
      <div class="panel-head">
        <div>
          <p class="panel-kicker">Members</p>
          <h3>成员列表</h3>
        </div>
      </div>

      <el-table class="data-table" :data="teamStore.members" border empty-text="暂无成员">
        <el-table-column prop="name" label="姓名" min-width="130" />
        <el-table-column prop="email" label="邮箱" min-width="220" />
        <el-table-column label="角色" width="160">
          <template #default="scope">
            <el-tag :type="scope.row.role === 'team_admin' ? 'success' : 'info'" effect="light">
              {{ roleLabel(scope.row.role) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="joined_at" label="加入时间" min-width="170">
          <template #default="scope">{{ formatDate(scope.row.joined_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" min-width="220">
          <template #default="scope">
            <div class="action-row">
              <el-button
                v-if="canManageRoles && !isSelf(scope.row.user_id)"
                size="small"
                @click="toggleRole(scope.row.id, scope.row.role)"
              >
                设为{{ scope.row.role === "team_admin" ? "成员" : "管理员" }}
              </el-button>
              <el-button
                v-if="canManageMembers && !isSelf(scope.row.user_id)"
                size="small"
                type="danger"
                plain
                @click="removeMember(scope.row.id)"
              >
                移除
              </el-button>
              <span v-if="isSelf(scope.row.user_id)" class="table-empty-note">当前账号</span>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <section class="card" v-if="hasTeam">
      <div class="panel-head">
        <div>
          <p class="panel-kicker">Invitations</p>
          <h3>邀请记录</h3>
        </div>
      </div>

      <el-table class="data-table" :data="teamStore.invites" border empty-text="暂无邀请记录">
        <el-table-column prop="email" label="邀请邮箱" min-width="220" />
        <el-table-column label="角色" width="140">
          <template #default="scope">{{ roleLabel(scope.row.role) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="130">
          <template #default="scope">
            <el-tag :type="inviteStatusType(scope.row.status)" effect="light">{{ inviteStatusLabel(scope.row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="邀请码" min-width="240">
          <template #default="scope">
            <span class="mono-text">{{ scope.row.token }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" min-width="170">
          <template #default="scope">{{ formatDate(scope.row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" min-width="260">
          <template #default="scope">
            <div class="action-row">
              <el-button size="small" @click="copyInviteToken(scope.row.token)">复制邀请码</el-button>
              <el-button
                v-if="canInvite && scope.row.status === 'pending'"
                size="small"
                type="danger"
                plain
                @click="revokeInvite(scope.row.id)"
              >
                撤销
              </el-button>
              <el-button
                v-if="canAcceptInvite(scope.row)"
                size="small"
                type="primary"
                plain
                @click="acceptInvite(scope.row.id)"
              >
                接受邀请
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <section class="card" v-else>
      <div class="panel-head">
        <div>
          <p class="panel-kicker">Join Team</p>
          <h3>加入团队</h3>
          <p class="panel-desc">当前账号尚未加入团队。请输入团队管理员发给你的邀请码完成加入。</p>
        </div>
      </div>
      <div class="action-row">
        <el-input v-model="joinToken" placeholder="请输入邀请码，例如 invite_xxx" clearable />
        <el-button type="primary" :loading="joining" @click="joinTeam">加入团队</el-button>
      </div>
    </section>

    <el-dialog v-model="inviteVisible" title="邀请成员" width="500px" destroy-on-close>
      <el-form label-width="92px">
        <el-form-item label="邮箱">
          <el-input v-model="inviteForm.email" placeholder="例如：new.user@company.com" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="inviteForm.role" style="width: 100%">
            <el-option label="团队管理员" value="team_admin" />
            <el-option label="团队成员" value="team_member" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="inviteVisible = false">取消</el-button>
        <el-button type="primary" :loading="submittingInvite" @click="submitInvite">发送邀请</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useAuthStore } from "../stores/auth";
import { useTeamStore, type TeamInvite, type TeamRole } from "../stores/team";

const auth = useAuthStore();
const teamStore = useTeamStore();

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
    const message = error?.response?.data?.message || "加载团队信息失败";
    if (error?.response?.status === 404) {
      ElMessage.info("当前账号还未加入团队");
      return;
    }
    ElMessage.error(message);
  }
};

const yesNo = (value: boolean) => (value ? "已启用" : "无权限");

const roleLabel = (role: TeamRole | null) => {
  if (role === "team_admin") return "团队管理员";
  if (role === "team_member") return "团队成员";
  return "--";
};

const inviteStatusLabel = (status: TeamInvite["status"]) => {
  if (status === "pending") return "待处理";
  if (status === "accepted") return "已接受";
  return "已撤销";
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
    ElMessage.warning("当前角色没有邀请权限");
    return;
  }
  inviteForm.email = "";
  inviteForm.role = "team_member";
  inviteVisible.value = true;
};

const submitInvite = async () => {
  const email = inviteForm.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    ElMessage.warning("请输入有效邮箱");
    return;
  }

  submittingInvite.value = true;
  try {
    await teamStore.createInvite(email, inviteForm.role);
    inviteVisible.value = false;
    ElMessage.success("邀请已创建");
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || "创建邀请失败");
  } finally {
    submittingInvite.value = false;
  }
};

const copyInviteToken = async (token: string) => {
  try {
    await navigator.clipboard.writeText(token);
    ElMessage.success("邀请码已复制");
  } catch {
    ElMessage.warning("复制失败，请手动复制");
  }
};

const revokeInvite = async (inviteId: number) => {
  try {
    await teamStore.revokeInvite(inviteId);
    ElMessage.success("邀请已撤销");
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || "撤销失败");
  }
};

const canAcceptInvite = (invite: TeamInvite) => {
  return invite.status === "pending" && invite.email === auth.user?.email;
};

const acceptInvite = async (inviteId: number) => {
  try {
    await teamStore.acceptInvite(inviteId);
    ElMessage.success("已加入团队");
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || "接受邀请失败");
  }
};

const toggleRole = async (memberId: number, role: TeamRole) => {
  const nextRole: TeamRole = role === "team_admin" ? "team_member" : "team_admin";

  try {
    await teamStore.updateMemberRole(memberId, nextRole);
    ElMessage.success("角色已更新");
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || "角色更新失败");
  }
};

const removeMember = async (memberId: number) => {
  try {
    await ElMessageBox.confirm("移除后该成员将失去团队访问权限，确定继续？", "确认移除", {
      type: "warning",
      confirmButtonText: "移除",
      cancelButtonText: "取消",
    });
    await teamStore.removeMember(memberId);
    ElMessage.success("成员已移除");
  } catch (error: any) {
    if (error === "cancel") return;
    ElMessage.error(error?.response?.data?.message || "移除失败");
  }
};

const joinTeam = async () => {
  const token = joinToken.value.trim();
  if (!token) {
    ElMessage.warning("请输入邀请码");
    return;
  }

  joining.value = true;
  try {
    await teamStore.joinByInviteToken(token);
    joinToken.value = "";
    ElMessage.success("加入团队成功");
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.message || "加入团队失败");
  } finally {
    joining.value = false;
  }
};
</script>
