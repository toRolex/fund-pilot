"""Tests for /api/qdii/{code} QDII prediction endpoint."""
import pytest
from unittest.mock import MagicMock, patch


class TestQdiiPredict:
    @patch("app.main.xa.QDIIPredict")
    def test_qdii_predict_ok(self, mock_qdii, client):
        mock_instance = MagicMock()
        mock_instance.get_t1.return_value = (1.2345, "2026-07-17")
        mock_instance.get_t0.return_value = (1.2567, "2026-07-20")
        mock_qdii.return_value = mock_instance

        resp = client.get("/api/qdii/SH501018")
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == "SH501018"
        assert data["t1_value"] == 1.2345
        assert data["t1_date"] == "2026-07-17"
        assert data["t0_value"] == 1.2567
        assert data["t0_date"] == "2026-07-20"
        mock_instance.get_t1.assert_called_once()
        mock_instance.get_t0.assert_called_once()

    @patch("app.main.xa.QDIIPredict")
    def test_non_qdii_fund(self, mock_qdii, client):
        mock_qdii.side_effect = ValueError("Please provide t1dict for prediction")

        resp = client.get("/api/qdii/999999")
        assert resp.status_code == 422
        data = resp.json()
        assert "detail" in data

    @patch("app.main.xa.QDIIPredict")
    def test_prediction_failure(self, mock_qdii, client):
        from xalpha.exceptions import NonAccurate

        mock_instance = MagicMock()
        mock_instance.get_t1.side_effect = NonAccurate(
            code="SH501018", reason="overseas data not yet updated"
        )
        mock_qdii.return_value = mock_instance

        resp = client.get("/api/qdii/SH501018")
        assert resp.status_code == 502
        data = resp.json()
        assert "detail" in data
