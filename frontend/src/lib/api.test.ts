import { describe, it, expect } from "vitest";
import { api } from "../lib/api";

describe("api client", () => {
  it("has health endpoint", () => {
    expect(api.health).toBeDefined();
    expect(typeof api.health).toBe("function");
  });
});
