import { useCostHistory } from "../hooks/useCostHistory";
import { BarChart3 } from "lucide-react";

export default function CostChart() {
  const { data: history, isLoading } = useCostHistory();
  const totalCost = history?.reduce((s, d) => s + d.totalUsd, 0) ?? 0;
  const totalTokens = history?.reduce((s, d) => s + d.totalTokens, 0) ?? 0;

  if (isLoading) {
    return (
      <div className="h-32 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center">
        <p className="text-xs text-zinc-600">Loading chart…</p>
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="h-32 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center">
        <div className="text-center text-zinc-600">
          <BarChart3 size={18} className="mx-auto mb-1" />
          <p className="text-xs">No usage data yet</p>
        </div>
      </div>
    );
  }

  const maxTokens = Math.max(...history.map((d) => d.totalTokens), 1);
  const maxCost = Math.max(...history.map((d) => d.totalUsd), 0.01);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 size={14} className="text-zinc-500" />
          <h3 className="text-sm font-medium text-zinc-300">Daily usage (30 days)</h3>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1 text-zinc-500">
            <span className="w-2 h-2 rounded-sm bg-blue-500/60 inline-block" />
            {totalTokens.toLocaleString()} tok
          </span>
          <span className="flex items-center gap-1 text-zinc-500">
            <span className="w-2 h-2 rounded-sm bg-purple-500/60 inline-block" />
            ${totalCost.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="flex items-end gap-[3px] h-28">
        {history.map((d) => {
          const tokPct = (d.totalTokens / maxTokens) * 100;
          const costPct = (d.totalUsd / maxCost) * 100;
          return (
            <div
              key={d.date}
              className="flex-1 flex flex-col items-center justify-end h-full group relative"
            >
              {/* Tooltip */}
              <div className="absolute bottom-full mb-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                <div className="bg-zinc-700 text-zinc-200 text-[10px] px-2 py-1 rounded shadow whitespace-nowrap">
                  <span className="font-medium">{d.date}</span>
                  <br />
                  {d.totalTokens.toLocaleString()} tok · ${d.totalUsd.toFixed(2)}
                  <br />
                  {d.sessionCount} session{d.sessionCount !== 1 ? "s" : ""}
                </div>
              </div>

              {/* Token bar (blue, full width) */}
              <div
                className="w-full rounded-t-sm bg-blue-500/60 hover:bg-blue-400/80 transition-colors"
                style={{ height: `${Math.max(tokPct, 2)}%` }}
              />
              {/* Cost bar (purple, thinner) */}
              {d.totalUsd > 0 && (
                <div
                  className="absolute bottom-0 w-[6px] rounded-t-sm bg-purple-500/70 hover:bg-purple-400/90 transition-colors"
                  style={{ height: `${Math.max(costPct, 2)}%` }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Labels — show every ~7th day */}
      <div className="flex gap-[3px] mt-1.5">
        {history.map((d, i) => {
          const show = i === 0 || i === history.length - 1 || d.date.endsWith("-01") || d.date.endsWith("-15") || history.length <= 14 || i % Math.max(1, Math.floor(history.length / 7)) === 0;
          return (
            <span key={d.date} className="flex-1 text-[9px] text-zinc-600 text-center truncate leading-none">
              {show ? d.date.slice(5) : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
}
