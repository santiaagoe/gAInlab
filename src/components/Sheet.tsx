/** Bottom sheet over a dimmed background; tapping outside closes it. */
export function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}
