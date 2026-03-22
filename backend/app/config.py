import os


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret")
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/train_guard"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    EMAIL_CODE_TTL_SECONDS = int(os.getenv("EMAIL_CODE_TTL_SECONDS", "300"))
    EMAIL_CODE_COOLDOWN_SECONDS = int(os.getenv("EMAIL_CODE_COOLDOWN_SECONDS", "60"))
    SMTP_HOST = os.getenv("SMTP_HOST", "")
    SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
    SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
    SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "false").lower() == "true"
    SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", SMTP_USERNAME)
    JWT_EXPIRES_MINUTES = int(os.getenv("JWT_EXPIRES_MINUTES", "120"))
    CORS_ORIGINS = [x.strip() for x in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if x.strip()]
    KAFKA_BOOTSTRAP_SERVERS = [
        x.strip() for x in os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092").split(",") if x.strip()
    ]
    KAFKA_METRICS_TOPIC = os.getenv("KAFKA_METRICS_TOPIC", "train-guard.metrics.ingest")
    KAFKA_PRODUCER_ACKS = os.getenv("KAFKA_PRODUCER_ACKS", "1")
    KAFKA_PRODUCER_LINGER_MS = int(os.getenv("KAFKA_PRODUCER_LINGER_MS", "10"))
    KAFKA_PRODUCER_RETRIES = int(os.getenv("KAFKA_PRODUCER_RETRIES", "3"))
    KAFKA_SEND_TIMEOUT_SECONDS = float(os.getenv("KAFKA_SEND_TIMEOUT_SECONDS", "3"))
