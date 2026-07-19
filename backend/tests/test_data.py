"""Test xalpha CSV backend initialization."""
import xalpha as xa


def test_xalpha_csv_backend_works():
    """set_backend(backend='csv') should not raise."""
    # ponytail: global backend, ok for single-user local app
    xa.set_backend(backend="csv")
