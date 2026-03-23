package store

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"train-guard-worker/internal/metrics"
)

type Store struct {
	pool *pgxpool.Pool
}

func New(ctx context.Context, databaseURL string) (*Store, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, err
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, err
	}

	return &Store{pool: pool}, nil
}

func (s *Store) Close() {
	s.pool.Close()
}

func (s *Store) InsertMetricSeriesPoints(ctx context.Context, points []metrics.Point) error {
	if len(points) == 0 {
		return nil
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	batch := &pgx.Batch{}
	for _, point := range points {
		batch.Queue(
			`INSERT INTO metric_series_points (run_id, metric_name, metric_value, step, epoch, event_time, recorded_at)
			 VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
			point.RunID,
			point.MetricName,
			point.MetricValue,
			point.Step,
			point.Epoch,
			point.EventTime,
		)
	}

	results := tx.SendBatch(ctx, batch)

	for range points {
		if _, err := results.Exec(); err != nil {
			results.Close()
			return err
		}
	}

	if err := results.Close(); err != nil {
		return err
	}

	return tx.Commit(ctx)
}
