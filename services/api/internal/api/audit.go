package api

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
)

func requestIDFromContext(ctx context.Context) string {
	requestID, _ := ctx.Value(requestIDContextKey{}).(string)
	return requestID
}

func recordAuditEvent(ctx context.Context, tx pgx.Tx, institutionID, actorID, action, targetType, targetID string, details map[string]any) error {
	if tx == nil {
		return errors.New("audit event requires an active transaction")
	}
	payload, err := json.Marshal(details)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO operational_audit_events
			(institution_id, actor_user_id, action, target_type, target_id, request_id, details)
		VALUES ($1::uuid, $2::uuid, $3, $4, $5::uuid, $6, $7::jsonb)`,
		institutionID, actorID, action, targetType, targetID, requestIDFromContext(ctx), string(payload),
	)
	return err
}
