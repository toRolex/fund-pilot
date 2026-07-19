import { describe, it, expect } from "vitest";
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
});
