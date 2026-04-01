"use client";

import { useEffect, useMemo, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISS_KEY = "git-members-install-banner-dismissed";

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function detectIos() {
  if (typeof window === "undefined") return false;
  return /iPad|iPhone|iPod/.test(window.navigator.userAgent);
}

function detectSafari() {
  if (typeof window === "undefined") return false;
  const userAgent = window.navigator.userAgent;
  return /Safari/.test(userAgent) && !/CriOS|FxiOS|EdgiOS/.test(userAgent);
}

export function MobileInstallBanner() {
  const [isOpen, setIsOpen] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true);
  const [isIos, setIsIos] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const standalone = isStandaloneMode();
      const dismissed = window.localStorage.getItem(DISMISS_KEY) === "1";
      setIsStandalone(standalone);
      setIsIos(detectIos() && detectSafari());
      setIsOpen(!standalone && !dismissed);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  const helperText = useMemo(() => {
    if (isIos) {
      return "iPhone は共有ボタンから「ホーム画面に追加」を選ぶと、アプリのように起動できます。";
    }
    if (deferredPrompt) {
      return "ホーム画面に追加すると、アプリのように起動できます。";
    }
    return "ブラウザのメニューからホーム画面に追加すると、起動しやすくなります。";
  }, [deferredPrompt, isIos]);

  if (isStandalone) return null;

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => undefined);
    setDeferredPrompt(null);
    setIsOpen(false);
  }

  function dismissBanner() {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setIsOpen(false);
  }

  return (
    <section className="mt-6 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="inline-flex rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          アプリとして使う
        </button>
        <p className="text-sm text-slate-500">スマホから起動しやすくする案内です。</p>
      </div>

      {isOpen ? (
        <article className="rounded-[1.5rem] border border-sky-100 bg-sky-50/80 p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">Install Guide</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">スマホですぐ開けるようにしますか？</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">{helperText}</p>
            </div>
            <button
              type="button"
              onClick={dismissBanner}
              className="inline-flex rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              あとで
            </button>
          </div>

          {isIos ? (
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-7 text-slate-600">
              <li>Safari の共有ボタンをタップします。</li>
              <li>「ホーム画面に追加」を選びます。</li>
              <li>追加後はホーム画面の GIT Members から起動できます。</li>
            </ol>
          ) : deferredPrompt ? (
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleInstall()}
                className="inline-flex rounded-full bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
              >
                インストール
              </button>
            </div>
          ) : (
            <p className="mt-4 text-sm leading-7 text-slate-600">Android や PC では、ブラウザのメニューから「インストール」または「ホーム画面に追加」を選んでください。</p>
          )}
        </article>
      ) : null}
    </section>
  );
}
