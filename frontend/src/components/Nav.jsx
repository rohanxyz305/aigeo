import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="AI Rank Checker home">
      <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="var(--accent)" />
        <path d="M8 21l5-6 4 4 7-9" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>AI Rank Checker</span>
    </Link>
  );
}

export default function Nav() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="nav">
      <div className="nav-inner">
        <Logo />
        {user ? (
          <nav className="nav-actions">
            <span className="nav-user">{user.name}</span>
            <Link to="/app" className="btn btn-ghost">Dashboard</Link>
            <button type="button" className="btn btn-outline" onClick={() => { signOut(); navigate('/'); }}>
              Sign out
            </button>
          </nav>
        ) : (
          <nav className="nav-actions">
            <Link to="/signin" className="btn btn-ghost">Sign in</Link>
            <Link to="/signup" className="btn btn-primary">Sign up</Link>
          </nav>
        )}
      </div>
    </header>
  );
}
