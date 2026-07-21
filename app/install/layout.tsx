import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cài ứng dụng Numega",
  description: "Cài Numega lên màn hình chính để sử dụng như một ứng dụng trên điện thoại.",
};

export default function InstallLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
