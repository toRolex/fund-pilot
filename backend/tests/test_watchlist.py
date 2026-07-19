"""Tests for WatchlistService."""
import pytest


@pytest.fixture
def service(tmp_path):
    csv_path = tmp_path / "watchlist.csv"
    from app.watchlist import WatchlistService

    return WatchlistService(csv_path)


class TestWatchlistService:
    def test_add_fund(self, service):
        service.add("000001", "测试基金")
        funds = service.list_all()
        assert len(funds) == 1
        assert funds[0].code == "000001"

    def test_add_duplicate_raises(self, service):
        service.add("000001", "测试基金")
        with pytest.raises(ValueError, match="already in watchlist"):
            service.add("000001", "测试基金")

    def test_remove_fund(self, service):
        service.add("000001", "测试基金")
        service.remove("000001")
        assert service.list_all() == []

    def test_remove_nonexistent_raises(self, service):
        with pytest.raises(ValueError, match="not found"):
            service.remove("000999")

    def test_list_all_returns_sorted(self, service):
        service.add("000002", "bbb")
        service.add("000001", "aaa")
        funds = service.list_all()
        assert funds[0].code == "000001"
        assert funds[1].code == "000002"

    def test_list_all_empty(self, service):
        assert service.list_all() == []

    def test_search_by_code(self, service):
        service.add("000001", "测试基金A")
        service.add("110001", "测试基金B")
        results = service.search("000001")
        assert len(results) == 1
        assert results[0].code == "000001"

    def test_search_by_name(self, service):
        service.add("000001", "招商基金")
        service.add("110001", "华夏基金")
        results = service.search("华夏")
        assert len(results) == 1
        assert results[0].code == "110001"

    def test_search_no_results(self, service):
        service.add("000001", "测试基金")
        assert service.search("不存在") == []

    def test_persists_to_csv(self, tmp_path):
        csv_path = tmp_path / "watchlist.csv"
        from app.watchlist import WatchlistService

        svc1 = WatchlistService(csv_path)
        svc1.add("000001", "测试基金")

        svc2 = WatchlistService(csv_path)
        funds = svc2.list_all()
        assert len(funds) == 1
        assert funds[0].code == "000001"
