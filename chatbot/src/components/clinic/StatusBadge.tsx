const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  scheduled: { label: "Planifié", className: "bg-blue-100 text-blue-700" },
  confirmed: { label: "Confirmé", className: "bg-green-100 text-green-700" },
  cancelled: { label: "Annulé", className: "bg-red-100 text-red-700" },
  completed: { label: "Terminé", className: "bg-gray-100 text-gray-700" },
  no_show: { label: "Absent", className: "bg-orange-100 text-orange-700" },
};

export default function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, className: "bg-gray-100 text-gray-700" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}
