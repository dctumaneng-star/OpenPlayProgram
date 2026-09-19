import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';

export default function CourtAnalytics({ courtAnalytics, topProfit, topParticipants }) {
  if (!courtAnalytics || courtAnalytics.length === 0) return null;

  return (
    <div className="mb-6">
      <h2 className="text-base font-semibold mb-3 text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700 pb-2">
        📊 Court Analytics
      </h2>

      {/* Insight cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {topProfit && (
          <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-green-600 dark:text-green-400 mb-1">
              🏆 Most Profitable Court
            </p>
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
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1">
              👥 Most Participants
            </p>
            <p className="text-lg font-bold text-indigo-800 dark:text-indigo-200">
              {topParticipants.name}
            </p>
            <p className="text-sm text-indigo-700 dark:text-indigo-300">
              {topParticipants.totalPlayers} total players
              &nbsp;·&nbsp;{topParticipants.sessions} session{topParticipants.sessions !== 1 ? 's' : ''}
              &nbsp;·&nbsp;Net ₱
              {topParticipants.netRev.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
          </div>
        )}
      </div>

      {/* Aggregated net profit bar chart */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-4">
          📈 Net Profit per Court (All Sessions Combined)
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={courtAnalytics} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₱${v}`} />
            <Tooltip
              formatter={(value, name) => [
                name === 'netRev'
                  ? `₱${Number(value).toLocaleString()}`
                  : value,
                name === 'netRev' ? 'Net Revenue' : name === 'totalPlayers' ? 'Total Players' : name,
              ]}
              contentStyle={{ borderRadius: '8px', fontSize: '12px' }}
            />
            <Legend
              wrapperStyle={{ fontSize: '12px' }}
              formatter={(v) => (v === 'netRev' ? 'Net Revenue' : 'Total Players')}
            />
            <Bar
              dataKey="netRev"
              name="netRev"
              fill="#6366f1"
              radius={[4, 4, 0, 0]}
              label={{
                position: 'top',
                fontSize: 10,
                formatter: (v) => `₱${Number(v).toLocaleString()}`,
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

