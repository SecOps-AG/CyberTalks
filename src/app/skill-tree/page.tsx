import type { Metadata } from "next";
import skillTrees from "@/generated/skill-trees.json";
import { canonicalUrl } from "@/lib/canonical";
import type { SkillTreeFile } from "@/lib/skill-tree";
import { SkillTreeClient } from "./SkillTreeClient";

export const metadata: Metadata = {
  title: "Skill Tree",
  description:
    "Learning paths through real conference talks. Pick a field like red team or cloud, then work from beginner talks up to expert ones.",
  alternates: { canonical: canonicalUrl("/skill-tree") },
};

export default function SkillTreePage() {
  return <SkillTreeClient data={skillTrees as SkillTreeFile} />;
}
