"""Verify all required dependencies are importable."""

REQUIRED = [
    "fastapi",
    "uvicorn",
    "xalpha",
    "apscheduler",
    "httpx",
]

DEV_REQUIRED = [
    "pytest",
]


def test_core_importable():
    for mod in REQUIRED:
        __import__(mod)


def test_dev_importable():
    for mod in DEV_REQUIRED:
        __import__(mod)
