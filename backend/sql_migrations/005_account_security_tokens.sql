-- One-time, hashed tokens for password recovery and email-address changes.
CREATE TABLE IF NOT EXISTS account_action_tokens (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    purpose VARCHAR(32) NOT NULL,
    target_email VARCHAR(255),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_account_action_tokens_user_id
    ON account_action_tokens (user_id);
CREATE INDEX IF NOT EXISTS ix_account_action_tokens_token_hash
    ON account_action_tokens (token_hash);
CREATE INDEX IF NOT EXISTS ix_account_action_tokens_purpose
    ON account_action_tokens (purpose);
CREATE INDEX IF NOT EXISTS ix_account_action_tokens_user_purpose
    ON account_action_tokens (user_id, purpose);
