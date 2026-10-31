import React, { useEffect, useMemo, useState } from "react";
import {
  MapPin,
  Search,
  ChevronDown,
  Bell,
  Menu,
  X,
  Plus,
  Heart,
  CalendarDays,
  ShieldCheck,
  ArrowUpRight,
  PackageSearch,
  SlidersHorizontal,
  Upload,
  ChevronRight,
  CheckCircle2,
  MessageCircle,
  ClipboardList,
  Users,
  Building2,
  Eye,
  LockKeyhole,
  Send,
  Paperclip,
  Clock3,
  CircleHelp,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { categories, districts } from "./data/items";
import { getItems, createItem } from "./api";

const navItems = ["Home", "Explore", "Report Item", "About"];

const emptyForm = {
  title: "",
  category: "",
  subcategory: "",
  district: "",
  location: "",
  date: "",
  description: "",
  brand: "",
  color: "",
};

// Maps an API record to the shape the UI uses. Kind is normalised to
// "Lost" / "Found" so filters, tabs and the status badge always agree.
const normalizeItem = (item) => {
  const kind = String(item.kind || item.type || "Lost");
  return {
    ...item,
    type: kind.charAt(0).toUpperCase() + kind.slice(1).toLowerCase(),
    location: item.place,
    subcategory: item.subcategory || item.category,
    image: item.image_url || item.image || "",
  };
};

function Logo({ onClick }) {
  return (
    <button className="brand" onClick={onClick} aria-label="FindIt home">
      <span className="brand-pin">
        <MapPin size={21} fill="currentColor" />
      </span>
      <span>
        Find<span>It</span>
      </span>
    </button>
  );
}

function Status({ type }) {
  return <span className={`status ${type.toLowerCase()}`}>{type} Item</span>;
}

function LoadingState({ label = "Loading items..." }) {
  return (
    <div className="loading-state" role="status">
      <span className="loading-spinner" />
      {label}
    </div>
  );
}

function ItemCard({ item, saved, onSave, onOpen }) {
  return (
    <article className="item-card">
      <button className="item-image" onClick={() => onOpen(item)}>
        <img src={item.image} alt={item.title} loading="lazy" />
        <Status type={item.type} />
      </button>
      <button
        className={`save-btn ${saved ? "saved" : ""}`}
        onClick={() => onSave(item.id)}
        aria-label={saved ? "Remove saved item" : "Save item"}
      >
        <Heart size={17} fill={saved ? "currentColor" : "none"} />
      </button>
      <button className="item-card-body" onClick={() => onOpen(item)}>
        <h3>{item.title}</h3>
        <p className="item-meta">
          <CalendarDays size={14} />
          {item.date
            ? new Date(item.date).toLocaleDateString("en-CA", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              })
            : "Date unavailable"}
        </p>
        <p className="item-meta">
          <MapPin size={14} />
          {item.district}
        </p>
        <div className="card-bottom">
          <span className="category-pill">{item.category}</span>
          <span className="view-arrow">
            <ArrowUpRight size={16} />
          </span>
        </div>
      </button>
    </article>
  );
}

function App() {
  const [page, setPage] = useState("Home");
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All categories");
  const [districtFilter, setDistrictFilter] = useState("All districts");
  const [sort, setSort] = useState("Newest first");
  const [saved, setSaved] = useState([]);
  const [selected, setSelected] = useState(null);
  const [reportType, setReportType] = useState("Lost");
  const [mobileNav, setMobileNav] = useState(false);
  const [notice, setNotice] = useState(null); // { text, type: "success" | "error" }
  const [loadingItems, setLoadingItems] = useState(true);
  const [profileTab, setProfileTab] = useState("Lost");
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    let cancelled = false;

    async function loadItems() {
      try {
        const data = await getItems();
        if (!cancelled) setItems(data.map(normalizeItem));
      } catch (error) {
        console.error("Failed to load reports:", error);
        if (!cancelled) {
          setNotice({
            text: "Could not load reports from the server.",
            type: "error",
          });
        }
      } finally {
        if (!cancelled) setLoadingItems(false);
      }
    }

    loadItems();
    return () => {
      cancelled = true;
    };
  }, []);

  // Notices clear themselves after a few seconds.
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  const filteredItems = useMemo(() => {
    let list = items.filter((item) => {
      const text =
        `${item.title} ${item.category} ${item.subcategory} ${item.district} ${item.location} ${item.description}`.toLowerCase();
      return (
        text.includes(query.toLowerCase()) &&
        (typeFilter === "All" || item.type === typeFilter) &&
        (categoryFilter === "All categories" ||
          item.category === categoryFilter) &&
        (districtFilter === "All districts" || item.district === districtFilter)
      );
    });
    if (sort === "Oldest first") list = [...list].reverse();
    return list;
  }, [items, query, typeFilter, categoryFilter, districtFilter, sort]);

  // `flash` lets a page change show a message ({ text, type }) after navigating.
  const go = (p, flash = null) => {
    setPage(p);
    setMobileNav(false);
    setNotice(flash);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openItem = (item) => {
    setSelected(item);
    go("Item Details");
  };

  const toggleSaved = (id) =>
    setSaved((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const startReport = (type) => {
    setReportType(type);
    setForm(emptyForm);
    setStep(1);
    go("Report Item");
  };

  const updateForm = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const submitReport = async (e) => {
    e.preventDefault();

    try {
      const payload = {
        title: form.title.trim(),
        kind: reportType.toUpperCase(),
        category: form.category,
        subcategory: form.subcategory || form.category,
        district: form.district,
        place: form.location,
        date: form.date || new Date().toISOString().slice(0, 10),
        description:
          form.description || "No additional description provided.",
        brand: form.brand || "",
        color: form.color || "",
      };

      await createItem(payload);
      const data = await getItems();
      setItems(data.map(normalizeItem));
      setForm(emptyForm);
      go("Explore", {
        text: `${reportType} item report submitted successfully.`,
        type: "success",
      });
    } catch (error) {
      console.error("Report submission failed:", error);
      setNotice({
        text: error.message || "Could not submit the report.",
        type: "error",
      });
    }
  };

  const resetFilters = () => {
    setQuery("");
    setTypeFilter("All");
    setCategoryFilter("All categories");
    setDistrictFilter("All districts");
  };

  const profileItems = items.filter((i) => i.type === profileTab).slice(0, 8);
  const savedItems = items.filter((i) => saved.includes(i.id));
  const chatItem = selected || items[2] || items[0] || null;

  const notifications = [
    {
      icon: <Sparkles size={18} />,
      title: "New possible match found",
      body: "Your lost item “Black Backpack” has a possible match.",
      time: "2 hours ago",
    },
    {
      icon: <MessageCircle size={18} />,
      title: "New message",
      body: "You have a new message about your item.",
      time: "4 hours ago",
    },
    {
      icon: <CheckCircle2 size={18} />,
      title: "Status updated",
      body: "Your item “Student ID Card” has been marked as returned.",
      time: "Yesterday",
    },
    {
      icon: <PackageSearch size={18} />,
      title: "New found item in your district",
      body: "A new found item has been posted in Colombo.",
      time: "1 day ago",
    },
  ];

  const navigate = (n) => (n === "Report Item" ? startReport("Lost") : go(n));

  return (
    <div className="app-shell">
      {/* ===================== NAVIGATION ===================== */}
      <header className="topbar">
        <div className="nav-inner">
          <Logo onClick={() => go("Home")} />
          <nav className="main-nav" aria-label="Main navigation">
            {navItems.map((n) => (
              <button
                key={n}
                className={page === n ? "nav-link active" : "nav-link"}
                onClick={() => navigate(n)}
              >
                {n}
                {n === "Explore" && <ChevronDown size={13} />}
              </button>
            ))}
          </nav>
          <div className="nav-actions">
            <button
              className="icon-button notification-trigger"
              onClick={() => go("Notifications")}
              aria-label="Notifications"
            >
              <Bell size={19} />
              <i />
            </button>
            <button
              className="avatar-button"
              onClick={() => go("Profile")}
              aria-label="Profile"
            >
              <img
                src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80"
                alt="Profile"
              />
            </button>
            <button className="btn btn-outline" onClick={() => go("Login")}>
              Log in
            </button>
            <button className="btn btn-primary" onClick={() => go("Register")}>
              Sign up
            </button>
            <button
              className="icon-button mobile-menu"
              onClick={() => setMobileNav(!mobileNav)}
              aria-label={mobileNav ? "Close menu" : "Open menu"}
              aria-expanded={mobileNav}
            >
              {mobileNav ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>

      {/* The new stylesheet hides .main-nav on mobile, so the open menu
          reuses the profile-menu list styles. */}
      {mobileNav && (
        <div className="wrap">
          <nav className="profile-sidebar" aria-label="Mobile navigation">
            <div className="profile-menu">
              {navItems.map((n) => (
                <button
                  key={n}
                  className={page === n ? "active" : ""}
                  onClick={() => navigate(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </nav>
        </div>
      )}

      {notice && (
        <div className="wrap">
          <div
            className={notice.type === "error" ? "error-message" : "success-message"}
            role="status"
          >
            {notice.text}
          </div>
        </div>
      )}

      {/* ===================== HOME ===================== */}
      {page === "Home" && (
        <>
          <section className="hero">
            <div className="hero-image" />
            <div className="hero-shade" />
            <div className="hero-content">
              <div className="eyebrow">
                <span className="eyebrow-dot" /> SRI LANKA'S COMMUNITY LOST &
                FOUND
              </div>
              <h1>
                Lost something?
                <br />
                Found something?
              </h1>
              <p className="hero-copy">
                A trusted platform to reunite people with their lost belongings
                across Sri Lanka.
              </p>
              <form
                className="hero-search"
                onSubmit={(e) => {
                  e.preventDefault();
                  go("Explore");
                }}
              >
                <Search size={19} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search for lost or found items..."
                />
                <button className="search-submit" aria-label="Search">
                  <Search size={20} />
                </button>
              </form>
              <div className="hero-filters">
                <label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  >
                    <option>All categories</option>
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} />
                </label>
                <label>
                  <select
                    value={districtFilter}
                    onChange={(e) => setDistrictFilter(e.target.value)}
                  >
                    <option>All districts</option>
                    {districts.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} />
                </label>
                <label>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                  >
                    <option value="All">Lost & Found</option>
                    <option>Lost</option>
                    <option>Found</option>
                  </select>
                  <ChevronDown size={14} />
                </label>
              </div>
              <div className="hero-trust">
                <ShieldCheck size={16} /> Your privacy is protected at every
                step
              </div>
            </div>
            <div className="hero-note">
              <span className="note-heart">
                <Heart size={18} fill="currentColor" />
              </span>
              <strong>
                Let's bring items
                <br />
                back home together.
              </strong>
              <span>Small acts make a big difference.</span>
            </div>
            <div className="hero-caption">
              <MapPin size={13} /> Connecting communities across Sri Lanka
            </div>
          </section>

          <section className="features wrap">
            <div className="feature">
              <span className="feature-icon blue">
                <Building2 />
              </span>
              <h3>Universities</h3>
              <p>Join and manage items within your campus.</p>
            </div>
            <div className="feature">
              <span className="feature-icon orange">
                <Users />
              </span>
              <h3>Public Access</h3>
              <p>Available for everyone across Sri Lanka.</p>
            </div>
            <div className="feature">
              <span className="feature-icon teal">
                <MapPin />
              </span>
              <h3>District Wise</h3>
              <p>Search items by district easily.</p>
            </div>
            <div className="feature">
              <span className="feature-icon purple">
                <ShieldCheck />
              </span>
              <h3>Safe & Anonymous</h3>
              <p>Your identity stays private until confirmed.</p>
            </div>
          </section>

          <section className="stats wrap">
            <div>
              <strong>
                1,250<span>+</span>
              </strong>
              <p>Items Reunited</p>
            </div>
            <div>
              <strong>
                45<span>+</span>
              </strong>
              <p>Universities</p>
            </div>
            <div>
              <strong>25</strong>
              <p>Districts Covered</p>
            </div>
            <div>
              <strong>
                98<span>%</span>
              </strong>
              <p>Positive Response</p>
            </div>
          </section>

          <section className="section wrap">
            <div className="section-heading">
              <div>
                <span className="section-kicker">COMMUNITY UPDATES</span>
                <h2>Recently reported items</h2>
                <p>Help someone find what they're missing.</p>
              </div>
              <button className="btn btn-outline" onClick={() => go("Explore")}>
                Explore all items <ArrowUpRight size={16} />
              </button>
            </div>
            {loadingItems ? (
              <LoadingState />
            ) : (
              <div className="item-grid">
                {items.slice(0, 4).map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    saved={saved.includes(item.id)}
                    onSave={toggleSaved}
                    onOpen={openItem}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="cta wrap">
            <div className="cta-icon">
              <PackageSearch size={28} />
            </div>
            <div>
              <h2>Have you lost or found something?</h2>
              <p>One small report can make someone's day.</p>
            </div>
            <div className="cta-actions">
              <button
                className="btn btn-white"
                onClick={() => startReport("Lost")}
              >
                Report lost item
              </button>
              <button
                className="btn btn-ghost-light"
                onClick={() => startReport("Found")}
              >
                Report found item
              </button>
            </div>
          </section>
        </>
      )}

      {/* ===================== EXPLORE ===================== */}
      {(page === "Explore" || page === "Browse Items") && (
        <main className="wrap page-main">
          <div className="page-title-row">
            <div>
              <span className="section-kicker">
                FIND WHAT YOU'RE LOOKING FOR
              </span>
              <h1>Search Lost & Found Items</h1>
              <p>Search by keyword, category or district to find your item.</p>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => startReport("Lost")}
            >
              <Plus size={17} /> Report an item
            </button>
          </div>
          <form className="browse-search" onSubmit={(e) => e.preventDefault()}>
            <Search size={19} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for items (e.g. phone, wallet, notebook...)"
            />
            <button className="btn btn-primary" aria-label="Search">
              <Search size={18} />
              <span>Search</span>
            </button>
          </form>
          <div className="filter-row">
            <label className="filter-select">
              <span>Category</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option>All categories</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <ChevronDown size={14} />
            </label>
            <label className="filter-select">
              <span>District</span>
              <select
                value={districtFilter}
                onChange={(e) => setDistrictFilter(e.target.value)}
              >
                <option>All districts</option>
                {districts.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
              <ChevronDown size={14} />
            </label>
            <label className="filter-select">
              <span>Status</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="All">Lost & Found</option>
                <option>Lost</option>
                <option>Found</option>
              </select>
              <ChevronDown size={14} />
            </label>
            <label className="filter-select sort-select">
              <span>Sort by</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option>Newest first</option>
                <option>Oldest first</option>
              </select>
              <ChevronDown size={14} />
            </label>
            <button className="clear-filters" onClick={resetFilters}>
              <X size={14} /> Clear
            </button>
          </div>
          <div className="type-tabs">
            {["All", "Lost", "Found"].map((t) => (
              <button
                key={t}
                className={typeFilter === t ? "type-tab active" : "type-tab"}
                onClick={() => setTypeFilter(t)}
              >
                {t === "All" ? "All items" : `${t} items`}
                <span>
                  {t === "All"
                    ? items.length
                    : items.filter((i) => i.type === t).length}
                </span>
              </button>
            ))}
          </div>
          <div className="results-head">
            <p>
              <strong>{filteredItems.length}</strong> items found
            </p>
            <span>
              <SlidersHorizontal size={15} /> Updated just now
            </span>
          </div>
          {loadingItems ? (
            <LoadingState />
          ) : filteredItems.length ? (
            <div className="item-grid browse-grid">
              {filteredItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  saved={saved.includes(item.id)}
                  onSave={toggleSaved}
                  onOpen={openItem}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <PackageSearch size={38} />
              <h3>No items found</h3>
              <p>Try another keyword or remove some filters.</p>
              <button className="btn btn-primary" onClick={resetFilters}>
                Clear all filters
              </button>
            </div>
          )}
        </main>
      )}

      {/* ===================== REPORT FORM ===================== */}
      {page === "Report Item" && (
        <main className="wrap form-page">
          <button className="back-link" onClick={() => go("Home")}>
            <ArrowLeft size={16} /> Back to home
          </button>
          <div className="form-heading">
            <h1>Report a {reportType} Item</h1>
            <p>
              {reportType === "Lost"
                ? "Provide details to help others find your item."
                : "Help return a found item to its rightful owner."}
            </p>
          </div>
          <div className="stepper">
            <div className={step >= 1 ? "step active" : "step"}>
              <span>1</span>
              <div>
                <strong>Item Details</strong>
                <small>Describe the item</small>
              </div>
            </div>
            <i />
            <div className={step >= 2 ? "step active" : "step"}>
              <span>2</span>
              <div>
                <strong>Location & Date</strong>
                <small>Where and when</small>
              </div>
            </div>
            <i />
            <div className={step >= 3 ? "step active" : "step"}>
              <span>3</span>
              <div>
                <strong>Review</strong>
                <small>Check your report</small>
              </div>
            </div>
          </div>
          <form
            className="report-form"
            onSubmit={(e) => {
              if (step < 3) {
                e.preventDefault();
                setStep(step + 1);
              } else submitReport(e);
            }}
          >
            <div className="form-content">
              <div className="form-fields">
                <h3>
                  {step === 1
                    ? "Item information"
                    : step === 2
                      ? "Location & date"
                      : "Review your report"}
                </h3>
                <p className="form-subtitle">
                  Fields marked with <b>*</b> are required.
                </p>
                {step === 1 && (
                  <>
                    <label className="field">
                      Item name <b>*</b>
                      <input
                        name="title"
                        required
                        value={form.title}
                        onChange={updateForm}
                        placeholder="e.g. iPhone 13, black backpack"
                      />
                    </label>
                    <div className="field-grid">
                      <label className="field">
                        Category <b>*</b>
                        <select
                          name="category"
                          required
                          value={form.category}
                          onChange={updateForm}
                        >
                          <option value="">Select category</option>
                          {categories.map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        Subcategory
                        <input
                          name="subcategory"
                          value={form.subcategory}
                          onChange={updateForm}
                          placeholder="e.g. Smartphone"
                        />
                      </label>
                    </div>
                    <div className="field-grid">
                      <label className="field">
                        Brand (if any)
                        <input
                          name="brand"
                          value={form.brand}
                          onChange={updateForm}
                          placeholder="e.g. Apple"
                        />
                      </label>
                      <label className="field">
                        Color
                        <input
                          name="color"
                          value={form.color}
                          onChange={updateForm}
                          placeholder="e.g. Black"
                        />
                      </label>
                    </div>
                    <label className="field">
                      Description <b>*</b>
                      <textarea
                        name="description"
                        required
                        value={form.description}
                        onChange={updateForm}
                        rows="4"
                        placeholder="Describe the item and any distinctive features..."
                      />
                    </label>
                  </>
                )}
                {step === 2 && (
                  <>
                    <label className="field">
                      District <b>*</b>
                      <select
                        name="district"
                        required
                        value={form.district}
                        onChange={updateForm}
                      >
                        <option value="">Select district</option>
                        {districts.map((d) => (
                          <option key={d}>{d}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      {reportType === "Lost"
                        ? "Last seen location"
                        : "Found location"}{" "}
                      <b>*</b>
                      <input
                        name="location"
                        required
                        value={form.location}
                        onChange={updateForm}
                        placeholder="e.g. University library, main gate"
                      />
                    </label>
                    <label className="field">
                      {reportType === "Lost"
                        ? "Approximate loss date"
                        : "Date found"}{" "}
                      <b>*</b>
                      <input
                        type="date"
                        name="date"
                        required
                        max={new Date().toISOString().slice(0, 10)}
                        value={form.date}
                        onChange={updateForm}
                      />
                    </label>
                    {reportType === "Found" && (
                      <label className="field">
                        Item custody{" "}
                        <select>
                          <option>Currently held by me</option>
                          <option>
                            Handed to university / authorized office
                          </option>
                        </select>
                      </label>
                    )}
                    <div className="privacy-card">
                      <ShieldCheck size={19} />
                      <div>
                        <strong>Your details stay private</strong>
                        <p>
                          Your exact private address and personal contact
                          details will not appear on public listings.
                        </p>
                      </div>
                    </div>
                  </>
                )}
                {step === 3 && (
                  <div className="review-list">
                    <div className="review-banner">
                      <CheckCircle2 size={20} />
                      <div>
                        <strong>Ready to submit</strong>
                        <p>Check the information below before publishing.</p>
                      </div>
                    </div>
                    {[
                      ["Report type", `${reportType} item`],
                      ["Item name", form.title],
                      ["Category", form.category],
                      ["Description", form.description],
                      ["District", form.district],
                      ["Location", form.location],
                      ["Date", form.date],
                      ["Brand", form.brand || "Not specified"],
                      ["Color", form.color || "Not specified"],
                    ].map(([k, v]) => (
                      <div className="review-row" key={k}>
                        <span>{k}</span>
                        <strong>{v || "—"}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <aside className="upload-panel">
                <h3>Upload photos</h3>
                <p>
                  Photos can help identify an item. Avoid showing private
                  information.
                </p>
                <label className="upload-drop">
                  <Upload size={27} />
                  <strong>Drag & drop images here</strong>
                  <span>or</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    onChange={(e) =>
                      setNotice({
                        text: `${e.target.files.length} file(s) selected for this demo.`,
                        type: "success",
                      })
                    }
                  />
                  <span className="btn btn-primary upload-choose">
                    Choose files
                  </span>
                  <small>PNG, JPG or WEBP · Max 5 MB each</small>
                </label>
                <div className="privacy-card">
                  <LockKeyhole size={18} />
                  <div>
                    <strong>Privacy first</strong>
                    <p>
                      Never publish serial numbers, ID numbers or sensitive
                      proof.
                    </p>
                  </div>
                </div>
              </aside>
            </div>
            <div className="form-footer">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => (step === 1 ? go("Home") : setStep(step - 1))}
              >
                {step === 1 ? "Cancel" : "Back"}
              </button>
              <button type="submit" className="btn btn-primary">
                {step === 3 ? "Submit report" : "Next step"}{" "}
                <ChevronRight size={17} />
              </button>
            </div>
          </form>
        </main>
      )}

      {/* ===================== ITEM DETAILS ===================== */}
      {page === "Item Details" && selected && (
        <main className="wrap detail-page">
          <button className="back-link" onClick={() => go("Explore")}>
            <ArrowLeft size={16} /> Back to items
          </button>
          <div className="detail-layout">
            <div className="detail-gallery">
              <img
                className="detail-main-image"
                src={selected.image}
                alt={selected.title}
              />
              <div className="gallery-thumbs">
                <img src={selected.image} alt="Item view" />
                <div className="thumb-placeholder">
                  <ShieldCheck />
                </div>
                <div className="thumb-placeholder">
                  <Eye />
                </div>
              </div>
            </div>
            <div className="detail-info">
              <Status type={selected.type} />
              <h1>{selected.title}</h1>
              <p className="detail-description">{selected.description}</p>
              <div className="detail-meta">
                <span>
                  <CalendarDays />
                  {selected.type === "Lost" ? "Lost on" : "Found on"}{" "}
                  {selected.date}
                </span>
                <span>
                  <MapPin />
                  {selected.location || selected.district}, {selected.district}
                </span>
                <span>
                  <PackageSearch />
                  {selected.category} / {selected.subcategory}
                </span>
              </div>
              <div className="detail-actions">
                <button
                  className="btn btn-primary"
                  onClick={() =>
                    go("Login", {
                      text: "Claim started in demo mode. Sign in and verify ownership to continue.",
                      type: "success",
                    })
                  }
                >
                  {selected.type === "Found"
                    ? "I think this is mine"
                    : "I found this item"}{" "}
                  <ArrowUpRight size={17} />
                </button>
                <button className="btn btn-outline" onClick={() => go("Chat")}>
                  <MessageCircle size={17} /> Contact anonymously
                </button>
              </div>
              <div className="detail-box">
                <h3>Additional details</h3>
                {[
                  ["Brand", selected.brand || "Not specified"],
                  ["Color", selected.color || "Not specified"],
                  ["District", selected.district],
                  ["Reported by", "Anonymous user"],
                ].map(([k, v]) => (
                  <div className="detail-row" key={k}>
                    <span>{k}</span>
                    <strong>{v}</strong>
                  </div>
                ))}
              </div>
              <div className="privacy-card">
                <ShieldCheck size={20} />
                <div>
                  <strong>Your privacy is protected</strong>
                  <p>
                    Personal contact details are hidden. Ownership must be
                    verified before an item is returned.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ===================== CHAT ===================== */}
      {page === "Chat" && (
        <main className="wrap chat-page">
          <button className="back-link" onClick={() => go("Explore")}>
            <ArrowLeft size={16} /> Back to items
          </button>
          <div className="chat-layout">
            <section className="chat-panel">
              <div className="chat-header">
                <div className="chat-avatar">
                  <ShieldCheck />
                </div>
                <div>
                  <h2>Secure communication</h2>
                  <p>
                    <span className="online-dot" /> Anonymous conversation
                  </p>
                </div>
                <button className="icon-button" aria-label="Help">
                  <CircleHelp />
                </button>
              </div>
              <div className="chat-safety">
                <LockKeyhole size={16} /> Your identity is protected until the
                item is confirmed.
              </div>
              <div className="messages">
                <div className="message other">
                  Hello, I found this item. Is it yours?<small>10:23 AM</small>
                </div>
                <div className="message mine">
                  Yes, it looks like mine. Can you tell me what was inside?
                  <small>10:26 AM</small>
                </div>
                <div className="message other">
                  There is a notebook and a blue water bottle. Is that correct?
                  <small>10:28 AM</small>
                </div>
                <div className="message mine">
                  Yes, that's mine! Where can I collect it?
                  <small>10:30 AM</small>
                </div>
              </div>
              <form
                className="chat-compose"
                onSubmit={(e) => {
                  e.preventDefault();
                  setNotice({
                    text: "Message sent in demo mode.",
                    type: "success",
                  });
                  e.currentTarget.reset();
                }}
              >
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Attach file"
                >
                  <Paperclip />
                </button>
                <input placeholder="Type your message..." required />
                <button className="send-btn" aria-label="Send message">
                  <Send size={17} />
                </button>
              </form>
            </section>
            {chatItem && (
              <aside className="chat-item">
                <h3>Item information</h3>
                <img src={chatItem.image} alt={chatItem.title} />
                <strong>{chatItem.title}</strong>
                <Status type={chatItem.type} />
                <p>
                  <CalendarDays size={14} />
                  {chatItem.date}
                </p>
                <p>
                  <MapPin size={14} />
                  {chatItem.district}
                </p>
                <div className="privacy-card">
                  <ShieldCheck />
                  <p>
                    Personal contact details are hidden until ownership is
                    confirmed.
                  </p>
                </div>
              </aside>
            )}
          </div>
        </main>
      )}

      {/* ===================== PROFILE ===================== */}
      {page === "Profile" && (
        <main className="wrap profile-page">
          <div className="profile-heading">
            <div className="profile-avatar">
              <img
                src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80"
                alt="User"
              />
            </div>
            <div>
              <h1>My Items</h1>
              <p>Manage your lost and found reports in one place.</p>
            </div>
          </div>
          <div className="profile-layout">
            <aside className="profile-sidebar">
              <nav className="profile-menu" aria-label="Account">
                <button
                  className={profileTab === "Lost" ? "active" : ""}
                  onClick={() => setProfileTab("Lost")}
                >
                  <ClipboardList size={17} /> Lost items
                </button>
                <button
                  className={profileTab === "Found" ? "active" : ""}
                  onClick={() => setProfileTab("Found")}
                >
                  <PackageSearch size={17} /> Found items
                </button>
                <button onClick={() => go("Saved Items")}>
                  <Heart size={17} /> Saved items ({saved.length})
                </button>
                <button onClick={() => go("Chat")}>
                  <MessageCircle size={17} /> Messages
                </button>
                <button onClick={() => go("Notifications")}>
                  <Bell size={17} /> Notifications
                </button>
              </nav>
            </aside>
            <section className="profile-content">
              <div className="page-title-row">
                <div>
                  <h2>{profileTab} items</h2>
                  <p>Reports you have posted as {profileTab.toLowerCase()}.</p>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => startReport(profileTab)}
                >
                  <Plus size={17} /> Report {profileTab.toLowerCase()} item
                </button>
              </div>
              {loadingItems ? (
                <LoadingState />
              ) : profileItems.length ? (
                <div className="item-grid browse-grid">
                  {profileItems.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      saved={saved.includes(item.id)}
                      onSave={toggleSaved}
                      onOpen={openItem}
                    />
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <PackageSearch size={38} />
                  <h3>No {profileTab.toLowerCase()} items yet</h3>
                  <p>Reports you post will show up here.</p>
                </div>
              )}
            </section>
          </div>
        </main>
      )}

      {/* ===================== SAVED ITEMS ===================== */}
      {page === "Saved Items" && (
        <main className="wrap page-main">
          <div className="page-title-row">
            <div>
              <span className="section-kicker">BOOKMARKED FOR LATER</span>
              <h1>Saved items</h1>
              <p>Items you want to keep an eye on.</p>
            </div>
          </div>
          {savedItems.length ? (
            <div className="item-grid browse-grid">
              {savedItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  saved
                  onSave={toggleSaved}
                  onOpen={openItem}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Heart size={38} />
              <h3>No saved items yet</h3>
              <p>Tap the heart on any item to save it here.</p>
              <button className="btn btn-primary" onClick={() => go("Explore")}>
                Explore items
              </button>
            </div>
          )}
        </main>
      )}

      {/* ===================== NOTIFICATIONS ===================== */}
      {page === "Notifications" && (
        <main className="wrap page-main">
          <div className="page-title-row">
            <div>
              <span className="section-kicker">STAY IN THE LOOP</span>
              <h1>Notifications</h1>
              <p>Relevant updates about your reports and claims.</p>
            </div>
            <button
              className="btn btn-outline"
              onClick={() =>
                setNotice({
                  text: "All notifications marked as read.",
                  type: "success",
                })
              }
            >
              Mark all as read
            </button>
          </div>
          <div className="notification-list">
            {notifications.map((n, i) => (
              <div
                className={i === 0 ? "notification-item unread" : "notification-item"}
                key={n.title}
              >
                <span className="notification-icon">{n.icon}</span>
                <div>
                  <h3>{n.title}</h3>
                  <p>{n.body}</p>
                  <small>
                    <Clock3 size={12} /> {n.time}
                  </small>
                </div>
              </div>
            ))}
          </div>
        </main>
      )}

      {/* ===================== ADMIN DASHBOARD ===================== */}
      {page === "Admin Dashboard" && (
        <main className="wrap dashboard-page">
          <div className="profile-heading">
            <div>
              <h1>Dashboard overview</h1>
              <p>Monitor platform activity and keep the community safe.</p>
            </div>
          </div>
          <div className="stats">
            <div>
              <strong>1,250</strong>
              <p>Total items</p>
            </div>
            <div>
              <strong>820</strong>
              <p>Lost items</p>
            </div>
            <div>
              <strong>430</strong>
              <p>Found items</p>
            </div>
            <div>
              <strong>2,340</strong>
              <p>Registered users</p>
            </div>
          </div>
          <div className="dashboard-card">
            <div className="dashboard-card-header">
              <h3>Recently reported items</h3>
              <button className="btn btn-outline" onClick={() => go("Explore")}>
                View all <ArrowUpRight size={15} />
              </button>
            </div>
            {loadingItems ? (
              <LoadingState />
            ) : (
              <div className="dashboard-list">
                {items.slice(0, 5).map((i) => (
                  <div className="dashboard-list-item" key={i.id}>
                    <img src={i.image} alt={i.title} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4>{i.title}</h4>
                      <p>
                        {i.district} · {i.date}
                      </p>
                    </div>
                    <Status type={i.type} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      )}

      {/* ===================== LOGIN / REGISTER ===================== */}
      {(page === "Login" || page === "Register") && (
        <main className="auth-page">
          <div className="auth-visual">
            <div>
              <h1>
                Lost things deserve to find their way home.
              </h1>
              <p>
                Join the community helping people across Sri Lanka report,
                discover and safely return lost belongings.
              </p>
            </div>
          </div>
          <div className="auth-form-wrap">
            <div className="auth-form">
              <h2>{page === "Login" ? "Welcome back" : "Create your account"}</h2>
              <p>
                {page === "Login"
                  ? "Sign in to manage your reports and matches."
                  : "Join the community helping lost items find their way home."}
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  go("Home", {
                    text: "Authentication is a frontend demo. Connect your backend to enable accounts.",
                    type: "success",
                  });
                }}
              >
                {page === "Register" && (
                  <label className="field">
                    Full name
                    <input required placeholder="Your name" />
                  </label>
                )}
                <label className="field">
                  Email address
                  <input required type="email" placeholder="you@example.com" />
                </label>
                <label className="field">
                  Password
                  <input
                    required
                    type="password"
                    minLength="8"
                    placeholder="At least 8 characters"
                  />
                </label>
                <button className="btn btn-primary">
                  {page === "Login" ? "Sign in" : "Create account"}{" "}
                  <ChevronRight size={17} />
                </button>
              </form>
              <div className="auth-bottom">
                {page === "Login"
                  ? "Don't have an account?"
                  : "Already have an account?"}{" "}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    go(page === "Login" ? "Register" : "Login");
                  }}
                >
                  {page === "Login" ? "Sign up" : "Log in"}
                </a>
              </div>
              <div className="auth-bottom">
                <LockKeyhole size={14} /> Your personal information stays
                private.
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ===================== ABOUT ===================== */}
      {page === "About" && (
        <main className="wrap about-page">
          <span className="eyebrow">ABOUT FINDIT</span>
          <h1>
            Lost things deserve
            <br />
            to find their way home.
          </h1>
          <p>
            FindIt helps communities across Sri Lanka report, discover and
            safely return lost belongings. We believe finding an item should be
            simple, safe and respectful of everyone's privacy.
          </p>
          <div className="about-grid">
            <div className="about-card">
              <span className="feature-icon teal" style={{ margin: 0 }}>
                <ShieldCheck />
              </span>
              <h3>Privacy by design</h3>
              <p>
                Contact details stay private while you coordinate through the
                platform.
              </p>
            </div>
            <div className="about-card">
              <span className="feature-icon blue" style={{ margin: 0 }}>
                <MapPin />
              </span>
              <h3>Local discovery</h3>
              <p>Find relevant listings by district, category and location.</p>
            </div>
            <div className="about-card">
              <span className="feature-icon purple" style={{ margin: 0 }}>
                <Heart />
              </span>
              <h3>Community powered</h3>
              <p>
                Every report can help reunite someone with something important.
              </p>
            </div>
          </div>
          <button
            className="btn btn-primary"
            style={{ marginTop: 30 }}
            onClick={() => go("Explore")}
          >
            Explore items <ArrowUpRight size={17} />
          </button>
        </main>
      )}

      {/* ===================== FOOTER ===================== */}
      <footer className="footer">
        <div className="wrap footer-inner">
          <div>
            <Logo onClick={() => go("Home")} />
            <p>Helping lost things find their way home.</p>
          </div>
          <div className="footer-links">
            <button onClick={() => go("Explore")}>Explore items</button>
            <button onClick={() => startReport("Lost")}>Report an item</button>
            <button onClick={() => go("About")}>About FindIt</button>
            <button onClick={() => go("Admin Dashboard")}>Admin demo</button>
          </div>
          <div className="footer-privacy">
            <ShieldCheck size={17} /> Built around trust and privacy
          </div>
        </div>
        <div className="wrap footer-bottom">
          <span>© 2026 FindIt. Community powered.</span>
          <span>Made for a safer, more connected Sri Lanka.</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
