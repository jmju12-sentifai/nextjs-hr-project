export async function checkSubscription(): Promise<boolean> {
  try {
    const res = await fetch("/api/subscription/check", { cache: "no-store" });
    if (!res.ok) return false;
    const data = (await res.json()) as { active?: boolean };
    return !!data.active;
  } catch {
    return false;
  }
}
