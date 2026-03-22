# Train Guard Dashboard（MVP）

训练可视化平台首版，包含：

- 登录 / 注册
- JWT API 鉴权
- 首页 Dashboard 概览
- Web 配置中心（版本化 + 发布）
- Agent 配置分发
- 训练数据记录与查询

技术栈：

- Frontend: Vue 3 + Element Plus + pnpm + Vite
- Backend: Python + Flask + PostgreSQL + Redis + Kafka

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
- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/:projectId/config`
- `PUT /api/projects/:projectId/config`
- `GET /api/dashboard/overview`
- `GET /api/projects/:projectId/runs`
- `GET /api/projects/:projectId/runs/:runId/metrics`
- `GET /api/projects/:projectId/runs/:runId/metrics/series`

Agent 侧（AK/SK + Project Header 鉴权）：

- `GET /api/agent/config`
- `POST /api/metrics/ingest`

指标上报链路说明：

- `POST /api/metrics/ingest`：后端接收后写入 Kafka（默认 topic：`train-guard.metrics.ingest`）
- 下游消费服务负责将指标事件落库到时序表（可按业务独立扩容）

## Agent 接入约定

1. 在 Web 管理台创建项目，拿到 `project_id`
2. 在配置中心发布一个有效配置
3. Agent 拉取配置：
   - URL: `/api/agent/config`
   - Header: `X-Access-Key-Id`, `X-Secret-Key`, `X-Project-Id`
   - Method: `GET`
4. Agent 上报数据到 `server.url`
   - `server.url` 会在拉配置时由后端自动注入为 `/api/metrics/ingest`
   - 请求 `/api/metrics/ingest` 时同样携带 `X-Access-Key-Id` / `X-Secret-Key` / `X-Project-Id`

## dev 分支自动部署（镜像构建 + 开发服务器部署）

仓库已新增工作流：`.github/workflows/deploy-dev-server.yml`

- 触发条件：`push` 到 `dev` 分支（或手动 `workflow_dispatch`）
- 构建内容：
  - 后端镜像：`<ACR_REGISTRY>/<ACR_NAMESPACE>/train-guard-dashboard/backend:dev`
  - 前端镜像：`<ACR_REGISTRY>/<ACR_NAMESPACE>/train-guard-dashboard/frontend:dev`
- 前端构建模式：固定 `VITE_API_MODE=real`（开发服务器使用真实后端）
- 部署方式：CI 通过 SSH 登录开发机，执行 `docker compose up -d`

### 需要配置的 GitHub Secrets

- `DEV_ACR_REGISTRY`：阿里云 ACR Registry（例如 `registry.cn-hangzhou.aliyuncs.com`）
- `DEV_ACR_NAMESPACE`：ACR 命名空间
- `DEV_ACR_USERNAME`：ACR 用户名
- `DEV_ACR_PASSWORD`：ACR 密码/令牌
- `DEV_BACKEND_REPOSITORY`：后端镜像仓库名（例如 `devserver-backend`）
- `DEV_FRONTEND_REPOSITORY`：前端镜像仓库名（例如 `devserver-frontend`）
- `DEV_SERVER_HOST`：开发机地址
- `DEV_SERVER_PORT`：SSH 端口（可选，默认 `22`）
- `DEV_SERVER_USER`：SSH 用户
- `DEV_SERVER_SSH_KEY`：私钥（用于 SSH 登录）
- `DEV_DEPLOY_PATH`：服务器部署目录（例如 `/opt/train-guard-dashboard`）
- `DEV_FRONTEND_API_BASE_URL`：前端真实 API 地址（例如 `http://<dev-host>:8000`）
- `DEV_SECRET_KEY`：后端密钥
- `DEV_CORS_ORIGINS`：允许跨域来源（例如 `http://<dev-host>`）
- `DEV_POSTGRES_PASSWORD`：数据库密码
- `DEV_POSTGRES_DB`：数据库名（可选，默认 `train_guard`）
- `DEV_POSTGRES_USER`：数据库用户（可选，默认 `postgres`）
- `DEV_POSTGRES_IMAGE`：PostgreSQL 镜像（建议填你 ACR 内的镜像）
- `DEV_REDIS_IMAGE`：Redis 镜像（建议填你 ACR 内的镜像）
- `DEV_KAFKA_IMAGE`：Kafka 镜像（可选，默认 `bitnami/kafka:3.7`）
- `DEV_KAFKA_BOOTSTRAP_SERVERS`：后端连接 Kafka 地址（可选，默认 `kafka:9092`）
- `DEV_KAFKA_METRICS_TOPIC`：指标 topic（可选，默认 `train-guard.metrics.ingest`）
- `DEV_FRONTEND_PORT`：前端对外端口（可选，默认 `80`）
- `DEV_BACKEND_PORT`：后端对外端口（可选，默认 `8000`）
- `DEV_JWT_EXPIRES_MINUTES`：JWT 过期时间（可选，默认 `120`）

### 开发机前置要求

- 已安装 Docker + Docker Compose（`docker compose`）
- `DEV_SERVER_USER` 对部署目录有读写权限
- 开发机可访问阿里云 ACR，并可通过 `docker login <DEV_ACR_REGISTRY>` 拉取镜像
- ACR 中需要提前创建 `DEV_BACKEND_REPOSITORY` / `DEV_FRONTEND_REPOSITORY` 两个仓库

## 贡献者

感谢所有为这个项目做出贡献的同学。

<a href="https://github.com/samoyed24/train-guard-dashboard/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=samoyed24/train-guard-dashboard" alt="contributors" />
</a>
