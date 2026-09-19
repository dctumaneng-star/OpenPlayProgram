import { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { INPUT_CLS } from '../utils/helpers';

export default function AuthView({ theme, icon, cycleTheme, label, onLogin, onSignup, onGoogleSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ email: '', username: '', password: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isLogin) {
        await onLogin({ username: form.username, password: form.password });
      } else {
        await onSignup(form);
        alert('Signup successful! Please login.');
        setIsLogin(true);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Authentication failed');
    }
  };

  const handleGoogle = async (credentialResponse) => {
    try {
      await onGoogleSuccess(credentialResponse.credential);
    } catch (err) {
      alert(err.response?.data?.error || 'Google login failed');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-900 flex justify-center items-center p-4 md:p-12 transition-colors">
      {/* Theme toggle */}
      <button
        onClick={cycleTheme}
        className="fixed top-4 right-4 p-2 rounded-full bg-white dark:bg-neutral-800 shadow border border-neutral-200 dark:border-neutral-700 text-sm hover:scale-110 transition-transform z-10"
        title={`Current: ${label} — click to change`}
      >
        {icon}
      </button>

      <div className="max-w-6xl w-full flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-24">

        {/* Left — description */}
        <div className="flex-1 text-center lg:text-left max-w-2xl">
          <h1 className="text-4xl lg:text-6xl font-extrabold text-blue-700 dark:text-blue-400 mb-6 tracking-tight">
            The Bottom Baseline
          </h1>
          <p className="text-lg text-neutral-700 dark:text-neutral-300 mb-6 leading-relaxed">
            The Bottom Baseline is a web application custom-built to completely automate financial
            tracking and player management for court organizers. Designed to eliminate manual
            spreadsheet calculations, it is the perfect solution for streamlining weekly badminton
            sessions, pickleball meetups, and other open play events into a clean, mobile-friendly
            dashboard.
          </p>
          <p className="text-base text-neutral-600 dark:text-neutral-400 mb-8 leading-relaxed">
            Feedback, bug reports, and collaboration ideas are welcome while the app is in the
            testing stage.
          </p>
          <div className="text-sm font-medium text-neutral-500 dark:text-neutral-400 bg-white/50 dark:bg-neutral-800/50 inline-block px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700">
            Created by:{' '}
            <span className="text-neutral-800 dark:text-neutral-200 font-bold">
              poochie (Daryl Tumaneng)
            </span>
          </div>
        </div>

        {/* Right — login card */}
        <div className="max-w-md w-full bg-white dark:bg-neutral-800 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-700 p-8 transition-colors shrink-0">
          <h2 className="text-2xl font-bold text-center text-neutral-900 dark:text-neutral-100 mb-6">
            🏸 Open Play Finance Tracker
          </h2>

          {/* Tabs */}
          <div className="flex border-b border-neutral-200 dark:border-neutral-700 mb-6">
            <button
              className={`flex-1 py-2 text-sm font-semibold transition-colors ${isLogin ? 'text-blue-700 border-b-2 border-blue-700' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'}`}
              onClick={() => setIsLogin(true)}
            >
              🔑 Login
            </button>
            <button
              className={`flex-1 py-2 text-sm font-semibold transition-colors ${!isLogin ? 'text-blue-700 border-b-2 border-blue-700' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'}`}
              onClick={() => setIsLogin(false)}
            >
              📝 Sign Up
            </button>
          </div>

          {/* Google SSO */}
          <div className="mb-4 flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogle}
              onError={() => alert('Google login failed. Check your OAuth configuration.')}
              useOneTap
              theme={theme === 'dark' ? 'filled_black' : 'outline'}
              text="continue_with"
              shape="rectangular"
              size="large"
            />
          </div>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
            <span className="text-xs text-neutral-400 dark:text-neutral-500">or</span>
            <div className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
          </div>

          {/* Standard form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {!isLogin && (
              <input
                type="email"
                placeholder="Email Address"
                required
                className={INPUT_CLS}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            )}
            <input
              type="text"
              placeholder="Username"
              required
              className={INPUT_CLS}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
            <input
              type="password"
              placeholder="Password"
              required
              className={INPUT_CLS}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <button
              type="submit"
              className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors mt-1"
            >
              {isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

