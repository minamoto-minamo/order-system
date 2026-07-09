import { useId, useState } from "react";
import { BaseButton } from "@/components/primitives";
import { Toast } from "@/components/feedback";
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
  const formId = useId();
  const usernameId = `${formId}-username`;
  const passwordId = `${formId}-password`;
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
            <div>
              <label htmlFor={usernameId} className="block text-caption text-muted mb-1">
                {usernamePlaceholder}
              </label>
              <input
                id={usernameId}
                type="text"
                placeholder={usernamePlaceholder}
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="input-field w-full border border-line rounded-[10px] px-4 py-3 text-sm text-ink bg-white outline-none focus:border-brand transition-colors"
                autoComplete="username"
              />
            </div>
            <div>
              <label htmlFor={passwordId} className="block text-caption text-muted mb-1">
                {passwordPlaceholder}
              </label>
              <input
                id={passwordId}
                type="password"
                placeholder={passwordPlaceholder}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input-field w-full border border-line rounded-[10px] px-4 py-3 text-sm text-ink bg-white outline-none focus:border-brand transition-colors"
                autoComplete="current-password"
              />
            </div>
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
