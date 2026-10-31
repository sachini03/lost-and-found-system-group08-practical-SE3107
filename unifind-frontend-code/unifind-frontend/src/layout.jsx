import React, { useEffect, useState } from "react";
import { Bell, Menu, X, Plus, User, LogOut, LayoutDashboard, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { Logo } from "./ui.jsx";
import { useApp } from "../lib/context.jsx";
import { href, navigate } from "../lib/router";

export function Nav({ path }) {
  const { user, signOut, unread } = useApp();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);

  const links = [
    ["/browse", "Browse items"],
    ["/report", "Report an item"],
    ["/about", "About"],
  ];

  return (
    <header className="nav">
      <div className="nav-inner">
        <Logo />
        <button className="nav-toggle" onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
        <nav className={`nav-links ${open ? "open" : ""}`}>
          {links.map(([to, label]) => (
            <a key={to} href={href(to)} className={path.startsWith(to) ? "active" : ""}>{label}</a>
          ))}
          <div className="nav-account">
            {user ? (
              <>
                <a className="icon-btn" href={href("/notifications")} aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
                  <Bell size={19} />
                  {unread > 0 && <span className="badge">{unread > 9 ? "9+" : unread}</span>}
                </a>
                {user.role === "admin" && (
                  <a className="icon-btn" href={href("/admin")} aria-label="Admin dashboard"><LayoutDashboard size={19} /></a>
                )}
                <a className="btn btn-outline btn-sm" href={href("/me")}><User size={16} />{user.name.split(" ")[0]}</a>
                <button className="icon-btn" onClick={() => { signOut(); navigate("/"); }} aria-label="Log out"><LogOut size={18} /></button>
              </>
            ) : (
              <>
                <a className="btn btn-outline btn-sm" href={href("/login")}>Log in</a>
                <a className="btn btn-primary btn-sm" href={href("/register")}>Sign up</a>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer-inner">
        <div>
          <Logo light />
          <p>Helping lost things find their way home across Sri Lanka.</p>
        </div>
        <div className="footer-links">
          <a href={href("/browse")}>Browse items</a>
          <a href={href("/report")}>Report an item</a>
          <a href={href("/about")}>About</a>
        </div>
      </div>
      <div className="wrap footer-bottom">
        <span>© 2026 UniFind · SE3107 Group 08</span>
        <span>Contact details are never shown on public listings.</span>
      </div>
    </footer>
  );
}

export function Toast() {
  const { toast, setToast } = useApp();
  if (!toast) return null;
  const Icon = toast.tone === "error" ? AlertCircle : toast.tone === "warn" ? Info : CheckCircle2;
  return (
    <div className={`toast toast-${toast.tone}`} role="status" key={toast.key}>
      <Icon size={18} />
      <span>{toast.message}</span>
      <button onClick={() => setToast(null)} aria-label="Dismiss"><X size={15} /></button>
    </div>
  );
}

export function FloatingReport({ path }) {
  if (path.startsWith("/report")) return null;
  return (
    <a className="fab" href={href("/report")}><Plus size={19} />Report item</a>
  );
}
