import { describe, expect, it } from "vitest";
import { publicMediaPath, schoolContentRequest, stabilizeMediaUrls } from "@/school/public-content";

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
describe("Public media", () => {
  it("allows homepage and gallery media", () => {
    expect(publicMediaPath("media/homepage/welcome-video-1")).toBe("homepage/welcome-video-1");
    expect(publicMediaPath("media/gallery/gallery/abc.jpg")).toBe("gallery/gallery/abc.jpg");
  });
  it.each(["media/applications/photo.jpg", "media/homepage/../applications/x", "homepage"])("blocks %s", (s) => {
    expect(publicMediaPath(s)).toBeNull();
  });
  it("rewrites signed links but leaves application photos alone", () => {
    const json = '{"a":"https://x.cloud/storage/v1/object/sign/gallery/homepage/v1?token=t","b":"https://x.cloud/storage/v1/object/sign/gallery/applications/p?token=t"}';
    const out = JSON.parse(stabilizeMediaUrls(json));
    expect(out.a).toBe("/school-api/media/homepage/v1");
    expect(out.b).toContain("token=t");
  });
});
