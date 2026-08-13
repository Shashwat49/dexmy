# A booking slot is 60 minutes total: 55 minutes of actual class time plus
# a 5-minute buffer for setup/teardown between back-to-back sessions.
# Slot math (scheduling, conflict-checking) uses SLOT_DURATION_MINUTES.
# Anything about the actual live class itself (e.g. a future in-class
# countdown/auto-end) should use CLASS_DURATION_MINUTES.
SLOT_DURATION_MINUTES = 60
CLASS_DURATION_MINUTES = 55