# Train Guard Dashboard（MVP）

训练可视化平台首版，包含：

- 登录 / 注册
- JWT API 鉴权
- Web 配置中心（版本化 + 发布）
- Agent 配置分发
- 训练数据记录与查询

技术栈：

- Frontend: Vue 3 + Element Plus + pnpm + Vite
- Backend: Python + Flask + PostgreSQL + Redis

## 在线试用

- 试用网址：https://samoyed24.github.io/train-guard-dashboard/
- 用户名（邮箱）：admin@train-guard.local
- 密码：123456

说明：在线试用站点默认使用 Mock 接口数据。

## 目录

- `frontend/` 前端项目
- `backend/` 后端项目

## 环境要求

- Node.js 18+
- pnpm 8+
- Python 3.10+
- uv（https://docs.astral.sh/uv/getting-started/installation/）

## 快速启动

### 1) 启动后端

```bash
cd backend
# 安装依赖并创建虚拟环境（.venv）
uv sync

cp .env.example .env

# 初始化数据库
uv run flask --app run.py init-db

# 启动后端
uv run python run.py
```

后端默认：`http://localhost:8000`

### 2) 启动前端

```bash
cd frontend
pnpm install
pnpm dev
```

前端默认：`http://localhost:5173`

前端默认 API 模式：`mock`（无需后端即可联调页面）

如需切换真实后端，在 `frontend/.env.local` 中设置：

```env
VITE_API_MODE=real
VITE_API_BASE_URL=http://localhost:8000
```

## 核心接口

用户侧（Bearer Token）：

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/apps`
- `POST /api/apps`
- `GET /api/apps/:appId/configs`
- `POST /api/apps/:appId/configs`
- `POST /api/apps/:appId/configs/:configId/publish`
- `GET /api/apps/:appId/runs`
- `GET /api/apps/:appId/runs/:runId/metrics`

Agent 侧（app_id/app_secret 鉴权）：

- `POST /api/agent/config/fetch`
- `POST /api/metrics/ingest`

## Agent 接入约定

1. 在 Web 管理台创建应用，拿到 `app_id/app_secret`
2. 在配置中心发布一个有效配置，包含 `server.url`
3. Agent 拉取配置：
   - URL: `/api/agent/config/fetch`
   - Header: `X-App-Id`, `X-App-Secret`
   - Body: `{ "app_id": "...", "app_secret": "..." }`
4. Agent 上报数据到 `server.url`（可使用 query 传鉴权）：
   - `http://localhost:8000/api/metrics/ingest?app_id=...&app_secret=...`

