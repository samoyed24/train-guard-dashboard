package consumer

import (
	"context"
	"errors"
	"io"
	"log"

	"github.com/segmentio/kafka-go"

	"train-guard-worker/internal/config"
	"train-guard-worker/internal/metrics"
	"train-guard-worker/internal/store"
)

type Consumer struct {
	reader       *kafka.Reader
	store        *store.Store
	autoCommit   bool
}

func New(cfg config.Config, store *store.Store) *Consumer {
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:  cfg.KafkaBrokers,
		GroupID:  cfg.KafkaGroupID,
		Topic:    cfg.KafkaTopic,
		MinBytes: cfg.KafkaMinBytes,
		MaxBytes: cfg.KafkaMaxBytes,
		MaxWait:  cfg.KafkaMaxWait,
	})

	return &Consumer{
		reader:     reader,
		store:      store,
		autoCommit: cfg.KafkaCommitEnabled,
	}
}

func (c *Consumer) Run(ctx context.Context) error {
	defer c.reader.Close()

	for {
		msg, err := c.reader.FetchMessage(ctx)
		if err != nil {
			if errors.Is(err, context.Canceled) {
				return ctx.Err()
			}
			if errors.Is(err, io.EOF) {
				return nil
			}
			return err
		}

		if err := c.handleMessage(ctx, msg); err != nil {
			log.Printf("process kafka message failed: topic=%s partition=%d offset=%d err=%v", msg.Topic, msg.Partition, msg.Offset, err)
			continue
		}

		if c.autoCommit {
			if err := c.reader.CommitMessages(ctx, msg); err != nil {
				return err
			}
		}
	}
}

func (c *Consumer) handleMessage(ctx context.Context, msg kafka.Message) error {
	event, err := metrics.DecodeEvent(msg.Value)
	if err != nil {
		return err
	}

	points := metrics.ExtractPoints(event)
	if len(points) == 0 {
		log.Printf("skip kafka message without numeric metrics: topic=%s partition=%d offset=%d run_id=%d", msg.Topic, msg.Partition, msg.Offset, event.RunID)
		return nil
	}

	if err := c.store.InsertMetricSeriesPoints(ctx, points); err != nil {
		return err
	}

	log.Printf(
		"inserted metric points: topic=%s partition=%d offset=%d run_id=%d record_id=%d points=%d",
		msg.Topic,
		msg.Partition,
		msg.Offset,
		event.RunID,
		event.RecordID,
		len(points),
	)
	return nil
}
