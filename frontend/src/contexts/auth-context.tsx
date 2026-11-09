"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signOut,
  type User,
} from "firebase/auth";

import { auth } from "@/lib/firebase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
      if (typeof document !== "undefined") {
        if (firebaseUser) {
          document.cookie = "orderly_logged_in=true; path=/; max-age=604800; SameSite=Lax";
        } else {
          document.cookie = "orderly_logged_in=; path=/; max-age=0; SameSite=Lax";
        }
      }
    });

    return unsubscribe;
  }, []);

  const logout = async () => {
    if (typeof document !== "undefined") {
      document.cookie = "orderly_logged_in=; path=/; max-age=0; SameSite=Lax";
    }
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
