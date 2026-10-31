const jwt = require("jsonwebtoken");
const { pool } = require("./db");

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-secret-change-me";
if (!process.env.JWT_SECRET) {
  console.warn("WARNING: JWT_SECRET is not set. Using an insecure development secret.");
}

function signToken(user) {
  return jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "7d" });
}

async function loadUser(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  try {
    const { id } = jwt.verify(token, JWT_SECRET);
    const result = await pool.query(
      "SELECT id, name, email, role FROM users WHERE id = $1",
      [id]
    );
    return result.rows[0] || null;
  } catch {
    return null;
  }
}

// Adds req.user when a valid token is sent, otherwise continues anonymously.
async function optionalAuth(req, res, next) {
  req.user = await loadUser(req);
  next();
}

async function requireAuth(req, res, next) {
  req.user = await loadUser(req);
  if (!req.user) return res.status(401).json({ error: "Please log in to continue." });
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Administrator access required." });
  }
  next();
}

module.exports = { signToken, optionalAuth, requireAuth, requireAdmin };
