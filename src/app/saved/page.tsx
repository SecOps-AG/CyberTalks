import type { Metadata } from "next";
import { SavedPageClient } from "./SavedPageClient";

export const metadata: Metadata = {
  title: "Saved talks",
  description: "Your bookmarked talks on Cyber Talks.",
};

export default function SavedPage() {
  return <SavedPageClient />;
}
