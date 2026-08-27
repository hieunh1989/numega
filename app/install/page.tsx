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
        <Link className="install-wordmark" href="/" aria-label="Open Numega">
          <Image src="/numega-logo.png" alt="Numega" width={588} height={126} priority />
        </Link>

        {platform === "loading" && (
          <div className="install-copy">
            <span className="install-eyebrow">NUMEGA PWA</span>
            <h1>Preparing installation…</h1>
            <p>Please wait a moment.</p>
          </div>
        )}

        {platform === "android" && (
          <>
            <div className="install-copy">
              <span className="install-eyebrow">FOR ANDROID</span>
              <h1>Install Numega on Your Phone</h1>
              <p>Use Numega full screen, launch it quickly from the app icon, and access saved data when the connection is weak.</p>
            </div>
            {installPrompt ? (
              <button className="install-primary" type="button" onClick={install} disabled={installing}>
                <span aria-hidden="true">↓</span>{installing ? "Opening installer…" : "Install Numega"}
              </button>
            ) : !promptChecked ? (
              <div className="install-waiting">
                <span className="install-spinner" aria-hidden="true" />
                <div><strong>Checking installation availability</strong><small>If the button does not appear, open this link in Chrome.</small></div>
              </div>
            ) : (
              <div className="install-manual">
                <strong>Chrome did not open the installation prompt</strong>
                <span>Open the <b>⋮</b> menu in the top-right corner, then select <b>Install app</b> or <b>Add to Home screen</b>.</span>
                <button type="button" onClick={() => window.location.reload()}>Check again</button>
              </div>
            )}
            {dismissed && <p className="install-note warning">The installation prompt was closed. Reload the page to try again.</p>}
          </>
        )}

        {platform === "ios-chrome" && (
          <>
            <div className="install-copy">
              <span className="install-eyebrow">IPHONE / IPAD · CHROME</span>
              <h1>Add Numega to the Home Screen</h1>
              <p>In Chrome, open the Share sheet and add Numega to the Home Screen.</p>
            </div>
            <ol className="ios-install-steps">
              <li><span>1</span><div><strong>Tap the Share button</strong><small>Use the square icon with an upward arrow next to the address bar.</small></div><b aria-hidden="true">⇧</b></li>
              <li><span>2</span><div><strong>Select “More”</strong><small>Tap the downward arrow at the end of the actions row.</small></div><b aria-hidden="true">⌄</b></li>
              <li><span>3</span><div><strong>Select “Add to Home Screen”</strong><small>This option appears in the expanded actions list.</small></div></li>
              <li><span>4</span><div><strong>Confirm the installation</strong><small>Keep the name Numega, then tap “Add” to finish.</small></div></li>
            </ol>
          </>
        )}

        {platform === "ios-safari" && (
          <>
            <div className="install-copy">
              <span className="install-eyebrow">IPHONE / IPAD · SAFARI</span>
              <h1>Add Numega to the Home Screen</h1>
              <p>Apple requires confirmation through Safari. Complete these three steps once.</p>
            </div>
            <ol className="ios-install-steps">
              <li><span>1</span><div><strong>Tap the Share button</strong><small>Use the square icon with an upward arrow in Safari.</small></div><b aria-hidden="true">⇧</b></li>
              <li><span>2</span><div><strong>Select “Add to Home Screen”</strong><small>If it is not visible, scroll to the bottom of the actions list.</small></div></li>
              <li><span>3</span><div><strong>Enable “Open as Web App”</strong><small>Then tap “Add”.</small></div></li>
            </ol>
          </>
        )}

        {platform === "in-app" && (
          <>
            <div className="install-copy">
              <span className="install-eyebrow">OPEN IN A BROWSER</span>
              <h1>Switch to Chrome or Safari</h1>
              <p>The browsers inside Zalo, Facebook, and Messenger cannot install PWAs. Select “Open in browser” from the app menu.</p>
            </div>
            <button className="install-secondary" type="button" onClick={copyAddress}>{copied ? "Link copied" : "Copy installation link"}</button>
          </>
        )}

        {platform === "desktop" && (
          <>
            <div className="install-copy">
              <span className="install-eyebrow">NUMEGA PWA</span>
              <h1>Open This Link on a Phone</h1>
              <p>Use Chrome on Android or Safari on iPhone to install Numega on the Home Screen.</p>
            </div>
            {installPrompt && <button className="install-primary" type="button" onClick={install} disabled={installing}>Install Numega on This Device</button>}
            <button className="install-secondary" type="button" onClick={copyAddress}>{copied ? "Link copied" : "Copy link"}</button>
          </>
        )}

        {platform === "installed" && (
          <>
            <div className="install-copy success">
              <span className="install-success-mark" aria-hidden="true">✓</span>
              <h1>Numega Is Ready</h1>
              <p>The app has been added to this device. Open Numega from the icon on the Home Screen.</p>
            </div>
            <Link className="install-primary link" href="/">Open Numega</Link>
          </>
        )}

        <footer className="install-footer">
          <Link href="/">Continue in Browser</Link>
          <small>No App Store or Google Play download required.</small>
        </footer>
      </section>
    </main>
  );
}
