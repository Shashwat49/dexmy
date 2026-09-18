-- Create server-side authentication sessions for refresh-token rotation
-- and revocation. Only a SHA-256 hash of the refresh credential is stored.

CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_user_sessions_user_id
ON user_sessions (user_id);

CREATE INDEX IF NOT EXISTS ix_user_sessions_refresh_token_hash
ON user_sessions (refresh_token_hash);

CREATE INDEX IF NOT EXISTS ix_user_sessions_expires_at
ON user_sessions (expires_at);