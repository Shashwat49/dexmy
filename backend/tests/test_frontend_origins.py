from app.core.config import settings
from app.core.origins import get_allowed_frontend_origins, normalize_origin


def test_configured_preview_origin_is_allowed(monkeypatch):
    monkeypatch.setattr(settings, "FRONTEND_ORIGIN", "https://dexmyedu.com")
    monkeypatch.setattr(
        settings,
        "FRONTEND_ORIGINS",
        "https://dexmy-git-safe-package-invoice-redirects-shashwat49s-projects.vercel.app",
    )

    assert (
        "https://dexmy-git-safe-package-invoice-redirects-shashwat49s-projects.vercel.app"
        in get_allowed_frontend_origins()
    )


def test_legacy_frontend_origin_remains_supported(monkeypatch):
    monkeypatch.setattr(settings, "FRONTEND_ORIGIN", "https://legacy.example.com/")
    monkeypatch.setattr(settings, "FRONTEND_ORIGINS", "")

    assert "https://legacy.example.com" in get_allowed_frontend_origins()


def test_multiple_origins_are_trimmed_and_normalized(monkeypatch):
    monkeypatch.setattr(settings, "FRONTEND_ORIGIN", "https://dexmyedu.com")
    monkeypatch.setattr(
        settings,
        "FRONTEND_ORIGINS",
        " https://preview-one.example.com/ , https://preview-two.example.com ",
    )

    allowed = get_allowed_frontend_origins()
    assert "https://preview-one.example.com" in allowed
    assert "https://preview-two.example.com" in allowed


def test_unlisted_origin_is_rejected(monkeypatch):
    monkeypatch.setattr(settings, "FRONTEND_ORIGIN", "https://dexmyedu.com")
    monkeypatch.setattr(settings, "FRONTEND_ORIGINS", "")

    assert normalize_origin("https://unlisted-preview.example.com") not in get_allowed_frontend_origins()


def test_origin_normalization_rejects_paths_and_non_http_schemes():
    assert normalize_origin("https://example.com/") == "https://example.com"
    assert normalize_origin("https://example.com/some/path") is None
    assert normalize_origin("javascript://example.com") is None
