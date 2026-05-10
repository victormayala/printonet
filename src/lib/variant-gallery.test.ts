import { describe, expect, it } from "vitest";
import { resolveGalleryImageForView } from "./variant-gallery";

describe("resolveGalleryImageForView", () => {
  const gallery = [
    "https://www.ssactivewear.com/Images/Color/115698_f_fl.jpg",
    "https://www.ssactivewear.com/Images/ModelColor/115698_omf_fl.jpg",
    "https://www.ssactivewear.com/Images/Color/115698_b_fl.jpg",
    "https://www.ssactivewear.com/Images/ModelColor/115698_omb_fl.jpg",
    "https://www.ssactivewear.com/Images/ModelColor/115698_oms_fl.jpg",
    "https://www.ssactivewear.com/Images/Color/115698_d_fl.jpg",
  ];

  it("matches gallery by base side signature first", () => {
    const out = resolveGalleryImageForView(
      gallery,
      "https://www.ssactivewear.com/Images/ModelColor/110373_oms_fl.jpg",
      "side1",
    );
    expect(out).toBe("https://www.ssactivewear.com/Images/ModelColor/115698_oms_fl.jpg");
  });

  it("falls back to token hints when base signature unavailable", () => {
    const out = resolveGalleryImageForView(
      gallery,
      "https://cdn.example.com/missing-pattern.jpg",
      "side2",
    );
    expect(out).toBe("https://www.ssactivewear.com/Images/Color/115698_d_fl.jpg");
  });
});
