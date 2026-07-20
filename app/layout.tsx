import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "vietnamese"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const imageUrl = `${protocol}://${host}/og.png`;
  return {
    title: "AgriCalc · Feed Formula Calculator",
    description: "Ứng dụng PWA tính toán công thức thức ăn chăn nuôi, hoạt động online và offline.",
    applicationName: "AgriCalc",
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, statusBarStyle: "default", title: "AgriCalc" },
    icons: { icon: "/favicon.svg", apple: "/favicon.svg" },
    openGraph: {
      title: "AgriCalc · Feed Formula Calculator",
      description: "Tạo công thức, kiểm tra dinh dưỡng và xem đóng góp nguyên liệu ngay cả khi offline.",
      type: "website",
      images: [{ url: imageUrl, width: 1792, height: 1024, alt: "AgriCalc Feed Formula Calculator" }],
    },
    twitter: { card: "summary_large_image", images: [imageUrl] },
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
