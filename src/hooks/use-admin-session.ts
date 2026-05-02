import { useCallback, useEffect, useState } from "react";
import { checkAdminSession } from "@/lib/publishing";
import { supabase } from "@/lib/supabase-client";

type AdminState = {
  accessToken: string;
  email: string;
};

export function useAdminSession() {
  const [admin, setAdmin] = useState<AdminState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setAdmin(null);
      setIsLoading(false);
      return null;
    }

    setIsLoading(true);

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;

      if (!accessToken) {
        setAdmin(null);
        return null;
      }

      const result = await checkAdminSession({ data: { adminToken: accessToken } });
      const nextAdmin = { accessToken, email: result.email };
      setAdmin(nextAdmin);
      return nextAdmin;
    } catch {
      setAdmin(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
    setAdmin(null);
  }, []);

  useEffect(() => {
    void refresh();

    if (!supabase) return undefined;

    const { data } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });

    return () => data.subscription.unsubscribe();
  }, [refresh]);

  return {
    admin,
    accessToken: admin?.accessToken ?? "",
    isAdmin: Boolean(admin),
    isLoading,
    refresh,
    signOut,
  };
}

