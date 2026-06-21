import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components";
import { api } from "@/lib/api";
import { ROUTES } from "@/lib/routes";
import { EP } from "@/lib/endpoints";
import { useAuthStore } from "@/stores/auth";
import type { AuthUser } from "@/stores/auth";

export default function Login() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { setUser } = useAuthStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await api.post<AuthUser>(EP.authLogin, { username, password });
      setUser(user);
      navigate(ROUTES.root, { replace: true });
    } catch {
      setError(t('login.errorInvalid'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-surface flex items-center justify-center p-5">
      <div className="w-full max-w-80">
        <div className="text-center mb-8">
          <div className="text-xl font-medium text-ink">{t('login.title')}</div>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            placeholder={t('login.usernamePlaceholder')}
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="border border-line rounded-[10px] px-4 py-3 text-sm text-ink bg-white outline-none focus:border-ink transition-colors"
            required
            autoComplete="username"
          />
          <input
            type="password"
            placeholder={t('login.passwordPlaceholder')}
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="border border-line rounded-[10px] px-4 py-3 text-sm text-ink bg-white outline-none focus:border-ink transition-colors"
            required
            autoComplete="current-password"
          />
          {error && (
            <div className="text-xs text-danger text-center">{error}</div>
          )}
          <Button
            type="submit"
            variant="primary"
            disabled={loading}
            className="w-full rounded-[10px] py-3 text-sm font-medium mt-1 disabled:opacity-50"
          >
            {loading ? t('login.submitting') : t('login.submit')}
          </Button>
        </form>
      </div>
    </div>
  );
}
