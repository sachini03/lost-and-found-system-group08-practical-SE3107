require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(
  cors({
    origin: "http://localhost:5173",
  })
);

app.use(express.json());

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