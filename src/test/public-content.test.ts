import { describe, expect, it } from "vitest";
import { schoolContentRequest } from "@/school/public-content";

describe("External school content", () => {
  it.each(["homepage", "gallery"])("allows the public %s read", (section) => {
    const request = schoolContentRequest(new Request("https://school.example/school-api/" + section), section);
    expect(request?.url).toBe("https://school.example/.netlify/functions/app/api/" + section);
  });
  it.each(["admin/gallery", "admin/me", "portal/me", "apply", "homepage/extra"])("does not expose %s", (section) => {
    expect(schoolContentRequest(new Request("https://school.example/"), section)).toBeNull();
  });
  it("does not permit writes", () => {
    expect(schoolContentRequest(new Request("https://school.example/", { method: "POST" }), "gallery")).toBeNull();
  });
  it("does not forward staff credentials or query parameters", () => {
    const request = schoolContentRequest(new Request("https://school.example/?token=private", {
      headers: { cookie: "staff=session", authorization: "Bearer staff" },
    }), "homepage");
    expect(request?.headers.has("cookie")).toBe(false);
    expect(request?.headers.has("authorization")).toBe(false);
    expect(new URL(request?.url ?? "https://school.example/").search).toBe("");
  });
});