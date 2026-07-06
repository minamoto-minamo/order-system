import { useState } from "react";
import { BaseButton } from "@/components/controls/button";
import { Toast } from "@/components/display/Toast/Toast";
import { BRAND } from "@/lib/brand";

// ログイン画面の全面レイアウト＋認証フォーム。
// 入力 state はここで持ち、検証・送信処理は onSubmit で呼び出し側が行う。
export function LoginForm({ title, usernamePlaceholder, passwordPlaceholder, submitLabel, submittingLabel, error, loading, onSubmit }: {
  title: string;
  usernamePlaceholder: string;
  passwordPlaceholder: string;
  submitLabel: string;
  submittingLabel: string;
  error: string | null;
  loading: boolean;
  onSubmit: (username: string, password: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(username, password);
  };

  return (
    <div className="h-dvh overflow-y-auto bg-white p-5">
      <div className="min-h-full flex flex-col items-center" style={{ justifyContent: "safe center" }}>
        <div className="w-full max-w-80">
          <div className="text-center mb-8">
            <img src={BRAND.iconPath} alt="" className="w-14 h-14 mx-auto mb-3" />
            <div className="text-xl font-medium text-ink">{BRAND.appName}</div>
            <div className="text-label text-muted mt-1">{title}</div>
          </div>
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
            <input
              type="text"
              placeholder={usernamePlaceholder}
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="border border-line rounded-[10px] px-4 py-3 text-sm text-ink bg-white outline-none focus:border-brand transition-colors"
              autoComplete="username"
            />
            <input
              type="password"
              placeholder={passwordPlaceholder}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="border border-line rounded-[10px] px-4 py-3 text-sm text-ink bg-white outline-none focus:border-brand transition-colors"
              autoComplete="current-password"
	            />
            <BaseButton
              type="submit"
              variant="primary"
              disabled={loading}
              className="w-full rounded-[10px] py-3 text-sm font-medium mt-1 disabled:opacity-50"
            >
              {loading ? submittingLabel : submitLabel}
            </BaseButton>
          </form>
        </div>
      </div>
      <Toast message={error} />
    </div>
  );
}
