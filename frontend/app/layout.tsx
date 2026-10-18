import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "EcoSentinel — Environmental Intelligence Platform",
  description:
    "AI-powered environmental monitoring and First Environmental Report platform. Know what was there. Understand what changed. Investigate what matters.",
  keywords: "environmental monitoring, FER, environmental clearance, satellite analysis, EIA",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
        />
      </head>
      <body className={`${inter.className} min-h-screen`} style={{ backgroundColor: '#F4F3EC', color: '#19382D' }}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
