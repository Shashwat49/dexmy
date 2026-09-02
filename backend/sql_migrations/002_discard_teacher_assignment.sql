-- Allow admins to discard a pending teacher assignment.
-- A discarded booking remains confirmed/unassigned and can be assigned later.

ALTER TABLE bookings
DROP CONSTRAINT IF EXISTS chk_teacher_assignment_status;

ALTER TABLE bookings
ADD CONSTRAINT chk_teacher_assignment_status
CHECK (teacher_assignment_status IN ('pending', 'assigned', 'failed', 'discarded'));
