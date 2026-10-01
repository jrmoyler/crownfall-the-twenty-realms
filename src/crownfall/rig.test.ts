import { describe, expect, it } from "vitest";
import { canonicalBone } from "./rig";

describe("canonicalBone", () => {
  it("reduces the naming schemes of every shipped rig to one form", () => {
    expect(canonicalBone("Bip001_L_UpperArm_011")).toBe("bip001lupperarm");
    expect(canonicalBone("mixamorigLeftForeArm_034")).toBe("mixamorigleftforearm");
    expect(canonicalBone("mixamorig_RightUpLeg_57")).toBe("mixamorigrightupleg");
    expect(canonicalBone("Upper_Arm_L_06")).toBe("upperarml");
    expect(canonicalBone("L_elbow_016")).toBe("lelbow");
    expect(canonicalBone("BicepL_09")).toBe("bicepl");
  });
});
