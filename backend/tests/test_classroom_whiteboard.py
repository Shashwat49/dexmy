from types import SimpleNamespace

from app.websockets.classroom_ws import (
    _apply_clear_action,
    _deleted_stroke_ids_for_snapshot,
)


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


def test_clear_tombstones_client_strokes_not_yet_committed_to_server():
    strokes = [{"id": "committed-stroke"}, {"id": "other-stroke"}]
    deleted_ids = set()

    remaining, deleted = _apply_clear_action(
        strokes,
        deleted_ids,
        ["committed-stroke", "live-preview-stroke"],
    )

    assert remaining == []
    assert deleted == {
        "committed-stroke",
        "other-stroke",
        "live-preview-stroke",
    }


def test_clear_ignores_malformed_stroke_id_payload():
    remaining, deleted = _apply_clear_action(
        [{"id": "committed-stroke"}],
        set(),
        "not-a-list",
    )

    assert remaining == []
    assert deleted == {"committed-stroke"}
