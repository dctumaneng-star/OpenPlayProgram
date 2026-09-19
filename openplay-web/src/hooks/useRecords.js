import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../api/config';
import { n, calcRecord, buildCourtAnalytics } from '../utils/helpers';

const newItem = (type) => ({ item_type: type, description: '', cost: 0 });

export const EMPTY_FORM = {
  court_name: '',
  returning_players: 0,
  new_players: 0,
  court_fee_rev: 0,
  misc_rev: 0,
  base_cost: 0,
  procuredItems: [],
  incidentItems: [],
};

export function useRecords(token) {
  const [records, setRecords] = useState([]);
  const [entryForm, setEntryForm] = useState(EMPTY_FORM);

  // Fetch whenever the token changes
  useEffect(() => {
    if (token) fetchRecords();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Entry form helpers ──────────────────────────────────────────────────
  const addProcured = () =>
    setEntryForm((f) => ({ ...f, procuredItems: [...f.procuredItems, newItem('procured')] }));

  const addIncident = () =>
    setEntryForm((f) => ({ ...f, incidentItems: [...f.incidentItems, newItem('incident')] }));

  const updateProcured = (idx, val) =>
    setEntryForm((f) => {
      const a = [...f.procuredItems];
      a[idx] = val;
      return { ...f, procuredItems: a };
    });

  const updateIncident = (idx, val) =>
    setEntryForm((f) => {
      const a = [...f.incidentItems];
      a[idx] = val;
      return { ...f, incidentItems: a };
    });

  const removeProcured = (idx) =>
    setEntryForm((f) => ({ ...f, procuredItems: f.procuredItems.filter((_, i) => i !== idx) }));

  const removeIncident = (idx) =>
    setEntryForm((f) => ({ ...f, incidentItems: f.incidentItems.filter((_, i) => i !== idx) }));

  // ── Form-level derived calculations ────────────────────────────────────
  const formProcuredTotal = entryForm.procuredItems.reduce((s, i) => s + n(i.cost), 0);
  const formIncidentTotal = entryForm.incidentItems.reduce((s, i) => s + n(i.cost), 0);
  const formGrossRev = n(entryForm.court_fee_rev) + n(entryForm.misc_rev);
  const formTotalCost = n(entryForm.base_cost) + formProcuredTotal + formIncidentTotal;
  const formNetRev = formGrossRev - formTotalCost;

  // ── Submit ──────────────────────────────────────────────────────────────
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
      setEntryForm(EMPTY_FORM);
      fetchRecords();
    } catch {
      alert('Error adding record');
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!confirm('Delete this record?')) return;
    try {
      await axios.delete(`${API_URL}/api/open-plays/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchRecords();
    } catch {
      alert('Error deleting record');
    }
  };

  // ── Aggregate stats across all records ─────────────────────────────────
  const totalGrossRev = records.reduce((s, r) => s + n(r.court_fee_rev) + n(r.misc_rev), 0);
  const totalCostAll = records.reduce(
    (s, r) => s + n(r.base_cost) + n(r.procured_costs) + n(r.losses),
    0
  );
  const totalNetRev = totalGrossRev - totalCostAll;
  const totalReturning = records.reduce((s, r) => s + (r.returning_players || 0), 0);
  const totalNew = records.reduce((s, r) => s + (r.new_players || 0), 0);
  const totalPlayersAll = totalReturning + totalNew;

  // ── Chart data ──────────────────────────────────────────────────────────
  const revenueChartData = records.map((r) => {
    const { netRev } = calcRecord(r);
    return {
      name: r.court_name || `#${r.id}`,
      'Court Fee': n(r.court_fee_rev),
      'Misc Rev': n(r.misc_rev),
      'Base Cost': n(r.base_cost),
      Procured: n(r.procured_costs),
      Incidents: n(r.losses),
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

  const courtAnalytics = buildCourtAnalytics(records);
  const topProfit = courtAnalytics.reduce(
    (best, c) => (!best || c.netRev > best.netRev ? c : best),
    null
  );
  const topParticipants = courtAnalytics.reduce(
    (best, c) => (!best || c.totalPlayers > best.totalPlayers ? c : best),
    null
  );

  return {
    // raw data
    records,
    entryForm,
    setEntryForm,
    // form computed
    formProcuredTotal,
    formIncidentTotal,
    formGrossRev,
    formTotalCost,
    formNetRev,
    // form item helpers
    addProcured,
    addIncident,
    updateProcured,
    updateIncident,
    removeProcured,
    removeIncident,
    // actions
    handleEntrySubmit,
    handleDelete,
    // aggregate stats
    totalGrossRev,
    totalCostAll,
    totalNetRev,
    totalReturning,
    totalNew,
    totalPlayersAll,
    // chart data
    revenueChartData,
    playerChartData,
    playerPieData,
    // analytics
    courtAnalytics,
    topProfit,
    topParticipants,
  };
}
