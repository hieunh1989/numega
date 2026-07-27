import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Install Numega",
  description: "Install Numega on the Home Screen and use it like a native mobile app.",
};

export default function InstallLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
