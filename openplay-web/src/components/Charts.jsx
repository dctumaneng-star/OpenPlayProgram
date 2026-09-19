import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { PIE_COLORS } from '../utils/helpers';

export default function Charts({ revenueChartData, playerChartData, playerPieData }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

      {/* Revenue vs Cost stacked bar */}
      <div className="lg:col-span-2 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold text-sm text-neutral-700 dark:text-neutral-300 mb-4">
          💰 Revenue vs. Cost per Session
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={revenueChartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₱${v}`} />
            <Tooltip
              formatter={(value) => [`₱${Number(value).toLocaleString()}`, undefined]}
              contentStyle={{
                backgroundColor: 'var(--tooltip-bg,#fff)',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Bar dataKey="Court Fee"  stackId="rev"  fill="#1D4ED8" />
            <Bar dataKey="Misc Rev"   stackId="rev"  fill="#065F46" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Base Cost"  stackId="cost" fill="#171717" />
            <Bar dataKey="Procured"   stackId="cost" fill="#DFFF00" />
            <Bar dataKey="Incidents"  stackId="cost" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Player type pie */}
      <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold text-sm text-neutral-700 dark:text-neutral-300 mb-4">
          👥 Player Breakdown
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={playerPieData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
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

      {/* Players per session */}
      <div className="lg:col-span-3 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold text-sm text-neutral-700 dark:text-neutral-300 mb-4">
          🏃 Players per Session
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={playerChartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Bar dataKey="Returning" fill="#1D4ED8" radius={[4, 4, 0, 0]} />
            <Bar dataKey="New"       fill="#DFFF00" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}

