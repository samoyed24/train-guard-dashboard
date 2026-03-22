package main

import (
	"context"
	"errors"
	"log"
	"os/signal"
	"syscall"

	"train-guard-worker/internal/config"
	"train-guard-worker/internal/consumer"
	"train-guard-worker/internal/store"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	cfg := config.Load()

	db, err := store.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("connect postgres failed: %v", err)
	}
	defer db.Close()

	streamConsumer, err := consumer.New(cfg, db)
	if err != nil {
		log.Fatalf("create redis stream consumer failed: %v", err)
	}

	if err := streamConsumer.Run(ctx); err != nil && !errors.Is(err, context.Canceled) {
		log.Fatalf("consumer stopped with error: %v", err)
	}
}
