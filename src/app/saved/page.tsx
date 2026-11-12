import type { Metadata } from "next";
import { pageMetadata } from "@/lib/page-meta";
import { SavedPageClient } from "./SavedPageClient";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Saved talks",
    description: "Your bookmarked talks on Cyber Talks.",
    path: "/saved",
  }),
  robots: { index: false, follow: true },
};

export default function SavedPage() {
  return <SavedPageClient />;
}
