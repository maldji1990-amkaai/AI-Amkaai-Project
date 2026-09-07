import { redirect } from "next/navigation";

// The canonical post-login AI workspace is the advanced generator.
// Keep the old dashboard implementation out of the primary navigation so users
// never land on a legacy generator with a different UX/billing surface.
export default function DashboardPage() {
  redirect("/");
}

