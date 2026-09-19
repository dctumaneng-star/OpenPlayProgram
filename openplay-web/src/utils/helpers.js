// Shared numeric helper — safely parses any value from the API
export const n = (v) => parseFloat(v) || 0;

// Shared Tailwind class strings used across multiple components
export const INPUT_CLS =
  'w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-neutral-800 ' +
  'border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 ' +
  'placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none ' +
  'focus:ring-2 focus:ring-blue-700 dark:focus:ring-blue-600';

export const LABEL_CLS =
  'block text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-1';

export const SECTION_LBL_CLS =
  'text-xs font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mt-3 mb-1';

export const PIE_COLORS = ['#1D4ED8', '#DFFF00'];

// Derive all financial figures for a single record
export const calcRecord = (r) => {
  const grossRev = n(r.court_fee_rev) + n(r.misc_rev);
  const totalCost = n(r.base_cost) + n(r.procured_costs) + n(r.losses);
  const netRev = grossRev - totalCost;
  const totalPlayers = (r.returning_players || 0) + (r.new_players || 0);
  return { grossRev, totalCost, netRev, totalPlayers };
};

// Build per-court aggregation from a records array
export const buildCourtAnalytics = (records) => {
  const courtMap = {};
  records.forEach((r) => {
    const court = r.court_name || `Session #${r.id}`;
    if (!courtMap[court])
      courtMap[court] = { name: court, netRev: 0, totalPlayers: 0, sessions: 0 };
    const { netRev, totalPlayers } = calcRecord(r);
    courtMap[court].netRev += netRev;
    courtMap[court].totalPlayers += totalPlayers;
    courtMap[court].sessions += 1;
  });
  return Object.values(courtMap);
};

