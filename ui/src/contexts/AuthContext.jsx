import { createContext, useState, useEffect } from 'react';
import { auth } from '../services/auth.js';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    try {
      const currentUser = await auth.getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
      }
    } catch (e) {
      // not authenticated
    } finally {
      setLoading(false);
    }
  }

  async function handleSignIn({ username, password }) {
    const result = await auth.signIn({ username, password });
    const currentUser = await auth.getCurrentUser();
    setUser(currentUser);
    return result;
  }

  async function handleSignUp({ username, password, options }) {
    return auth.signUp({ username, password, options });
  }

  async function handleConfirmSignUp({ username, confirmationCode }) {
    return auth.confirmSignUp({ username, confirmationCode });
  }

  async function handleSignOut() {
    await auth.signOut();
    setUser(null);
  }

  const value = {
    user,
    loading,
    signIn: handleSignIn,
    signUp: handleSignUp,
    confirmSignUp: handleConfirmSignUp,
    signOut: handleSignOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
