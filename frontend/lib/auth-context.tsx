'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { authAPI } from '@/lib/api';
import {
  auth as firebaseAuth,
  googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
} from '@/lib/firebase';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  organization?: string;
  is_first_login: boolean;
}

interface RegisterData {
  email: string;
  password: string;
  full_name: string;
  organization?: string;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: RegisterData) => Promise<User>;
  loginWithFirebase: (email: string, password: string) => Promise<User>;
  registerWithFirebase: (data: RegisterData) => Promise<User>;
  loginWithGoogle: (role?: string) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  async function refresh() {
    try {
      const r = await authAPI.me();
      setUser(r.data);
    } catch {
      setUser(null);
    }
  }

  // Standard API login with email & password
  async function login(email: string, password: string): Promise<User> {
    try {
      const r = await authAPI.login({ email, password });
      const { access_token, user: userData } = r.data;
      localStorage.setItem('access_token', access_token);
      setUser(userData);
      return userData;
    } catch (err) {
      // Fallback: try Firebase email/password if direct backend user does not match
      try {
        return await loginWithFirebase(email, password);
      } catch {
        throw err;
      }
    }
  }

  // Standard API registration
  async function register(data: RegisterData): Promise<User> {
    const regRes = await authAPI.register(data);
    // Auto-login after registration
    const r = await authAPI.login({ email: data.email, password: data.password });
    const { access_token, user: userData } = r.data;
    localStorage.setItem('access_token', access_token);
    setUser(userData);
    return userData;
  }

  // Firebase Email/Password Sign-in
  async function loginWithFirebase(email: string, password: string): Promise<User> {
    const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
    const fbUser = userCredential.user;

    // Sync with EcoSentinel backend session
    const r = await authAPI.firebaseLogin({
      email: fbUser.email || email,
      full_name: fbUser.displayName || undefined,
      firebase_uid: fbUser.uid,
    });

    const { access_token, user: userData } = r.data;
    localStorage.setItem('access_token', access_token);
    setUser(userData);
    return userData;
  }

  // Firebase Email/Password Registration with custom role selection
  async function registerWithFirebase(data: RegisterData): Promise<User> {
    let fbUid = '';
    try {
      const userCredential = await createUserWithEmailAndPassword(firebaseAuth, data.email, data.password);
      fbUid = userCredential.user.uid;
    } catch (fbErr: any) {
      // If user already exists in Firebase, sign in to link
      if (fbErr?.code === 'auth/email-already-in-use') {
        const cred = await signInWithEmailAndPassword(firebaseAuth, data.email, data.password);
        fbUid = cred.user.uid;
      } else {
        throw fbErr;
      }
    }

    // Sync with EcoSentinel backend & save role
    const r = await authAPI.firebaseLogin({
      email: data.email,
      full_name: data.full_name,
      organization: data.organization,
      role: data.role || 'applicant',
      firebase_uid: fbUid,
    });

    const { access_token, user: userData } = r.data;
    localStorage.setItem('access_token', access_token);
    setUser(userData);
    return userData;
  }

  // Firebase Google OAuth Sign-in / Sign-up
  async function loginWithGoogle(role: string = 'applicant'): Promise<User> {
    const result = await signInWithPopup(firebaseAuth, googleProvider);
    const fbUser = result.user;

    const r = await authAPI.firebaseLogin({
      email: fbUser.email!,
      full_name: fbUser.displayName || undefined,
      role: role,
      firebase_uid: fbUser.uid,
    });

    const { access_token, user: userData } = r.data;
    localStorage.setItem('access_token', access_token);
    setUser(userData);
    return userData;
  }

  async function logout() {
    try {
      await firebaseSignOut(firebaseAuth);
    } catch {}
    await authAPI.logout().catch(() => {});
    localStorage.removeItem('access_token');
    setUser(null);
    window.location.href = '/login';
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        loginWithFirebase,
        registerWithFirebase,
        loginWithGoogle,
        logout,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
