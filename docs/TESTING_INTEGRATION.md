# Testing Integration Architecture

## Architecture
The final architecture integrates the existing Testing System (Node.js/Express + PostgreSQL) with the main Dexmy application (FastAPI + PostgreSQL). 
- **FastAPI** remains the primary Dexmy backend handling Users, Authentication, Roles, Bookings, etc.
- **Node/Express** is dedicated strictly to Testing functionality (Test creation, execution, grading, results).
- Both services utilize PostgreSQL.

## Authentication Flow
The system utilizes a Shared JWT Validation approach:
1. User logs in via FastAPI and receives a JWT token containing their `user_id` and `role`.
2. The Dexmy Frontend attaches this token as a `Bearer` token in the Authorization header for all API calls to the Node.js Testing service.
3. The Node.js service intercepts the request, decodes the JWT using the shared `JWT_SECRET_KEY`, and verifies the identity and role of the Dexmy user.

## Authorization Flow
- **Admin**: Can assign or remove the `test_creator` role via FastAPI admin endpoints.
- **Test Creator**: The Node.js service verifies `req.user.role === 'test_creator'` before permitting test creation, editing, and publishing.
- **Student**: The Node.js service verifies `req.user.role === 'student'` before allowing a test attempt to start.
- Test ownership is strictly tied to `req.user.id` to ensure isolation.

## Role Structure
The `user_role` enum in Dexmy (PostgreSQL) has been expanded to include:
- `test_creator`
This role exists alongside `student`, `teacher`, `admin`, etc. Admins manage this assignment natively within Dexmy; it is not a separate authentication system.

## API Communication
- **Admin assigns Test Creator**: `Frontend -> FastAPI -> Dexmy PostgreSQL`
- **Test Creator creates test**: `Testing Frontend -> Node/Express Testing API -> PostgreSQL`
- **Student starts test**: `Testing Frontend -> Node/Express -> PostgreSQL`

## PostgreSQL Structure
The Testing tables reside in PostgreSQL, preserving relationships to Dexmy users:
- `tests` (contains `created_by` referencing `users(id)`)
- `questions`
- `test_questions` (Join table)
- `test_submissions` (contains `student_id` referencing `users(id)`)
- `question_reports`

## Responsibilities
**Node/Express Responsibilities**:
- Test & Question management
- Publishing tests
- Student attempts and submissions
- Automated scoring and results tracking

**FastAPI Responsibilities**:
- User identity & Registration
- Authentication & JWT issuance
- Role management & Assignment
- Core Dexmy domains (Bookings, Classrooms, Payments, Teachers)

## Security Considerations
- The frontend is strictly untrusted. Role boundaries (`role=test_creator`) are entirely enforced by backend JWT validation.
- The Node.js service cannot generate authentication tokens, only verify them.
- A `test_creator` cannot implicitly access `admin` endpoints in FastAPI.
- A user ID is securely extracted from the verified token payload (`decoded.sub`), mitigating ID-spoofing attacks.

## Known Limitations
- Node.js and FastAPI must share the exact same `JWT_SECRET_KEY` and algorithm for validation to work.
- Token invalidation (if implemented in FastAPI via denylists) will require a shared caching layer (e.g., Redis) to propagate to the Node.js service instantly.
