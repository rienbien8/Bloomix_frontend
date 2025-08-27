import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function usePWA() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // オンライン状態の監視
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    // インストール前のプロンプトイベントをキャッチ
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    // アプリがインストールされたかチェック
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      console.log("PWAがインストールされました");
    };

    // スタンドアロンモードかチェック
    const checkIfInstalled = () => {
      if (window.matchMedia("(display-mode: standalone)").matches) {
        setIsInstalled(true);
        setIsInstallable(false);
      }
    };

    // イベントリスナーの登録
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // 初期チェック
    checkIfInstalled();
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const installApp = async () => {
    if (!deferredPrompt) return false;

    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === "accepted") {
        console.log("ユーザーがインストールを承認しました");
        setDeferredPrompt(null);
        setIsInstallable(false);
        return true;
      } else {
        console.log("ユーザーがインストールを拒否しました");
        return false;
      }
    } catch (error) {
      console.error("インストールプロンプトエラー:", error);
      return false;
    }
  };

  const checkInstallability = () => {
    return isInstallable && !isInstalled;
  };

  return {
    isInstallable: checkInstallability(),
    isInstalled,
    isOnline,
    installApp,
    deferredPrompt,
  };
}
