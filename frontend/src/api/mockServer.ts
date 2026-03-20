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

interface AppAuthSuccess {
  ok: true;
  app: MockApp;
}

interface AppAuthFailure {
  ok: false;
  response: MockResponse;
}

type AppAuthResult = AppAuthSuccess | AppAuthFailure;

const MOCK_DELAY_MS = 120;

const defaultConfigV1: JsonObject = {
  server: {
    url: "http://localhost:8000/api/metrics/ingest?app_id=app_demo_001&app_secret=sec_demo_001",
    timeout: 10,
    retry_count: 3,
  },
  agent: {
    upload_frequency: "epoch",
    upload_interval: 1,
    enable_async: true,
  },
  metrics: {
    include_system_info: true,
  },
};

const defaultConfigV2: JsonObject = {
  server: {
    url: "http://localhost:8000/api/metrics/ingest?app_id=app_demo_001&app_secret=sec_demo_001",
    timeout: 8,
    retry_count: 2,
  },
  agent: {
    upload_frequency: "step",
    upload_interval: 20,
    enable_async: true,
  },
  metrics: {
    include_system_info: true,
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
  ],
  apps: [
    {
      id: 1,
      name: "Demo App",
      app_id: "app_demo_001",
      app_secret: "sec_demo_001",
      is_active: true,
      created_by: 1,
      created_at: nowIso(),
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
      first_seen_at: nowIso(),
      last_seen_at: nowIso(),
    } as MockRun,
    {
      id: 2,
      app_pk: 1,
      train_id: "train-vit-b16",
      first_seen_at: nowIso(),
      last_seen_at: nowIso(),
    } as MockRun,
  ],
  metrics: [
    {
      id: 1,
      run_id: 1,
      received_at: nowIso(),
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
      received_at: nowIso(),
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
      received_at: nowIso(),
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
      received_at: nowIso(),
      payload: {
        train_id: "train-vit-b16",
        step: 40,
        loss: 1.05,
        acc: 0.62,
        lr: 0.0002,
      },
    } as MockMetricRecord,
  ],
  metricSeries: [] as MockMetricSeriesPoint[],
  issuedTokens: new Map<string, number>(),
  blacklistedTokens: new Set<string>(),
  activeConfigCache: new Map<string, JsonObject>(),
  nextIds: {
    user: 2,
    app: 2,
    config: 3,
    run: 3,
    metric: 5,
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

  if (method === "GET" && path === "/api/apps") {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;

    const apps = state.apps
      .filter((app) => app.created_by === auth.user.id)
      .sort((a, b) => b.id - a.id)
      .map(toAppListItem);

    return ok(apps);
  }

  if (method === "POST" && path === "/api/apps") {
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
      app_id: `app_${randomHex(16)}`,
      app_secret: `sec_${randomHex(32)}`,
      is_active: true,
      created_by: auth.user.id,
      created_at: nowIso(),
    };

    state.apps.push(app);

    return ok(
      {
        ...toAppListItem(app),
        app_secret: app.app_secret,
      },
      201,
    );
  }

  const configsMatch = path.match(/^\/api\/apps\/(\d+)\/configs$/);
  if (configsMatch && method === "GET") {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;

    const appPk = Number(configsMatch[1]);
    const app = findOwnedApp(appPk, auth.user.id);
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
    const app = findOwnedApp(appPk, auth.user.id);
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

  const publishMatch = path.match(/^\/api\/apps\/(\d+)\/configs\/(\d+)\/publish$/);
  if (publishMatch && method === "POST") {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;

    const appPk = Number(publishMatch[1]);
    const configId = Number(publishMatch[2]);

    const app = findOwnedApp(appPk, auth.user.id);
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

  const runsMatch = path.match(/^\/api\/apps\/(\d+)\/runs$/);
  if (runsMatch && method === "GET") {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;

    const appPk = Number(runsMatch[1]);
    const app = findOwnedApp(appPk, auth.user.id);
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

  const metricsMatch = path.match(/^\/api\/apps\/(\d+)\/runs\/(\d+)\/metrics$/);
  if (metricsMatch && method === "GET") {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;

    const appPk = Number(metricsMatch[1]);
    const runId = Number(metricsMatch[2]);

    const app = findOwnedApp(appPk, auth.user.id);
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

  const metricSeriesMatch = path.match(/^\/api\/apps\/(\d+)\/runs\/(\d+)\/metrics\/series$/);
  if (metricSeriesMatch && method === "GET") {
    const auth = requireAuth(request);
    if (!auth.ok) return auth.response;

    const appPk = Number(metricSeriesMatch[1]);
    const runId = Number(metricSeriesMatch[2]);

    const app = findOwnedApp(appPk, auth.user.id);
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
    const appAuth = requireAppAuth(request, url.searchParams);
    if (!appAuth.ok) return appAuth.response;

    const cache = state.activeConfigCache.get(appAuth.app.app_id);
    if (cache) {
      return ok({
        code: 0,
        data: {
          config: cache,
          from_cache: true,
        },
      });
    }

    const activeConfig = state.configs
      .filter((item) => item.app_pk === appAuth.app.id && item.is_active)
      .sort((a, b) => b.id - a.id)[0];

    if (!activeConfig) {
      return fail(404, "No active config");
    }

    state.activeConfigCache.set(appAuth.app.app_id, clone(activeConfig.content));

    return ok({
      code: 0,
      data: {
        config: activeConfig.content,
        from_cache: false,
      },
    });
  }

  if (method === "POST" && path === "/api/metrics/ingest") {
    const appAuth = requireAppAuth(request, url.searchParams);
    if (!appAuth.ok) return appAuth.response;

    const payload = asObject(request.body) ?? {};
    const trainId = asString(payload.train_id).trim() || "default";
    const now = nowIso();

    let run = state.runs.find((item) => item.app_pk === appAuth.app.id && item.train_id === trainId);
    if (!run) {
      run = {
        id: state.nextIds.run++,
        app_pk: appAuth.app.id,
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

  if (!email || !name || password.length < 6) {
    return fail(400, "name/email/password(>=6) required");
  }

  if (state.users.some((item) => item.email === email)) {
    return fail(409, "Email already exists");
  }

  const user: MockUser = {
    id: state.nextIds.user++,
    email,
    name,
    password,
    created_at: nowIso(),
  };

  state.users.push(user);
  return response(201, { message: "ok" });
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

function requireAppAuth(request: MockRequest, query: URLSearchParams): AppAuthResult {
  const body = asObject(request.body);

  const appId =
    asString(request.headers["x-app-id"]).trim() ||
    asString(query.get("app_id") ?? "").trim() ||
    asString(body?.app_id).trim();

  const appSecret =
    asString(request.headers["x-app-secret"]).trim() ||
    asString(query.get("app_secret") ?? "").trim() ||
    asString(body?.app_secret).trim();

  if (!appId || !appSecret) {
    return { ok: false, response: fail(401, "Invalid app credentials") };
  }

  const app = state.apps.find((item) => item.app_id === appId && item.app_secret === appSecret);
  if (!app) {
    return { ok: false, response: fail(401, "Invalid app credentials") };
  }

  return { ok: true, app };
}

function findOwnedApp(appPk: number, userId: number): MockApp | undefined {
  return state.apps.find((item) => item.id === appPk && item.created_by === userId);
}

function toAppListItem(app: MockApp) {
  return {
    id: app.id,
    name: app.name,
    app_id: app.app_id,
    is_active: app.is_active,
    created_at: app.created_at,
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
  return ["train_id", "step", "global_step", "epoch", "timestamp", "time", "app_id", "app_secret"].includes(key);
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
