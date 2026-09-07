import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/session";
import { buildConsentUrl, googleCalendarConfigured } from "@/server/services/googleOAuth";
import { signState } from "@/server/services/oauthState";

/** Start przepływu zgody. Odpowiada przekierowaniem, więc nie używa `withAuth`. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!googleCalendarConfigured()) {
    redirect("/improvements?google=nieskonfigurowane");
  }

  redirect(buildConsentUrl(signState(user.id)));
}
