import type { Metadata } from "next";
import en from "../../messages/en.json";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: en.Common.brand,
    template: `%s | ${en.Common.brand}`
  },
  description: en.Common.footerNote,
  icons: {
    icon: "/growity-mark.svg",
    shortcut: "/growity-mark.svg",
    apple: "/growity-mark.svg"
  },
  referrer: "strict-origin-when-cross-origin"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
