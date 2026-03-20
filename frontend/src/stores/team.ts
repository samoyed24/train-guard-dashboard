import { defineStore } from "pinia";
import http from "../api/http";

export type TeamRole = "team_admin" | "team_member";

export interface TeamPermissions {
  manage_members: boolean;
  invite_members: boolean;
  manage_roles: boolean;
  view_audit: boolean;
}

export interface TeamMember {
  id: number;
  user_id: number;
  name: string;
  email: string;
  role: TeamRole;
  joined_at: string;
}

export interface TeamInvite {
  id: number;
  email: string;
  role: TeamRole;
  status: "pending" | "accepted" | "revoked";
  token: string;
  created_at: string;
  accepted_at: string | null;
}

interface TeamPayload {
  team: {
    id: number;
    name: string;
    description: string;
    created_at: string;
  };
  my_role: TeamRole;
  permissions: TeamPermissions;
  members: TeamMember[];
  invites: TeamInvite[];
}

interface TeamState {
  loading: boolean;
  team: TeamPayload["team"] | null;
  myRole: TeamRole | null;
  permissions: TeamPermissions;
  members: TeamMember[];
  invites: TeamInvite[];
}

const defaultPermissions: TeamPermissions = {
  manage_members: false,
  invite_members: false,
  manage_roles: false,
  view_audit: false,
};

export const useTeamStore = defineStore("team", {
  state: (): TeamState => ({
    loading: false,
    team: null,
    myRole: null,
    permissions: { ...defaultPermissions },
    members: [],
    invites: [],
  }),
  actions: {
    async fetchCurrentTeam() {
      this.loading = true;
      try {
        const { data } = await http.get<TeamPayload>("/api/team/current");
        this.team = data.team;
        this.myRole = data.my_role;
        this.permissions = data.permissions;
        this.members = data.members;
        this.invites = data.invites;
      } catch (error) {
        this.reset();
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async joinByInviteToken(token: string) {
      await http.post("/api/team/join", { token });
      await this.fetchCurrentTeam();
    },
    async createInvite(email: string, role: TeamRole) {
      await http.post("/api/team/invites", { email, role });
      await this.fetchCurrentTeam();
    },
    async revokeInvite(inviteId: number) {
      await http.post(`/api/team/invites/${inviteId}/revoke`);
      await this.fetchCurrentTeam();
    },
    async acceptInvite(inviteId: number) {
      await http.post(`/api/team/invites/${inviteId}/accept`);
      await this.fetchCurrentTeam();
    },
    async updateMemberRole(memberId: number, role: TeamRole) {
      await http.patch(`/api/team/members/${memberId}/role`, { role });
      await this.fetchCurrentTeam();
    },
    async removeMember(memberId: number) {
      await http.delete(`/api/team/members/${memberId}`);
      await this.fetchCurrentTeam();
    },
    reset() {
      this.team = null;
      this.myRole = null;
      this.permissions = { ...defaultPermissions };
      this.members = [];
      this.invites = [];
    },
  },
});
