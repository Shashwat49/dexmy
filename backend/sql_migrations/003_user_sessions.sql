-- Create server-side authentication sessions for refresh-token management.
-- Refresh tokens are stored only as hashes.

CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    session_family_id UUID NOT NULL,

    refresh_token_hash VARCHAR(255) NOT NULL UNIQUE,

    expires_at TIMESTAMPTZ NOT NULL,

    revoked_at TIMESTAMPTZ,

    replaced_by_session_id UUID
        REFERENCES user_sessions(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id
    ON user_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_user_sessions_family_id
    ON user_sessions(session_family_id);

CREATE INDEX IF NOT EXISTS idx_user_sessions_replaced_by
    ON user_sessions(replaced_by_session_id);