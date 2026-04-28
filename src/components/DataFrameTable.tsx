import type { CSSProperties } from "react";
import type { PublishedTable, PublishedTableCell } from "@/lib/publishing";

type Props = {
  table: PublishedTable;
};

const colorMap: Record<string, string> = {
  default: "transparent",
  muted: "color-mix(in oklch, var(--muted-foreground) 16%, transparent)",
  primary: "color-mix(in oklch, var(--primary) 16%, transparent)",
  leaf: "color-mix(in oklch, var(--leaf) 16%, transparent)",
  clay: "color-mix(in oklch, var(--clay) 16%, transparent)",
  sand: "color-mix(in oklch, var(--sand) 22%, transparent)",
};

function cellStyle(cell: PublishedTableCell, mode: PublishedTable["mode"]): CSSProperties {
  return {
    width: mode === "scroll" ? `${cell.width}px` : undefined,
    minWidth: mode === "scroll" ? `${Math.max(60, cell.width)}px` : undefined,
    height: `${cell.height}px`,
    textAlign: cell.align,
    background: colorMap[cell.color] ?? colorMap.default,
  };
}

export function DataFrameTable({ table }: Props) {
  const columnCount = Math.max(...table.rows.map((row) => row.length), 1);
  const scrollMinWidth = table.rows[0]?.reduce((sum, cell) => sum + cell.width, 0) ?? columnCount * 140;

  return (
    <figure className="lure-dataframe">
      {table.title && <figcaption>{table.title}</figcaption>}
      <div className={table.mode === "scroll" ? "lure-dataframe-scroll" : "lure-dataframe-fit"}>
        <table
          style={{
            minWidth: table.mode === "scroll" ? `${Math.max(520, scrollMinWidth)}px` : undefined,
            tableLayout: table.mode === "fit" ? "fixed" : "auto",
          }}
        >
          <tbody>
            {table.rows.map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`}>
                {row.map((cell, cellIndex) => {
                  const CellTag = rowIndex === 0 ? "th" : "td";

                  return (
                    <CellTag key={`cell-${rowIndex}-${cellIndex}`} style={cellStyle(cell, table.mode)}>
                      {cell.text}
                    </CellTag>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
