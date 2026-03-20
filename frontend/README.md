# Train Guard Dashboard Frontend

技术栈：Vue3 + Element Plus + pnpm + Vite

## 在线试用

- 试用网址：https://samoyed24.github.io/train-guard-dashboard/
- 用户名（邮箱）：admin@train-guard.local
- 密码：123456

说明：试用站点固定使用 Mock 模式。

## 启动

```bash
cd frontend
pnpm install
pnpm dev
```

默认访问：`http://localhost:5173`

## API 模式切换（Mock / Real）

默认模式为 `mock`，即前端无需依赖后端即可跑通全部页面流程。

1) 复制环境变量文件：

```bash
cp .env.example .env.local
```

2) 使用 Mock（默认）：

```env
VITE_API_MODE=mock
VITE_API_BASE_URL=http://localhost:8000
VITE_MOCK_LOGIN_EMAIL=
VITE_MOCK_LOGIN_PASSWORD=
```

其中 `VITE_MOCK_LOGIN_EMAIL` / `VITE_MOCK_LOGIN_PASSWORD` 为可选项：
- 配置后，登录页会在 Mock 模式下自动填充该账号密码。
- GitHub Pages 的 `dev` 分支自动部署会注入默认值（`admin@train-guard.local` / `123456`）。

3) 切到真实后端：

```env
VITE_API_MODE=real
VITE_API_BASE_URL=http://localhost:8000
```

修改环境变量后请重启 `pnpm dev`。

## 页面

- 概览看板 `/dashboard`
- 登录 `/login`
- 注册 `/register`
- 应用管理 `/apps`
- 配置中心 `/configs`
- 训练数据 `/metrics`

## 接口依赖

真实接口模式默认后端地址：`http://localhost:8000`

已内置 Mock 接口清单：

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
- `GET /api/apps/:appId/runs/:runId/metrics/series`
- `POST /api/agent/config/fetch`
- `POST /api/metrics/ingest`

## GitHub Pages 自动部署

- 工作流文件：`.github/workflows/deploy-frontend-pages.yml`
- 触发条件：`push` 到 `dev` 分支（以及手动 `workflow_dispatch`）
- 构建目录：`frontend/`
- 构建模式：固定使用 `VITE_API_MODE=mock`
- 部署目标：GitHub Pages（通过 GitHub Actions Artifact 发布）

首次使用时，请在仓库 `Settings -> Pages` 中确认 Source 为 `GitHub Actions`。
