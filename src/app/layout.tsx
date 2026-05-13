import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";

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
    <html lang="en" suppressHydrationWarning>
      <body
        className="min-h-screen bg-edsync-bg font-body text-edsync-text antialiased"
        suppressHydrationWarning
      >
        {children}
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
