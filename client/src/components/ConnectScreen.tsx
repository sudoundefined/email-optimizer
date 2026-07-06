export default function ConnectScreen() {
  return (
    <>
      <div className="airmail-edge" aria-hidden="true" />
      <div className="center-screen">
        <div className="connect-card">
          <div className="connect-stamp" aria-hidden="true">✉</div>
          <h1 className="connect-title">Email Unsubscriber</h1>
          <p className="connect-copy">
            Scan your Gmail for marketing email, unsubscribe in bulk, sort senders into labels, and
            clear out what you never read.
          </p>
          <a className="btn btn-primary btn-large" href="/api/auth/login">
            Sign in with Google
          </a>
          <p className="hint">
            While the app is in Google "Testing" mode, sessions expire after about 7 days and you'll
            need to sign in again.
          </p>
        </div>
      </div>
    </>
  )
}
