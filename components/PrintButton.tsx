"use client";

import { useEffect } from "react";

/**
 * One-click PDF export.
 *
 * There is no headless browser and no paid PDF service here: the browser's own
 * print engine is the PDF writer. This navigates to the print-optimised report
 * and fires window.print(), where "Save as PDF" produces vector output with the
 * diagrams intact rather than rasterised images.
 */
export default function PrintButton({
  id,
  label = "Export PDF",
  autoPrint = false,
}: {
  id?: string;
  label?: string;
  autoPrint?: boolean;
}) {
  useEffect(() => {
    if (autoPrint) {
      // give the diagram SVGs a moment to lay out before printing
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [autoPrint]);

  if (id) {
    return (
      <button
        className="btn"
        type="button"
        onClick={() => {
          window.open(`/architecture/report?id=${encodeURIComponent(id)}&print=1`, "_blank");
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <button className="btn" type="button" onClick={() => window.print()}>
      {label}
    </button>
  );
}
