import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageTitle } from "../components/PageTitle";
import { useAuth } from "../context/AuthContext";

export function LoginPage() {
  const { user, loading, error, login, logout } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("Monty@test.com");
  const [password, setPassword] = useState("Test");

  async function submit(event: FormEvent) {
    event.preventDefault();
    await login(email, password);
    navigate("/profile");
  }

  return (
    <div className="page narrow">
      <PageTitle title="Login" />
      <div className="page-head">
        <span className="eyebrow">Account</span>
        <h1>Log in to AutoVinFix</h1>
        <p>Use an account to keep saved vehicles, history, to-dos, costs, and diagnostic notes backed up.</p>
      </div>

      {user ? (
        <div className="card">
          <h2>You are logged in</h2>
          <p className="muted">{user.email}</p>
          <button className="secondary danger-soft" onClick={logout}>Log out</button>
        </div>
      ) : (
        <form className="card" onSubmit={submit}>
          <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" /></label>
          <label>Password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" /></label>
          <button className="primary" disabled={loading} type="submit">{loading ? "Logging in..." : "Log in"}</button>
          {error ? <div className="state error">{error}</div> : null}
          <div className="empty-card">
            Test accounts: `Monty@test.com` / `Test` and `Eddie@test.com` / `test`.
          </div>
        </form>
      )}
    </div>
  );
}
