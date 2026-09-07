import { redirect } from "next/navigation";

export default function LegacyAIImagePage() {
  redirect("/dashboard/generate");
}
