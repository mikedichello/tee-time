const ICONS = {
  ball: "⛳",
  manual: "✏️",
  info: "ℹ️",
  warn: "⚠️",
};

const COLORS = {
  ball: "bg-green-600 border-green-400",
  manual: "bg-blue-600 border-blue-400",
  info: "bg-gray-700 border-gray-500",
  warn: "bg-yellow-600 border-yellow-400",
};

export default function Toast({ toast }) {
  return (
    <div
      className={`
        fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3
        rounded-xl border shadow-2xl text-white font-semibold text-sm
        animate-slide-in
        ${COLORS[toast.type] ?? COLORS.info}
      `}
    >
      <span className="text-xl">{ICONS[toast.type] ?? "ℹ️"}</span>
      {toast.message}
    </div>
  );
}
