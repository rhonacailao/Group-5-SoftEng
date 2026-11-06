import { create } from "zustand";
import { api } from "../lib/api";
import type { User } from "../lib/api";

// ---------------------------------------------------------------------------
// Demo account: lets anyone jump into the dashboard without the back end or a
// database user. It is checked in the browser only, so REMOVE IT before going
// live (or set VITE_DEMO_LOGIN=off in frontend/.env to turn it off).
// ---------------------------------------------------------------------------
export const DEMO_ENABLED = import.meta.env.VITE_DEMO_LOGIN !== "off";
export const DEMO_EMAIL = "user@outlook.com";
export const DEMO_PASSWORD = "12345abcde";
const DEMO_KEY = "hope_demo_session";
const demoUser: User = { id: 0, firstName: "Demo", lastName: "User", email: DEMO_EMAIL, role: "admin" };

const isDemoActive = () => {
  try {
    return sessionStorage.getItem(DEMO_KEY) === "1";
  } catch {
    return false;
  }
};
const setDemoActive = (on: boolean) => {
  try {
    if (on) sessionStorage.setItem(DEMO_KEY, "1");
    else sessionStorage.removeItem(DEMO_KEY);
  } catch {
    /* storage blocked: the demo session just won't survive a refresh */
  }
};

type Status = "unknown" | "authenticated" | "guest";

type AuthState = {
  user: User | null;
  status: Status;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  status: "unknown",

  // Throws an ApiError when the back end says no (wrong password, pending, blocked...)
  login: async (email, password) => {
    if (DEMO_ENABLED && email.trim().toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD) {
      setDemoActive(true);
      set({ user: demoUser, status: "authenticated" });
      return;
    }
    const { user } = await api<{ ok: true; user: User }>("/api/auth/login", {
      body: { email, password },
    });
    setDemoActive(false);
    set({ user, status: "authenticated" });
  },

  logout: async () => {
    const wasDemo = isDemoActive();
    setDemoActive(false);
    if (!wasDemo) {
      try {
        await api("/api/auth/logout", { method: "POST" });
      } catch {
        /* even if the call fails, we still log out on this device */
      }
    }
    set({ user: null, status: "guest" });
  },

  // Asks the back end "who am I?" once, when a protected page first loads
  checkSession: async () => {
    if (get().status !== "unknown") return;
    if (isDemoActive()) {
      set({ user: demoUser, status: "authenticated" });
      return;
    }
    try {
      const { user } = await api<{ ok: true; user: User }>("/api/auth/me");
      set({ user, status: "authenticated" });
    } catch {
      set({ user: null, status: "guest" });
    }
  },
}));
