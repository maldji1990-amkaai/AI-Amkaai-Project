import { redirect } from "next/navigation";

export default function LegacyAIVideoPage() {
  redirect("/dashboard/generate");
}
