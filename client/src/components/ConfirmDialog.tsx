import { useEffect, useState } from 'react'

export default function ConfirmDialog({
  title,
  message,
  danger,
  requireTypedCount,
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  danger?: boolean
  requireTypedCount?: number
  onConfirm: () => void
  onCancel: () => void
}) {
  const [typed, setTyped] = useState('')
  const [armed, setArmed] = useState(!danger)

  // short arming delay so a double-click can't confirm a destructive action
  useEffect(() => {
    if (!danger) return
    const t = setTimeout(() => setArmed(true), 1500)
    return () => clearTimeout(t)
  }, [danger])

  const typedOk = requireTypedCount === undefined || typed.trim() === String(requireTypedCount)

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal modal-small" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <p>{message}</p>
        {requireTypedCount !== undefined && (
          <label className="confirm-type">
            Type <strong>{requireTypedCount}</strong> to confirm:
            <input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
          </label>
        )}
        <div className="modal-actions">
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            className={danger ? 'btn btn-danger' : 'btn btn-primary'}
            disabled={!armed || !typedOk}
            onClick={onConfirm}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}
