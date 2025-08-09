import { useState, useEffect, useMemo } from 'react';
import { onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, signOut } from "firebase/auth";

const ADMIN_UID = "mbCAypsn8AQ2lmISGRMpD6DzhTZ2";

/**
 * @description 管理使用者認證的 Hook
 * @param {object} auth - Firebase Auth 的實例
 * @returns {object} - 包含使用者、管理員狀態、登入和登出函數
 */
export function useAuth(auth) {
  const [user, setUser] = useState(null);
  
  // 監聽 Firebase 認證狀態的變化
  useEffect(() => {
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      // 如果使用者未登入，則自動以匿名方式登入
      if (!currentUser) {
        signInAnonymously(auth).catch(error => 
          console.error("Anonymous sign-in failed:", error)
        );
      }
    });

    return () => unsubscribe();
  }, [auth]);

  const isAdmin = useMemo(() => user?.uid === ADMIN_UID, [user]);

  const handleLogin = async (email, password) => {
    if (!auth) return false;
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return true;
    } catch (error) {
      console.error("Login failed:", error.message);
      return false;
    }
  };

  const handleLogout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return { user, isAdmin, handleLogin, handleLogout };
}
