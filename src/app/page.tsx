import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/session";

/** Wejscie w korzen kieruje na widok startowy wybrany przez uzytkownika (spec 06). */
export default async function Home() {
  const user = await getCurrentUser();
  redirect(user?.defaultView ?? "/dashboard");
}
