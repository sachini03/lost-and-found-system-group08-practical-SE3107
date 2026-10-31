const bcrypt = require("bcryptjs");
const { pool } = require("./db");

const sampleItems = [
  ["iPhone 13 (Black)", "Electronics", "Smartphone", "Lost", "Colombo", "University of Colombo", "Black", "Apple", "Black iPhone 13 with a clear protective case. A small scratch is visible near the camera.", 3],
  ["Student ID Card", "Documents & Cards", "Student ID", "Found", "Gampaha", "University of Kelaniya", "White", "University ID", "A student identity card was found near the library entrance. The name is hidden for privacy.", 6],
  ["Black Backpack", "Bags", "Backpack", "Lost", "Kandy", "Peradeniya campus canteen", "Black", "HP", "Black backpack with a laptop compartment, small keychain and university logo.", 8],
  ["Key Set", "Keys", "Key Set", "Found", "Galle", "Galle bus stand", "Gold", "Unknown", "A small set of keys on a metal key ring was found near a bus stop.", 9],
  ["Samsung Earbuds", "Electronics", "Earbuds/Headphones", "Lost", "Matara", "Matara town", "Black", "Samsung", "Black wireless earbuds in a compact charging case.", 11],
  ["Brown Leather Wallet", "Bags", "Wallet", "Found", "Kandy", "Campus security office", "Brown", "Unknown", "A brown leather wallet was handed to the campus security office. Contents are not shown.", 13],
  ["Silver Wrist Watch", "Jewelry & Accessories", "Watch", "Found", "Colombo", "Colombo 07 study area", "Silver", "Unknown", "Silver wrist watch found in a study area.", 14],
  ["Blue Water Bottle", "Personal Items", "Bottle", "Lost", "Gampaha", "University grounds", "Blue", "Unknown", "Reusable blue water bottle with a small sticker on the side.", 15],
  ["Lecture Notebook", "Documents & Cards", "Book/Notebook", "Found", "Kurunegala", "Lecture hall 3", "Brown", "Unknown", "A notebook was found in a lecture room. The writing inside is kept private.", 16],
];

// Creates the admin account and a few sample reports on a fresh database.
async function seed() {
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@unifind.lk").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin@12345";

  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [adminEmail]);
  if (existing.rows.length === 0) {
    const hash = await bcrypt.hash(adminPassword, 10);
    await pool.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'admin')",
      ["UniFind Admin", adminEmail, hash]
    );
    console.log(`Admin account created: ${adminEmail}`);
  }

  const count = await pool.query("SELECT COUNT(*)::int AS n FROM items");
  if (count.rows[0].n === 0) {
    for (const [title, category, subcategory, kind, district, place, color, brand, description, daysAgo] of sampleItems) {
      await pool.query(
        `INSERT INTO items (title, category, subcategory, kind, district, place, date, description, color, brand, created_at)
         VALUES ($1,$2,$3,$4,$5,$6, CURRENT_DATE - $7::int, $8,$9,$10, NOW() - ($7::int * INTERVAL '1 day'))`,
        [title, category, subcategory, kind, district, place, daysAgo, description, color, brand]
      );
    }
    console.log("Sample items added.");
  }
}

module.exports = { seed };
