import { generateTaskCode } from "./task-code";

describe("generateTaskCode", () => {
  it("formats code with uppercase project and number", () => {
    expect(generateTaskCode("ats", 1)).toBe("ATS-1");
    expect(generateTaskCode("THX", 42)).toBe("THX-42");
  });

  it("handles mixed case", () => {
    expect(generateTaskCode("AtS", 5)).toBe("ATS-5");
  });
});
