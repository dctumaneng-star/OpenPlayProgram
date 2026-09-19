import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { GoogleLogin, useGoogleLogin } from '@react-oauth/google';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import './index.css';

const API_URL = "https://open-play-program.vercel.app";

// ─── Helpers ────────────────────────────────────────────────────────────────
const n = (v) => parseFloat(v) || 0; // safe numeric parse

// ─── Theme Hook ──────────────────────────────────────────────────────────────
function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'system');

  const applyTheme = useCallback((t) => {
    const root = document.documentElement;
    if (t === 'dark') root.classList.add('dark');
    else if (t === 'light') root.classList.remove('dark');
    else root.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches);
  }, []);

  useEffect(() => {
    applyTheme(theme);
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme('system');
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

// ─── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }) {
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-1 ${color}`}>
      <span className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</span>
      <span className="text-2xl font-bold">{value}</span>
      {sub && <span className="text-xs opacity-60">{sub}</span>}
    </div>
  );
}

// ─── Loss Item Row ────────────────────────────────────────────────────────────
function LossItemRow({ item, onChange, onRemove, inputCls }) {
  return (
    <div className="flex gap-1 items-center">
      <input
        type="text"
        placeholder="Description"
        className={`${inputCls} flex-1`}
        value={item.description}
        onChange={(e) => onChange({ ...item, description: e.target.value })}
      />
      <input
        type="number"
        min="0"
        step="10"
        placeholder="₱"
        className={`${inputCls} w-20`}
        value={item.cost}
        onChange={(e) => onChange({ ...item, cost: parseFloat(e.target.value) || 0 })}
      />
      <button
        type="button"
        onClick={onRemove}
        className="text-red-400 hover:text-red-600 text-lg leading-none px-1"
      >×</button>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
function App() {
  const { theme, cycleTheme, icon, label } = useTheme();
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [username, setUsername] = useState(localStorage.getItem('username') || '');
  const [records, setRecords] = useState([]);
  const [exportStatus, setExportStatus] = useState('idle');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null); // id of expanded record

  // Auth form
  const [isLogin, setIsLogin] = useState(true);
  const [authForm, setAuthForm] = useState({ email: '', username: '', password: '' });

  // Empty loss item template
  const newItem = (type) => ({ item_type: type, description: '', cost: 0 });

  // Entry form
  const emptyForm = {
    court_name: '',
    returning_players: 0,
    new_players: 0,
    court_fee_rev: 0,
    misc_rev: 0,
    base_cost: 0,
    procuredItems: [],   // [{item_type:'procured', description, cost}]
    incidentItems: [],   // [{item_type:'incident', description, cost}]
  };
  const [entryForm, setEntryForm] = useState(emptyForm);

  useEffect(() => { if (token) fetchRecords(); }, [token]);

  const saveAuth = (data) => {
    setToken(data.token);
    setUsername(data.username);
    localStorage.setItem('token', data.token);
    localStorage.setItem('username', data.username);
  };

  // ── Standard auth ──
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

  // ── Derived calculations for a record ──
  const calcRecord = (r) => {
    const grossRev = n(r.court_fee_rev) + n(r.misc_rev);
    const totalCost = n(r.base_cost) + n(r.procured_costs) + n(r.losses);
    const netRev = grossRev - totalCost;
    const totalPlayers = (r.returning_players || 0) + (r.new_players || 0);
    return { grossRev, totalCost, netRev, totalPlayers };
  };

  // ── Derived calculations for form preview ──
  const formProcuredTotal = entryForm.procuredItems.reduce((s, i) => s + n(i.cost), 0);
  const formIncidentTotal = entryForm.incidentItems.reduce((s, i) => s + n(i.cost), 0);
  const formGrossRev = n(entryForm.court_fee_rev) + n(entryForm.misc_rev);
  const formTotalCost = n(entryForm.base_cost) + formProcuredTotal + formIncidentTotal;
  const formNetRev = formGrossRev - formTotalCost;

  const handleEntrySubmit = async (e) => {
    e.preventDefault();
    const loss_items = [
      ...entryForm.procuredItems.filter((i) => i.description.trim()),
      ...entryForm.incidentItems.filter((i) => i.description.trim()),
    ];
    const payload = {
      court_name: entryForm.court_name,
      returning_players: entryForm.returning_players,
      new_players: entryForm.new_players,
      court_fee_rev: n(entryForm.court_fee_rev),
      misc_rev: n(entryForm.misc_rev),
      base_cost: n(entryForm.base_cost),
      procured_costs: formProcuredTotal,
      losses: formIncidentTotal,
      loss_items,
    };
    try {
      await axios.post(`${API_URL}/api/open-plays`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setEntryForm(emptyForm);
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

  // ── Loss item list helpers ──
  const addProcured = () =>
    setEntryForm((f) => ({ ...f, procuredItems: [...f.procuredItems, newItem('procured')] }));
  const addIncident = () =>
    setEntryForm((f) => ({ ...f, incidentItems: [...f.incidentItems, newItem('incident')] }));
  const updateProcured = (idx, val) =>
    setEntryForm((f) => { const a = [...f.procuredItems]; a[idx] = val; return { ...f, procuredItems: a }; });
  const updateIncident = (idx, val) =>
    setEntryForm((f) => { const a = [...f.incidentItems]; a[idx] = val; return { ...f, incidentItems: a }; });
  const removeProcured = (idx) =>
    setEntryForm((f) => ({ ...f, procuredItems: f.procuredItems.filter((_, i) => i !== idx) }));
  const removeIncident = (idx) =>
    setEntryForm((f) => ({ ...f, incidentItems: f.incidentItems.filter((_, i) => i !== idx) }));

  // ── Export to Google Sheets ──
  const exportToSheets = useGoogleLogin({
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    onSuccess: async (tokenResponse) => {
      setExportStatus('loading');
      try {
        const accessToken = tokenResponse.access_token;
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

        const headers = [
          'Record ID', 'Session Name', 'Date',
          'Returning Players', 'New Players', 'Total Players',
          'Court Fee Rev (₱)', 'Misc Rev (₱)', 'Gross Revenue (₱)',
          'Base Cost (₱)', 'Procured Costs (₱)', 'Incident Losses (₱)', 'Total Cost (₱)',
          'Net Revenue (₱)',
        ];
        const rows = records.map((r) => {
          const { grossRev, totalCost, netRev, totalPlayers } = calcRecord(r);
          return [
            r.id,
            r.court_name,
            r.created_at ? new Date(r.created_at).toLocaleDateString() : '',
            r.returning_players,
            r.new_players,
            totalPlayers,
            n(r.court_fee_rev),
            n(r.misc_rev),
            parseFloat(grossRev.toFixed(2)),
            n(r.base_cost),
            n(r.procured_costs),
            n(r.losses),
            parseFloat(totalCost.toFixed(2)),
            parseFloat(netRev.toFixed(2)),
          ];
        });

        await axios.put(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Records!A1?valueInputOption=RAW`,
          { values: [headers, ...rows] },
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
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
              {
                autoResizeDimensions: {
                  dimensions: { sheetId: 0, dimension: 'COLUMNS', startIndex: 0, endIndex: 14 },
                },
              },
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

  // ── Aggregate stats ──
  const totalGrossRev = records.reduce((s, r) => s + n(r.court_fee_rev) + n(r.misc_rev), 0);
  const totalCostAll = records.reduce((s, r) => s + n(r.base_cost) + n(r.procured_costs) + n(r.losses), 0);
  const totalNetRev = totalGrossRev - totalCostAll;
  const totalPlayersAll = records.reduce((s, r) => s + (r.returning_players || 0) + (r.new_players || 0), 0);
  const totalReturning = records.reduce((s, r) => s + (r.returning_players || 0), 0);
  const totalNew = records.reduce((s, r) => s + (r.new_players || 0), 0);

  // ── Per-session chart data ──
  const revenueChartData = records.map((r) => {
    const { grossRev, totalCost, netRev } = calcRecord(r);
    return {
      name: r.court_name || `#${r.id}`,
      'Court Fee': n(r.court_fee_rev),
      'Misc Rev': n(r.misc_rev),
      'Base Cost': n(r.base_cost),
      'Procured': n(r.procured_costs),
      'Incidents': n(r.losses),
      'Net Revenue': parseFloat(netRev.toFixed(2)),
    };
  });

  const playerChartData = records.map((r) => ({
    name: r.court_name || `#${r.id}`,
    Returning: r.returning_players || 0,
    New: r.new_players || 0,
  }));

  const playerPieData = [
    { name: 'Returning', value: totalReturning },
    { name: 'New', value: totalNew },
  ];

  // ── Per-COURT aggregated analytics ──
  const courtMap = {};
  records.forEach((r) => {
    const court = r.court_name || `Session #${r.id}`;
    if (!courtMap[court]) courtMap[court] = { name: court, netRev: 0, totalPlayers: 0, sessions: 0 };
    const { netRev, totalPlayers } = calcRecord(r);
    courtMap[court].netRev += netRev;
    courtMap[court].totalPlayers += totalPlayers;
    courtMap[court].sessions += 1;
  });
  const courtAnalytics = Object.values(courtMap);
  const topProfit = courtAnalytics.reduce((best, c) => (!best || c.netRev > best.netRev ? c : best), null);
  const topParticipants = courtAnalytics.reduce((best, c) => (!best || c.totalPlayers > best.totalPlayers ? c : best), null);

  const PIE_COLORS = ['#6366f1', '#f59e0b'];

  // ── Shared style classes ──
  const inp = 'w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400';
  const lbl = 'block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1';
  const sectionLbl = 'text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mt-3 mb-1';

  // ── Auth view ─────────────────────────────────────────────────────────────
  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex justify-center items-center p-4 md:p-12 transition-colors">
        <button
          onClick={cycleTheme}
          className="fixed top-4 right-4 p-2 rounded-full bg-white dark:bg-gray-800 shadow border border-gray-200 dark:border-gray-700 text-sm hover:scale-110 transition-transform z-10"
          title={`Current: ${label} — click to change`}
        >
          {icon}
        </button>

        <div className="max-w-6xl w-full flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-24">
          <div className="flex-1 text-center lg:text-left max-w-2xl">
            <h1 className="text-4xl lg:text-6xl font-extrabold text-indigo-600 dark:text-indigo-400 mb-6 tracking-tight">
              The Bottom Baseline
            </h1>
            <p className="text-lg text-gray-700 dark:text-gray-300 mb-6 leading-relaxed">
              The Bottom Baseline is a web application custom-built to completely automate financial tracking and player management for court organizers. Designed to eliminate manual spreadsheet calculations, it is the perfect solution for streamlining weekly badminton sessions, pickleball meetups, and other open play events into a clean, mobile-friendly dashboard.
            </p>
            <p className="text-base text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
              Feedback, bug reports, and collaboration ideas are welcome while the app is in the testing stage.
            </p>
            <div className="text-sm font-medium text-gray-500 dark:text-gray-500 bg-white/50 dark:bg-gray-900/50 inline-block px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-800">
              Created by: <span className="text-gray-800 dark:text-gray-200 font-bold">poochie (Daryl Tumaneng)</span>
            </div>
          </div>

          <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 p-8 transition-colors shrink-0">
            <h2 className="text-2xl font-bold text-center text-gray-800 dark:text-gray-100 mb-6">
              🏸 Open Play Finance Tracker
            </h2>

            <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
              <button
                className={`flex-1 py-2 text-sm font-semibold transition-colors ${isLogin ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                onClick={() => setIsLogin(true)}
              >🔑 Login</button>
              <button
                className={`flex-1 py-2 text-sm font-semibold transition-colors ${!isLogin ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                onClick={() => setIsLogin(false)}
              >📝 Sign Up</button>
            </div>

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
      </div>
    );
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans transition-colors">

      {/* ── Sidebar ── */}
      <aside className="w-80 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 h-full overflow-y-auto p-5 flex flex-col shrink-0">
        <h3 className="font-bold text-base mb-4 text-gray-800 dark:text-gray-100">📝 New Open Play Record</h3>

        <form onSubmit={handleEntrySubmit} className="flex flex-col gap-2 text-sm">
          {/* Record name */}
          <div>
            <label className={lbl}>Session Name</label>
            <input
              type="text" placeholder="e.g., Open Play Session 1" required
              className={inp}
              value={entryForm.court_name}
              onChange={(e) => setEntryForm({ ...entryForm, court_name: e.target.value })}
            />
          </div>

          {/* Players */}
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

          {/* ── Revenue section ── */}
          <p className={sectionLbl}>💰 Revenue</p>
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

          {/* Gross preview */}
          <div className="flex justify-between text-xs px-1 text-emerald-600 dark:text-emerald-400 font-mono">
            <span>Gross Revenue</span>
            <span>₱{formGrossRev.toLocaleString()}</span>
          </div>

          {/* ── Cost section ── */}
          <p className={sectionLbl}>💸 Costs</p>
          <div>
            <label className={lbl}>Base Cost (₱) <span className="normal-case text-gray-400 font-normal">court rental, overhead</span></label>
            <input type="number" min="0" step="50" className={inp} value={entryForm.base_cost}
              onChange={(e) => setEntryForm({ ...entryForm, base_cost: parseFloat(e.target.value) || 0 })} />
          </div>

          {/* Procured items */}
          <div>
            <div className="flex items-center justify-between">
              <label className={lbl}>Procured Items <span className="normal-case text-gray-400 font-normal">shuttles, grips…</span></label>
              <button type="button" onClick={addProcured}
                className="text-xs text-indigo-500 hover:text-indigo-700 font-semibold mb-1">+ Add</button>
            </div>
            <div className="flex flex-col gap-1">
              {entryForm.procuredItems.map((item, idx) => (
                <LossItemRow
                  key={idx} item={item} inputCls={inp}
                  onChange={(val) => updateProcured(idx, val)}
                  onRemove={() => removeProcured(idx)}
                />
              ))}
            </div>
            {entryForm.procuredItems.length > 0 && (
              <div className="text-right text-xs text-amber-600 dark:text-amber-400 font-mono mt-1">
                Subtotal: ₱{formProcuredTotal.toLocaleString()}
              </div>
            )}
          </div>

          {/* Incident adjustments */}
          <div>
            <div className="flex items-center justify-between">
              <label className={lbl}>Incident Losses <span className="normal-case text-gray-400 font-normal">broken equip, lost items</span></label>
              <button type="button" onClick={addIncident}
                className="text-xs text-red-400 hover:text-red-600 font-semibold mb-1">+ Add</button>
            </div>
            <div className="flex flex-col gap-1">
              {entryForm.incidentItems.map((item, idx) => (
                <LossItemRow
                  key={idx} item={item} inputCls={inp}
                  onChange={(val) => updateIncident(idx, val)}
                  onRemove={() => removeIncident(idx)}
                />
              ))}
            </div>
            {entryForm.incidentItems.length > 0 && (
              <div className="text-right text-xs text-red-500 dark:text-red-400 font-mono mt-1">
                Subtotal: ₱{formIncidentTotal.toLocaleString()}
              </div>
            )}
          </div>

          {/* Total cost preview */}
          <div className="flex justify-between text-xs px-1 text-amber-600 dark:text-amber-400 font-mono">
            <span>Total Cost</span>
            <span>₱{formTotalCost.toLocaleString()}</span>
          </div>

          {/* Net preview */}
          <div className={`text-sm text-center py-2 rounded-lg font-mono font-semibold
            ${formNetRev >= 0
              ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300'
              : 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400'}`}>
            Net Preview: {formNetRev >= 0 ? '' : '−'}₱{Math.abs(formNetRev).toLocaleString()}
          </div>

          <button
            type="submit"
            className="mt-1 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Add Record
          </button>
        </form>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 h-full overflow-y-auto p-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            🏸 The Bottom Baseline
            <span className="ml-2 text-base font-normal text-gray-400 dark:text-gray-500">— {username}</span>
          </h1>

          <div className="flex items-center gap-4 relative">
            {/* Export */}
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
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
              {exportStatus === 'success' ? 'Exported!' : exportStatus === 'error' ? 'Error' : exportStatus === 'loading' ? 'Exporting...' : 'Export to Sheets'}
            </button>

            {/* Profile */}
            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900 border border-indigo-200 dark:border-indigo-700 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors focus:outline-none"
              >
                {username ? username.charAt(0).toUpperCase() : 'U'}
              </button>
              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{username}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Settings &amp; Profile</p>
                  </div>
                  <div className="p-1">
                    <button
                      onClick={() => { cycleTheme(); setIsProfileOpen(false); }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors flex items-center gap-2"
                    >
                      {icon} {label} Mode
                    </button>
                    <button
                      onClick={() => { handleLogout(); setIsProfileOpen(false); }}
                      className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors mt-1"
                    >
                      Log out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Summary Stats ── */}
        {records.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
            <StatCard
              label="Sessions"
              value={records.length}
              sub="total records"
              color="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100"
            />
            <StatCard
              label="Total Players"
              value={totalPlayersAll}
              sub={`${totalReturning} returning · ${totalNew} new`}
              color="bg-indigo-50 dark:bg-indigo-950 border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-200"
            />
            <StatCard
              label="Gross Revenue"
              value={`₱${totalGrossRev.toLocaleString()}`}
              sub="court fee + misc"
              color="bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
            />
            <StatCard
              label="Total Cost"
              value={`₱${totalCostAll.toLocaleString()}`}
              sub="base + procured + losses"
              color="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200"
            />
            <StatCard
              label="Net Revenue"
              value={`${totalNetRev >= 0 ? '' : '−'}₱${Math.abs(totalNetRev).toLocaleString()}`}
              sub={totalNetRev >= 0 ? 'profitable 🎉' : 'at a loss ⚠️'}
              color={totalNetRev >= 0
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
            {/* ── Charts Row 1 ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

              {/* Revenue vs Cost stacked bar */}
              <div className="lg:col-span-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm">
                <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-4">💰 Revenue vs. Cost per Session</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={revenueChartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₱${v}`} />
                    <Tooltip
                      formatter={(value) => [`₱${Number(value).toLocaleString()}`, undefined]}
                      contentStyle={{ backgroundColor: 'var(--tooltip-bg,#fff)', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="Court Fee" stackId="rev" fill="#6366f1" />
                    <Bar dataKey="Misc Rev" stackId="rev" fill="#818cf8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Base Cost" stackId="cost" fill="#fbbf24" />
                    <Bar dataKey="Procured" stackId="cost" fill="#fb923c" />
                    <Bar dataKey="Incidents" stackId="cost" fill="#f87171" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Player pie */}
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
                      {playerPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => [v, 'Players']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Players per session */}
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

            {/* ── Per-Court Analytics ── */}
            {courtAnalytics.length > 0 && (
              <div className="mb-6">
                <h2 className="text-base font-semibold mb-3 text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 pb-2">
                  📊 Court Analytics
                </h2>

                {/* Insight cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {topProfit && (
                    <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-xl p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-green-600 dark:text-green-400 mb-1">🏆 Most Profitable Court</p>
                      <p className="text-lg font-bold text-green-800 dark:text-green-200">{topProfit.name}</p>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        Net ₱{topProfit.netRev.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        &nbsp;·&nbsp;{topProfit.sessions} session{topProfit.sessions !== 1 ? 's' : ''}
                        &nbsp;·&nbsp;{topProfit.totalPlayers} players
                      </p>
                      {topParticipants && topProfit.name === topParticipants.name && (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-medium">
                          ✅ Also has the most participants!
                        </p>
                      )}
                    </div>
                  )}
                  {topParticipants && (
                    <div className="bg-indigo-50 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1">👥 Most Participants</p>
                      <p className="text-lg font-bold text-indigo-800 dark:text-indigo-200">{topParticipants.name}</p>
                      <p className="text-sm text-indigo-700 dark:text-indigo-300">
                        {topParticipants.totalPlayers} total players
                        &nbsp;·&nbsp;{topParticipants.sessions} session{topParticipants.sessions !== 1 ? 's' : ''}
                        &nbsp;·&nbsp;Net ₱{topParticipants.netRev.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  )}
                </div>

                {/* Net profit per court bar chart */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm">
                  <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-4">📈 Net Profit per Court (All Sessions Combined)</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={courtAnalytics} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₱${v}`} />
                      <Tooltip
                        formatter={(value, name) => [
                          name === 'netRev' ? `₱${Number(value).toLocaleString()}` : value,
                          name === 'netRev' ? 'Net Revenue' : name === 'totalPlayers' ? 'Total Players' : name,
                        ]}
                        contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }} formatter={(v) => v === 'netRev' ? 'Net Revenue' : 'Total Players'} />
                      <Bar dataKey="netRev" name="netRev" fill="#6366f1" radius={[4, 4, 0, 0]}
                        label={{ position: 'top', fontSize: 10, formatter: (v) => `₱${Number(v).toLocaleString()}` }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ── Records Table ── */}
            <h2 className="text-base font-semibold mb-3 text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 pb-2">
              📋 Records
            </h2>
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left">ID</th>
                    <th className="px-4 py-3 text-left">Session</th>
                    <th className="px-4 py-3 text-right">↩ Return</th>
                    <th className="px-4 py-3 text-right">🆕 New</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Gross Rev (₱)</th>
                    <th className="px-4 py-3 text-right">Total Cost (₱)</th>
                    <th className="px-4 py-3 text-right">Net (₱)</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
                  {records.map((r) => {
                    const { grossRev, totalCost, netRev, totalPlayers } = calcRecord(r);
                    const isExpanded = expandedRow === r.id;
                    const hasItems = r.loss_items && r.loss_items.length > 0;
                    return (
                      <>
                        <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          <td className="px-4 py-3 text-gray-400 dark:text-gray-500 font-mono">{r.id}</td>
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                            {r.court_name}
                            {hasItems && (
                              <button
                                onClick={() => setExpandedRow(isExpanded ? null : r.id)}
                                className="ml-2 text-xs text-indigo-400 hover:text-indigo-600"
                              >
                                {isExpanded ? '▲ hide' : '▼ items'}
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">{r.returning_players}</td>
                          <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">{r.new_players}</td>
                          <td className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">{totalPlayers}</td>
                          <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">
                            {grossRev.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-3 text-right text-amber-600 dark:text-amber-400">
                            {totalCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </td>
                          <td className={`px-4 py-3 text-right font-semibold ${netRev >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                            {netRev >= 0 ? '' : '−'}₱{Math.abs(netRev).toLocaleString(undefined, { maximumFractionDigits: 2 })}
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
                        {isExpanded && hasItems && (
                          <tr key={`${r.id}-items`} className="bg-gray-50 dark:bg-gray-800/30">
                            <td colSpan={9} className="px-6 py-3">
                              <div className="grid grid-cols-2 gap-4 text-xs">
                                {/* Procured items */}
                                {r.loss_items.filter(i => i.item_type === 'procured').length > 0 && (
                                  <div>
                                    <p className="font-semibold text-amber-600 dark:text-amber-400 mb-1">📦 Procured Items</p>
                                    {r.loss_items.filter(i => i.item_type === 'procured').map(i => (
                                      <div key={i.id} className="flex justify-between text-gray-600 dark:text-gray-400">
                                        <span>{i.description}</span>
                                        <span>₱{n(i.cost).toLocaleString()}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {/* Incident items */}
                                {r.loss_items.filter(i => i.item_type === 'incident').length > 0 && (
                                  <div>
                                    <p className="font-semibold text-red-500 dark:text-red-400 mb-1">⚠️ Incident Losses</p>
                                    {r.loss_items.filter(i => i.item_type === 'incident').map(i => (
                                      <div key={i.id} className="flex justify-between text-gray-600 dark:text-gray-400">
                                        <span>{i.description}</span>
                                        <span>₱{n(i.cost).toLocaleString()}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
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