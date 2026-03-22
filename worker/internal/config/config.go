package config

import (
	"os"
	"strings"
	"time"
)

type Config struct {
	RedisURL             string
	MetricsStreamKey     string
	MetricsConsumerGroup string
	MetricsConsumerName  string
	MetricsReadBlock     time.Duration
	DatabaseURL          string
}

func Load() Config {
	return Config{
		RedisURL:             getEnv("REDIS_URL", "redis://localhost:6379/0"),
		MetricsStreamKey:     getEnv("METRICS_STREAM_KEY", "train-guard.metrics.ingest"),
		MetricsConsumerGroup: getEnv("METRICS_CONSUMER_GROUP", "train-guard-worker"),
		MetricsConsumerName:  getEnv("METRICS_CONSUMER_NAME", defaultConsumerName()),
		MetricsReadBlock:     getEnvDuration("METRICS_READ_BLOCK", 1*time.Second),
		DatabaseURL:          getEnv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/train_guard"),
	}
}

func defaultConsumerName() string {
	hostname, err := os.Hostname()
	if err != nil || strings.TrimSpace(hostname) == "" {
		return "train-guard-worker-1"
	}
	return hostname
}

func getEnv(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func getEnvDuration(key string, fallback time.Duration) time.Duration {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}

	parsed, err := time.ParseDuration(value)
	if err != nil {
		return fallback
	}
	return parsed
}
