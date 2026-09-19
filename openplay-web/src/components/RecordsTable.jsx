import { useState } from 'react';
import { n, calcRecord } from '../utils/helpers';

export default function RecordsTable({ records, onDelete }) {
  const [expandedRow, setExpandedRow] = useState(null);

  return (
    <>
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
                  <tr
                    key={r.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
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
                    <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">
                      {r.returning_players}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">
                      {r.new_players}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-300">
                      {totalPlayers}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">
                      {grossRev.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right text-amber-600 dark:text-amber-400">
                      {totalCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${
                        netRev >= 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-500 dark:text-red-400'
                      }`}
                    >
                      {netRev >= 0 ? '' : '−'}₱
                      {Math.abs(netRev).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onDelete(r.id)}
                        className="text-red-400 hover:text-red-600 dark:hover:text-red-300 text-xs font-medium px-2 py-1 rounded border border-transparent hover:border-red-200 dark:hover:border-red-800 transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>

                  {/* Expandable loss items row */}
                  {isExpanded && hasItems && (
                    <tr key={`${r.id}-items`} className="bg-gray-50 dark:bg-gray-800/30">
                      <td colSpan={9} className="px-6 py-3">
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          {r.loss_items.filter((i) => i.item_type === 'procured').length > 0 && (
                            <div>
                              <p className="font-semibold text-amber-600 dark:text-amber-400 mb-1">
                                📦 Procured Items
                              </p>
                              {r.loss_items
                                .filter((i) => i.item_type === 'procured')
                                .map((i) => (
                                  <div
                                    key={i.id}
                                    className="flex justify-between text-gray-600 dark:text-gray-400"
                                  >
                                    <span>{i.description}</span>
                                    <span>₱{n(i.cost).toLocaleString()}</span>
                                  </div>
                                ))}
                            </div>
                          )}
                          {r.loss_items.filter((i) => i.item_type === 'incident').length > 0 && (
                            <div>
                              <p className="font-semibold text-red-500 dark:text-red-400 mb-1">
                                ⚠️ Incident Losses
                              </p>
                              {r.loss_items
                                .filter((i) => i.item_type === 'incident')
                                .map((i) => (
                                  <div
                                    key={i.id}
                                    className="flex justify-between text-gray-600 dark:text-gray-400"
                                  >
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
  );
}
