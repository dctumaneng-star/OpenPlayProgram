import { useState } from 'react';
import axios from 'axios';
import { useGoogleLogin } from '@react-oauth/google';
import { n, calcRecord } from '../utils/helpers';

export function useExport(records, username) {
  const [exportStatus, setExportStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'

  const exportToSheets = useGoogleLogin({
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    onSuccess: async (tokenResponse) => {
      setExportStatus('loading');
      try {
        const accessToken = tokenResponse.access_token;

        // 1. Create spreadsheet
        const createRes = await axios.post(
          'https://sheets.googleapis.com/v4/spreadsheets',
          {
            properties: { title: `Open Play Finance Tracker — ${username}` },
            sheets: [{ properties: { title: 'Records' } }],
          },
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const { spreadsheetId, spreadsheetUrl } = createRes.data;

        // 2. Build rows
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

        // 3. Write data
        await axios.put(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Records!A1?valueInputOption=RAW`,
          { values: [headers, ...rows] },
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        // 4. Format header row
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

  return { exportStatus, exportToSheets };
}

