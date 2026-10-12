from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from pydantic import ValidationError

from app.api.v1.endpoints.admin_package_schedules import ScheduleRequest, _occurrence_dates

IST = ZoneInfo("Asia/Kolkata")


def test_occurrence_dates_are_ordered_and_match_selected_weekdays():
    start = datetime.now(IST).date() + timedelta(days=1)
    weekdays = sorted({(start.weekday() + offset + 1) % 7 for offset in (0, 2, 4)})
    dates = _occurrence_dates(start, weekdays, 4)

    assert len(dates) == 4
    assert dates == sorted(dates)
    assert all((item.weekday() + 1) % 7 in weekdays for item in dates)


def test_schedule_request_rejects_duplicate_or_invalid_weekdays():
    with pytest.raises(ValidationError):
        ScheduleRequest(
            student_package_id="00000000-0000-0000-0000-000000000001",
            subject_id=1,
            teacher_id="00000000-0000-0000-0000-000000000002",
            start_date=(datetime.now(IST).date() + timedelta(days=1)).isoformat(),
            start_time="18:00",
            weekdays=[1, 1],
            class_count=2,
        )


def test_schedule_request_rejects_slots_outside_existing_booking_window():
    with pytest.raises(ValidationError):
        ScheduleRequest(
            student_package_id="00000000-0000-0000-0000-000000000001",
            subject_id=1,
            teacher_id="00000000-0000-0000-0000-000000000002",
            start_date=(datetime.now(IST).date() + timedelta(days=1)).isoformat(),
            start_time="09:00",
            weekdays=[1],
            class_count=1,
        )
