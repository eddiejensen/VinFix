import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, type AuthUser } from "../api/client";
import { CLOUD_DATA_RESTORE_EVENT, LOCAL_DATA_SYNC_EVENT, readLocalArray, STORAGE_KEYS, writeLocalArray } from "../utils/localData";

interface AuthContextValue {
  user: AuthUser | null;
  sessionToken: string;
  loading: boolean;
  error: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  syncNow: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const SESSION_STORAGE_KEY = "autovinfix:sessionToken";

function collectLocalData() {
  return {
    garage: readLocalArray(STORAGE_KEYS.garage),
    repairHistory: readLocalArray(STORAGE_KEYS.repairHistory),
    todos: readLocalArray(STORAGE_KEYS.todos),
    diagnosticNotes: readLocalArray(STORAGE_KEYS.diagnosticNotes),
  };
}

function restoreLocalData(data: Record<string, unknown>) {
  if (Array.isArray(data.garage)) writeLocalArray(STORAGE_KEYS.garage, data.garage);
  if (Array.isArray(data.repairHistory)) writeLocalArray(STORAGE_KEYS.repairHistory, data.repairHistory);
  if (Array.isArray(data.todos)) writeLocalArray(STORAGE_KEYS.todos, data.todos);
  if (Array.isArray(data.diagnosticNotes)) writeLocalArray(STORAGE_KEYS.diagnosticNotes, data.diagnosticNotes);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [sessionToken, setSessionToken] = useState(() => localStorage.getItem(SESSION_STORAGE_KEY) || "");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(Boolean(sessionToken));
  const [error, setError] = useState("");
  const syncTimer = useRef<number | null>(null);
  const restoring = useRef(false);

  const saveLocalDataToCloud = useCallback(async (token = sessionToken) => {
    if (!token || restoring.current) return;
    await api.saveAccountData(token, collectLocalData());
  }, [sessionToken]);

  const loadCloudData = useCallback(async (token: string) => {
    const response = await api.getAccountData(token);
    const data = response.data || {};
    const hasCloudData = Object.values(data).some((value) => Array.isArray(value) && value.length > 0);

    if (hasCloudData) {
      restoring.current = true;
      restoreLocalData(data);
      restoring.current = false;
      window.dispatchEvent(new CustomEvent(CLOUD_DATA_RESTORE_EVENT));
    } else {
      await api.saveAccountData(token, collectLocalData());
    }
  }, []);

  useEffect(() => {
    if (!sessionToken) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    api.getSession(sessionToken)
      .then(async (session) => {
        if (cancelled) return;
        setUser(session.user);
        await loadCloudData(session.sessionToken);
      })
      .catch(() => {
        if (cancelled) return;
        localStorage.removeItem(SESSION_STORAGE_KEY);
        setSessionToken("");
        setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loadCloudData, sessionToken]);

  useEffect(() => {
    function scheduleSync() {
      if (!sessionToken || !user || restoring.current) return;
      if (syncTimer.current) window.clearTimeout(syncTimer.current);
      syncTimer.current = window.setTimeout(() => {
        saveLocalDataToCloud().catch(() => undefined);
      }, 600);
    }

    window.addEventListener(LOCAL_DATA_SYNC_EVENT, scheduleSync);
    return () => window.removeEventListener(LOCAL_DATA_SYNC_EVENT, scheduleSync);
  }, [saveLocalDataToCloud, sessionToken, user]);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await api.login(email, password);
      localStorage.setItem(SESSION_STORAGE_KEY, response.sessionToken);
      setSessionToken(response.sessionToken);
      setUser(response.user);
      await loadCloudData(response.sessionToken);
    } catch {
      setError("Could not log in. Check the email and password.");
      throw new Error("login failed");
    } finally {
      setLoading(false);
    }
  }, [loadCloudData]);

  const logout = useCallback(async () => {
    const token = sessionToken;
    setSessionToken("");
    setUser(null);
    localStorage.removeItem(SESSION_STORAGE_KEY);
    if (token) {
      await api.logout(token).catch(() => undefined);
    }
  }, [sessionToken]);

  const syncNow = useCallback(async () => {
    await saveLocalDataToCloud();
  }, [saveLocalDataToCloud]);

  const value = useMemo(
    () => ({ user, sessionToken, loading, error, login, logout, syncNow }),
    [error, loading, login, logout, sessionToken, syncNow, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
