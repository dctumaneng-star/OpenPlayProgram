import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { GoogleLogin } from '@react-oauth/google';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import './index.css';

const API_URL = "https://opfintracker-backend.vercel.app";

// ─── Theme Hook ────────────────────────────────────────────────────────────
function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'system');

  const applyTheme = useCallback((t) => {
    const root = document.documentElement;
    if (t === 'dark') {
      root.classList.add('dark');
    } else if (t === 'light') {
      root.classList.remove('dark');
    } else {
      // system
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    }
  }, []);

  useEffect(() => {
    applyTheme(theme);
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e) => applyTheme('system');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [theme, applyTheme]);

  const cycleTheme = () => {
    const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    localStorage.setItem('theme', next);
    setTheme(next);
  };

  const icon = theme === 'light' ? '☀️' : theme === 'dark' ? '🌙' : '💻';
  const label = theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'System';

  return { theme, cycleTheme, icon, label };
}

// ─── Stat Card ─────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }) {
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-1 ${color}`}>
      <span className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</span>
      <span className="text-2xl font-bold">{value}</span>
      {sub && <span className="text-xs opacity-60">{sub}</span>}
    </div>
  );
}

// ─── App ───────────────────────────────────────────────────────────────────
function App() {
  const { theme, cycleTheme, icon, label } = useTheme();
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [username, setUsername] = useState(localStorage.getItem('username') || '');
  const [records, setRecords] = useState([]);
  const [exportStatus, setExportStatus] = useState('idle'); // idle | loading | success | error

  // Auth Form State
  const [isLogin, setIsLogin] = useState(true);
  const [authForm, setAuthForm] = useState({ email: '', username: '', password: '' });

  // Entry Form State
  const [entryForm, setEntryForm] = useState({
    court_name: '', returning_players: 0, new_players: 0,
    court_fee_rev: 0, misc_rev: 0, base_cost: 0, losses: 0,
  });

  useEffect(() => {
    if (token) fetchRecords();
  }, [token]);

  const saveAuth = (data) => {
    setToken(data.token);
    setUsername(data.username);
    localStorage.setItem('token', data.token);
    localStorage.setItem('username', data.username);
  };

  // ── Standard login / signup ──
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isLogin) {
        const res = await axios.post(`${API_URL}/api/login`, {
          username: authForm.username,
          password: authForm.password,
        });
        saveAuth(res.data);
      } else {
        await axios.post(`${API_URL}/api/signup`, authForm);
        alert('Signup successful! Please login.');
        setIsLogin(true);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Authentication failed');
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const res = await axios.post(`${API_URL}/api/google-auth`, {
        credential: credentialResponse.credential,
      });
      saveAuth(res.data);
    } catch (err) {
      alert(err.response?.data?.error || 'Google login failed');
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUsername('');
    localStorage.removeItem('token');
    localStorage.removeItem('username');
  };

  const fetchRecords = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/open-plays`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRecords(res.data);
    } catch (err) {
      console.error('Failed to fetch records', err);
    }
  };

  const handleEntrySubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/open-plays`, entryForm, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setEntryForm({
        court_name: '', returning_players: 0, new_players: 0,
        court_fee_rev: 0, misc_rev: 0, base_cost: 0, losses: 0,
      });
      fetchRecords();
    } catch (err) {
      alert('Error adding record');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this record?')) return;
    try {
      await axios.delete(`${API_URL}/api/open-plays/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchRecords();
    } catch (err) {
      alert('Error deleting record');
    }
  };

  // ── Export to Google Sheets ──
  const exportToSheets = useGoogleLogin({
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    onSuccess: async (tokenResponse) => {
      setExportStatus('loading');
      try {
        const accessToken = tokenResponse.access_token;

        // 1. Create a new spreadsheet
        const createRes = await axios.post(
          'https://sheets.googleapis.com/v4/spreadsheets',
          {
            properties: { title: `Open Play Finance Tracker — ${username}` },
            sheets: [{ properties: { title: 'Records' } }],
          },
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const spreadsheetId = createRes.data.spreadsheetId;
        const spreadsheetUrl = createRes.data.spreadsheetUrl;

        // 2. Build header + rows
        const headers = [
          'Record ID', 'Court Name', 'Returning Players', 'New Players',
          'Total Players', 'Court Fee Rev (₱)', 'Misc Rev (₱)',
          'Base Cost (₱)', 'Losses (₱)', 'Net Revenue (₱)',
        ];
        const rows = records.map((r) => {
          const net = (r.court_fee_rev + r.misc_rev) - (r.base_cost + r.losses);
          return [
            r.id, r.court_name, r.returning_players, r.new_players,
            r.returning_players + r.new_players,
            r.court_fee_rev, r.misc_rev, r.base_cost, r.losses,
            parseFloat(net.toFixed(2)),
          ];
        });

        // 3. Fill data into the sheet
        await axios.put(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Records!A1?valueInputOption=RAW`,
          { values: [headers, ...rows] },
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        // 4. Bold the header row
        await axios.post(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
          {
            requests: [
              {
                repeatCell: {
                  range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
                  cell: {
                    userEnteredFormat: {
                      textFormat: { bold: true },
                      backgroundColor: { red: 0.9, green: 0.9, blue: 0.95 },
                    },
                  },
                  fields: 'userEnteredFormat(textFormat,backgroundColor)',
                },
              },
              { autoResizeDimensions: { dimensions: { sheetId: 0, dimension: 'COLUMNS', startIndex: 0, endIndex: 10 } } },
            ],
          },
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        setExportStatus('success');
        window.open(spreadsheetUrl, '_blank');
        setTimeout(() => setExportStatus('idle'), 4000);
      } catch (err) {
        console.error('Sheets export error:', err.response?.data || err.message);
        setExportStatus('error');
        setTimeout(() => setExportStatus('idle'), 4000);
      }
    },
    onError: () => {
      setExportStatus('error');
      setTimeout(() => setExportStatus('idle'), 4000);
    },
  });

  // ── Chart data ──
  const revenueChartData = records.map((r, i) => ({
    name: r.court_name || `#${r.id}`,
    'Court Fee': parseFloat(r.court_fee_rev) || 0,
    'Misc Rev': parseFloat(r.misc_rev) || 0,
    'Base Cost': parseFloat(r.base_cost) || 0,
    'Losses': parseFloat(r.losses) || 0,
    'Net Revenue': parseFloat(((r.court_fee_rev + r.misc_rev) - (r.base_cost + r.losses)).toFixed(2)),
  }));

  const playerChartData = records.map((r) => ({
    name: r.court_name || `#${r.id}`,
    Returning: r.returning_players || 0,
    New: r.new_players || 0,
  }));

  const playerPieData = [
    {
      name: 'Returning',
      value: records.reduce((s, r) => s + (r.returning_players || 0), 0),
    },
    {
      name: 'New',
      value: records.reduce((s, r) => s + (r.new_players || 0), 0),
    },
  ];

  const totalRevenue = records.reduce((s, r) => s + (r.court_fee_rev || 0) + (r.misc_rev || 0), 0);
  const totalCost = records.reduce((s, r) => s + (r.base_cost || 0) + (r.losses || 0), 0);
  const totalNet = totalRevenue - totalCost;
  const totalPlayers = records.reduce((s, r) => s + (r.returning_players || 0) + (r.new_players || 0), 0);

  const PIE_COLORS = ['#6366f1', '#f59e0b'];
  const BAR_COLORS = { net: '#6366f1', positive: '#10b981', negative: '#ef4444' };

  // ── Shared input class ──
  const inp = 'w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400';
  const lbl = 'block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1';

  // ─── Auth View ─────────────────────────────────────────────────────────
  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col justify-center items-center p-4 transition-colors">
        {/* Theme toggle top-right */}
        <button
          onClick={cycleTheme}
          className="fixed top-4 right-4 p-2 rounded-full bg-white dark:bg-gray-800 shadow border border-gray-200 dark:border-gray-700 text-sm hover:scale-110 transition-transform"
          title={`Current: ${label} — click to change`}
        >
          {icon}
        </button>

        <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800 p-8 transition-colors">
          <h2 className="text-2xl font-bold text-center text-gray-800 dark:text-gray-100 mb-6">
            🏸 Open Play Finance Tracker
          </h2>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
            <button
              className={`flex-1 py-2 text-sm font-semibold transition-colors ${isLogin ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              onClick={() => setIsLogin(true)}
            >
              🔑 Login
            </button>
            <button
              className={`flex-1 py-2 text-sm font-semibold transition-colors ${!isLogin ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              onClick={() => setIsLogin(false)}
            >
              📝 Sign Up
            </button>
          </div>

          {/* Google SSO */}
          <div className="mb-4 flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => alert('Google login failed. Check your OAuth configuration.')}
              useOneTap
              theme={theme === 'dark' ? 'filled_black' : 'outline'}
              text="continue_with"
              shape="rectangular"
              size="large"
            />
          </div>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
            <span className="text-xs text-gray-400 dark:text-gray-500">or</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
          </div>

          {/* Standard form */}
          <form onSubmit={handleAuthSubmit} className="flex flex-col gap-3">
            {!isLogin && (
              <input
                type="email" placeholder="Email Address" required
                className={inp}
                onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
              />
            )}
            <input
              type="text" placeholder="Username" required
              className={inp}
              onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
            />
            <input
              type="password" placeholder="Password" required
              className={inp}
              onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
            />
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors mt-1"
            >
              {isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ─── Dashboard View ────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans transition-colors">

      {/* ── Sidebar ── */}
      <aside className="w-72 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 h-full overflow-y-auto p-5 flex flex-col shrink-0">
        <h3 className="font-bold text-base mb-5 text-gray-800 dark:text-gray-100">📝 New Open Play Record</h3>

        <form onSubmit={handleEntrySubmit} className="flex flex-col gap-3 text-sm">
          <div>
            <label className={lbl}>Court Name</label>
            <input
              type="text" placeholder="e.g., Court A" required
              className={inp}
              value={entryForm.court_name}
              onChange={(e) => setEntryForm({ ...entryForm, court_name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={lbl}>Returning</label>
              <input type="number" min="0" className={inp} value={entryForm.returning_players}
                onChange={(e) => setEntryForm({ ...entryForm, returning_players: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <label className={lbl}>New Players</label>
              <input type="number" min="0" className={inp} value={entryForm.new_players}
                onChange={(e) => setEntryForm({ ...entryForm, new_players: parseInt(e.target.value) || 0 })} />
            </div>
          </div>

          <div>
            <label className={lbl}>Court Fee Revenue (₱)</label>
            <input type="number" min="0" step="50" className={inp} value={entryForm.court_fee_rev}
              onChange={(e) => setEntryForm({ ...entryForm, court_fee_rev: parseFloat(e.target.value) || 0 })} />
          </div>

          <div>
            <label className={lbl}>Misc Revenue (₱)</label>
            <input type="number" min="0" step="10" className={inp} value={entryForm.misc_rev}
              onChange={(e) => setEntryForm({ ...entryForm, misc_rev: parseFloat(e.target.value) || 0 })} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={lbl}>Base Cost (₱)</label>
              <input type="number" min="0" step="50" className={inp} value={entryForm.base_cost}
                onChange={(e) => setEntryForm({ ...entryForm, base_cost: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label className={lbl}>Losses (₱)</label>
              <input type="number" min="0" step="10" className={inp} value={entryForm.losses}
                onChange={(e) => setEntryForm({ ...entryForm, losses: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>

          {/* Preview net */}
          <div className="text-xs text-center py-1 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono">
            Net preview: ₱{((entryForm.court_fee_rev + entryForm.misc_rev) - (entryForm.base_cost + entryForm.losses)).toLocaleString()}
          </div>

          <button
            type="submit"
            className="mt-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Add Record
          </button>
        </form>

        {/* Bottom actions */}
        <div className="mt-auto pt-6 flex flex-col gap-2">
          <button
            onClick={cycleTheme}
            className="w-full flex items-center justify-center gap-2 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {icon} {label} Mode
          </button>
          <button
            onClick={handleLogout}
            className="w-full py-2 text-sm text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 h-full overflow-y-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            🏸 Open Play Finance Tracker
            <span className="ml-2 text-base font-normal text-gray-400 dark:text-gray-500">— {username}</span>
          </h1>

          {/* Export to Sheets */}
          <button
            onClick={() => exportToSheets()}
            disabled={records.length === 0 || exportStatus === 'loading'}
            className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg border transition-all shadow-sm
              ${exportStatus === 'success' ? 'bg-green-100 dark:bg-green-900 border-green-400 text-green-700 dark:text-green-300' :
                exportStatus === 'error' ? 'bg-red-100 dark:bg-red-900 border-red-400 text-red-700 dark:text-red-300' :
                exportStatus === 'loading' ? 'opacity-60 cursor-wait bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300' :
                records.length === 0 ? 'opacity-40 cursor-not-allowed bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400' :
                'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-green-500 hover:text-green-600 dark:hover:text-green-400'}`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
            {exportStatus === 'loading' ? 'Exporting…' :
             exportStatus === 'success' ? '✓ Sheet Created!' :
             exportStatus === 'error' ? 'Export Failed' :
             'Export to Google Sheets'}
          </button>
        </div>

        {/* ── Summary Stats ── */}
        {records.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard
              label="Sessions"
              value={records.length}
              sub="total records"
              color="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100"
            />
            <StatCard
              label="Total Players"
              value={totalPlayers}
              sub={`${playerPieData[0].value} returning · ${playerPieData[1].value} new`}
              color="bg-indigo-50 dark:bg-indigo-950 border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-200"
            />
            <StatCard
              label="Total Revenue"
              value={`₱${totalRevenue.toLocaleString()}`}
              sub="gross income"
              color="bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
            />
            <StatCard
              label="Net Revenue"
              value={`₱${totalNet.toLocaleString()}`}
              sub={totalNet >= 0 ? 'profitable 🎉' : 'at a loss ⚠️'}
              color={totalNet >= 0
                ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
                : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'}
            />
          </div>
        )}

        {records.length === 0 ? (
          <div className="bg-indigo-50 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 p-5 rounded-xl border border-indigo-200 dark:border-indigo-800">
            👈 No data yet. Use the sidebar to log your first open play session.
          </div>
        ) : (
          <>
            {/* ── Charts ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

              {/* Net Revenue bar chart */}
              <div className="lg:col-span-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm">
                <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-4">💰 Net Revenue per Session</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={revenueChartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₱${v}`} />
                    <Tooltip
                      formatter={(value) => [`₱${Number(value).toLocaleString()}`, undefined]}
                      contentStyle={{
                        backgroundColor: 'var(--tooltip-bg, #fff)',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="Court Fee" stackId="rev" fill="#6366f1" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Misc Rev" stackId="rev" fill="#818cf8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Base Cost" stackId="cost" fill="#fbbf24" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Losses" stackId="cost" fill="#f87171" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Player type pie */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm">
                <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-4">👥 Player Breakdown</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={playerPieData}
                      cx="50%" cy="50%"
                      innerRadius={55} outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {playerPieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => [v, 'Players']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Players per session bar chart */}
              <div className="lg:col-span-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm">
                <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-4">🏃 Players per Session</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={playerChartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="Returning" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="New" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── Data Table ── */}
            <h2 className="text-base font-semibold mb-3 text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 pb-2">
              📋 Records
            </h2>
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left">ID</th>
                    <th className="px-4 py-3 text-left">Court</th>
                    <th className="px-4 py-3 text-right">Returning</th>
                    <th className="px-4 py-3 text-right">New</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Revenue (₱)</th>
                    <th className="px-4 py-3 text-right">Cost (₱)</th>
                    <th className="px-4 py-3 text-right">Net (₱)</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
                  {records.map((r) => {
                    const totalP = r.returning_players + r.new_players;
                    const rev = (r.court_fee_rev || 0) + (r.misc_rev || 0);
                    const cost = (r.base_cost || 0) + (r.losses || 0);
                    const net = rev - cost;
                    return (
                      <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-3 text-gray-400 dark:text-gray-500 font-mono">{r.id}</td>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{r.court_name}</td>
                        <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">{r.returning_players}</td>
                        <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">{r.new_players}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">{totalP}</td>
                        <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">{rev.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-amber-600 dark:text-amber-400">{cost.toLocaleString()}</td>
                        <td className={`px-4 py-3 text-right font-semibold ${net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                          {net >= 0 ? '' : '−'}₱{Math.abs(net).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleDelete(r.id)}
                            className="text-red-400 hover:text-red-600 dark:hover:text-red-300 text-xs font-medium px-2 py-1 rounded border border-transparent hover:border-red-200 dark:hover:border-red-800 transition-colors"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;