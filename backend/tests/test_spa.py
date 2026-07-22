"""Test SPA static files mount and fallback."""
import re

from starlette.routing import Mount

MAKEFILE = "../Makefile"


def test_spa_static_mount_exists(client):
    """Verify the app mounts StaticFiles for SPA fallback."""
    mounts = [r for r in client.app.routes if isinstance(r, Mount) and r.name == "spa"]
    assert len(mounts) == 1, "Expected exactly one SPA mount"


def test_makefile_dev_port_is_3456():
    """Verify Makefile dev targets use port 3456 (not 5173)."""
    text = open(MAKEFILE).read()
    port_lines = [l for l in text.splitlines() if "vite" in l and "--port" in l]
    assert port_lines, "Expected at least one frontend --port line in Makefile"
    for line in port_lines:
        assert "5173" not in line, f"Found old port 5173 in Makefile: {line}"
        m = re.search(r"--port\s+(\d+)", line)
        assert m and m.group(1) == "3456", f"Expected port 3456 in: {line}"

