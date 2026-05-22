/**
 * Reusable DataTable built on @tanstack/react-table + shadcn table primitives.
 * Dense rows, alternating colors, sort indicators, pagination, mobile card fallback.
 */

import { useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@monobase/ui'
import { Button } from '@monobase/ui'
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react'

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  pageSize?: number
  /** Render function for mobile card layout (<768px). If omitted, table is shown at all sizes. */
  renderMobileCard?: (row: TData) => React.ReactNode
}

export function DataTable<TData, TValue>({
  columns,
  data,
  pageSize = 25,
  renderMobileCard,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
    initialState: { pagination: { pageSize } },
  })

  const { pageIndex } = table.getState().pagination
  const totalRows = table.getFilteredRowModel().rows.length
  const start = pageIndex * pageSize + 1
  const end = Math.min((pageIndex + 1) * pageSize, totalRows)

  return (
    <div style={{ containerType: 'inline-size' }}>
      {/* Mobile card layout — viewport fallback + container query override */}
      {renderMobileCard && (
        <div className="md:hidden cq-table-cards flex flex-col gap-3">
          {table.getRowModel().rows.map((row) => (
            <div key={row.id}>{renderMobileCard(row.original)}</div>
          ))}
        </div>
      )}

      {/* Desktop table — viewport fallback + container query override */}
      <div className={renderMobileCard ? 'hidden md:block cq-table-desktop' : ''} role="grid" aria-label="Data table">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-[var(--color-surface-warm)] border-b">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="h-10 px-3 text-caption text-[var(--color-text-secondary)] select-none"
                    style={header.column.getCanSort() ? { cursor: 'pointer' } : undefined}
                    onClick={header.column.getToggleSortingHandler()}
                    aria-sort={
                      header.column.getIsSorted() === 'asc' ? 'ascending' :
                      header.column.getIsSorted() === 'desc' ? 'descending' : 'none'
                    }
                  >
                    <span className="flex items-center gap-1">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        <span className="inline-flex">
                          {header.column.getIsSorted() === 'asc' ? (
                            <ChevronUp className="h-3.5 w-3.5" style={{ color: 'var(--color-primary)' }} />
                          ) : header.column.getIsSorted() === 'desc' ? (
                            <ChevronDown className="h-3.5 w-3.5" style={{ color: 'var(--color-primary)' }} />
                          ) : (
                            <ChevronsUpDown className="h-3.5 w-3.5 text-[var(--color-muted)]" />
                          )}
                        </span>
                      )}
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-[var(--color-muted)]">
                  No results.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row, idx) => (
                <TableRow
                  key={row.id}
                  className={idx % 2 === 1 ? 'bg-[var(--color-surface-warm)]' : ''}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-2 px-3 text-body-sm tabular-nums">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalRows > pageSize && (
        <div className="flex items-center justify-between px-3 py-3 border-t border-[var(--color-border-light)]">
          <span className="text-caption text-[var(--color-text-secondary)]">
            Showing {start}-{end} of {totalRows}
          </span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
