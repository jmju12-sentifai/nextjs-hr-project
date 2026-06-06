"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { checkSubscription } from "./subscription";

export function usePaywall() {
  const router = useRouter();
  const [active, setActive] = useState<boolean | null>(null);
  const checkingRef = useRef(false);

  useEffect(() => {
    checkSubscription().then(setActive);
  }, []);

  const gate = useCallback(async (): Promise<boolean> => {
    if (active === true) return true;
    if (active === false) {
      router.push("/pricing");
      return false;
    }
    if (checkingRef.current) return false;
    checkingRef.current = true;
    const ok = await checkSubscription();
    checkingRef.current = false;
    setActive(ok);
    if (!ok) router.push("/pricing");
    return ok;
  }, [active, router]);

  return { active, gate };
}
