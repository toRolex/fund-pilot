"""Test SPA static files mount and fallback."""

from starlette.routing import Mount


def test_spa_static_mount_exists(client):
    """Verify the app mounts StaticFiles for SPA fallback."""
    mounts = [r for r in client.app.routes if isinstance(r, Mount) and r.name == "spa"]
    assert len(mounts) == 1, "Expected exactly one SPA mount"

