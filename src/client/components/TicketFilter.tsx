import { Search, X } from "lucide-react";
import { TICKET_STATUSES, TICKET_PRIORITIES, TICKET_CATEGORIES } from "../../shared/types";

export interface FilterValues {
  search: string;
  status: string;
  priority: string;
  category: string;
}

interface TicketFilterProps {
  values: FilterValues;
  onChange: (values: FilterValues) => void;
}

export default function TicketFilter({ values, onChange }: TicketFilterProps) {
  const set = (key: keyof FilterValues, val: string) => onChange({ ...values, [key]: val });

  const hasAny = values.search || values.status || values.priority || values.category;

  return (
    <div className="flex items-center gap-2">
      {/* Search */}
      <div className="relative flex-1 max-w-xs">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
        <input
          type="text"
          value={values.search}
          onChange={(e) => set("search", e.target.value)}
          placeholder="Search tickets..."
          className="w-full bg-zinc-900 border border-zinc-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-700"
        />
        {values.search && (
          <button
            onClick={() => set("search", "")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Status filter */}
      <select
        value={values.status}
        onChange={(e) => set("status", e.target.value)}
        className="bg-zinc-900 border border-zinc-800 rounded-md px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-700"
      >
        <option value="">All statuses</option>
        {TICKET_STATUSES.map((s) => (
          <option key={s} value={s}>{s.replace("_", " ")}</option>
        ))}
      </select>

      {/* Priority filter */}
      <select
        value={values.priority}
        onChange={(e) => set("priority", e.target.value)}
        className="bg-zinc-900 border border-zinc-800 rounded-md px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-700"
      >
        <option value="">All priorities</option>
        {TICKET_PRIORITIES.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>

      {/* Category filter */}
      <select
        value={values.category}
        onChange={(e) => set("category", e.target.value)}
        className="bg-zinc-900 border border-zinc-800 rounded-md px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-700"
      >
        <option value="">All categories</option>
        {TICKET_CATEGORIES.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      {/* Clear button */}
      {hasAny && (
        <button
          onClick={() => onChange({ search: "", status: "", priority: "", category: "" })}
          className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1.5"
        >
          Clear
        </button>
      )}
    </div>
  );
}
