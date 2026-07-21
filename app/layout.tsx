import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "vietnamese"] });

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Numega · Feed Formula Calculator",
    description: "Ứng dụng PWA tính toán công thức thức ăn chăn nuôi, hoạt động online và offline.",
    applicationName: "Numega",
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, statusBarStyle: "default", title: "Numega" },
    icons: { icon: "/favicon.svg", apple: "/favicon.svg" },
    openGraph: {
      title: "Numega · Feed Formula Calculator",
      description: "Tạo công thức, kiểm tra dinh dưỡng và xem đóng góp nguyên liệu ngay cả khi offline.",
      type: "website",
    },
    twitter: { card: "summary" },
  };
}

export const viewport: Viewport = {
  themeColor: "#006c4e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body className={inter.variable}>{children}</body></html>;
}
