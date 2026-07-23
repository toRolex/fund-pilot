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

  it("has getFundDetailMerged", () => {
    expect(api.getFundDetailMerged).toBeDefined();
    expect(typeof api.getFundDetailMerged).toBe("function");
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
