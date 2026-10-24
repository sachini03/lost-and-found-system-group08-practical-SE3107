const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 4000;

app.use(
  cors({
    origin: "http://localhost:5173",
  })
);

app.use(express.json());

// Temporary sample reports
let items = [
  {
    id: 1,
    title: "Black Wallet",
    category: "Wallet",
    kind: "Lost",
    district: "Colombo",
    place: "University Library",
    date: "2026-10-18",
    description: "A black wallet was lost near the library.",
  },
  {
    id: 2,
    title: "Student ID Card",
    category: "ID Card",
    kind: "Found",
    district: "Gampaha",
    place: "Bus Stand",
    date: "2026-10-17",
    description: "A student ID card was found near the bus stand.",
  },
];

// Test the backend
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "UniFind backend is running",
  });
});

// Get all reports
app.get("/api/items", (req, res) => {
  const { search, category, district, kind } = req.query;

  let result = [...items];

  if (search) {
    const keyword = search.toLowerCase();

    result = result.filter((item) =>
      `${item.title} ${item.description} ${item.place}`
        .toLowerCase()
        .includes(keyword)
    );
  }

  if (category && category !== "All categories") {
    result = result.filter(
      (item) => item.category === category
    );
  }

  if (district && district !== "All districts") {
    result = result.filter(
      (item) => item.district === district
    );
  }

  if (kind && kind !== "Lost & Found") {
    result = result.filter(
      (item) =>
        item.kind.toLowerCase() === kind.toLowerCase()
    );
  }

  res.json(result);
});

// Submit a Lost or Found report
app.post("/api/items", (req, res) => {
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

  if (!["Lost", "Found"].includes(kind)) {
    return res.status(400).json({
      error: "Type must be Lost or Found.",
    });
  }

  const newItem = {
    id: Date.now(),
    title,
    category,
    kind,
    district,
    place,
    date,
    description,
  };

  items.push(newItem);

  res.status(201).json({
    message: "Report submitted successfully.",
    item: newItem,
  });
});

// Get a single report
app.get("/api/items/:id", (req, res) => {
  const item = items.find(
    (entry) => entry.id === Number(req.params.id)
  );

  if (!item) {
    return res.status(404).json({
      error: "Item not found",
    });
  }

  res.json(item);
});

// Start the server
app.listen(PORT, () => {
  console.log(
    `UniFind backend running at http://localhost:${PORT}`
  );
});