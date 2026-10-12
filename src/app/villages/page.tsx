import { redirect } from "next/navigation";

/** Global village index moved under the DEF CON hub. */
export default function VillagesRedirectPage() {
  redirect("/defcon/villages");
}
