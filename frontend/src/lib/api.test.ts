import { describe, it, expect, vi } from "vitest";
import { api } from "../lib/api";

describe("api client", () => {
  it("has health endpoint", () => {
    expect(api.health).toBeDefined();
    expect(typeof api.health).toBe("function");
  });

  it("has getFunds", () => {
    expect(api.getFunds).toBeDefined();
    expect(typeof api.getFunds).toBe("function");
  });

  it("has addFund", () => {
    expect(api.addFund).toBeDefined();
    expect(typeof api.addFund).toBe("function");
  });

  it("has removeFund", () => {
    expect(api.removeFund).toBeDefined();
    expect(typeof api.removeFund).toBe("function");
  });

  it("has searchFunds", () => {
    expect(api.searchFunds).toBeDefined();
    expect(typeof api.searchFunds).toBe("function");
  });

  it("has getSignals", () => {
    expect(api.getSignals).toBeDefined();
    expect(typeof api.getSignals).toBe("function");
  });

  it("has getStrategies", () => {
    expect(api.getStrategies).toBeDefined();
    expect(typeof api.getStrategies).toBe("function");
  });

  it("has getStatus", () => {
    expect(api.getStatus).toBeDefined();
    expect(typeof api.getStatus).toBe("function");
  });

  it("has getFundDetail", () => {
    expect(api.getFundDetail).toBeDefined();
    expect(typeof api.getFundDetail).toBe("function");
  });

  it("has runFundStrategy", () => {
    expect(api.runFundStrategy).toBeDefined();
    expect(typeof api.runFundStrategy).toBe("function");
  });

  it("has setFundStrategyEnabled", () => {
    expect(api.setFundStrategyEnabled).toBeDefined();
    expect(typeof api.setFundStrategyEnabled).toBe("function");
  });

  it("runFundStrategy POSTs to the run endpoint", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    );

    await api.runFundStrategy("000001", "indicator_cross");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/funds/000001/strategies/indicator_cross/run",
      expect.objectContaining({ method: "POST" }),
    );
    fetchMock.mockRestore();
  });

  it("setFundStrategyEnabled PUTs enabled body", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ name: "indicator_cross", enabled: false }), { status: 200 }),
    );

    await api.setFundStrategyEnabled("000001", "indicator_cross", false);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/funds/000001/strategies/indicator_cross",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ enabled: false }) }),
    );
    fetchMock.mockRestore();
  });

  it("has getFundNav", () => {
    expect(api.getFundNav).toBeDefined();
    expect(typeof api.getFundNav).toBe("function");
  });

  it("getSignals builds all_history query param", async () => {
    const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    );

    await api.getSignals("000001", { all_history: true });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/signals?fund_code=000001&all_history=true",
    );
    fetchMock.mockRestore();
  });

  describe("importHoldingsFormData", () => {
    it("sends FormData with no explicit Content-Type header", async () => {
      const fd = new FormData();
      fd.append("file", new Blob(["a,b\n1,2"]), "test.csv");
      const fetchMock = vi.spyOn(window, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ imported: 3 }), { status: 200 }),
      );

      const result = await api.importHoldingsFormData(fd);

      expect(fetchMock).toHaveBeenCalledWith(
        "/api/holdings/import",
        expect.objectContaining({
          method: "POST",
          body: fd,
        }),
      );
      // ponytail: headers can be undefined or an object without Content-Type
      const callArgs = fetchMock.mock.calls[0][1] as RequestInit;
      expect(callArgs.headers).toBeUndefined();
      expect(result).toEqual({ imported: 3 });
    });
  });
});
