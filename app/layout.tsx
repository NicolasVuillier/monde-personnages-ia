import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Le Monde des Personnages IA",
  description:
    "Explore une carte mondiale peuplée de personnages historiques, mythologiques, fictifs et imaginés par la communauté.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
