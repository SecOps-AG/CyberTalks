import type { Metadata } from "next";
import skillTrees from "@/generated/skill-trees.json";
import { canonicalUrl } from "@/lib/canonical";
import type { SkillTreeFile } from "@/lib/skill-tree";
import { SkillTreeClient } from "./SkillTreeClient";

export const metadata: Metadata = {
  title: "Skill Tree",
  description:
    "An experimental guide to what to watch next: conference talks from the archive, sorted by difficulty and topic into suggested paths.",
  alternates: { canonical: canonicalUrl("/skill-tree") },
};

export default function SkillTreePage() {
  return <SkillTreeClient data={skillTrees as SkillTreeFile} />;
}
