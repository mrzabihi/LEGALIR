import { describe, it, expect } from "vitest";
import {
  computeProfileCompletion,
  BASIC_PROFILE_FIELDS,
  EXTENDED_PROFILE_FIELDS,
} from "../profile-completion";

const EMPTY = {
  displayName: null,
  city: null,
  occupation: null,
  email: null,
  birthDate: null,
  userType: null,
  province: null,
  legalInterests: null,
  primaryUseCase: null,
};

const BASIC_COMPLETE = {
  ...EMPTY,
  displayName: "مریم محمدی",
  city: "تهران",
  occupation: "وکیل دادگستری",
  email: "maryam@example.com",
  birthDate: "1990-01-01",
};

describe("computeProfileCompletion — single source of truth", () => {
  it("empty profile is 0%", () => {
    const r = computeProfileCompletion(EMPTY);
    expect(r.percentage).toBe(0);
    expect(r.rounded).toBe(0);
    expect(r.basicProfile.completed).toBe(false);
    expect(r.extendedProfile.completed).toBe(false);
  });

  it("all 5 basic fields = 50% (not the old 25%)", () => {
    const r = computeProfileCompletion(BASIC_COMPLETE);
    expect(r.percentage).toBe(50);
    expect(r.rounded).toBe(50);
    expect(r.basicProfile.completed).toBe(true);
    expect(r.basicProfile.percentage).toBe(50);
    expect(r.basicProfile.missingFields).toEqual([]);
  });

  it("basic fields are equally weighted at 10% each", () => {
    const r = computeProfileCompletion({ ...EMPTY, displayName: "م" });
    expect(r.percentage).toBe(10);
  });

  it("extended progression is 50 → 62.5 → 75 → 87.5 → 100", () => {
    const r1 = computeProfileCompletion({ ...BASIC_COMPLETE, userType: "شخصی" });
    expect(r1.percentage).toBe(62.5);
    expect(r1.rounded).toBe(63);

    const r2 = computeProfileCompletion({ ...BASIC_COMPLETE, userType: "شخصی", province: "تهران" });
    expect(r2.percentage).toBe(75);

    const r3 = computeProfileCompletion({
      ...BASIC_COMPLETE,
      userType: "شخصی",
      province: "تهران",
      legalInterests: ["قراردادها"],
    });
    expect(r3.percentage).toBe(87.5);
    expect(r3.rounded).toBe(88);

    const r4 = computeProfileCompletion({
      ...BASIC_COMPLETE,
      userType: "شخصی",
      province: "تهران",
      legalInterests: ["قراردادها"],
      primaryUseCase: "مشاوره حقوقی",
    });
    expect(r4.percentage).toBe(100);
    expect(r4.rounded).toBe(100);
    expect(r4.extendedProfile.completed).toBe(true);
    expect(r4.extendedProfile.missingFields).toEqual([]);
  });

  it("extended fields count even when basic is incomplete", () => {
    const r = computeProfileCompletion({ ...EMPTY, userType: "شخصی" });
    expect(r.percentage).toBe(12.5);
  });

  it("empty string and empty array are treated as unfilled", () => {
    const r = computeProfileCompletion({ ...EMPTY, displayName: "   ", legalInterests: [] });
    expect(r.percentage).toBe(0);
    expect(r.basicProfile.missingFields).toContain("displayName");
  });

  it("the two stages sum to exactly 100% by construction", () => {
    const allFilled = computeProfileCompletion({
      ...BASIC_COMPLETE,
      userType: "شخصی",
      province: "تهران",
      legalInterests: ["قراردادها"],
      primaryUseCase: "مشاوره حقوقی",
    });
    expect(allFilled.basicProfile.percentage + allFilled.extendedProfile.percentage).toBe(100);
    expect(BASIC_PROFILE_FIELDS).toHaveLength(5);
    expect(EXTENDED_PROFILE_FIELDS).toHaveLength(4);
  });
});
