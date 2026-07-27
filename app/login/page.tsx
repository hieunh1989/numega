"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { apiRequest } from "../lib/api";

type AuthUser = { id: string; full_name: string; email: string; role: "Admin" | "User"; status: string };

function safeReturnPath() {
  if (typeof window === "undefined") return "/";
  const value = new URLSearchParams(window.location.search).get("returnTo") || "/";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiRequest<AuthUser>("/api/auth/me")
      .then(() => { window.location.replace(safeReturnPath()); })
      .catch(() => undefined);
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const user = await apiRequest<AuthUser>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      const requested = safeReturnPath();
      window.location.replace(requested === "/admin" && user.role !== "Admin" ? "/" : requested);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-shell">
      <section className="login-card">
        <Link className="login-logo" href="/" aria-label="Back to Numega">
          <Image src="/numega-logo.png" alt="Numega" width={588} height={126} priority />
        </Link>
        <div className="login-heading">
          <span>NUMEGA FEED FORMULA</span>
          <h1>Sign In</h1>
          <p>Use an authorized account to continue.</p>
        </div>
        <form onSubmit={submit} className="login-form">
          <label>
            <span>Email</span>
            <input type="email" inputMode="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@numega.com" required autoFocus />
          </label>
          <label>
            <span>Password</span>
            <div className="password-field">
              <input type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter password" required />
              <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button>
            </div>
          </label>
          {error && <div className="login-error" role="alert">{error}</div>}
          <button className="login-submit" type="submit" disabled={submitting}>{submitting ? "Signing in…" : "Sign In"}</button>
        </form>
        <Link className="login-back" href="/">← Back to Calculator</Link>
      </section>
    </main>
  );
}
