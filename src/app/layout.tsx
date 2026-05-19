import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import PwaRegister from "@/components/PwaRegister";
import { DEFAULT_PUBLIC_LANGUAGE, EDSYNC_LANGUAGES } from "@/lib/public/languages";

const publicLanguages = JSON.stringify(EDSYNC_LANGUAGES);
const preferenceScript = `
(() => {
  try {
    const theme = window.localStorage.getItem("edsync-theme");
    document.documentElement.classList.toggle("dark", theme === "dark");
    const cookieLanguage = document.cookie.split("; ").find((row) => row.startsWith("edsync-language="))?.split("=")[1];
    const cookieLanguageCode = document.cookie.split("; ").find((row) => row.startsWith("edsync-language-code="))?.split("=")[1];
    const language = window.localStorage.getItem("edsync-language") || (cookieLanguage ? decodeURIComponent(cookieLanguage) : "${DEFAULT_PUBLIC_LANGUAGE}");
    const languageCode = cookieLanguageCode ? decodeURIComponent(cookieLanguageCode) : "";
    const languages = ${publicLanguages};
    const match = languages.find((item) => item.name === language || item.code === language || item.code === languageCode);
    document.documentElement.lang = match?.code || "en";
  } catch {}
})();
`;

export const metadata: Metadata = {
  title: {
    default: "EdSync",
    template: "%s | EdSync",
  },
  description:
    "Browse public courses, organization academies, and role-aware EdSync learning workspaces.",
  icons: { icon: "/favicon.svg" },
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: preferenceScript }} />
      </head>
      <body
        className="min-h-screen bg-edsync-bg font-body text-edsync-text antialiased"
        suppressHydrationWarning
      >
        {children}
        <PwaRegister />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "var(--overlay-strong)",
              color: "var(--text)",
              border: "1px solid var(--border)",
              borderRadius: "14px",
              boxShadow: "var(--shadow-menu)",
              fontFamily: "Instrument Sans, sans-serif",
            },
            success: { iconTheme: { primary: "var(--emerald)", secondary: "var(--surface)" } },
            error: { iconTheme: { primary: "var(--red)", secondary: "var(--surface)" } },
          }}
        />
      </body>
    </html>
  );
}
