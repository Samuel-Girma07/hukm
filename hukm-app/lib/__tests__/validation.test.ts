import { describe, expect, it } from "vitest";

import {
  isValidEmail,
  passwordPolicyError,
  PASSWORD_MAX_BYTES,
  utf8ByteLength,
} from "../validation";

describe("isValidEmail", () => {
  const valid = [
    "user@example.com",
    "first.last@sub.domain.org",
    "a+b@gmail.com",
    "UPPER@EXAMPLE.COM",
  ];
  const invalid = [
    "",
    "   ",
    "plainaddress",
    "missing-at-sign.com",
    "a@b",            // no TLD part
    "two@@ats.com",
    "spaces in@mail.com",
    "trailing@dot.",
    "@nolocal.com",
  ];

  it.each(valid)("accepts %s", (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  it.each(invalid)("rejects %s", (email) => {
    expect(isValidEmail(email)).toBe(false);
  });
});

describe("utf8ByteLength", () => {
  it("counts ASCII as one byte per char", () => {
    expect(utf8ByteLength("abcdef")).toBe(6);
  });

  it("counts two-byte characters correctly", () => {
    // 'ä' is 2 bytes in UTF-8
    expect(utf8ByteLength("ä".repeat(10))).toBe(20);
  });
});

describe("passwordPolicyError", () => {
  it("rejects below minimum length", () => {
    expect(passwordPolicyError("abc123")).toMatch(/at least 8/);
  });

  it("accepts the exact minimum", () => {
    expect(passwordPolicyError("abc12345")).toBeNull();
  });

  it("rejects passwords whose UTF-8 encoding exceeds bcrypt's 72-byte limit", () => {
    const asciiTooLong = "a".repeat(PASSWORD_MAX_BYTES + 1);
    expect(passwordPolicyError(asciiTooLong)).toMatch(/72/);

    // Boundary: exactly 72 bytes is acceptable.
    expect(passwordPolicyError("a".repeat(PASSWORD_MAX_BYTES))).toBeNull();

    // Multi-byte: 36 × 'ä' = 72 bytes → OK; 37 × 'ä' = 74 bytes → rejected.
    expect(passwordPolicyError("ä".repeat(36))).toBeNull();
    expect(passwordPolicyError("ä".repeat(37))).toMatch(/72/);
  });
});
