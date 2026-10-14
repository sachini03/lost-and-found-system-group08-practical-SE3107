# FindIt / UniFind — Lost & Found Frontend

A responsive React + Vite prototype inspired by the supplied FindIt UI reference and aligned with the Lost & Found Platform SRS.

## Requirements
- Node.js 20.19+ or 22.12+ recommended
- npm

## Run locally
```bash
npm install
npm run dev
```

## Production build
```bash
npm run build
npm run preview
```

## Included screens
- Landing page with search, district/category filters, feature highlights and sample items
- Browse/search with keyword search, Lost/Found tabs, category/district filters and sorting
- Item details with privacy reminders
- Multi-step Lost/Found report form with validation and review
- Anonymous chat demo
- Profile / My Items and Saved Items
- Notifications
- Login and registration UI
- About page
- Admin dashboard demo

## Notes
- This is a frontend prototype. Reports and saved items are kept in React state and reset after refresh.
- Authentication, persistent storage, actual messaging, image uploads, matching notifications, and admin authorization need a backend.
- Sample item data is in `src/data/items.js`.
- Item images use remote Unsplash image URLs, so an internet connection is needed for them to load.
