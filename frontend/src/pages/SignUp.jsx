import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signup } from '../api.js';
import { Logo } from '../components/Nav.jsx';

export default function SignUp() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { email } = await signup(form);
      navigate('/signin', { state: { created: true, email } });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <Logo />
      <form className="card auth-card" onSubmit={submit}>
        <h1>Create your account</h1>
        <p className="muted">Sign up to run site audits and get platform-specific fixes.</p>

        {error && <p className="alert alert-error" role="alert">{error}</p>}

        <label htmlFor="name">Name</label>
        <input id="name" value={form.name} onChange={update('name')} autoComplete="name" required maxLength={100} />

        <label htmlFor="email">Email</label>
        <input id="email" type="email" value={form.email} onChange={update('email')} autoComplete="email" required />

        <label htmlFor="password">Password</label>
        <input id="password" type="password" value={form.password} onChange={update('password')}
          autoComplete="new-password" required minLength={8} maxLength={72} aria-describedby="pw-hint" />
        <p className="hint" id="pw-hint">At least 8 characters.</p>

        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Creating account…' : 'Sign up'}</button>
        <p className="auth-switch">Already have an account? <Link to="/signin">Sign in</Link></p>
      </form>
    </main>
  );
}
