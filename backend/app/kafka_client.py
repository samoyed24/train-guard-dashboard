import json
from typing import Any

from flask import current_app
from kafka import KafkaProducer

_producer: KafkaProducer | None = None


def get_kafka_producer() -> KafkaProducer:
    global _producer
    if _producer is None:
        servers = current_app.config.get("KAFKA_BOOTSTRAP_SERVERS", [])
        if not servers:
            raise ValueError("Kafka bootstrap servers are not configured")

        _producer = KafkaProducer(
            bootstrap_servers=servers,
            acks=current_app.config["KAFKA_PRODUCER_ACKS"],
            linger_ms=current_app.config["KAFKA_PRODUCER_LINGER_MS"],
            retries=current_app.config["KAFKA_PRODUCER_RETRIES"],
            value_serializer=lambda value: json.dumps(value, ensure_ascii=False).encode("utf-8"),
            key_serializer=lambda value: value.encode("utf-8") if value is not None else None,
        )
    return _producer


def publish_metric_ingest_event(event: dict[str, Any], key: str | None = None) -> dict[str, int | str]:
  producer = get_kafka_producer()
  future = producer.send(current_app.config["KAFKA_METRICS_TOPIC"], key=key, value=event)
  metadata = future.get(timeout=current_app.config["KAFKA_SEND_TIMEOUT_SECONDS"])
  return {"topic": metadata.topic, "partition": metadata.partition, "offset": metadata.offset}
