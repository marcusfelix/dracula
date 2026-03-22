import { describe, it, expect } from "vitest";
import {
  DraculaError,
  DraculaNetworkError,
  DraculaNotFoundError,
  DraculaUserError,
  DraculaValidationError,
} from "../src/errors.js";

describe("Error classes", () => {
  it("DraculaError has correct name", () => {
    const err = new DraculaError("test");
    expect(err.name).toBe("DraculaError");
    expect(err.message).toBe("test");
    expect(err).toBeInstanceOf(Error);
  });

  it("DraculaNetworkError marks 429 as retryable", () => {
    const err = new DraculaNetworkError("rate limited", 429);
    expect(err.retryable).toBe(true);
    expect(err.status).toBe(429);
  });

  it("DraculaNetworkError marks 500+ as retryable", () => {
    const err = new DraculaNetworkError("server error", 502);
    expect(err.retryable).toBe(true);
  });

  it("DraculaNetworkError marks 400 as not retryable", () => {
    const err = new DraculaNetworkError("bad request", 400);
    expect(err.retryable).toBe(false);
  });

  it("DraculaNotFoundError formats message", () => {
    const err = new DraculaNotFoundError("Product", "my-handle");
    expect(err.message).toBe("Product not found: my-handle");
    expect(err.resource).toBe("Product");
    expect(err.identifier).toBe("my-handle");
  });

  it("DraculaUserError carries code and field", () => {
    const err = new DraculaUserError("Invalid", "INVALID", ["lines", "0"]);
    expect(err.code).toBe("INVALID");
    expect(err.field).toEqual(["lines", "0"]);
  });

  it("DraculaValidationError has correct name", () => {
    const err = new DraculaValidationError("bad data");
    expect(err.name).toBe("DraculaValidationError");
  });
});
