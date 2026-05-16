import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import PwaRegister from "@/components/PwaRegister";

const preferenceScript = `
(() => {
  try {
    const theme = window.localStorage.getItem("edsync-theme");
    document.documentElement.classList.toggle("dark", theme === "dark");
    const language = window.localStorage.getItem("edsync-language") || "English";
    const codes = { English: "en", Korean: "ko", Khmer: "km", Chinese: "zh", Japanese: "ja", Spanish: "es", French: "fr", Vietnamese: "vi", Thai: "th" };
    document.documentElement.lang = codes[language] || "en";
  } catch {}
})();
`;

export const metadata: Metadata = {
  title: {
    default: "EdSync Catalog",
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
              background: "#ffffff",
              color: "#142033",
              border: "1px solid #d9e2ef",
              borderRadius: "8px",
              fontFamily: "Instrument Sans, sans-serif",
            },
            success: { iconTheme: { primary: "#108765", secondary: "#ffffff" } },
            error: { iconTheme: { primary: "#dc2626", secondary: "#ffffff" } },
          }}
        />
      </body>
    </html>
  );
}
