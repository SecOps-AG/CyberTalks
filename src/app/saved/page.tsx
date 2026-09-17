import type { Metadata } from "next";
import { SavedPageClient } from "./SavedPageClient";
import { getTalkIndex } from "@/lib/data";

export const metadata: Metadata = {
  title: "Saved talks",
  description: "Your bookmarked talks on Cyber Talks.",
};

export default function SavedPage() {
  const allTalks = getTalkIndex();
  return <SavedPageClient allTalks={allTalks} />;
}
