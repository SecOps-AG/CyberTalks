import type { Metadata } from "next";
import { SavedPageClient } from "./SavedPageClient";

export const metadata: Metadata = {
  title: "Saved talks",
  description: "Your bookmarked talks on Cyber Talks.",
  robots: { index: false, follow: true },
};

export default function SavedPage() {
  return <SavedPageClient />;
}
