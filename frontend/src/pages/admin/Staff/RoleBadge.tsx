export function RoleBadge({ role }: { role: string }) {
  const isAdmin = role === "admin";
  return (
    <span className={`text-caption px-2 py-0.5 rounded-full border ${isAdmin ? "bg-info-bg border-info-border text-info" : "bg-surface border-divider text-muted"}`}>
      {isAdmin ? "管理者" : "スタッフ"}
    </span>
  );
}
