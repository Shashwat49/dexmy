CREATE TABLE IF NOT EXISTS test_questions_db (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_text TEXT,
    question_image TEXT,
    options JSONB NOT NULL,
    correct_answer INTEGER NOT NULL,
    marks NUMERIC(10,2) DEFAULT 1,
    difficulty VARCHAR(50) DEFAULT 'Medium',
    negative_marks NUMERIC(10,2) DEFAULT 0,
    subject VARCHAR(255) DEFAULT 'General Awareness',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    subject VARCHAR(255),
    duration INTEGER NOT NULL,
    marks_per_question NUMERIC(10,2) DEFAULT 1,
    negative_marks NUMERIC(10,2) DEFAULT 0,
    total_questions INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT FALSE,
    is_paid BOOLEAN DEFAULT FALSE,
    price NUMERIC(10,2) DEFAULT 0,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE tests ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) DEFAULT 0;
ALTER TABLE tests ALTER COLUMN marks_per_question TYPE NUMERIC(10,2) USING marks_per_question::NUMERIC;
ALTER TABLE tests ALTER COLUMN negative_marks TYPE NUMERIC(10,2) USING negative_marks::NUMERIC;
ALTER TABLE test_questions_db ALTER COLUMN marks TYPE NUMERIC(10,2) USING marks::NUMERIC;
ALTER TABLE test_questions_db ALTER COLUMN negative_marks TYPE NUMERIC(10,2) USING negative_marks::NUMERIC;

CREATE TABLE IF NOT EXISTS test_questions (
    test_id UUID REFERENCES tests(id) ON DELETE CASCADE,
    question_id UUID REFERENCES test_questions_db(id) ON DELETE CASCADE,
    PRIMARY KEY (test_id, question_id)
);

CREATE TABLE IF NOT EXISTS exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    subject VARCHAR(255),
    duration INTEGER NOT NULL,
    marks_per_question NUMERIC(10,2) DEFAULT 1,
    negative_marks NUMERIC(10,2) DEFAULT 0,
    total_questions INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT FALSE,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exam_questions (
    exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
    question_id UUID REFERENCES test_questions_db(id) ON DELETE CASCADE,
    PRIMARY KEY (exam_id, question_id)
);

CREATE TABLE IF NOT EXISTS test_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID REFERENCES tests(id) ON DELETE CASCADE,
    student_id UUID,
    answers JSONB,
    total_questions INTEGER DEFAULT 0,
    answered INTEGER DEFAULT 0,
    correct INTEGER DEFAULT 0,
    incorrect INTEGER DEFAULT 0,
    not_answered INTEGER DEFAULT 0,
    total_marks NUMERIC(10,2) DEFAULT 0,
    obtained_marks NUMERIC(10,2) DEFAULT 0,
    percentage NUMERIC(5,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS question_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID REFERENCES test_questions_db(id) ON DELETE CASCADE,
    student_id UUID,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS test_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID REFERENCES tests(id) ON DELETE CASCADE,
    student_id UUID,
    amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    payment_reference VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(test_id, student_id)
);
