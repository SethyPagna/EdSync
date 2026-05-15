import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import PwaRegister from "@/components/PwaRegister";

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
