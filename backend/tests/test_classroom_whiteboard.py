from types import SimpleNamespace

from app.websockets.classroom_ws import _deleted_stroke_ids_for_snapshot


def test_restored_strokes_are_not_kept_as_historical_deletions():
    deleted_snapshot = SimpleNamespace(
        snapshot_data={"canonical": True, "deleted_stroke_ids": ["stroke-1"]}
    )
    restored_snapshot = SimpleNamespace(
        snapshot_data={"canonical": True, "deleted_stroke_ids": []}
    )

    deleted_ids = _deleted_stroke_ids_for_snapshot(
        [deleted_snapshot, restored_snapshot],
        restored_snapshot,
    )

    assert deleted_ids == set()


def test_legacy_snapshots_still_contribute_deletion_tombstones():
    legacy_snapshot = SimpleNamespace(
        snapshot_data={"deleted_stroke_ids": ["stroke-1"]}
    )

    deleted_ids = _deleted_stroke_ids_for_snapshot([legacy_snapshot], legacy_snapshot)

    assert deleted_ids == {"stroke-1"}
