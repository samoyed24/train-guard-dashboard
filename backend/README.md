# Train Guard Dashboard Backend

技术栈：Flask + PostgreSQL + Redis

依赖管理：uv（`pyproject.toml`）

## 功能

- 用户注册/登录/JWT 鉴权
- 应用管理（生成 app_id/app_secret）
- Web 配置中心（配置版本、发布激活）
- 配置分发（`/api/agent/config`）
- 训练指标上报（`/api/metrics/ingest`，写入 Redis Stream）
- 指标查询（按 app/run）
- 指标时序点存储与按指标曲线查询

## 指标链路

- `POST /api/metrics/ingest` 接口会：
  - 校验应用凭证
  - 更新 `training_runs` / `metric_records`
  - 将原始事件发布到 Redis Stream（默认 stream：`train-guard.metrics.ingest`）
- 建议由独立消费者服务消费 Redis Stream 并写入时序表。

## 启动

```bash
cd backend
# 安装依赖并创建虚拟环境（.venv）
uv sync

cp .env.example .env

# 初始化表
uv run flask --app run.py init-db

# 运行
uv run python run.py
```

默认服务：`http://localhost:8000`

## Docker 运行说明

后端镜像文件：`backend/Dockerfile`

- 容器默认监听：`8000`
- `FLASK_DEBUG` 默认关闭（`0`）
- 主要环境变量：
  - `SECRET_KEY`
  - `DATABASE_URL`
  - `REDIS_URL`
  - `METRICS_STREAM_KEY`
  - `CORS_ORIGINS`
  - `JWT_EXPIRES_MINUTES`
  - `EMAIL_CODE_TTL_SECONDS`
  - `EMAIL_CODE_COOLDOWN_SECONDS`
  - `SMTP_HOST` / `SMTP_PORT` / `SMTP_USERNAME` / `SMTP_PASSWORD` / `SMTP_USE_TLS` / `SMTP_FROM_EMAIL`

## 常用 uv 命令

```bash
# 新增依赖
uv add <package>

# 升级并锁定依赖
uv lock

# 按锁文件同步环境
uv sync
```

## 关键接口

- `POST /api/auth/register`
- `POST /api/auth/register/email-code`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/projects`
- `GET /api/projects`
- `GET /api/projects/:projectId/config`
- `PUT /api/projects/:projectId/config`
- `GET /api/dashboard/overview`
- `GET /api/agent/config`（Agent 用）
- `POST /api/metrics/ingest`（Agent 用）
- `GET /api/projects/:projectId/runs/:runId/metrics/series`

`POST /api/metrics/ingest` 成功返回示例（202）：

```json
{
  "code": 0,
  "message": "ok",
  "run_id": 12,
  "record_id": 1288,
  "queued": true,
  "queue": {
    "stream": "train-guard.metrics.ingest",
    "id": "1711123200000-0"
  }
}
```

`init-db` 默认仅建表，不会尝试启用 TimescaleDB。  
若需启用 TimescaleDB，请设置 `ENABLE_TIMESCALE=true` 后再执行 `init-db`。

## Agent 对接

配置拉取支持：
- Header: `X-Access-Key-Id` / `X-Secret-Key` / `X-Project-Id`
- Method: `GET /api/agent/config`

数据上报鉴权支持：
- Header 携带 `X-Access-Key-Id` / `X-Secret-Key` / `X-Project-Id`
- `server.url` 由后端注入为：
  - `http://localhost:8000/api/metrics/ingest`
