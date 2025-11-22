import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import SessionDetailsClient from "@/components/dashboard/session-details-client";

export default async function SessionDetailsPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return <SessionDetailsClient sessionId={params.id} />;
}
