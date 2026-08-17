import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedEmail = localStorage.getItem('user_email');
    if (token && savedEmail) {
      setUser({ email: savedEmail });
    }
    setLoading(false);
  }, [token]);

  const loginUser = (accessToken, email) => {
    localStorage.setItem('token', accessToken);
    localStorage.setItem('user_email', email);
    setToken(accessToken);
    setUser({ email });
  };

  const logoutUser = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user_email');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, loginUser, logoutUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
