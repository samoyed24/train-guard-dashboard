package metrics

import (
	"bytes"
	"encoding/json"
	"math"
	"strconv"
	"strings"
	"time"
)

var ignoredMetricKeys = map[string]struct{}{
	"train_id":   {},
	"step":       {},
	"global_step": {},
	"epoch":      {},
	"timestamp":  {},
	"time":       {},
	"created_at": {},
	"updated_at": {},
}

type Event struct {
	AppPK      int64                  `json:"app_pk"`
	AppID      string                 `json:"app_id"`
	RunID      int64                  `json:"run_id"`
	RecordID   int64                  `json:"record_id"`
	TrainID    string                 `json:"train_id"`
	ReceivedAt string                 `json:"received_at"`
	Payload    map[string]interface{} `json:"payload"`
}

type Point struct {
	RunID      int64
	MetricName string
	MetricValue float64
	Step       *int32
	Epoch      *int32
	EventTime  time.Time
}

func DecodeEvent(raw []byte) (Event, error) {
	var event Event
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	err := decoder.Decode(&event)
	return event, err
}

func ExtractPoints(event Event) []Point {
	if len(event.Payload) == 0 {
		return nil
	}

	eventTime := parseEventTime(event.ReceivedAt)
	step := pickFirstInt32(event.Payload, "step", "global_step")
	epoch := pickFirstInt32(event.Payload, "epoch")

	points := make([]Point, 0, len(event.Payload))
	for key, rawValue := range event.Payload {
		if _, skip := ignoredMetricKeys[key]; skip {
			continue
		}

		metricName := strings.TrimSpace(key)
		if metricName == "" {
			continue
		}

		numeric, ok := parseNumeric(rawValue)
		if !ok {
			continue
		}

		points = append(points, Point{
			RunID:       event.RunID,
			MetricName:  metricName,
			MetricValue: numeric,
			Step:        step,
			Epoch:       epoch,
			EventTime:   eventTime,
		})
	}

	return points
}

func parseEventTime(value string) time.Time {
	if value == "" {
		return time.Now().UTC()
	}

	parsed, err := time.Parse(time.RFC3339Nano, value)
	if err != nil {
		return time.Now().UTC()
	}
	return parsed.UTC()
}

func pickFirstInt32(payload map[string]interface{}, keys ...string) *int32 {
	for _, key := range keys {
		value, ok := payload[key]
		if !ok {
			continue
		}

		parsed, ok := parseOptionalInt32(value)
		if ok {
			return &parsed
		}
	}

	return nil
}

func parseOptionalInt32(value interface{}) (int32, bool) {
	switch v := value.(type) {
	case nil:
		return 0, false
	case bool:
		return 0, false
	case float64:
		if !isFinite(v) {
			return 0, false
		}
		return int32(v), true
	case float32:
		if !isFinite(float64(v)) {
			return 0, false
		}
		return int32(v), true
	case int:
		return int32(v), true
	case int32:
		return v, true
	case int64:
		return int32(v), true
	case json.Number:
		fv, err := v.Float64()
		if err != nil || !isFinite(fv) {
			return 0, false
		}
		return int32(fv), true
	case string:
		text := strings.TrimSpace(v)
		if text == "" {
			return 0, false
		}
		fv, err := strconv.ParseFloat(text, 64)
		if err != nil || !isFinite(fv) {
			return 0, false
		}
		return int32(fv), true
	default:
		return 0, false
	}
}

func parseNumeric(value interface{}) (float64, bool) {
	switch v := value.(type) {
	case nil:
		return 0, false
	case bool:
		return 0, false
	case float64:
		return v, isFinite(v)
	case float32:
		fv := float64(v)
		return fv, isFinite(fv)
	case int:
		return float64(v), true
	case int8:
		return float64(v), true
	case int16:
		return float64(v), true
	case int32:
		return float64(v), true
	case int64:
		return float64(v), true
	case uint:
		return float64(v), true
	case uint8:
		return float64(v), true
	case uint16:
		return float64(v), true
	case uint32:
		return float64(v), true
	case uint64:
		return float64(v), true
	case json.Number:
		fv, err := v.Float64()
		if err != nil || !isFinite(fv) {
			return 0, false
		}
		return fv, true
	case string:
		text := strings.TrimSpace(v)
		if text == "" {
			return 0, false
		}
		fv, err := strconv.ParseFloat(text, 64)
		if err != nil || !isFinite(fv) {
			return 0, false
		}
		return fv, true
	default:
		return 0, false
	}
}

func isFinite(value float64) bool {
	return !math.IsNaN(value) && !math.IsInf(value, 0)
}
