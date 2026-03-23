package consumer

import (
	"context"
	"errors"
	"log"
	"strings"
	"time"

	redis "github.com/redis/go-redis/v9"

	"train-guard-worker/internal/config"
	"train-guard-worker/internal/metrics"
	"train-guard-worker/internal/store"
)

type Consumer struct {
	reader       *redis.Client
	acker        *redis.Client
	streamKey    string
	group        string
	consumer     string
	readBlock    time.Duration
	store        *store.Store
}

func New(cfg config.Config, store *store.Store) (*Consumer, error) {
	opts, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		return nil, err
	}

	reader := redis.NewClient(opts)
	acker := redis.NewClient(opts)
	consumer := &Consumer{
		reader:    reader,
		acker:     acker,
		streamKey: cfg.MetricsStreamKey,
		group:     cfg.MetricsConsumerGroup,
		consumer:  cfg.MetricsConsumerName,
		readBlock: cfg.MetricsReadBlock,
		store:     store,
	}

	if err := consumer.ensureGroup(context.Background()); err != nil {
		reader.Close()
		acker.Close()
		return nil, err
	}

	return consumer, nil
}

func (c *Consumer) Run(ctx context.Context) error {
	defer c.reader.Close()
	defer c.acker.Close()

	for {
		result, err := c.reader.XReadGroup(ctx, &redis.XReadGroupArgs{
			Group:    c.group,
			Consumer: c.consumer,
			Streams:  []string{c.streamKey, ">"},
			Count:    1,
			Block:    c.readBlock,
		}).Result()
		if err != nil {
			if errors.Is(err, context.Canceled) {
				return ctx.Err()
			}
			if errors.Is(err, redis.Nil) {
				continue
			}
			if strings.Contains(err.Error(), "NOGROUP") {
				if ensureErr := c.ensureGroup(ctx); ensureErr != nil {
					return ensureErr
				}
				continue
			}
			return err
		}

		for _, stream := range result {
			for _, message := range stream.Messages {
				if err := c.handleMessage(ctx, message); err != nil {
					log.Printf("process redis stream message failed: stream=%s id=%s err=%v", c.streamKey, message.ID, err)
					continue
				}

				if err := c.acker.XAck(ctx, c.streamKey, c.group, message.ID).Err(); err != nil {
					return err
				}
				if err := c.acker.XDel(ctx, c.streamKey, message.ID).Err(); err != nil {
					return err
				}
			}
		}
	}
}

func (c *Consumer) ensureGroup(ctx context.Context) error {
	err := c.acker.XGroupCreateMkStream(ctx, c.streamKey, c.group, "$").Err()
	if err == nil || strings.Contains(err.Error(), "BUSYGROUP") {
		return nil
	}
	return err
}

func (c *Consumer) handleMessage(ctx context.Context, msg redis.XMessage) error {
	raw, ok := msg.Values["event"]
	if !ok {
		return errors.New("missing event payload")
	}

	rawEvent, ok := raw.(string)
	if !ok {
		return errors.New("event payload is not a string")
	}

	event, err := metrics.DecodeEvent([]byte(rawEvent))
	if err != nil {
		return err
	}

	points := metrics.ExtractPoints(event)
	if len(points) == 0 {
		log.Printf("skip redis stream message without numeric metrics: stream=%s id=%s run_id=%d", c.streamKey, msg.ID, event.RunID)
		return nil
	}

	if err := c.store.InsertMetricSeriesPoints(ctx, points); err != nil {
		return err
	}

	log.Printf(
		"inserted metric points: stream=%s id=%s run_id=%d record_id=%d points=%d",
		c.streamKey,
		msg.ID,
		event.RunID,
		event.RecordID,
		len(points),
	)
	return nil
}
