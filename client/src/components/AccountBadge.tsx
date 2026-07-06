export default function AccountBadge({ email, onLogout }: { email: string; onLogout: () => void }) {
  return (
    <div className="account-badge">
      <span className="account-email">{email}</span>
      <button className="btn btn-small" onClick={onLogout}>
        Disconnect
      </button>
    </div>
  )
}
