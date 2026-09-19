import LossItemRow from './LossItemRow';
import { INPUT_CLS, LABEL_CLS, SECTION_LBL_CLS } from '../utils/helpers';

export default function Sidebar({
  entryForm,
  setEntryForm,
  formProcuredTotal,
  formIncidentTotal,
  formGrossRev,
  formTotalCost,
  formNetRev,
  addProcured,
  addIncident,
  updateProcured,
  updateIncident,
  removeProcured,
  removeIncident,
  handleEntrySubmit,
}) {
  return (
    <aside className="w-80 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 h-full overflow-y-auto p-5 flex flex-col shrink-0">
      <h3 className="font-bold text-base mb-4 text-gray-800 dark:text-gray-100">
        📝 New Open Play Record
      </h3>

      <form onSubmit={handleEntrySubmit} className="flex flex-col gap-2 text-sm">
        {/* Session name */}
        <div>
          <label className={LABEL_CLS}>Session Name</label>
          <input
            type="text"
            placeholder="e.g., Open Play Session 1"
            required
            className={INPUT_CLS}
            value={entryForm.court_name}
            onChange={(e) => setEntryForm({ ...entryForm, court_name: e.target.value })}
          />
        </div>

        {/* Players */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={LABEL_CLS}>Returning</label>
            <input
              type="number"
              min="0"
              className={INPUT_CLS}
              value={entryForm.returning_players}
              onChange={(e) =>
                setEntryForm({ ...entryForm, returning_players: parseInt(e.target.value) || 0 })
              }
            />
          </div>
          <div>
            <label className={LABEL_CLS}>New Players</label>
            <input
              type="number"
              min="0"
              className={INPUT_CLS}
              value={entryForm.new_players}
              onChange={(e) =>
                setEntryForm({ ...entryForm, new_players: parseInt(e.target.value) || 0 })
              }
            />
          </div>
        </div>

        {/* ── Revenue ── */}
        <p className={SECTION_LBL_CLS}>💰 Revenue</p>
        <div>
          <label className={LABEL_CLS}>Court Fee Revenue (₱)</label>
          <input
            type="number"
            min="0"
            step="50"
            className={INPUT_CLS}
            value={entryForm.court_fee_rev}
            onChange={(e) =>
              setEntryForm({ ...entryForm, court_fee_rev: parseFloat(e.target.value) || 0 })
            }
          />
        </div>
        <div>
          <label className={LABEL_CLS}>Misc Revenue (₱)</label>
          <input
            type="number"
            min="0"
            step="10"
            className={INPUT_CLS}
            value={entryForm.misc_rev}
            onChange={(e) =>
              setEntryForm({ ...entryForm, misc_rev: parseFloat(e.target.value) || 0 })
            }
          />
        </div>
        <div className="flex justify-between text-xs px-1 text-emerald-600 dark:text-emerald-400 font-mono">
          <span>Gross Revenue</span>
          <span>₱{formGrossRev.toLocaleString()}</span>
        </div>

        {/* ── Costs ── */}
        <p className={SECTION_LBL_CLS}>💸 Costs</p>
        <div>
          <label className={LABEL_CLS}>
            Base Cost (₱){' '}
            <span className="normal-case text-gray-400 font-normal">court rental, overhead</span>
          </label>
          <input
            type="number"
            min="0"
            step="50"
            className={INPUT_CLS}
            value={entryForm.base_cost}
            onChange={(e) =>
              setEntryForm({ ...entryForm, base_cost: parseFloat(e.target.value) || 0 })
            }
          />
        </div>

        {/* Procured items */}
        <div>
          <div className="flex items-center justify-between">
            <label className={LABEL_CLS}>
              Procured Items{' '}
              <span className="normal-case text-gray-400 font-normal">shuttles, grips…</span>
            </label>
            <button
              type="button"
              onClick={addProcured}
              className="text-xs text-indigo-500 hover:text-indigo-700 font-semibold mb-1"
            >
              + Add
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {entryForm.procuredItems.map((item, idx) => (
              <LossItemRow
                key={idx}
                item={item}
                inputCls={INPUT_CLS}
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

        {/* Incident losses */}
        <div>
          <div className="flex items-center justify-between">
            <label className={LABEL_CLS}>
              Incident Losses{' '}
              <span className="normal-case text-gray-400 font-normal">broken equip, lost items</span>
            </label>
            <button
              type="button"
              onClick={addIncident}
              className="text-xs text-red-400 hover:text-red-600 font-semibold mb-1"
            >
              + Add
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {entryForm.incidentItems.map((item, idx) => (
              <LossItemRow
                key={idx}
                item={item}
                inputCls={INPUT_CLS}
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

        {/* Totals */}
        <div className="flex justify-between text-xs px-1 text-amber-600 dark:text-amber-400 font-mono">
          <span>Total Cost</span>
          <span>₱{formTotalCost.toLocaleString()}</span>
        </div>

        {/* Net preview */}
        <div
          className={`text-sm text-center py-2 rounded-lg font-mono font-semibold ${
            formNetRev >= 0
              ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300'
              : 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400'
          }`}
        >
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
  );
}

