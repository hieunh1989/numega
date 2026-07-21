"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

type InstallChoice = { outcome: "accepted" | "dismissed" };
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
};
type Platform = "loading" | "android" | "ios-chrome" | "ios-safari" | "in-app" | "desktop" | "installed";

function isStandalone() {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
}

export default function InstallPage() {
  const [platform, setPlatform] = useState<Platform>("loading");
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [promptChecked, setPromptChecked] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setPlatform("installed");
      return;
    }

    const userAgent = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(userAgent);
    const iosChrome = ios && /CriOS/i.test(userAgent);
    const inApp = /FBAN|FBAV|Instagram|Line|Zalo|Messenger/i.test(userAgent);
    const android = /Android/i.test(userAgent);

    setPlatform(inApp ? "in-app" : iosChrome ? "ios-chrome" : ios ? "ios-safari" : android ? "android" : "desktop");
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);

    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
      setPromptChecked(true);
      if (android) setPlatform("android");
    };
    const markInstalled = () => {
      setPlatform("installed");
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", markInstalled);
    const promptTimer = window.setTimeout(() => setPromptChecked(true), 3500);
    return () => {
      window.clearTimeout(promptTimer);
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    setInstalling(true);
    setDismissed(false);
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setPlatform("installed");
      else setDismissed(true);
      setInstallPrompt(null);
    } finally {
      setInstalling(false);
    }
  };

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText("https://numega.vercel.app/install");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      window.location.href = "https://numega.vercel.app/install";
    }
  };

  return (
    <main className="install-shell">
      <section className="install-card">
        <Link className="install-wordmark" href="/" aria-label="Mở Numega">
          <Image src="/numega-logo.png" alt="Numega" width={588} height={126} priority />
        </Link>

        <div className="install-app-icon" aria-hidden="true">
          <Image src="/icons/pwa/icon-192.png" alt="" width={192} height={192} priority />
        </div>

        {platform === "loading" && (
          <div className="install-copy">
            <span className="install-eyebrow">NUMEGA PWA</span>
            <h1>Đang chuẩn bị cài đặt…</h1>
            <p>Vui lòng chờ trong giây lát.</p>
          </div>
        )}

        {platform === "android" && (
          <>
            <div className="install-copy">
              <span className="install-eyebrow">DÀNH CHO ANDROID</span>
              <h1>Cài Numega lên điện thoại</h1>
              <p>Sử dụng toàn màn hình, mở nhanh từ icon và tiếp tục xem dữ liệu đã lưu khi mạng yếu.</p>
            </div>
            {installPrompt ? (
              <button className="install-primary" type="button" onClick={install} disabled={installing}>
                <span aria-hidden="true">↓</span>{installing ? "Đang mở cài đặt…" : "Cài ứng dụng Numega"}
              </button>
            ) : !promptChecked ? (
              <div className="install-waiting">
                <span className="install-spinner" aria-hidden="true" />
                <div><strong>Đang kiểm tra khả năng cài đặt</strong><small>Nếu nút chưa xuất hiện, hãy mở link này bằng Chrome.</small></div>
              </div>
            ) : (
              <div className="install-manual">
                <strong>Chrome chưa mở hộp cài đặt tự động</strong>
                <span>Nhấn menu <b>⋮</b> ở góc trên bên phải, rồi chọn <b>Cài đặt ứng dụng</b> hoặc <b>Thêm vào màn hình chính</b>.</span>
                <button type="button" onClick={() => window.location.reload()}>Kiểm tra lại</button>
              </div>
            )}
            {dismissed && <p className="install-note warning">Anh đã đóng hộp thoại cài đặt. Tải lại trang để thử lại.</p>}
          </>
        )}

        {platform === "ios-chrome" && (
          <>
            <div className="install-copy">
              <span className="install-eyebrow">IPHONE / IPAD · CHROME</span>
              <h1>Thêm Numega vào Màn hình chính</h1>
              <p>Trên Chrome, anh mở bảng Chia sẻ rồi chọn thêm Numega vào Màn hình chính.</p>
            </div>
            <ol className="ios-install-steps">
              <li><span>1</span><div><strong>Nhấn nút Chia sẻ</strong><small>Biểu tượng ô vuông có mũi tên hướng lên, nằm cạnh thanh địa chỉ ở phía trên.</small></div><b aria-hidden="true">⇧</b></li>
              <li><span>2</span><div><strong>Chọn “Xem thêm”</strong><small>Nhấn biểu tượng mũi tên xuống ở cuối hàng tác vụ.</small></div><b aria-hidden="true">⌄</b></li>
              <li><span>3</span><div><strong>Chọn “Thêm vào Màn hình chính”</strong><small>Mục này nằm trong danh sách tác vụ mở rộng.</small></div></li>
              <li><span>4</span><div><strong>Xác nhận thêm ứng dụng</strong><small>Giữ tên Numega rồi nhấn “Thêm” để hoàn tất.</small></div></li>
            </ol>
          </>
        )}

        {platform === "ios-safari" && (
          <>
            <div className="install-copy">
              <span className="install-eyebrow">IPHONE / IPAD · SAFARI</span>
              <h1>Thêm Numega vào Màn hình chính</h1>
              <p>Apple yêu cầu xác nhận qua Safari. Chỉ cần thực hiện ba bước sau một lần.</p>
            </div>
            <ol className="ios-install-steps">
              <li><span>1</span><div><strong>Nhấn nút Chia sẻ</strong><small>Biểu tượng ô vuông có mũi tên hướng lên trong Safari.</small></div><b aria-hidden="true">⇧</b></li>
              <li><span>2</span><div><strong>Chọn “Thêm vào Màn hình chính”</strong><small>Nếu chưa thấy, cuộn xuống cuối danh sách tác vụ.</small></div></li>
              <li><span>3</span><div><strong>Bật “Mở dưới dạng ứng dụng web”</strong><small>Sau đó nhấn “Thêm”.</small></div></li>
            </ol>
          </>
        )}

        {platform === "in-app" && (
          <>
            <div className="install-copy">
              <span className="install-eyebrow">MỞ BẰNG TRÌNH DUYỆT</span>
              <h1>Chuyển sang Chrome hoặc Safari</h1>
              <p>Trình duyệt bên trong Zalo, Facebook hoặc Messenger không cho cài PWA. Hãy chọn “Mở bằng trình duyệt” trong menu của ứng dụng.</p>
            </div>
            <button className="install-secondary" type="button" onClick={copyAddress}>{copied ? "Đã sao chép link" : "Sao chép link cài đặt"}</button>
          </>
        )}

        {platform === "desktop" && (
          <>
            <div className="install-copy">
              <span className="install-eyebrow">NUMEGA PWA</span>
              <h1>Mở link này trên điện thoại</h1>
              <p>Trên Android dùng Chrome; trên iPhone dùng Safari để cài Numega lên màn hình chính.</p>
            </div>
            {installPrompt && <button className="install-primary" type="button" onClick={install} disabled={installing}>Cài Numega trên thiết bị này</button>}
            <button className="install-secondary" type="button" onClick={copyAddress}>{copied ? "Đã sao chép link" : "Sao chép link để gửi"}</button>
          </>
        )}

        {platform === "installed" && (
          <>
            <div className="install-copy success">
              <span className="install-success-mark" aria-hidden="true">✓</span>
              <h1>Numega đã sẵn sàng</h1>
              <p>Ứng dụng đã được thêm vào thiết bị. Anh có thể mở Numega từ icon trên màn hình chính.</p>
            </div>
            <Link className="install-primary link" href="/">Mở Numega</Link>
          </>
        )}

        <footer className="install-footer">
          <Link href="/">Tiếp tục dùng trên trình duyệt</Link>
          <small>Không cần tải từ App Store hoặc Google Play.</small>
        </footer>
      </section>
    </main>
  );
}
