import assert from "node:assert/strict";
import { test } from "vitest";
import { passwordError } from "../src/lib/auth-policy.ts";

test("rejects short passwords and missing character groups", () => {
  for (const value of ["", "Short1!", "onlylowercase123!", "ONLYUPPERCASE123!", "NoNumbersInHere!!", "NoSymbolsInHere123"]) {
    assert.ok(passwordError(value), `Expected rejection: ${value}`);
  }
});
test("accepts long passwords including each required group", () => {
  assert.equal(passwordError("Passphrase-For-Testing-482!"), null);
  assert.equal(passwordError("A" + "b".repeat(68) + "1!"), null);
});
test("rejects passwords that exceed bcrypt's byte limit", () => {
  assert.ok(passwordError("Aa1!" + "x".repeat(69)));
  assert.ok(passwordError("Aa1!" + "é".repeat(35)));
});

test("accepts exactly 15 characters and exactly 72 bytes, including Unicode", () => {
  assert.equal(passwordError("Aa1!" + "x".repeat(11)), null);
  assert.equal(passwordError("Aa1!" + "x".repeat(68)), null);
  assert.equal(passwordError("Aa1!" + "é".repeat(34)), null);
  assert.ok(passwordError("Aa1!" + "x".repeat(10)));
});
