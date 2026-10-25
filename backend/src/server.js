
const express = require("express");
const cors = require("cors");
const { pool } = require("./db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

require("dotenv").config();

const app = express();
const PORT = Number(process.env.PORT || 4000);
const UPLOAD_DIR = path.join(__dirname, "..", "uploads");

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(
  cors({
    origin: "http://localhost:5173",
  })
);

app.use(express.json({ limit: "1mb" }));

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

// Get reports, with optional search and filters


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
         i.event_date AS date,
         i.description,
         i.color,
         i.brand,
         i.created_at
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

    const item = result.rows[0];

    res.json({
      ...item,
      kind:
        item.kind === "LOST"
          ? "Lost"
          : item.kind === "FOUND"
            ? "Found"
            : item.kind,
    });
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
        i.event_date AS date,
        i.description,
        i.color,
        i.brand,
        i.created_at
      FROM items i
      JOIN categories c ON c.id = i.category_id
      JOIN districts d ON d.id = i.district_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY i.created_at DESC
    `;

    const result = await pool.query(query, values);

    res.json(
      result.rows.map((item) => ({
        ...item,
        kind:
          item.kind === "LOST"
            ? "Lost"
            : item.kind === "FOUND"
              ? "Found"
              : item.kind,
      }))
    );
  } catch (error) {
    console.error("Get items failed:", error.message);
    res.status(500).json({
      error: "Unable to retrieve reports.",
    });
  }
});
app.post("/api/items", async (req, res) => {
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
  } = req.body;

  if (
    !title ||
    !category ||
    !kind ||
    !district ||
    !place ||
    !date ||
    !description
  ) {
    return res.status(400).json({
      error: "Please complete all required fields.",
    });
  }

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
    // Use the existing local development user.
    const userResult = await pool.query(
      "SELECT id FROM users ORDER BY created_at ASC LIMIT 1"
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({
        error: "No user exists. Create a user before submitting reports.",
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

    const insertResult = await pool.query(
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
       RETURNING id, title, item_type AS kind, event_date AS date,
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

    res.status(201).json({
      message: "Report submitted successfully.",
      item: {
        ...insertResult.rows[0],
        kind:
          insertResult.rows[0].kind === "LOST"
            ? "Lost"
            : "Found",
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
});

// Handle unexpected request errors
app.use((err, req, res, next) => {
  console.error("Request error:", err.message);

  if (res.headersSent) {
    return next(err);
  }

  res.status(400).json({
    error: "Invalid request.",
  });
});
// Serve uploaded images
app.use("/uploads", express.static(UPLOAD_DIR));

// Upload an item image to local storage
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
    if (!file.mimetype.startsWith("image/")) {
      return callback(new Error("Only image files are allowed."));
    }
    callback(null, true);
  },
});

app.post("/api/upload", uploadImage.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Please select an image." });
  }

  res.status(201).json({
    message: "Image uploaded successfully.",
    imageUrl: `http://localhost:${PORT}/uploads/${req.file.filename}`,
  });
});
app.listen(PORT, () => {
  console.log(`UniFind backend running at http://localhost:${PORT}`);
});
