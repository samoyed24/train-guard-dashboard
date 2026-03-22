package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	KafkaBrokers       []string
	KafkaTopic         string
	KafkaGroupID       string
	KafkaMinBytes      int
	KafkaMaxBytes      int
	KafkaMaxWait       time.Duration
	KafkaCommitEnabled bool
	DatabaseURL        string
}

func Load() Config {
	return Config{
		KafkaBrokers:       splitCSV(getEnv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")),
		KafkaTopic:         getEnv("KAFKA_METRICS_TOPIC", "train-guard.metrics.ingest"),
		KafkaGroupID:       getEnv("KAFKA_CONSUMER_GROUP_ID", "train-guard-worker"),
		KafkaMinBytes:      getEnvInt("KAFKA_CONSUMER_MIN_BYTES", 1e3),
		KafkaMaxBytes:      getEnvInt("KAFKA_CONSUMER_MAX_BYTES", 10e6),
		KafkaMaxWait:       getEnvDuration("KAFKA_CONSUMER_MAX_WAIT", 1*time.Second),
		KafkaCommitEnabled: getEnvBool("KAFKA_CONSUMER_AUTO_COMMIT", true),
		DatabaseURL:        getEnv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/train_guard"),
	}
}

func getEnv(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func getEnvInt(key string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}

	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func getEnvBool(key string, fallback bool) bool {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}

	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fallback
	}
	return parsed
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

func splitCSV(value string) []string {
	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		item := strings.TrimSpace(part)
		if item != "" {
			out = append(out, item)
		}
	}
	return out
}
