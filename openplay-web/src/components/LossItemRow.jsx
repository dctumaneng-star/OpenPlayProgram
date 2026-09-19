export default function LossItemRow({ item, onChange, onRemove, inputCls }) {
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
        placeholder="₱"
        className={`${inputCls} w-20`}
        value={item.cost}
        onChange={(e) => onChange({ ...item, cost: e.target.value })}
      />
      <button
        type="button"
        onClick={onRemove}
        className="text-red-400 hover:text-red-600 text-lg leading-none px-1"
      >
        ×
      </button>
    </div>
  );
}

