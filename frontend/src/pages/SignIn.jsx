import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { login } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Logo } from '../components/Nav.jsx';
import { Aurora } from '../components/Effects.jsx';

export default function SignIn() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [form, setForm] = useState({ email: state?.email || '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      signIn(await login(form));
      navigate(state?.from || '/app', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <Aurora />
      <Logo />
      <form className="card auth-card" onSubmit={submit}>
        <h1>Sign in</h1>
        <p className="muted">Welcome back. Sign in to run an audit.</p>

        {state?.created && !error && (
          <p className="alert alert-success" role="status">Account created. Sign in to continue.</p>
        )}
        {error && <p className="alert alert-error" role="alert">{error}</p>}

        <label htmlFor="email">Email</label>
        <input id="email" type="email" value={form.email} onChange={update('email')} autoComplete="email" required />

        <label htmlFor="password">Password</label>
        <input id="password" type="password" value={form.password} onChange={update('password')}
          autoComplete="current-password" required autoFocus={!!state?.email} />

        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="auth-switch">New here? <Link to="/signup">Create an account</Link></p>
      </form>
    </main>
  );
}
