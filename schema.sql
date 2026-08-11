-- ============================================================
-- Dexmy EdTech Platform — Database Schema (PostgreSQL)
-- ============================================================

-- ---------- ENUMS ----------
CREATE TYPE user_role AS ENUM ('student', 'teacher', 'parent', 'admin');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed', 'no_show');
CREATE TYPE session_status AS ENUM ('scheduled', 'live', 'ended', 'cancelled');
CREATE TYPE permission_type AS ENUM ('screen_share', 'annotate', 'mic', 'camera');
CREATE TYPE demo_status AS ENUM ('requested', 'scheduled', 'completed', 'cancelled');

-- ---------- CORE USERS ----------
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role            user_role NOT NULL,
    full_name       VARCHAR(255) NOT NULL,
    phone           VARCHAR(20),
    avatar_url      TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email);

-- ---------- ROLE PROFILES ----------
CREATE TABLE teacher_profiles (
    user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    bio             TEXT,
    qualifications  TEXT,
    years_experience INTEGER,
    hourly_rate     NUMERIC(10, 2),
    is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
    rating_avg      NUMERIC(3, 2) DEFAULT 0.0,
    rating_count    INTEGER DEFAULT 0
);

CREATE TABLE student_profiles (
    user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    grade_level     VARCHAR(50),
    school_name     VARCHAR(255),
    date_of_birth   DATE
);

-- Parents can be linked to multiple students; a student can (rarely) have
-- more than one guardian account, hence a join table rather than a single FK.
CREATE TABLE parent_student_links (
    parent_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (parent_id, student_id)
);

-- ---------- SUBJECTS & TEACHER-SUBJECT MAPPING ----------
CREATE TABLE subjects (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) UNIQUE NOT NULL,
    description     TEXT
);

CREATE TABLE teacher_subjects (
    teacher_id      UUID NOT NULL REFERENCES teacher_profiles(user_id) ON DELETE CASCADE,
    subject_id      INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    PRIMARY KEY (teacher_id, subject_id)
);

-- ---------- AVAILABILITY ----------
CREATE TABLE teacher_availability (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id      UUID NOT NULL REFERENCES teacher_profiles(user_id) ON DELETE CASCADE,
    day_of_week     SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday
    start_time      TIME NOT NULL,
    end_time        TIME NOT NULL,
    is_recurring    BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_availability_teacher ON teacher_availability(teacher_id);

-- ---------- DEMO BOOKINGS (marketing funnel) ----------
CREATE TABLE demo_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    email           VARCHAR(255) NOT NULL,
    phone           VARCHAR(20),
    subject_id      INTEGER REFERENCES subjects(id),
    preferred_time  TIMESTAMPTZ,
    status          demo_status NOT NULL DEFAULT 'requested',
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- CONTACT FORM ----------
CREATE TABLE contact_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    email           VARCHAR(255) NOT NULL,
    message         TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_resolved     BOOLEAN NOT NULL DEFAULT FALSE
);

-- ---------- BOOKINGS (a scheduled one-on-one slot) ----------
CREATE TABLE bookings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    teacher_id      UUID NOT NULL REFERENCES teacher_profiles(user_id) ON DELETE CASCADE,
    subject_id      INTEGER NOT NULL REFERENCES subjects(id),
    scheduled_at    TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    status          booking_status NOT NULL DEFAULT 'pending',
    price           NUMERIC(10, 2),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bookings_student ON bookings(student_id);
CREATE INDEX idx_bookings_teacher ON bookings(teacher_id);
CREATE INDEX idx_bookings_scheduled_at ON bookings(scheduled_at);

-- ---------- LIVE SESSIONS (an actual classroom instance) ----------
CREATE TABLE class_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id      UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    livekit_room_name VARCHAR(255) UNIQUE NOT NULL,
    status          session_status NOT NULL DEFAULT 'scheduled',
    started_at      TIMESTAMPTZ,
    ended_at        TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_booking ON class_sessions(booking_id);
CREATE INDEX idx_sessions_status ON class_sessions(status);

-- Tracks who actually joined and when — enforces "only teacher + student"
-- at the data layer (application layer double-checks against this table
-- before admitting anyone to the LiveKit room).
CREATE TABLE session_participants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_in_session VARCHAR(20) NOT NULL, -- 'teacher' | 'student'
    joined_at       TIMESTAMPTZ,
    left_at         TIMESTAMPTZ,
    UNIQUE (session_id, user_id)
);

-- Audit trail of teacher granting/revoking student permissions mid-class
CREATE TABLE permission_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
    target_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission      permission_type NOT NULL,
    granted         BOOLEAN NOT NULL, -- true = granted, false = revoked
    granted_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_permission_events_session ON permission_events(session_id);

-- ---------- CHAT ----------
-- Chat is ephemeral by design: messages are relayed live over WebSocket
-- and never written to the database. No table here on purpose.

-- ---------- WHITEBOARD ----------
-- Periodic snapshots (for crash recovery / late-join sync) — the final
-- snapshot at session end is what gets compiled into the notes PDF.
CREATE TABLE whiteboard_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
    snapshot_data   JSONB NOT NULL, -- Fabric.js canvas JSON
    page_number     INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_whiteboard_session ON whiteboard_snapshots(session_id);

-- ---------- CLASS NOTES (final PDF output) ----------
CREATE TABLE class_notes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL UNIQUE REFERENCES class_sessions(id) ON DELETE CASCADE,
    pdf_url         TEXT NOT NULL,
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- updated_at trigger for users ----------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
