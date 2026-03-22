# Train Guard Worker

使用 Go 编写的 Kafka Consumer，用于消费 dashboard 产生的指标事件，并将可查询的时序指标点写入 PostgreSQL 的 `metric_series_points` 表。

## 处理链路

- `train-guard-dashboard` 将训练指标事件发送到 Kafka topic：`train-guard.metrics.ingest`
- `train-guard-worker` 消费该 topic
- Worker 从事件里的 `payload` 提取数值型指标，并写入 PostgreSQL

消息格式与 `train-guard-dashboard/backend/app/routes/agent.py` 中的事件保持一致：

```json
{
  "project_pk": 1,
  "project_id": "project_xxx",
  "run_id": 12,
  "record_id": 1288,
  "train_id": "train-001",
  "received_at": "2026-03-22T12:00:00Z",
  "payload": {
    "train_id": "train-001",
    "step": 10,
    "loss": 0.42,
    "accuracy": 0.91
  }
}
```

## 环境变量

- `DATABASE_URL`：PostgreSQL 连接串
- `KAFKA_BOOTSTRAP_SERVERS`：Kafka 地址，逗号分隔，默认 `localhost:9092`
- `KAFKA_METRICS_TOPIC`：默认 `train-guard.metrics.ingest`
- `KAFKA_CONSUMER_GROUP_ID`：默认 `train-guard-worker`
- `KAFKA_CONSUMER_MIN_BYTES`：默认 `1000`
- `KAFKA_CONSUMER_MAX_BYTES`：默认 `10000000`
- `KAFKA_CONSUMER_MAX_WAIT`：默认 `1s`
- `KAFKA_CONSUMER_AUTO_COMMIT`：默认 `true`

## 启动

```bash
cd train-guard-worker
go mod tidy
go run .
```

## 数据库要求

需要先由 dashboard 初始化好 PostgreSQL 表结构，至少包含：

- `training_runs`
- `metric_records`
- `metric_series_points`

当前 worker 只负责把 Kafka 里的指标事件转成 `metric_series_points`；原始 `metric_records` 仍由 dashboard 接口写入。
