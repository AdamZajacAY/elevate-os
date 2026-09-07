/**
 * Poczta transakcyjna (spec 09) — "powiadomienia o zbliżających się terminach
 * i follow-upach CRM, e-mail transakcyjny, bez treści poufnych".
 *
 * Dostawca jest wymienny i **opcjonalny**: bez `RESEND_API_KEY` wysyłka jest
 * pomijana z wpisem w logu, a aplikacja działa normalnie — powiadomienia i tak
 * są widoczne w skrzynce w aplikacji. Dzięki temu wdrożenie nie blokuje się
 * na koncie u dostawcy poczty.
 */

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
};

export type SendResult = { sent: boolean; reason?: string };

function isConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

/**
 * Pola finansowe i dane osobowe klientów nie mogą trafiać do treści maila —
 * poczta wychodzi poza kontrolowany kanał. Mail niesie powód i link, resztę
 * użytkownik zobaczy po zalogowaniu.
 */
export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  if (!isConfigured()) {
    console.info(`[email] pominięto wysyłkę do ${message.to} — brak konfiguracji dostawcy`);
    return { sent: false, reason: "not-configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: message.to,
        subject: message.subject,
        text: message.text,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[email] dostawca odrzucił wiadomość (${res.status}): ${body.slice(0, 200)}`);
      return { sent: false, reason: `provider-${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    // Awaria poczty nie moze przewrocic operacji, ktora ja wywolala.
    console.error("[email] wysyłka nieudana", err);
    return { sent: false, reason: "network" };
  }
}

/** Zbiorcze podsumowanie zamiast maila na każde powiadomienie z osobna. */
export function buildDigest(params: {
  fullName: string;
  items: { title: string; body: string | null; link: string | null }[];
  baseUrl: string;
}): EmailMessage["text"] {
  const lines = [
    `Cześć ${params.fullName.split(" ")[0]},`,
    "",
    `w ELEVATE OS czeka na Ciebie ${params.items.length} ${
      params.items.length === 1 ? "powiadomienie" : "powiadomień"
    }:`,
    "",
    ...params.items.map((item) => `• ${item.title}${item.body ? ` — ${item.body}` : ""}`),
    "",
    `Szczegóły: ${params.baseUrl}/notifications`,
    "",
    "— ELEVATE OS, AdviseYou",
  ];
  return lines.join("\n");
}
