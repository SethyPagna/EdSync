import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import SupabaseKeyCheck from "@/components/SupabaseKeyCheck";

export const metadata: Metadata = {
  title: "EdSync - AI Learning OS",
  description:
    "A mature AI-assisted education workspace for teachers and students.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className="min-h-screen bg-atlas-bg font-body text-atlas-text antialiased"
        suppressHydrationWarning
      >
        {children}
        <SupabaseKeyCheck />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#111827",
              color: "#E8EDF5",
              border: "1px solid #263244",
              borderRadius: "8px",
              fontFamily: "Instrument Sans, sans-serif",
            },
            success: { iconTheme: { primary: "#23D18B", secondary: "#111827" } },
            error: { iconTheme: { primary: "#F14C4C", secondary: "#111827" } },
          }}
        />
      </body>
    </html>
  );
}
