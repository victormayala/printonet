import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const applySession = (nextSession: Session | null, forceSessionUpdate = false) => {
    setSession((currentSession) => {
      const currentUserId = currentSession?.user?.id ?? null;
      const nextUserId = nextSession?.user?.id ?? null;
      return forceSessionUpdate || currentUserId !== nextUserId ? nextSession : currentSession;
    });
    setUser((currentUser) => {
      const nextUser = nextSession?.user ?? null;
      return currentUser?.id === nextUser?.id ? currentUser : nextUser;
    });
    setLoading(false);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        applySession(session, event !== "SIGNED_IN" && event !== "TOKEN_REFRESHED");
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session, true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({ user, session, loading, signOut }),
    [user, session, loading, signOut],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
