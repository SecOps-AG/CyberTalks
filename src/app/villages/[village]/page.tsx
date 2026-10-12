import { redirect } from "next/navigation";

type Props = { params: Promise<{ village: string }> };

/** Legacy village URLs redirect into the DEF CON hub. */
export default async function LegacyVillageRedirectPage({ params }: Props) {
  const { village } = await params;
  redirect(`/defcon/villages/${village}`);
}
