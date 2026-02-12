-- Migration 028: Add scheduled plan support for subscription transition rules
-- Date: 2026-02-13
-- Description: Adds columns for deferred plan activation (scheduled plan concept)
-- EXECUTED: 2026-02-13 by owner via Adminer

ALTER TABLE users ADD COLUMN scheduled_plan_id INTEGER REFERENCES subscription_plans(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN scheduled_plan_paid_at TIMESTAMP;
CREATE INDEX idx_users_scheduled_plan ON users(scheduled_plan_id) WHERE scheduled_plan_id IS NOT NULL;
