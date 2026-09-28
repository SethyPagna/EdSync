import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "@/styles/globals.css";
import "@/styles/workspace.css";
import { Toaster } from "react-hot-toast";
import PwaRegister from "@/components/PwaRegister";
import { ConfirmProvider } from "@/components/ui/Confirm";
import { DEFAULT_PUBLIC_LANGUAGE, EDSYNC_LANGUAGES } from "@/lib/public/languages";
import { THEMES, appearanceBootScript } from "@/lib/ui/theme";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap", preload: false });
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  variable: "--font-instrument-serif",
  display: "swap",
});

const publicLanguages = JSON.stringify(EDSYNC_LANGUAGES);
const languageScript = `
(() => {
  try {
    const queryLanguage = new URLSearchParams(window.location.search).get("language");
    const cookieLanguage = document.cookie.split("; ").find((row) => row.startsWith("edsync-language="))?.split("=")[1];
    const cookieLanguageCode = document.cookie.split("; ").find((row) => row.startsWith("edsync-language-code="))?.split("=")[1];
    const language = queryLanguage || window.localStorage.getItem("edsync-language") || (cookieLanguage ? decodeURIComponent(cookieLanguage) : "${DEFAULT_PUBLIC_LANGUAGE}");
    const languageCode = cookieLanguageCode ? decodeURIComponent(cookieLanguageCode) : "";
    const languages = ${publicLanguages};
    const match = languages.find((item) => item.name === language || item.code === language || item.code === languageCode);
    document.documentElement.lang = match?.code || "en";
  } catch {}
})();
`;
const preferenceScript = appearanceBootScript + languageScript;

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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: THEMES.filter((theme) => theme.id === "porcelain" || theme.id === "graphite").map((theme) => ({
    media: `(prefers-color-scheme: ${theme.mode})`,
    color: theme.swatch.bg,
  })),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} ${instrumentSerif.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: preferenceScript }} />
      </head>
      <body className="min-h-screen bg-bg font-sans text-fg antialiased" suppressHydrationWarning>
        <ConfirmProvider>{children}</ConfirmProvider>
        <PwaRegister />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "var(--elevated)",
              color: "var(--text)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-lg)",
              fontFamily: "var(--font-sans)",
              fontSize: "13px",
            },
            success: { iconTheme: { primary: "var(--success)", secondary: "var(--elevated)" } },
            error: { iconTheme: { primary: "var(--danger)", secondary: "var(--elevated)" } },
          }}
        />
      </body>
    </html>
  );
}
