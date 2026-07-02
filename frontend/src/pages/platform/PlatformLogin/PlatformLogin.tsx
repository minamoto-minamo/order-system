import { BaseButton } from "@/components";
import { api } from "@/lib/api";
import { EP } from "@/lib/endpoints";
import { ROUTES } from "@/lib/routes";
import type { PlatformAdmin } from "@/stores/platformAuth";
import { usePlatformAuthStore } from "@/stores/platformAuth";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

export default function PlatformLogin() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { setAdmin } = usePlatformAuthStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username || !password) {
      setError(t('platform.errorRequired'));
      return;
    }
    setLoading(true);
    try {
      const admin = await api.post<PlatformAdmin>(EP.platformAuthLogin, { username, password });
      setAdmin(admin);
      navigate(ROUTES.platformStores, { replace: true });
    } catch {
      setError(t('platform.errorInvalid'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-surface flex items-center justify-center p-5">
      <div className="w-full max-w-80">
        <div className="text-center mb-8">
          <div className="text-xl font-medium text-ink">{t('platform.loginTitle')}</div>
        </div>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
          <input
            type="text"
            placeholder={t('platform.usernamePlaceholder')}
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="border border-line rounded-[10px] px-4 py-3 text-sm text-ink bg-white outline-none focus:border-ink transition-colors"
            autoComplete="username"
          />
          <input
            type="password"
            placeholder={t('platform.passwordPlaceholder')}
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="border border-line rounded-[10px] px-4 py-3 text-sm text-ink bg-white outline-none focus:border-ink transition-colors"
            autoComplete="current-password"
          />
          {error && (
            <div className="text-xs text-danger text-center">{error}</div>
          )}
          <BaseButton
            type="submit"
            variant="primary"
            disabled={loading}
            className="w-full rounded-[10px] py-3 text-sm font-medium mt-1 disabled:opacity-50"
          >
            {loading ? t('platform.submitting') : t('platform.submit')}
          </BaseButton>
        </form>
      </div>
    </div>
  );
}
