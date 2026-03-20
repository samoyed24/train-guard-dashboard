# Train Guard Dashboard Backend

技术栈：Flask + PostgreSQL + Redis

依赖管理：uv（`pyproject.toml`）

## 功能

- 用户注册/登录/JWT 鉴权
- 应用管理（生成 app_id/app_secret）
- Web 配置中心（配置版本、发布激活）
- 配置分发（`/api/agent/config/fetch`）
- 训练指标上报（`/api/metrics/ingest`）
- 指标查询（按 app/run）
- 指标时序点存储与按指标曲线查询

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
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/apps`
- `GET /api/apps`
- `POST /api/apps/:appId/configs`
- `POST /api/apps/:appId/configs/:configId/publish`
- `POST /api/agent/config/fetch`（Agent 用）
- `POST /api/metrics/ingest`（Agent 用）
- `GET /api/apps/:appId/runs/:runId/metrics/series`

`init-db` 会在建表后尝试启用 TimescaleDB（hypertable）。
若数据库未安装 TimescaleDB 扩展，会自动回退到普通 PostgreSQL 表存储时序点。

## Agent 对接

配置拉取支持：
- Header: `X-App-Id` / `X-App-Secret`
- Body: `app_id` / `app_secret`

数据上报鉴权支持：
- Header 或 Query 携带 `app_id` / `app_secret`
- 方便将 `server.url` 配置成：
  - `http://localhost:8000/api/metrics/ingest?app_id=...&app_secret=...`
