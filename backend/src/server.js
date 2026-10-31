require("dotenv").config();

const express = require("express");
const cors = require("cors");
 HEAD
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 4000;

const { pool } = require("./db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = Number(process.env.PORT || 4000);
const UPLOAD_DIR = path.join(__dirname, "..", "uploads");

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
 d8a08cdcbbdc209e8379e77aee4faaeee86a7984

app.use(
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
  })
);

app.use(express.json({ limit: "1mb" }));

 HEAD
const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "lost_found",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "",
});

// Test the backend and database connection
app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT current_database() AS database"
    );

    res.json({
      status: "ok",
      message: "UniFind backend is running",
      database: result.rows[0].database,
    });
  } catch (error) {
    console.error("Database connection error:", error.message);

    res.status(500).json({
      status: "error",
      message: "Backend is running, but the database connection failed.",
    });
  }
});

// Get all reports with optional filters
app.get("/api/items", async (req, res) => {
  try {
    const { search, category, district, kind } = req.query;

    const conditions = [];
    const values = [];

    if (search) {
      values.push(`%${search}%`);
      conditions.push(
        `(title ILIKE $${values.length}
          OR description ILIKE $${values.length}
          OR place ILIKE $${values.length})`
      );
    }

    if (category && category !== "All categories") {
      values.push(category);
      conditions.push(`category = $${values.length}`);
    }

    if (district && district !== "All districts") {
      values.push(district);
      conditions.push(`district = $${values.length}`);
    }

    if (kind && kind !== "Lost & Found") {
      if (!["Lost", "Found"].includes(kind)) {
        return res.status(400).json({
          error: "Type must be Lost or Found.",
        });
      }

      values.push(kind);
      conditions.push(`kind = $${values.length}`);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const result = await pool.query(
      `SELECT id, title, category, kind, district,
              place, TO_CHAR(date, 'YYYY-MM-DD') AS date,
              description
       FROM items
       ${whereClause}
       ORDER BY created_at DESC`,
      values
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Failed to retrieve reports:", error.message);

    res.status(500).json({
      error: "Failed to retrieve reports.",
    });
  }
});

// Submit a Lost or Found report
app.post("/api/items", async (req, res) => {
  try {
    const {
      title,
      category,
      kind,
      district,
      place,
      date,
      description,
    } = req.body;

// Serve uploaded images
app.use("/uploads", express.static(UPLOAD_DIR));

// Image uploads are stored on local disk (backend/uploads)
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

const imageStorage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, UPLOAD_DIR);
  },
  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
    callback(null, safeName);
  },
});

const uploadImage = multer({
  storage: imageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      return callback(new Error("Only PNG, JPG or WEBP images are allowed."));
    }
    callback(null, true);
  },
});

// Build a public image URL from a stored key (file name or full URL)
function buildImageUrl(req, key) {
  if (!key) return null;
  if (/^https?:\/\//i.test(key)) return key;
  return `${req.protocol}://${req.get("host")}/uploads/${key}`;
}

// First public photo of each report
const IMAGE_SUBQUERY = `(
  SELECT im.storage_key FROM item_images im
  WHERE im.item_id = i.id AND im.is_private_evidence = FALSE
  ORDER BY im.sort_order, im.uploaded_at
  LIMIT 1
) AS image_key`;

function formatItem(req, row) {
  const { image_key, ...item } = row;
  return {
    ...item,
    kind:
      item.kind === "LOST" ? "Lost" : item.kind === "FOUND" ? "Found" : item.kind,
    image_url: buildImageUrl(req, image_key),
  };
}

// API health check, including PostgreSQL connectivity
app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT current_database() AS database"
    );

    res.json({
      status: "ok",
      message: "UniFind backend and database are running",
      database: result.rows[0].database,
    });
  } catch (error) {
    console.error("Health check failed:", error.message);
    res.status(503).json({
      status: "error",
      message: "Database connection failed",
    });
  }
});

// ---------------------------------------------------------------
// Authentication (register / login / session)
// ---------------------------------------------------------------
let JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  JWT_SECRET = crypto.randomBytes(32).toString("hex");
  console.warn(
    "JWT_SECRET is not set in .env. Using a temporary secret: users will be logged out whenever the server restarts."
  );
}

const TOKEN_LIFETIME = "7d";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Used to keep login timing similar when the email does not exist
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

function publicUser(row) {
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    role: row.role,
  };
}

function signToken(user) {
  return jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: TOKEN_LIFETIME });
}

// Requires a valid "Authorization: Bearer <token>" header
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Please log in to continue." });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub };
    next();
  } catch (error) {
    return res
      .status(401)
      .json({ error: "Your session has expired. Please log in again." });
  }
}

app.post("/api/auth/register", async (req, res) => {
  const { full_name, email, password } = req.body || {};

  if (
    typeof full_name !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string"
  ) {
    return res.status(400).json({ error: "Please complete all fields." });
  }

  const name = full_name.trim();
  const normalizedEmail = email.trim().toLowerCase();

  if (name.length < 2 || name.length > 120) {
    return res
      .status(400)
      .json({ error: "Name must be between 2 and 120 characters." });
  }

  if (!EMAIL_PATTERN.test(normalizedEmail) || normalizedEmail.length > 255) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }

  // bcrypt only uses the first 72 bytes of a password
  if (password.length < 8 || Buffer.byteLength(password) > 72) {
    return res
      .status(400)
      .json({ error: "Password must be 8 to 72 characters long." });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (full_name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, full_name, email, role`,
      [name, normalizedEmail, passwordHash]
    );

    const user = publicUser(result.rows[0]);
    res.status(201).json({ token: signToken(user), user });
  } catch (error) {
    if (error.code === "23505") {
      return res
        .status(409)
        .json({ error: "An account with this email already exists." });
    }

    console.error("Register failed:", error.message);
    res.status(500).json({ error: "Unable to create the account." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};

  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Please enter your email and password." });
  }

  try {
    const result = await pool.query(
      `SELECT id, full_name, email, role, password_hash, is_active
       FROM users WHERE LOWER(email) = $1`,
      [email.trim().toLowerCase()]
    );

    const row = result.rows[0];
    const passwordOk = await bcrypt.compare(
      password,
      row ? row.password_hash : DUMMY_HASH
    );

    if (!row || !passwordOk || !row.is_active) {
      return res.status(401).json({ error: "Incorrect email or password." });
    }

    const user = publicUser(row);
    res.json({ token: signToken(user), user });
  } catch (error) {
    console.error("Login failed:", error.message);
    res.status(500).json({ error: "Unable to log in." });
  }
});

// Current logged-in user (used to restore the session on page load)
app.get("/api/auth/me", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name, email, role FROM users
       WHERE id = $1 AND is_active = TRUE`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Account not found." });
    }

    res.json({ user: publicUser(result.rows[0]) });
  } catch (error) {
    console.error("Session check failed:", error.message);
    res.status(500).json({ error: "Unable to check the session." });
  }
});

// Reports created by the logged-in user
app.get("/api/my/items", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         i.id,
         i.title,
         c.name AS category,
         i.item_type AS kind,
         d.name AS district,
         i.location_description AS place,
         to_char(i.event_date, 'YYYY-MM-DD') AS date,
         i.description,
         i.color,
         i.brand,
         i.created_at,
         ${IMAGE_SUBQUERY}
       FROM items i
       JOIN categories c ON c.id = i.category_id
       JOIN districts d ON d.id = i.district_id
       WHERE i.reporter_id = $1 AND i.status <> 'REMOVED'
       ORDER BY i.created_at DESC`,
      [req.user.id]
    );

    res.json(result.rows.map((row) => formatItem(req, row)));
  } catch (error) {
    console.error("Get my items failed:", error.message);
    res.status(500).json({ error: "Unable to retrieve your reports." });
  }
});

// Get one report by UUID
app.get("/api/items/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT
         i.id,
         i.title,
         c.name AS category,
         i.item_type AS kind,
         d.name AS district,
         i.location_description AS place,
         to_char(i.event_date, 'YYYY-MM-DD') AS date,
         i.description,
         i.color,
         i.brand,
         i.created_at,
         ${IMAGE_SUBQUERY}
       FROM items i
       JOIN categories c ON c.id = i.category_id
       JOIN districts d ON d.id = i.district_id
       WHERE i.id = $1
         AND i.is_public = TRUE
         AND i.status = 'ACTIVE'`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Item not found",
      });
    }

    res.json(formatItem(req, result.rows[0]));
  } catch (error) {
    if (error.code === "22P02") {
      return res.status(400).json({
        error: "Invalid item ID.",
      });
    }

    console.error("Get item failed:", error.message);
    res.status(500).json({
      error: "Unable to retrieve the report.",
    });
  }
});

// Get reports with optional search and filters
app.get("/api/items", async (req, res) => {
  try {
    const { search, category, district, kind } = req.query;

    const conditions = [
      "i.is_public = TRUE",
      "i.status = 'ACTIVE'",
    ];
    const values = [];

    if (search && String(search).trim()) {
      values.push(`%${String(search).trim()}%`);
      conditions.push(
        `(i.title ILIKE $${values.length}
          OR i.description ILIKE $${values.length}
          OR COALESCE(i.location_description, '') ILIKE $${values.length})`
      );
    }

    if (category && category !== "All categories") {
      values.push(String(category));
      conditions.push(`c.name = $${values.length}`);
    }

    if (district && district !== "All districts") {
      values.push(String(district));
      conditions.push(`d.name = $${values.length}`);
    }

    if (kind && kind !== "Lost & Found") {
      const normalizedKind = String(kind).toUpperCase();

      if (!["LOST", "FOUND"].includes(normalizedKind)) {
        return res.status(400).json({
          error: "Type must be Lost or Found.",
        });
      }

      values.push(normalizedKind);
      conditions.push(`i.item_type = $${values.length}::item_type`);
    }

    const query = `
      SELECT
        i.id,
        i.title,
        c.name AS category,
        i.item_type AS kind,
        d.name AS district,
        i.location_description AS place,
        to_char(i.event_date, 'YYYY-MM-DD') AS date,
        i.description,
        i.color,
        i.brand,
        i.created_at,
        ${IMAGE_SUBQUERY}
      FROM items i
      JOIN categories c ON c.id = i.category_id
      JOIN districts d ON d.id = i.district_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY i.created_at DESC
    `;

    const result = await pool.query(query, values);

    res.json(result.rows.map((row) => formatItem(req, row)));
  } catch (error) {
    console.error("Get items failed:", error.message);
    res.status(500).json({
      error: "Unable to retrieve reports.",
    });
  }
});

// Submit a new Lost or Found report
app.post("/api/items", requireAuth, uploadImage.single("image"), async (req, res) => {
  // If the request fails, do not keep the uploaded photo on disk.
  res.on("finish", () => {
    if (res.statusCode >= 400 && req.file) {
      fs.unlink(req.file.path, () => {});
    }
  });

  const {
    title,
    category,
    kind,
    district,
    place,
    date,
    description,
    color,
    brand,
  } = req.body || {};
 d8a08cdcbbdc209e8379e77aee4faaeee86a7984

    if (
      !title?.trim() ||
      !category?.trim() ||
      !kind ||
      !district?.trim() ||
      !place?.trim() ||
      !date ||
      !description?.trim()
    ) {
      return res.status(400).json({
        error: "Please complete all required fields.",
      });
    }

    if (!["Lost", "Found"].includes(kind)) {
      return res.status(400).json({
        error: "Type must be Lost or Found.",
      });
    }

    // Check that the date is in YYYY-MM-DD format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        error: "Please provide a valid date in YYYY-MM-DD format.",
      });
    }

    const result = await pool.query(
      `INSERT INTO items
        (title, category, kind, district, place, date, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, title, category, kind, district,
                 place, TO_CHAR(date, 'YYYY-MM-DD') AS date,
                 description`,
      [
        title.trim(),
        category.trim(),
        kind,
        district.trim(),
        place.trim(),
        date,
        description.trim(),
      ]
    );

    res.status(201).json({
      message: "Report submitted successfully.",
      item: result.rows[0],
    });
  } catch (error) {
    console.error("Failed to submit report:", error.message);

    res.status(500).json({
      error: "Failed to submit report.",
    });
  }
 HEAD
});

// Get one report by ID
app.get("/api/items/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        error: "Invalid item ID.",
      });
    }

    const result = await pool.query(
      `SELECT id, title, category, kind, district,
              place, TO_CHAR(date, 'YYYY-MM-DD') AS date,
              description
       FROM items
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Item not found.",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Failed to retrieve report:", error.message);

    res.status(500).json({
      error: "Failed to retrieve report.",
    });
  }
});

// Start the server
const server = app.listen(PORT, () => {
  console.log(`UniFind backend running at http://localhost:${PORT}`);
});

// Handle unexpected database connection failures
pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error.message);
});

// Close database connections cleanly
process.on("SIGINT", async () => {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
});


  const normalizedKind = String(kind).toUpperCase();

  if (!["LOST", "FOUND"].includes(normalizedKind)) {
    return res.status(400).json({
      error: "Type must be Lost or Found.",
    });
  }

  if (
    typeof title !== "string" ||
    title.trim().length < 3 ||
    title.trim().length > 180 ||
    typeof description !== "string" ||
    description.trim().length < 5 ||
    typeof place !== "string" ||
    place.trim().length > 255
  ) {
    return res.status(400).json({
      error: "Please check the title, location, and description.",
    });
  }

  try {
    // The report belongs to the logged-in user.
    const userResult = await pool.query(
      "SELECT id FROM users WHERE id = $1 AND is_active = TRUE",
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: "Account not found. Please log in again.",
      });
    }

    const categoryResult = await pool.query(
      "SELECT id FROM categories WHERE LOWER(name) = LOWER($1) AND is_active = TRUE",
      [String(category).trim()]
    );

    if (categoryResult.rows.length === 0) {
      return res.status(400).json({
        error: "Unknown category. Please choose a valid category.",
      });
    }

    const districtResult = await pool.query(
      "SELECT id FROM districts WHERE LOWER(name) = LOWER($1)",
      [String(district).trim()]
    );

    if (districtResult.rows.length === 0) {
      return res.status(400).json({
        error: "Unknown district. Please choose a valid district.",
      });
    }

    const client = await pool.connect();
    let insertResult;

    try {
      await client.query("BEGIN");

      insertResult = await client.query(
        `INSERT INTO items (
           reporter_id,
           item_type,
           category_id,
           title,
           description,
           brand,
           color,
           district_id,
           location_description,
           event_date
         )
         VALUES ($1, $2::item_type, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id, title, item_type AS kind,
                   to_char(event_date, 'YYYY-MM-DD') AS date,
                   description, location_description AS place, created_at`,
        [
          userResult.rows[0].id,
          normalizedKind,
          categoryResult.rows[0].id,
          title.trim(),
          description.trim(),
          brand ? String(brand).trim() : null,
          color ? String(color).trim() : null,
          districtResult.rows[0].id,
          place.trim(),
          date,
        ]
      );

      // Save the uploaded photo (if any) against this report
      if (req.file) {
        await client.query(
          `INSERT INTO item_images (item_id, storage_key, caption)
           VALUES ($1, $2, $3)`,
          [insertResult.rows[0].id, req.file.filename, title.trim()]
        );
      }

      await client.query("COMMIT");
    } catch (txError) {
      await client.query("ROLLBACK");
      throw txError;
    } finally {
      client.release();
    }

    res.status(201).json({
      message: "Report submitted successfully.",
      item: {
        ...formatItem(req, {
          ...insertResult.rows[0],
          image_key: req.file ? req.file.filename : null,
        }),
      },
    });
  } catch (error) {
    if (error.code === "22008" || error.code === "22007") {
      return res.status(400).json({
        error: "Please provide a valid report date.",
      });
    }

    console.error("Create item failed:", error.message);
    res.status(500).json({
      error: "Unable to submit the report.",
    });
  }
;

app.post("/api/upload", uploadImage.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Please select an image." });
  }

  res.status(201).json({
    message: "Image uploaded successfully.",
    imageUrl: `http://localhost:${PORT}/uploads/${req.file.filename}`,
  });
});
// Handle unexpected request errors
app.use((err, req, res, next) => {
  console.error("Request error:", err.message);

  if (res.headersSent) {
    return next(err);
  }

  res.status(400).json({
    error: err.message || "Invalid request.",
  });
});
app.listen(PORT, () => {
  console.log(`UniFind backend running at http://localhost:${PORT}`);
});
 d8a08cdcbbdc209e8379e77aee4faaeee86a7984
