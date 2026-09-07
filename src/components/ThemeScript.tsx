/**
 * Motyw uzytkownika stemplowany na <html> przed pierwszym malowaniem —
 * inaczej strona mrugnelaby jasnym tlem przed hydratacja. Wartosc "system"
 * nie stempluje nic, zeby zadzialalo prefers-color-scheme.
 */
export function ThemeScript({ theme }: { theme: string }) {
  if (theme === "system") return null;
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `document.documentElement.setAttribute("data-theme", ${JSON.stringify(theme)});`,
      }}
    />
  );
}
