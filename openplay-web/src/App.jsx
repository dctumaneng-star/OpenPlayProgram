import { useState } from 'react';
import './index.css';

import { useTheme }   from './hooks/useTheme';
import { useAuth }    from './hooks/useAuth';
import { useRecords } from './hooks/useRecords';
import { useExport }  from './hooks/useExport';

import AuthView       from './components/AuthView';
import Sidebar        from './components/Sidebar';
import StatCard       from './components/StatCard';
import Charts         from './components/Charts';
import CourtAnalytics from './components/CourtAnalytics';
import RecordsTable   from './components/RecordsTable';

function App() {
  const { theme, cycleTheme, icon, label } = useTheme();
  const { token, username, handleLogin, handleSignup, handleGoogleAuth, handleLogout } = useAuth();
  const records = useRecords(token);
  const { exportStatus, exportToSheets } = useExport(records.records, username);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // ── Auth page ─────────────────────────────────────────────────────────────
  if (!token) {
    return (
      <AuthView
        theme={theme}
        icon={icon}
        label={label}
        cycleTheme={cycleTheme}
        onLogin={handleLogin}
        onSignup={handleSignup}
        onGoogleSuccess={handleGoogleAuth}
      />
    );
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-slate-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 font-sans transition-colors">

      {/* Sidebar — entry form */}
      <Sidebar
        entryForm={records.entryForm}
        setEntryForm={records.setEntryForm}
        formProcuredTotal={records.formProcuredTotal}
        formIncidentTotal={records.formIncidentTotal}
        formGrossRev={records.formGrossRev}
        formTotalCost={records.formTotalCost}
        formNetRev={records.formNetRev}
        addProcured={records.addProcured}
        addIncident={records.addIncident}
        updateProcured={records.updateProcured}
        updateIncident={records.updateIncident}
        removeProcured={records.removeProcured}
        removeIncident={records.removeIncident}
        handleEntrySubmit={records.handleEntrySubmit}
      />

      {/* Main content */}
      <main className="flex-1 h-full overflow-y-auto p-8">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            🏸 The Bottom Baseline
            <span className="ml-2 text-base font-normal text-neutral-400 dark:text-neutral-500">
              — {username}
            </span>
          </h1>

          <div className="flex items-center gap-4 relative">
            {/* Export to Sheets */}
            <button
              onClick={() => exportToSheets()}
              disabled={records.records.length === 0 || exportStatus === 'loading'}
              className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg border transition-all shadow-sm
                ${exportStatus === 'success'
                  ? 'bg-emerald-100 dark:bg-emerald-900 border-emerald-400 text-emerald-800 dark:text-emerald-300'
                  : exportStatus === 'error'
                  ? 'bg-red-100 dark:bg-red-900 border-red-400 text-red-700 dark:text-red-300'
                  : exportStatus === 'loading'
                  ? 'opacity-60 cursor-wait bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300'
                  : records.records.length === 0
                  ? 'opacity-40 cursor-not-allowed bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600 text-neutral-400'
                  : 'bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-200 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400'
                }`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
              {exportStatus === 'success'
                ? 'Exported!'
                : exportStatus === 'error'
                ? 'Error'
                : exportStatus === 'loading'
                ? 'Exporting...'
                : 'Export to Sheets'}
            </button>

            {/* Profile dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 flex items-center justify-center text-blue-700 dark:text-blue-400 font-bold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors focus:outline-none"
              >
                {username ? username.charAt(0).toUpperCase() : 'U'}
              </button>
              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-neutral-800 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-700">
                    <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">{username}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">Settings &amp; Profile</p>
                  </div>
                  <div className="p-1">
                    <button
                      onClick={() => { cycleTheme(); setIsProfileOpen(false); }}
                      className="w-full text-left px-3 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-md transition-colors flex items-center gap-2"
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

        {/* ── Summary Stat Cards ── */}
        {records.records.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
            <StatCard
              label="Sessions"
              value={records.records.length}
              sub="total records"
              color="bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100"
            />
            <StatCard
              label="Total Players"
              value={records.totalPlayersAll}
              sub={`${records.totalReturning} returning · ${records.totalNew} new`}
              color="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300"
            />
            <StatCard
              label="Gross Revenue"
              value={`₱${records.totalGrossRev.toLocaleString()}`}
              sub="court fee + misc"
              color="bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
            />
            <StatCard
              label="Total Cost"
              value={`₱${records.totalCostAll.toLocaleString()}`}
              sub="base + procured + losses"
              color="bg-slate-100 dark:bg-neutral-800/80 border-slate-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-300"
            />
            <StatCard
              label="Net Revenue"
              value={`${records.totalNetRev >= 0 ? '' : '−'}₱${Math.abs(records.totalNetRev).toLocaleString()}`}
              sub={records.totalNetRev >= 0 ? 'profitable 🎉' : 'at a loss ⚠️'}
              color={records.totalNetRev >= 0
                ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                : 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'}
            />
          </div>
        )}

        {/* ── Empty state ── */}
        {records.records.length === 0 ? (
          <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 p-5 rounded-xl border border-blue-200 dark:border-blue-800">
            👈 No data yet. Use the sidebar to log your first open play session.
          </div>
        ) : (
          <>
            <Charts
              revenueChartData={records.revenueChartData}
              playerChartData={records.playerChartData}
              playerPieData={records.playerPieData}
            />
            <CourtAnalytics
              courtAnalytics={records.courtAnalytics}
              topProfit={records.topProfit}
              topParticipants={records.topParticipants}
            />
            <RecordsTable
              records={records.records}
              onDelete={records.handleDelete}
            />
          </>
        )}

      </main>
    </div>
  );
}

export default App;