export interface MockRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

export interface MockResponse {
  status: number;
  data: unknown;
}

type JsonObject = Record<string, unknown>;

interface MockUser {
  id: number;
  email: string;
  name: string;
  password: string;
  created_at: string;
}

interface MockApp {
  id: number;
  name: string;
  app_id: string;
  app_secret: string;
  is_active: boolean;
  created_by: number;
  created_at: string;
}

interface MockAccessKey {
  id: number;
  user_id: number;
  name: string;
  access_key_id: string;
  secret_key: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

interface MockConfigVersion {
  id: number;
  app_pk: number;
  version: number;
  content: JsonObject;
  is_active: boolean;
  created_at: string;
  published_at: string | null;
  published_by: number;
}

interface MockRun {
  id: number;
  app_pk: number;
  train_id: string;
  first_seen_at: string;
  last_seen_at: string;
}

interface MockMetricRecord {
  id: number;
  run_id: number;
  payload: JsonObject;
  received_at: string;
}

interface MockMetricSeriesPoint {
  id: number;
  run_id: number;
  metric_name: string;
  metric_value: number;
  step: number | null;
  epoch: number | null;
  event_time: string;
}

type TeamRole = "team_admin" | "team_member";

interface MockTeam {
  id: number;
  name: string;
  description: string;
  created_by: number;
  created_at: string;
}

interface MockTeamMember {
  id: number;
  team_id: number;
  user_id: number;
  role: TeamRole;
  joined_at: string;
}

type TeamInviteStatus = "pending" | "accepted" | "revoked";

interface MockTeamInvite {
  id: number;
  team_id: number;
  email: string;
  role: TeamRole;
  invited_by: number;
  status: TeamInviteStatus;
  token: string;
  created_at: string;
  accepted_by: number | null;
  accepted_at: string | null;
}

interface AuthSuccess {
  ok: true;
  user: MockUser;
  token: string;
}

interface AuthFailure {
  ok: false;
  response: MockResponse;
}

type AuthResult = AuthSuccess | AuthFailure;

interface AccessKeyAuthSuccess {
  ok: true;
  accessKey: MockAccessKey;
  user: MockUser;
}

interface AccessKeyAuthFailure {
  ok: false;
  response: MockResponse;
}

type AccessKeyAuthResult = AccessKeyAuthSuccess | AccessKeyAuthFailure;

const MOCK_DELAY_MS = 120;

const defaultConfigV1: JsonObject = {
  server: {
    heartbeat_interval_seconds: 15,
    timeout: 10,
    retry_count: 3,
  },
  agent: {
    upload_frequency: "epoch",
    upload_interval: 1,
  },
};

const defaultConfigV2: JsonObject = {
  server: {
    heartbeat_interval_seconds: 10,
    timeout: 8,
    retry_count: 2,
  },
  agent: {
    upload_frequency: "step",
    upload_interval: 20,
  },
};

const state = {
  users: [
    {
      id: 1,
      email: "admin@train-guard.local",
      name: "Admin",
      password: "123456",
      created_at: nowIso(),
    } as MockUser,
    {
      id: 2,
      email: "member@train-guard.local",
      name: "Operator",
      password: "123456",
      created_at: nowIso(),
    } as MockUser,
  ],
  teams: [
    {
      id: 1,
      name: "Train Guard Core Team",
      description: "负责训练平台运营、配置治理与指标回传。",
      created_by: 1,
      created_at: nowIso(),
    } as MockTeam,
  ],
  teamMembers: [
    {
      id: 1,
      team_id: 1,
      user_id: 1,
      role: "team_admin",
      joined_at: nowIso(),
    } as MockTeamMember,
    {
      id: 2,
      team_id: 1,
      user_id: 2,
      role: "team_member",
      joined_at: nowIso(),
    } as MockTeamMember,
  ],
  teamInvites: [
    {
      id: 1,
      team_id: 1,
      email: "new.joiner@train-guard.local",
      role: "team_member",
      invited_by: 1,
      status: "pending",
      token: `invite_${randomHex(20)}`,
      created_at: nowIso(),
      accepted_by: null,
      accepted_at: null,
    } as MockTeamInvite,
  ],
  accessKeys: [
    {
      id: 1,
      user_id: 1,
      name: "cli-dev",
      access_key_id: "ak_demo_admin_001",
      secret_key: "sk_demo_admin_001",
      is_active: true,
      created_at: offsetIso(-2 * 24 * 60 * 60 * 1000),
      last_used_at: offsetIso(-30 * 60 * 1000),
    } as MockAccessKey,
    {
      id: 2,
      user_id: 1,
      name: "notebook-prod",
      access_key_id: "ak_demo_admin_002",
      secret_key: "sk_demo_admin_002",
      is_active: true,
      created_at: offsetIso(-6 * 24 * 60 * 60 * 1000),
      last_used_at: offsetIso(-5 * 60 * 60 * 1000),
    } as MockAccessKey,
    {
      id: 3,
      user_id: 2,
      name: "member-local",
      access_key_id: "ak_demo_member_001",
      secret_key: "sk_demo_member_001",
      is_active: true,
      created_at: offsetIso(-3 * 24 * 60 * 60 * 1000),
      last_used_at: null,
    } as MockAccessKey,
  ],
  apps: [
    {
      id: 1,
      name: "Demo App",
      app_id: "project_demo_001",
      app_secret: "secret_demo_001",
      is_active: true,
      created_by: 1,
      created_at: nowIso(),
    } as MockApp,
    {
      id: 2,
      name: "Vision Pipeline",
      app_id: "project_vision_002",
      app_secret: "secret_vision_002",
      is_active: true,
      created_by: 1,
      created_at: offsetIso(-2 * 24 * 60 * 60 * 1000),
    } as MockApp,
    {
      id: 3,
      name: "LLM Fine-tune Hub",
      app_id: "project_llm_003",
      app_secret: "secret_llm_003",
      is_active: true,
      created_by: 1,
      created_at: offsetIso(-5 * 24 * 60 * 60 * 1000),
    } as MockApp,
    {
      id: 4,
      name: "Ranking Trainer",
      app_id: "project_rank_004",
      app_secret: "secret_rank_004",
      is_active: true,
      created_by: 1,
      created_at: offsetIso(-8 * 24 * 60 * 60 * 1000),
    } as MockApp,
    {
      id: 5,
      name: "Speech Lab",
      app_id: "project_speech_005",
      app_secret: "secret_speech_005",
      is_active: true,
      created_by: 1,
      created_at: offsetIso(-12 * 24 * 60 * 60 * 1000),
    } as MockApp,
    {
      id: 6,
      name: "Anomaly Watch",
      app_id: "project_anomaly_006",
      app_secret: "secret_anomaly_006",
      is_active: true,
      created_by: 1,
      created_at: offsetIso(-14 * 24 * 60 * 60 * 1000),
    } as MockApp,
    {
      id: 7,
      name: "Forecast Engine",
      app_id: "project_forecast_007",
      app_secret: "secret_forecast_007",
      is_active: true,
      created_by: 1,
      created_at: offsetIso(-18 * 24 * 60 * 60 * 1000),
    } as MockApp,
    {
      id: 8,
      name: "Fraud Shield",
      app_id: "project_fraud_008",
      app_secret: "secret_fraud_008",
      is_active: true,
      created_by: 1,
      created_at: offsetIso(-22 * 24 * 60 * 60 * 1000),
    } as MockApp,
  ],
  configs: [
    {
      id: 1,
      app_pk: 1,
      version: 1,
      content: defaultConfigV1,
      is_active: false,
      created_at: nowIso(),
      published_at: null,
      published_by: 1,
    } as MockConfigVersion,
    {
      id: 2,
      app_pk: 1,
      version: 2,
      content: defaultConfigV2,
      is_active: true,
      created_at: nowIso(),
      published_at: nowIso(),
      published_by: 1,
    } as MockConfigVersion,
  ],
  runs: [
    {
      id: 1,
      app_pk: 1,
      train_id: "train-resnet50",
      first_seen_at: offsetIso(-6 * 60 * 60 * 1000),
      last_seen_at: offsetIso(-35 * 60 * 1000),
    } as MockRun,
    {
      id: 2,
      app_pk: 1,
      train_id: "train-vit-b16",
      first_seen_at: offsetIso(-4 * 60 * 60 * 1000),
      last_seen_at: offsetIso(-12 * 60 * 1000),
    } as MockRun,
    {
      id: 3,
      app_pk: 2,
      train_id: "train-yolov11-large",
      first_seen_at: offsetIso(-9 * 60 * 60 * 1000),
      last_seen_at: offsetIso(-8 * 60 * 1000),
    } as MockRun,
    {
      id: 4,
      app_pk: 2,
      train_id: "train-segformer-b4",
      first_seen_at: offsetIso(-15 * 60 * 60 * 1000),
      last_seen_at: offsetIso(-95 * 60 * 1000),
    } as MockRun,
    {
      id: 5,
      app_pk: 2,
      train_id: "train-detr-v2",
      first_seen_at: offsetIso(-30 * 60 * 60 * 1000),
      last_seen_at: offsetIso(-160 * 60 * 1000),
    } as MockRun,
    {
      id: 6,
      app_pk: 3,
      train_id: "train-llama3-8b-sft",
      first_seen_at: offsetIso(-11 * 60 * 60 * 1000),
      last_seen_at: offsetIso(-5 * 60 * 1000),
    } as MockRun,
    {
      id: 7,
      app_pk: 3,
      train_id: "train-qwen2.5-14b-dpo",
      first_seen_at: offsetIso(-42 * 60 * 60 * 1000),
      last_seen_at: offsetIso(-6 * 60 * 60 * 1000),
    } as MockRun,
    {
      id: 8,
      app_pk: 4,
      train_id: "train-ranker-xgb",
      first_seen_at: offsetIso(-22 * 60 * 60 * 1000),
      last_seen_at: offsetIso(-130 * 60 * 1000),
    } as MockRun,
    {
      id: 9,
      app_pk: 5,
      train_id: "train-wav2vec2-base",
      first_seen_at: offsetIso(-50 * 60 * 60 * 1000),
      last_seen_at: offsetIso(-18 * 60 * 60 * 1000),
    } as MockRun,
    {
      id: 10,
      app_pk: 6,
      train_id: "train-isolation-forest-v2",
      first_seen_at: offsetIso(-26 * 60 * 60 * 1000),
      last_seen_at: offsetIso(-2 * 60 * 60 * 1000),
    } as MockRun,
    {
      id: 11,
      app_pk: 6,
      train_id: "train-anomaly-transformer",
      first_seen_at: offsetIso(-70 * 60 * 60 * 1000),
      last_seen_at: offsetIso(-24 * 60 * 60 * 1000),
    } as MockRun,
    {
      id: 12,
      app_pk: 7,
      train_id: "train-prophet-ensemble",
      first_seen_at: offsetIso(-16 * 60 * 60 * 1000),
      last_seen_at: offsetIso(-48 * 60 * 1000),
    } as MockRun,
    {
      id: 13,
      app_pk: 8,
      train_id: "train-gbdt-fraud",
      first_seen_at: offsetIso(-10 * 24 * 60 * 60 * 1000),
      last_seen_at: offsetIso(-30 * 60 * 60 * 1000),
    } as MockRun,
  ],
  metrics: [
    {
      id: 1,
      run_id: 1,
      received_at: offsetIso(-42 * 60 * 1000),
      payload: {
        train_id: "train-resnet50",
        step: 20,
        loss: 1.83,
        acc: 0.41,
        lr: 0.0003,
      },
    } as MockMetricRecord,
    {
      id: 2,
      run_id: 1,
      received_at: offsetIso(-35 * 60 * 1000),
      payload: {
        train_id: "train-resnet50",
        step: 40,
        loss: 1.22,
        acc: 0.56,
        lr: 0.0003,
      },
    } as MockMetricRecord,
    {
      id: 3,
      run_id: 2,
      received_at: offsetIso(-18 * 60 * 1000),
      payload: {
        train_id: "train-vit-b16",
        step: 20,
        loss: 1.51,
        acc: 0.48,
        lr: 0.0002,
      },
    } as MockMetricRecord,
    {
      id: 4,
      run_id: 2,
      received_at: offsetIso(-12 * 60 * 1000),
      payload: {
        train_id: "train-vit-b16",
        step: 40,
        loss: 1.05,
        acc: 0.62,
        lr: 0.0002,
      },
    } as MockMetricRecord,
    {
      id: 5,
      run_id: 3,
      received_at: offsetIso(-16 * 60 * 1000),
      payload: {
        train_id: "train-yolov11-large",
        step: 120,
        loss: 0.78,
        map50: 0.67,
        lr: 0.00015,
      },
    } as MockMetricRecord,
    {
      id: 6,
      run_id: 3,
      received_at: offsetIso(-8 * 60 * 1000),
      payload: {
        train_id: "train-yolov11-large",
        step: 160,
        loss: 0.65,
        map50: 0.71,
        lr: 0.00012,
      },
    } as MockMetricRecord,
    {
      id: 7,
      run_id: 4,
      received_at: offsetIso(-110 * 60 * 1000),
      payload: {
        train_id: "train-segformer-b4",
        step: 90,
        loss: 0.93,
        miou: 0.58,
        lr: 0.0002,
      },
    } as MockMetricRecord,
    {
      id: 8,
      run_id: 5,
      received_at: offsetIso(-170 * 60 * 1000),
      payload: {
        train_id: "train-detr-v2",
        step: 60,
        loss: 1.14,
        map50: 0.49,
        lr: 0.00018,
      },
    } as MockMetricRecord,
    {
      id: 9,
      run_id: 6,
      received_at: offsetIso(-9 * 60 * 1000),
      payload: {
        train_id: "train-llama3-8b-sft",
        step: 340,
        loss: 1.72,
        reward: 0.33,
        lr: 0.00005,
      },
    } as MockMetricRecord,
    {
      id: 10,
      run_id: 6,
      received_at: offsetIso(-5 * 60 * 1000),
      payload: {
        train_id: "train-llama3-8b-sft",
        step: 400,
        loss: 1.48,
        reward: 0.41,
        lr: 0.00004,
      },
    } as MockMetricRecord,
    {
      id: 11,
      run_id: 7,
      received_at: offsetIso(-7 * 60 * 60 * 1000),
      payload: {
        train_id: "train-qwen2.5-14b-dpo",
        step: 180,
        loss: 1.91,
        reward: 0.21,
        lr: 0.00003,
      },
    } as MockMetricRecord,
    {
      id: 12,
      run_id: 8,
      received_at: offsetIso(-140 * 60 * 1000),
      payload: {
        train_id: "train-ranker-xgb",
        step: 75,
        loss: 0.61,
        auc: 0.81,
        lr: 0.03,
      },
    } as MockMetricRecord,
    {
      id: 13,
      run_id: 9,
      received_at: offsetIso(-19 * 60 * 60 * 1000),
      payload: {
        train_id: "train-wav2vec2-base",
        step: 55,
        loss: 0.89,
        wer: 0.21,
        lr: 0.0001,
      },
    } as MockMetricRecord,
    {
      id: 14,
      run_id: 10,
      received_at: offsetIso(-3 * 60 * 60 * 1000),
      payload: {
        train_id: "train-isolation-forest-v2",
        step: 48,
        loss: 0.44,
        f1: 0.76,
        lr: 0.008,
      },
    } as MockMetricRecord,
    {
      id: 15,
      run_id: 11,
      received_at: offsetIso(-25 * 60 * 60 * 1000),
      payload: {
        train_id: "train-anomaly-transformer",
        step: 90,
        loss: 0.58,
        recall: 0.72,
        lr: 0.0006,
      },
    } as MockMetricRecord,
    {
      id: 16,
      run_id: 12,
      received_at: offsetIso(-55 * 60 * 1000),
      payload: {
        train_id: "train-prophet-ensemble",
        step: 32,
        loss: 0.37,
        mape: 0.11,
        lr: 0.004,
      },
    } as MockMetricRecord,
    {
      id: 17,
      run_id: 13,
      received_at: offsetIso(-31 * 60 * 60 * 1000),
      payload: {
        train_id: "train-gbdt-fraud",
        step: 68,
        loss: 0.52,
        auc: 0.87,
        lr: 0.02,
      },
    } as MockMetricRecord,
  ],
  metricSeries: [] as MockMetricSeriesPoint[],
  issuedTokens: new Map<string, number>(),
  blacklistedTokens: new Set<string>(),
  activeConfigCache: new Map<string, JsonObject>(),
  registerEmailCodes: new Map<string, string>(),
  nextIds: {
    user: 3,
    team: 2,
    teamMember: 3,
    teamInvite: 2,
    accessKey: 4,
    app: 9,
    config: 3,
    run: 14,
    metric: 18,
    metricSeries: 1,
  },
};

bootstrapMetricSeries();

export async function handleMockRequest(request: MockRequest): Promise<MockResponse> {
  await sleep(MOCK_DELAY_MS);

  const method = request.method.toUpperCase();
  const url = new URL(request.url, "http://mock.local");
  const path = url.pathname;

  if (method === "GET" && path === "/health") {
    return ok({ status: "ok" });
  }

  if (method === "POST" && path === "/api/auth/register") {
    return register(request.body);
  }

  if (method === "POST" && path === "/api/auth/register/email-code") {
    return sendRegisterEmailCode(request.body);
  }

  if (method === "POST" && path === "/api/auth/login") {
    return login(request.body);
  }

  if (method === "GET" && path === "/api/auth/me") {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;

    return ok({ id: auth.user.id, name: auth.user.name, email: auth.user.email });
  }

  if (method === "POST" && path === "/api/auth/logout") {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;

    state.blacklistedTokens.add(auth.token);
    state.issuedTokens.delete(auth.token);
    return ok({ message: "ok" });
  }

  if (method === "GET" && path === "/api/team/current") {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;

    const membership = findMembershipByUserId(auth.user.id);
    if (!membership) {
      return fail(404, "You have not joined any team");
    }

    const team = state.teams.find((item) => item.id === membership.team_id);
    if (!team) {
      return fail(404, "Team not found");
    }

    return ok(buildTeamPayload(team, auth.user.id));
  }

  if (method === "POST" && path === "/api/team/join") {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;

    const payload = asObject(request.body);
    const token = asString(payload?.token).trim();
    if (!token) {
      return fail(400, "token required");
    }

    const invite = state.teamInvites.find((item) => item.token === token);
    if (!invite) {
      return fail(404, "Invite token not found");
    }

    if (invite.status !== "pending") {
      return fail(409, "Invite is no longer active");
    }

    if (invite.email !== auth.user.email) {
      return fail(403, "Invite email does not match current account");
    }

    const existingMembership = findMembershipByUserId(auth.user.id);
    if (existingMembership && existingMembership.team_id === invite.team_id) {
      return fail(409, "Already in team");
    }

    invite.status = "accepted";
    invite.accepted_by = auth.user.id;
    invite.accepted_at = nowIso();

    state.teamMembers.push({
      id: state.nextIds.teamMember++,
      team_id: invite.team_id,
      user_id: auth.user.id,
      role: invite.role,
      joined_at: nowIso(),
    });

    return ok({ message: "joined", team_id: invite.team_id });
  }

  if (method === "POST" && path === "/api/team/invites") {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;

    const adminContext = requireTeamAdmin(auth.user.id);
    if (!adminContext.ok) return adminContext.response;

    const payload = asObject(request.body);
    const email = asString(payload?.email).trim().toLowerCase();
    const role = normalizeTeamRole(payload?.role) ?? "team_member";

    if (!email || !email.includes("@")) {
      return fail(400, "valid email required");
    }

    const alreadyMember = findMemberByTeamAndEmail(adminContext.team.id, email);
    if (alreadyMember) {
      return fail(409, "User is already in the team");
    }

    const pendingInvite = state.teamInvites.find(
      (item) => item.team_id === adminContext.team.id && item.email === email && item.status === "pending",
    );
    if (pendingInvite) {
      return ok({
        invite_id: pendingInvite.id,
        email: pendingInvite.email,
        role: pendingInvite.role,
        status: pendingInvite.status,
        token: pendingInvite.token,
        created_at: pendingInvite.created_at,
      });
    }

    const invite: MockTeamInvite = {
      id: state.nextIds.teamInvite++,
      team_id: adminContext.team.id,
      email,
      role,
      invited_by: auth.user.id,
      status: "pending",
      token: `invite_${randomHex(20)}`,
      created_at: nowIso(),
      accepted_by: null,
      accepted_at: null,
    };
    state.teamInvites.push(invite);

    return ok(
      {
        invite_id: invite.id,
        email: invite.email,
        role: invite.role,
        status: invite.status,
        token: invite.token,
        created_at: invite.created_at,
      },
      201,
    );
  }

  const revokeInviteMatch = path.match(/^\/api\/team\/invites\/(\d+)\/revoke$/);
  if (revokeInviteMatch && method === "POST") {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;

    const adminContext = requireTeamAdmin(auth.user.id);
    if (!adminContext.ok) return adminContext.response;

    const inviteId = Number(revokeInviteMatch[1]);
    const invite = state.teamInvites.find((item) => item.id === inviteId && item.team_id === adminContext.team.id);
    if (!invite) {
      return fail(404, "Invite not found");
    }

    if (invite.status !== "pending") {
      return fail(409, "Only pending invite can be revoked");
    }

    invite.status = "revoked";
    return ok({ message: "revoked" });
  }

  const acceptInviteMatch = path.match(/^\/api\/team\/invites\/(\d+)\/accept$/);
  if (acceptInviteMatch && method === "POST") {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;

    const inviteId = Number(acceptInviteMatch[1]);
    const invite = state.teamInvites.find((item) => item.id === inviteId);
    if (!invite) {
      return fail(404, "Invite not found");
    }

    if (invite.status !== "pending") {
      return fail(409, "Invite is no longer active");
    }

    if (auth.user.email !== invite.email) {
      return fail(403, "This invite does not match current account");
    }

    const existingMembership = findMembershipByUserId(auth.user.id);
    if (existingMembership && existingMembership.team_id === invite.team_id) {
      return fail(409, "Already in team");
    }

    invite.status = "accepted";
    invite.accepted_by = auth.user.id;
    invite.accepted_at = nowIso();

    state.teamMembers.push({
      id: state.nextIds.teamMember++,
      team_id: invite.team_id,
      user_id: auth.user.id,
      role: invite.role,
      joined_at: nowIso(),
    });

    return ok({ message: "accepted", team_id: invite.team_id });
  }

  const updateMemberRoleMatch = path.match(/^\/api\/team\/members\/(\d+)\/role$/);
  if (updateMemberRoleMatch && method === "PATCH") {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;

    const adminContext = requireTeamAdmin(auth.user.id);
    if (!adminContext.ok) return adminContext.response;

    const memberId = Number(updateMemberRoleMatch[1]);
    const role = normalizeTeamRole(asObject(request.body)?.role);
    if (!role) {
      return fail(400, "invalid role");
    }

    const member = state.teamMembers.find((item) => item.id === memberId && item.team_id === adminContext.team.id);
    if (!member) {
      return fail(404, "Member not found");
    }

    member.role = role;
    return ok({ message: "updated", role });
  }

  const removeMemberMatch = path.match(/^\/api\/team\/members\/(\d+)$/);
  if (removeMemberMatch && method === "DELETE") {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;

    const adminContext = requireTeamAdmin(auth.user.id);
    if (!adminContext.ok) return adminContext.response;

    const memberId = Number(removeMemberMatch[1]);
    const memberIndex = state.teamMembers.findIndex(
      (item) => item.id === memberId && item.team_id === adminContext.team.id,
    );
    if (memberIndex < 0) {
      return fail(404, "Member not found");
    }

    const member = state.teamMembers[memberIndex];
    if (member.user_id === auth.user.id) {
      return fail(409, "Cannot remove yourself");
    }

    state.teamMembers.splice(memberIndex, 1);
    return ok({ message: "removed" });
  }

  if (method === "GET" && path === "/api/projects") {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;

    const projects = state.apps
      .filter((app) => app.created_by === auth.user.id)
      .sort((a, b) => b.id - a.id)
      .map(toProjectListItem);

    return ok(projects);
  }

  if (method === "GET" && path === "/api/access-keys") {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;

    const accessKeys = state.accessKeys
      .filter((item) => item.user_id === auth.user.id)
      .sort((a, b) => b.id - a.id)
      .map(toAccessKeyListItem);

    return ok(accessKeys);
  }

  if (method === "POST" && path === "/api/access-keys") {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;

    const payload = asObject(request.body);
    const name = asString(payload?.name).trim();
    if (!name) {
      return fail(400, "name required");
    }

    const accessKey: MockAccessKey = {
      id: state.nextIds.accessKey++,
      user_id: auth.user.id,
      name,
      access_key_id: `ak_${randomHex(16)}`,
      secret_key: `sk_${randomHex(32)}`,
      is_active: true,
      created_at: nowIso(),
      last_used_at: null,
    };

    state.accessKeys.push(accessKey);

    return ok(
      {
        ...toAccessKeyListItem(accessKey),
        secret_key: accessKey.secret_key,
      },
      201,
    );
  }

  const revokeAccessKeyMatch = path.match(/^\/api\/access-keys\/(\d+)$/);
  if (revokeAccessKeyMatch && method === "DELETE") {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;

    const accessKeyId = Number(revokeAccessKeyMatch[1]);
    const accessKey = state.accessKeys.find((item) => item.id === accessKeyId && item.user_id === auth.user.id);
    if (!accessKey) {
      return fail(404, "Not found");
    }

    accessKey.is_active = false;
    return ok({ message: "revoked" });
  }

  if (method === "POST" && path === "/api/projects") {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;

    const payload = asObject(request.body);
    const name = asString(payload?.name).trim();
    if (!name) {
      return fail(400, "name required");
    }

    const app: MockApp = {
      id: state.nextIds.app++,
      name,
      app_id: `project_${randomHex(16)}`,
      app_secret: `secret_${randomHex(32)}`,
      is_active: true,
      created_by: auth.user.id,
      created_at: nowIso(),
    };

    state.apps.push(app);

    return ok(
      {
        ...toProjectListItem(app),
        project_secret: app.app_secret,
      },
      201,
    );
  }

  const configsMatch = path.match(/^\/api\/projects\/(\d+)\/configs$/);
  if (configsMatch && method === "GET") {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;

    const appPk = Number(configsMatch[1]);
    const app = findOwnedProject(appPk, auth.user.id);
    if (!app) return fail(404, "Not found");

    const data = state.configs
      .filter((item) => item.app_pk === app.id)
      .sort((a, b) => b.version - a.version)
      .map((item) => ({
        id: item.id,
        version: item.version,
        is_active: item.is_active,
        content: item.content,
        created_at: item.created_at,
        published_at: item.published_at,
      }));

    return ok(data);
  }

  if (configsMatch && method === "POST") {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;

    const appPk = Number(configsMatch[1]);
    const app = findOwnedProject(appPk, auth.user.id);
    if (!app) return fail(404, "Not found");

    const payload = asObject(request.body);
    const content = payload?.content;
    if (!isJsonObject(content)) {
      return fail(400, "content must be JSON object");
    }

    const maxVersion = state.configs
      .filter((item) => item.app_pk === app.id)
      .reduce((max, item) => Math.max(max, item.version), 0);

    const row: MockConfigVersion = {
      id: state.nextIds.config++,
      app_pk: app.id,
      version: maxVersion + 1,
      content,
      is_active: false,
      created_at: nowIso(),
      published_at: null,
      published_by: auth.user.id,
    };

    state.configs.push(row);

    return ok({ id: row.id, version: row.version, is_active: row.is_active }, 201);
  }

  const currentConfigMatch = path.match(/^\/api\/projects\/(\d+)\/config$/);
  if (currentConfigMatch && method === "GET") {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;

    const appPk = Number(currentConfigMatch[1]);
    const app = findOwnedProject(appPk, auth.user.id);
    if (!app) return fail(404, "Not found");

    const row = state.configs
      .filter((item) => item.app_pk === app.id)
      .sort((a, b) => {
        if (a.is_active !== b.is_active) {
          return a.is_active ? -1 : 1;
        }
        return b.version - a.version;
      })[0];

    if (!row) {
      return ok(null);
    }

    return ok({
      id: row.id,
      version: row.version,
      is_active: row.is_active,
      content: row.content,
      created_at: row.created_at,
      published_at: row.published_at,
    });
  }

  if (currentConfigMatch && method === "PUT") {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;

    const appPk = Number(currentConfigMatch[1]);
    const app = findOwnedProject(appPk, auth.user.id);
    if (!app) return fail(404, "Not found");

    const payload = asObject(request.body);
    const content = payload?.content;
    if (!isJsonObject(content)) {
      return fail(400, "content must be JSON object");
    }

    let row = state.configs
      .filter((item) => item.app_pk === app.id)
      .sort((a, b) => {
        if (a.is_active !== b.is_active) {
          return a.is_active ? -1 : 1;
        }
        return b.version - a.version;
      })[0];

    if (row) {
      row.content = content;
      row.is_active = true;
      row.published_at = nowIso();
      row.published_by = auth.user.id;
    } else {
      row = {
        id: state.nextIds.config++,
        app_pk: app.id,
        version: 1,
        content,
        is_active: true,
        created_at: nowIso(),
        published_at: nowIso(),
        published_by: auth.user.id,
      } as MockConfigVersion;
      state.configs.push(row);
    }

    for (const item of state.configs) {
      if (item.app_pk === app.id && item.id !== row.id) {
        item.is_active = false;
      }
    }

    state.activeConfigCache.set(app.app_id, clone(row.content));

    return ok({
      id: row.id,
      version: row.version,
      is_active: row.is_active,
      content: row.content,
      created_at: row.created_at,
      published_at: row.published_at,
    });
  }

  const publishMatch = path.match(/^\/api\/projects\/(\d+)\/configs\/(\d+)\/publish$/);
  if (publishMatch && method === "POST") {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;

    const appPk = Number(publishMatch[1]);
    const configId = Number(publishMatch[2]);

    const app = findOwnedProject(appPk, auth.user.id);
    if (!app) return fail(404, "Not found");

    const row = state.configs.find((item) => item.id === configId && item.app_pk === app.id);
    if (!row) return fail(404, "Not found");

    for (const item of state.configs) {
      if (item.app_pk === app.id && item.is_active) {
        item.is_active = false;
      }
    }

    row.is_active = true;
    row.published_at = nowIso();
    state.activeConfigCache.set(app.app_id, clone(row.content));

    return ok({ message: "published", version: row.version });
  }

  const runsMatch = path.match(/^\/api\/projects\/(\d+)\/runs$/);
  if (runsMatch && method === "GET") {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;

    const appPk = Number(runsMatch[1]);
    const app = findOwnedProject(appPk, auth.user.id);
    if (!app) return fail(404, "Not found");

    const data = state.runs
      .filter((item) => item.app_pk === app.id)
      .sort((a, b) => b.last_seen_at.localeCompare(a.last_seen_at))
      .map((item) => ({
        id: item.id,
        train_id: item.train_id,
        first_seen_at: item.first_seen_at,
        last_seen_at: item.last_seen_at,
      }));

    return ok(data);
  }

  const metricsMatch = path.match(/^\/api\/projects\/(\d+)\/runs\/(\d+)\/metrics$/);
  if (metricsMatch && method === "GET") {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;

    const appPk = Number(metricsMatch[1]);
    const runId = Number(metricsMatch[2]);

    const app = findOwnedProject(appPk, auth.user.id);
    if (!app) return fail(404, "Not found");

    const run = state.runs.find((item) => item.id === runId && item.app_pk === app.id);
    if (!run) return fail(404, "Not found");

    const limit = clampNumber(Number(url.searchParams.get("limit") ?? "50"), 1, 500);
    const data = state.metrics
      .filter((item) => item.run_id === run.id)
      .sort((a, b) => b.id - a.id)
      .slice(0, limit)
      .map((item) => ({
        id: item.id,
        received_at: item.received_at,
        payload: item.payload,
      }));

    return ok(data);
  }

  const metricSeriesMatch = path.match(/^\/api\/projects\/(\d+)\/runs\/(\d+)\/metrics\/series$/);
  if (metricSeriesMatch && method === "GET") {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;

    const appPk = Number(metricSeriesMatch[1]);
    const runId = Number(metricSeriesMatch[2]);

    const app = findOwnedProject(appPk, auth.user.id);
    if (!app) return fail(404, "Not found");

    const run = state.runs.find((item) => item.id === runId && item.app_pk === app.id);
    if (!run) return fail(404, "Not found");

    const requestedMetric = asString(url.searchParams.get("metric") ?? "").trim();
    const limit = clampNumber(Number(url.searchParams.get("limit") ?? "240"), 10, 2000);

    const names = Array.from(
      new Set(state.metricSeries.filter((item) => item.run_id === run.id).map((item) => item.metric_name)),
    ).sort((a, b) => a.localeCompare(b));

    const selectedMetric = names.includes(requestedMetric) ? requestedMetric : names[0] || null;
    const points = selectedMetric
      ? state.metricSeries
          .filter((item) => item.run_id === run.id && item.metric_name === selectedMetric)
          .sort((a, b) => a.event_time.localeCompare(b.event_time))
          .slice(-limit)
          .map((item) => ({
            id: item.id,
            metric_name: item.metric_name,
            value: item.metric_value,
            step: item.step,
            epoch: item.epoch,
            event_time: item.event_time,
          }))
      : [];

    return ok({
      run_id: run.id,
      train_id: run.train_id,
      metric_names: names,
      selected_metric: selectedMetric,
      points,
    });
  }

  if (method === "POST" && path === "/api/agent/config/fetch") {
    const accessKeyAuth = requireAccessKeyAuth(request, url.searchParams);
    if (!accessKeyAuth.ok) return accessKeyAuth.response;

    const project = findProjectForAccessKey(request, url.searchParams, accessKeyAuth.user.id);
    if (!project) {
      return fail(404, "Project not found");
    }

    const cache = state.activeConfigCache.get(project.app_id);
    if (cache) {
      return ok({
        code: 0,
        data: {
          config: hydrateProjectConfig(cache, request, project),
          from_cache: true,
        },
      });
    }

    const activeConfig = state.configs
      .filter((item) => item.app_pk === project.id && item.is_active)
      .sort((a, b) => b.id - a.id)[0];

    if (!activeConfig) {
      return fail(404, "No active config");
    }

    state.activeConfigCache.set(project.app_id, clone(activeConfig.content));

    return ok({
      code: 0,
      data: {
        config: hydrateProjectConfig(activeConfig.content, request, project),
        from_cache: false,
      },
    });
  }

  if (method === "POST" && path === "/api/metrics/ingest") {
    const accessKeyAuth = requireAccessKeyAuth(request, url.searchParams);
    if (!accessKeyAuth.ok) return accessKeyAuth.response;

    const project = findProjectForAccessKey(request, url.searchParams, accessKeyAuth.user.id);
    if (!project) {
      return fail(404, "Project not found");
    }

    const payload = asObject(request.body) ?? {};
    const trainId = asString(payload.train_id).trim() || "default";
    const now = nowIso();

    let run = state.runs.find((item) => item.app_pk === project.id && item.train_id === trainId);
    if (!run) {
      run = {
        id: state.nextIds.run++,
        app_pk: project.id,
        train_id: trainId,
        first_seen_at: now,
        last_seen_at: now,
      };
      state.runs.push(run);
    } else {
      run.last_seen_at = now;
    }

    const record: MockMetricRecord = {
      id: state.nextIds.metric++,
      run_id: run.id,
      payload,
      received_at: now,
    };
    state.metrics.push(record);
    appendMetricSeriesPoints(run.id, payload, now);

    return response(202, { code: 0, message: "ok", run_id: run.id, record_id: record.id });
  }

  return fail(404, `Mock route not found: ${method} ${path}`);
}

function register(body: unknown): MockResponse {
  const payload = asObject(body);
  const email = asString(payload?.email).trim().toLowerCase();
  const name = asString(payload?.name).trim();
  const password = asString(payload?.password);
  const verificationCode = asString(payload?.verification_code).trim();

  if (!email || !name || password.length < 6 || !verificationCode) {
    return fail(400, "name/email/password(>=6)/verification_code required");
  }

  if (state.users.some((item) => item.email === email)) {
    return fail(409, "Email already exists");
  }

  const savedCode = state.registerEmailCodes.get(email);
  if (!savedCode || savedCode !== verificationCode) {
    return fail(400, "Invalid or expired verification code");
  }

  const user: MockUser = {
    id: state.nextIds.user++,
    email,
    name,
    password,
    created_at: nowIso(),
  };

  state.users.push(user);
  state.registerEmailCodes.delete(email);
  return response(201, { message: "ok" });
}

function sendRegisterEmailCode(body: unknown): MockResponse {
  const payload = asObject(body);
  const email = asString(payload?.email).trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return fail(400, "valid email required");
  }

  if (state.users.some((item) => item.email === email)) {
    return fail(409, "Email already exists");
  }

  const code = `${Math.floor(Math.random() * 1_000_000)}`.padStart(6, "0");
  state.registerEmailCodes.set(email, code);
  return ok({ message: "ok" });
}

function login(body: unknown): MockResponse {
  const payload = asObject(body);
  const email = asString(payload?.email).trim().toLowerCase();
  const password = asString(payload?.password);

  const user = state.users.find((item) => item.email === email);
  if (!user || user.password !== password) {
    return fail(401, "Invalid credentials");
  }

  const token = `mock_${user.id}_${randomHex(24)}`;
  state.issuedTokens.set(token, user.id);

  return ok({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
  });
}

function requireAuth(request: MockRequest): AuthResult {
  const token = parseBearerToken(request.headers.authorization);
  if (!token || state.blacklistedTokens.has(token)) {
    return { ok: false, response: fail(401, "Unauthorized") };
  }

  const userId = state.issuedTokens.get(token);
  if (!userId) {
    return { ok: false, response: fail(401, "Unauthorized") };
  }

  const user = state.users.find((item) => item.id === userId);
  if (!user) {
    return { ok: false, response: fail(401, "Unauthorized") };
  }

  return { ok: true, user, token };
}

function requireAccessKeyAuth(request: MockRequest, query: URLSearchParams): AccessKeyAuthResult {
  const body = asObject(request.body);

  const accessKeyId =
    asString(request.headers["x-access-key-id"]).trim() ||
    asString(query.get("access_key_id") ?? "").trim() ||
    asString(body?.access_key_id).trim();

  const secretKey =
    asString(request.headers["x-secret-key"]).trim() ||
    asString(query.get("secret_key") ?? "").trim() ||
    asString(body?.secret_key).trim();

  if (!accessKeyId || !secretKey) {
    return { ok: false, response: fail(401, "Invalid access key credentials") };
  }

  const accessKey = state.accessKeys.find(
    (item) => item.access_key_id === accessKeyId && item.secret_key === secretKey && item.is_active,
  );
  if (!accessKey) {
    return { ok: false, response: fail(401, "Invalid access key credentials") };
  }

  const user = state.users.find((item) => item.id === accessKey.user_id);
  if (!user) {
    return { ok: false, response: fail(401, "Access key owner not found") };
  }

  accessKey.last_used_at = nowIso();
  return { ok: true, accessKey, user };
}

function findOwnedProject(appPk: number, userId: number): MockApp | undefined {
  return state.apps.find((item) => item.id === appPk && item.created_by === userId);
}

function findProjectForAccessKey(request: MockRequest, query: URLSearchParams, userId: number): MockApp | undefined {
  const body = asObject(request.body);
  const projectId =
    asString(request.headers["x-project-id"]).trim() ||
    asString(query.get("project_id") ?? "").trim() ||
    asString(body?.project_id).trim();

  if (!projectId) {
    return undefined;
  }

  return state.apps.find((item) => item.app_id === projectId && item.created_by === userId && item.is_active);
}

function findMembershipByUserId(userId: number): MockTeamMember | undefined {
  return state.teamMembers.find((item) => item.user_id === userId);
}

function findMemberByTeamAndEmail(teamId: number, email: string): MockTeamMember | undefined {
  const user = state.users.find((item) => item.email === email);
  if (!user) {
    return undefined;
  }
  return state.teamMembers.find((item) => item.team_id === teamId && item.user_id === user.id);
}

function normalizeTeamRole(value: unknown): TeamRole | null {
  if (value === "team_admin" || value === "team_member") {
    return value;
  }
  return null;
}

function requireTeamAdmin(userId: number):
  | { ok: true; team: MockTeam; membership: MockTeamMember }
  | { ok: false; response: MockResponse } {
  const membership = findMembershipByUserId(userId);
  if (!membership) {
    return { ok: false, response: fail(403, "Not in team") };
  }

  const team = state.teams.find((item) => item.id === membership.team_id);
  if (!team) {
    return { ok: false, response: fail(404, "Team not found") };
  }

  if (membership.role !== "team_admin") {
    return { ok: false, response: fail(403, "Admin role required") };
  }

  return { ok: true, team, membership };
}

function getTeamPermissions(role: TeamRole) {
  const isAdmin = role === "team_admin";
  return {
    manage_members: isAdmin,
    invite_members: isAdmin,
    manage_roles: isAdmin,
    view_audit: true,
  };
}

function buildTeamPayload(team: MockTeam, currentUserId: number) {
  const myMembership = state.teamMembers.find((item) => item.team_id === team.id && item.user_id === currentUserId);
  if (!myMembership) {
    return null;
  }

  const members = state.teamMembers
    .filter((item) => item.team_id === team.id)
    .map((item) => {
      const user = state.users.find((userItem) => userItem.id === item.user_id);
      return {
        id: item.id,
        user_id: item.user_id,
        name: user?.name ?? `User-${item.user_id}`,
        email: user?.email ?? "unknown",
        role: item.role,
        joined_at: item.joined_at,
      };
    })
    .sort((a, b) => a.id - b.id);

  const invites = state.teamInvites
    .filter((item) => item.team_id === team.id)
    .sort((a, b) => b.id - a.id)
    .map((item) => ({
      id: item.id,
      email: item.email,
      role: item.role,
      status: item.status,
      token: item.token,
      created_at: item.created_at,
      accepted_at: item.accepted_at,
    }));

  return {
    team: {
      id: team.id,
      name: team.name,
      description: team.description,
      created_at: team.created_at,
    },
    my_role: myMembership.role,
    permissions: getTeamPermissions(myMembership.role),
    members,
    invites,
  };
}

function toProjectListItem(app: MockApp) {
  return {
    id: app.id,
    name: app.name,
    project_id: app.app_id,
    is_active: app.is_active,
    created_at: app.created_at,
  };
}

function hydrateProjectConfig(content: unknown, request: MockRequest, project: MockApp) {
  const hydrated = clone(content);
  const root = asObject(hydrated) ?? {};
  const server = asObject(root.server) ?? {};
  const reportUrl = new URL("/api/metrics/ingest", request.url);
  reportUrl.searchParams.set("project_id", project.app_id);
  server.url = reportUrl.toString();
  root.server = server;
  return root;
}

function toAccessKeyListItem(accessKey: MockAccessKey) {
  return {
    id: accessKey.id,
    name: accessKey.name,
    access_key_id: accessKey.access_key_id,
    is_active: accessKey.is_active,
    created_at: accessKey.created_at,
    last_used_at: accessKey.last_used_at,
  };
}

function parseBearerToken(authHeader: string | undefined): string {
  if (!authHeader) {
    return "";
  }

  const [scheme, token] = authHeader.split(" ");
  if (!scheme || !token) {
    return "";
  }

  if (scheme.toLowerCase() !== "bearer") {
    return "";
  }

  return token.trim();
}

function asObject(value: unknown): JsonObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as JsonObject;
}

function isJsonObject(value: unknown): value is JsonObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function clampNumber(input: number, min: number, max: number): number {
  if (Number.isNaN(input)) return min;
  return Math.min(Math.max(input, min), max);
}

function bootstrapMetricSeries(): void {
  for (const record of state.metrics) {
    appendMetricSeriesPoints(record.run_id, record.payload, record.received_at);
  }
}

function appendMetricSeriesPoints(runId: number, payload: JsonObject, eventTime: string): void {
  const step = parseOptionalInt(payload.step ?? payload.global_step);
  const epoch = parseOptionalInt(payload.epoch);

  for (const [key, rawValue] of Object.entries(payload)) {
    if (isReservedMetricKey(key)) {
      continue;
    }

    const metricValue = parseMetricNumber(rawValue);
    if (metricValue === null) {
      continue;
    }

    state.metricSeries.push({
      id: state.nextIds.metricSeries++,
      run_id: runId,
      metric_name: key,
      metric_value: metricValue,
      step,
      epoch,
      event_time: eventTime,
    });
  }
}

function parseOptionalInt(value: unknown): number | null {
  if (value === undefined || value === null || typeof value === "boolean") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.trunc(parsed);
}

function parseMetricNumber(value: unknown): number | null {
  if (value === undefined || value === null || typeof value === "boolean") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

function isReservedMetricKey(key: string): boolean {
  return ["train_id", "step", "global_step", "epoch", "timestamp", "time", "project_id", "access_key_id", "secret_key"].includes(key);
}

function randomHex(len: number): string {
  const chars = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < len; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function nowIso(): string {
  return new Date().toISOString();
}

function offsetIso(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

function clone<T>(value: T): T {
  if (value === undefined || value === null) {
    return value;
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function response(status: number, data: unknown): MockResponse {
  return {
    status,
    data: clone(data),
  };
}

function ok(data: unknown, status = 200): MockResponse {
  return response(status, data);
}

function fail(status: number, message: string): MockResponse {
  return response(status, { message });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
