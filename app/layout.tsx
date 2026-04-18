import type { Metadata } from "next";
import "./globals.css";
import AppLayout from "@/components/AppLayout";
import { AppProvider } from "@/lib/context";

export const metadata: Metadata = {
  title: "Tracker",
  description: "Personal Finance Tracker",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Tracker",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="antialiased h-full">
      <body className="font-sans antialiased text-gray-900 bg-white dark:bg-gray-900 dark:text-gray-100">
        <AppProvider>
          <AppLayout>{children}</AppLayout>
        </AppProvider>
      </body>
    </html>
  );
}
