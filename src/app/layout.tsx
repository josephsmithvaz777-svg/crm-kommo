import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import { AppNav } from "@/components/AppNav";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const body = Source_Sans_3({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "ConexiónCRM · Kommo",
  description: "CRM inmobiliario sincronizado con Kommo vía API y webhooks",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="flex h-full flex-col overflow-hidden">
        <AppNav />
        <main className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col overflow-y-auto px-4 py-3 sm:px-6 sm:py-4">
          {children}
        </main>
      </body>
    </html>
  );
}
