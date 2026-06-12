// Loading placeholder for a table while data is being fetched.
// Renders shimmering bars matching the given column widths so the
// layout doesn't jump once real rows arrive.
export default function TableSkeleton({
  columns,
  rows = 6,
}: {
  // Tailwind width class per column, e.g. ["w-32", "w-20"]. Length sets column count.
  columns: string[];
  rows?: number;
}) {
  return (
    <table className="w-full text-left text-sm">
      <tbody className="divide-y divide-hairline">
        {Array.from({ length: rows }).map((_, r) => (
          <tr key={r}>
            {columns.map((w, c) => (
              <td key={c} className="py-3.5">
                <div
                  className={`h-3.5 ${w} animate-pulse rounded-full bg-gradient-to-r from-surface-2 via-hairline to-surface-2`}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
