# Backend API Documentation

This document describes all HTTP APIs currently implemented in the backend.

## Base URL

- Local development: `http://localhost:8000`
- All examples below use `/api/...` relative paths.

## Authentication

### 1. User session APIs

Most dashboard APIs require a JWT bearer token:

```http
Authorization: Bearer <token>
```

### 2. Agent APIs

Agent-side APIs use Access Key credentials plus `project_id`.

Headers:

```http
X-Access-Key-Id: <access_key_id>
X-Secret-Key: <secret_key>
X-Project-Id: <project_id>
```

Equivalent query/body fields are also accepted where applicable:

- `access_key_id`
- `secret_key`
- `project_id`

## Common Response Style

Most business APIs return JSON objects or arrays directly.

Common error shape:

```json
{
  "message": "error description"
}
```

Some agent APIs return:

```json
{
  "code": 0,
  "data": {}
}
```

## Auth APIs

### POST `/api/auth/register/email-code`

Send registration verification code by email.

Request body:

```json
{
  "email": "alice@example.com"
}
```

Responses:

- `200`: `{"message":"ok"}`
- `400`: invalid email
- `409`: email already exists
- `429`: cooldown not finished
- `500`: email sending failed

### POST `/api/auth/register`

Create a user account.

Request body:

```json
{
  "email": "alice@example.com",
  "name": "Alice",
  "password": "secret123",
  "verification_code": "123456"
}
```

Responses:

- `201`: `{"message":"ok"}`
- `400`: missing or invalid fields, or expired code
- `409`: email already exists

### POST `/api/auth/login`

Login with email and password.

Request body:

```json
{
  "email": "alice@example.com",
  "password": "secret123"
}
```

Response `200`:

```json
{
  "token": "<jwt>",
  "user": {
    "id": 1,
    "name": "Alice",
    "email": "alice@example.com"
  }
}
```

Response `401`: invalid credentials.

### GET `/api/auth/me`

Get current user profile.

Auth: Bearer token

Response `200`:

```json
{
  "id": 1,
  "name": "Alice",
  "email": "alice@example.com"
}
```

### POST `/api/auth/logout`

Logout and blacklist the current JWT.

Auth: Bearer token

Response `200`:

```json
{
  "message": "ok"
}
```

## Project APIs

All endpoints in this section require Bearer token auth.

### GET `/api/projects`

List projects created by the current user.

Response `200`:

```json
[
  {
    "id": 1,
    "name": "Demo Project",
    "project_id": "project_abcd1234",
    "is_active": true,
    "created_at": "2026-03-22T10:00:00+00:00"
  }
]
```

### POST `/api/projects`

Create a project.

Request body:

```json
{
  "name": "Demo Project"
}
```

Response `201`:

```json
{
  "id": 1,
  "name": "Demo Project",
  "project_id": "project_abcd1234",
  "project_secret": "secret_xxxxx",
  "is_active": true,
  "created_at": "2026-03-22T10:00:00+00:00"
}
```

Notes:

- `project_secret` is returned only when the project is created.

### GET `/api/projects/{projectPk}/config`

Get the current project config. Returns the active config if one exists, otherwise the latest config, otherwise `null`.

Response `200`:

```json
{
  "id": 3,
  "version": 1,
  "is_active": true,
  "content": {
    "server": {
      "heartbeat_interval_seconds": 15,
      "timeout": 10,
      "retry_count": 3
    },
    "agent": {
      "upload_frequency": "epoch",
      "upload_interval": 1
    }
  },
  "created_at": "2026-03-22T10:00:00+00:00",
  "published_at": "2026-03-22T10:05:00+00:00"
}
```

Possible `200` response:

```json
null
```

### PUT `/api/projects/{projectPk}/config`

Create or update the current active config.

Request body:

```json
{
  "content": {
    "server": {
      "heartbeat_interval_seconds": 15,
      "timeout": 10,
      "retry_count": 3
    },
    "agent": {
      "upload_frequency": "epoch",
      "upload_interval": 1
    }
  }
}
```

Response `200`:

```json
{
  "id": 3,
  "version": 1,
  "is_active": true,
  "content": {
    "server": {
      "heartbeat_interval_seconds": 15,
      "timeout": 10,
      "retry_count": 3
    },
    "agent": {
      "upload_frequency": "epoch",
      "upload_interval": 1
    }
  },
  "created_at": "2026-03-22T10:00:00+00:00",
  "published_at": "2026-03-22T10:05:00+00:00"
}
```

Response `400`:

```json
{
  "message": "content must be JSON object"
}
```

### GET `/api/projects/{projectPk}/configs`

List all config versions for a project.

Response `200`:

```json
[
  {
    "id": 3,
    "version": 2,
    "is_active": true,
    "content": {},
    "created_at": "2026-03-22T10:00:00+00:00",
    "published_at": "2026-03-22T10:05:00+00:00"
  }
]
```

### POST `/api/projects/{projectPk}/configs`

Create a new config version without publishing it.

Request body:

```json
{
  "content": {}
}
```

Response `201`:

```json
{
  "id": 4,
  "version": 3,
  "is_active": false
}
```

### POST `/api/projects/{projectPk}/configs/{configId}/publish`

Publish a specific config version.

Response `200`:

```json
{
  "message": "published",
  "version": 3
}
```

### GET `/api/projects/{projectPk}/runs`

List all runs under a project.

Response `200`:

```json
[
  {
    "id": 10,
    "train_id": "run-001",
    "first_seen_at": "2026-03-22T10:00:00+00:00",
    "last_seen_at": "2026-03-22T10:30:00+00:00"
  }
]
```

### GET `/api/projects/{projectPk}/runs/{runId}/metrics`

List raw metric records for a run.

Query params:

- `limit`: default `50`, range `1-500`

Response `200`:

```json
[
  {
    "id": 100,
    "received_at": "2026-03-22T10:30:00+00:00",
    "payload": {
      "train_id": "run-001",
      "loss": 0.123,
      "step": 10
    }
  }
]
```

### GET `/api/projects/{projectPk}/runs/{runId}/metrics/series`

List time-series points for a run. If the run only has historical raw records, the backend will backfill the series table before reading.

Query params:

- `metric`: optional metric name
- `limit`: default `240`, range `10-2000`

Response `200`:

```json
{
  "run": {
    "id": 10,
    "train_id": "run-001",
    "first_seen_at": "2026-03-22T10:00:00+00:00",
    "last_seen_at": "2026-03-22T10:30:00+00:00"
  },
  "metric_names": ["loss", "lr"],
  "selected_metric": "loss",
  "points": [
    {
      "id": 1000,
      "value": 0.123,
      "step": 10,
      "epoch": 1,
      "event_time": "2026-03-22T10:30:00+00:00"
    }
  ]
}
```

## Dashboard APIs

All endpoints in this section require Bearer token auth.

### GET `/api/dashboard/overview`

Get dashboard overview data, including summary, project ranking, recent runs, and featured metric pulse data.

Query params:

- `recent_limit`: default `8`, range `1-30`
- `project_rank_limit`: default `6`, range `1-20`
- `pulse_limit`: default `80`, range `10-500`
- `featured_run_id`: optional positive integer
- `metric`: optional metric name

Response `200`:

```json
{
  "summary": {
    "project_count": 2,
    "run_count": 12,
    "active_runs_24h": 3,
    "latest_report_at": "2026-03-22T10:30:00+00:00"
  },
  "projects": [
    {
      "id": 1,
      "name": "Demo Project",
      "project_id": "project_abcd1234",
      "created_at": "2026-03-22T10:00:00+00:00"
    }
  ],
  "project_run_stats": [
    {
      "project_pk": 1,
      "name": "Demo Project",
      "project_id": "project_abcd1234",
      "run_count": 5,
      "latest_report_at": "2026-03-22T10:30:00+00:00"
    }
  ],
  "recent_runs": [
    {
      "id": 10,
      "train_id": "run-001",
      "first_seen_at": "2026-03-22T10:00:00+00:00",
      "last_seen_at": "2026-03-22T10:30:00+00:00",
      "project_pk": 1,
      "project_name": "Demo Project",
      "project_id": "project_abcd1234"
    }
  ],
  "featured": {
    "run": {
      "id": 10,
      "train_id": "run-001",
      "first_seen_at": "2026-03-22T10:00:00+00:00",
      "last_seen_at": "2026-03-22T10:30:00+00:00",
      "project_pk": 1,
      "project_name": "Demo Project",
      "project_id": "project_abcd1234"
    },
    "metric_names": ["loss"],
    "selected_metric": "loss",
    "points": [
      {
        "id": 1000,
        "value": 0.123,
        "step": 10,
        "epoch": 1,
        "event_time": "2026-03-22T10:30:00+00:00"
      }
    ]
  }
}
```

When the user has no project, the API returns empty arrays and `featured.run = null`.

## Access Key APIs

All endpoints in this section require Bearer token auth.

### GET `/api/access-keys`

List the current user's access keys.

Response `200`:

```json
[
  {
    "id": 1,
    "name": "CLI Key",
    "access_key_id": "ak_xxxxx",
    "is_active": true,
    "created_at": "2026-03-22T10:00:00+00:00",
    "last_used_at": "2026-03-22T10:30:00+00:00"
  }
]
```

### POST `/api/access-keys`

Create a new access key.

Request body:

```json
{
  "name": "CLI Key"
}
```

Response `201`:

```json
{
  "id": 1,
  "name": "CLI Key",
  "access_key_id": "ak_xxxxx",
  "secret_key": "sk_xxxxx",
  "is_active": true,
  "created_at": "2026-03-22T10:00:00+00:00",
  "last_used_at": null
}
```

Notes:

- `secret_key` is returned only at creation time.

### DELETE `/api/access-keys/{keyId}`

Revoke an access key.

Response `200`:

```json
{
  "message": "revoked"
}
```

## Team APIs

All endpoints in this section require Bearer token auth.

Roles:

- `team_admin`
- `team_member`

Invite statuses:

- `pending`
- `accepted`
- `revoked`

### GET `/api/team/current`

Get the current team and membership details.

Response `200`:

```json
{
  "team": {
    "id": 1,
    "name": "Train Guard Core Team",
    "description": "Default team for bootstrap and permissions setup.",
    "created_at": "2026-03-22T10:00:00+00:00"
  },
  "my_role": "team_admin",
  "permissions": {
    "manage_members": true,
    "invite_members": true,
    "manage_roles": true,
    "view_audit": true
  },
  "members": [
    {
      "id": 1,
      "user_id": 1,
      "name": "Alice",
      "email": "alice@example.com",
      "role": "team_admin",
      "joined_at": "2026-03-22T10:00:00+00:00"
    }
  ],
  "invites": [
    {
      "id": 1,
      "email": "bob@example.com",
      "role": "team_member",
      "status": "pending",
      "token": "invite_xxxxx",
      "created_at": "2026-03-22T10:00:00+00:00",
      "accepted_at": null
    }
  ]
}
```

Response `404`: user has not joined any team.

### POST `/api/team/join`

Join a team using invite token.

Request body:

```json
{
  "token": "invite_xxxxx"
}
```

Response `200`:

```json
{
  "message": "joined",
  "team_id": 1
}
```

### POST `/api/team/invites`

Create a team invite. Admin only.

Request body:

```json
{
  "email": "bob@example.com",
  "role": "team_member"
}
```

Responses:

- `201`: invite created
- `200`: an existing pending invite for the same email already exists
- `400`: invalid email
- `403`: not in team or not admin
- `409`: user already in team

Success response:

```json
{
  "invite_id": 1,
  "email": "bob@example.com",
  "role": "team_member",
  "status": "pending",
  "token": "invite_xxxxx",
  "created_at": "2026-03-22T10:00:00+00:00"
}
```

### POST `/api/team/invites/{inviteId}/revoke`

Revoke a pending invite. Admin only.

Response `200`:

```json
{
  "message": "revoked"
}
```

Possible errors:

- `403`: not in team or not admin
- `404`: invite not found
- `409`: invite is not pending

### POST `/api/team/invites/{inviteId}/accept`

Accept an invite while logged in.

Response `200`:

```json
{
  "message": "accepted",
  "team_id": 1
}
```

### PATCH `/api/team/members/{memberId}/role`

Update a member's role. Admin only.

Request body:

```json
{
  "role": "team_member"
}
```

Response `200`:

```json
{
  "message": "updated",
  "role": "team_member"
}
```

Possible errors:

- `400`: invalid role
- `403`: not in team or not admin
- `404`: member not found

### DELETE `/api/team/members/{memberId}`

Remove a member from the team. Admin only.

Response `200`:

```json
{
  "message": "removed"
}
```

Possible errors:

- `403`: not in team or not admin
- `404`: member not found
- `409`: cannot remove yourself

## Agent APIs

These endpoints are intended for agents or SDKs, not the dashboard UI.

### POST `/api/agent/config/fetch`

Fetch the active config for a project using access key credentials.

Auth:

- `X-Access-Key-Id`
- `X-Secret-Key`
- `X-Project-Id`

Minimal request body:

```json
{
  "project_id": "project_abcd1234",
  "access_key_id": "ak_xxxxx",
  "secret_key": "sk_xxxxx"
}
```

Response `200`:

```json
{
  "code": 0,
  "data": {
    "config": {
      "server": {
        "heartbeat_interval_seconds": 15,
        "timeout": 10,
        "retry_count": 3,
        "url": "http://localhost:8000/api/metrics/ingest?project_id=project_abcd1234"
      },
      "agent": {
        "upload_frequency": "epoch",
        "upload_interval": 1
      }
    },
    "from_cache": true
  }
}
```

Possible errors:

- `401`: invalid access key credentials
- `404`: project not found or no active config

### POST `/api/metrics/ingest`

Ingest one metric payload and enqueue a Kafka event for the worker.

Auth:

- `X-Access-Key-Id`
- `X-Secret-Key`
- `X-Project-Id`

Request body example:

```json
{
  "project_id": "project_abcd1234",
  "access_key_id": "ak_xxxxx",
  "secret_key": "sk_xxxxx",
  "train_id": "run-001",
  "epoch": 1,
  "step": 10,
  "loss": 0.123,
  "lr": 0.0001
}
```

Response `202`:

```json
{
  "code": 0,
  "message": "ok",
  "run_id": 10,
  "record_id": 100,
  "queued": true,
  "kafka": {
    "topic": "train-guard.metrics.ingest",
    "partition": 0,
    "offset": 123
  }
}
```

Possible errors:

- `400`: payload is not a JSON object
- `401`: invalid access key credentials
- `404`: project not found
- `503`: Kafka publish failed

## Notes

- Project ownership checks are enforced server-side for all dashboard APIs.
- Agent APIs do not expose `project_secret`; they rely on user-owned Access Keys.
- `server.url` in fetched config is generated automatically from `PUBLIC_API_BASE_URL` when configured, otherwise from the current request host.
- Historical versioned config APIs still exist, but the current frontend now primarily uses the single-config endpoints.
