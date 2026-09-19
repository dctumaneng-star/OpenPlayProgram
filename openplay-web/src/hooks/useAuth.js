import { useState } from 'react';
import axios from 'axios';
import { API_URL } from '../api/config';

export function useAuth() {
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [username, setUsername] = useState(localStorage.getItem('username') || '');

  const saveAuth = (data) => {
    setToken(data.token);
    setUsername(data.username);
    localStorage.setItem('token', data.token);
    localStorage.setItem('username', data.username);
  };

  const handleLogout = () => {
    setToken(null);
    setUsername('');
    localStorage.removeItem('token');
    localStorage.removeItem('username');
  };

  const handleLogin = async ({ username: u, password }) => {
    const res = await axios.post(`${API_URL}/api/login`, { username: u, password });
    saveAuth(res.data);
  };

  const handleSignup = async ({ email, username: u, password }) => {
    await axios.post(`${API_URL}/api/signup`, { email, username: u, password });
  };

  const handleGoogleAuth = async (credential) => {
    const res = await axios.post(`${API_URL}/api/google-auth`, { credential });
    saveAuth(res.data);
  };

  return { token, username, handleLogin, handleSignup, handleGoogleAuth, handleLogout };
}
