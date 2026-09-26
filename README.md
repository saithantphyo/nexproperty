# NEXPROPERTY

A beginner-friendly real-estate website with:
- Public property listings
- Search and type filter
- Admin login
- Add / edit / delete properties
- Website settings (name, logo text, colors, phone, email, address, hero text)
- Property image URL support
- No `express-session` MemoryStore warning

## Demo login
Username: `admin`
Password: `admin123`

Change these before production with environment variables:
- `ADMIN_USER`
- `ADMIN_PASS`

## Run locally
1. Install Node.js LTS.
2. Open a terminal in this folder.
3. Run `npm install`
4. Run `npm start`
5. Open `http://localhost:3000`
6. Admin: `http://localhost:3000/admin`

## Render
Build Command: `npm install`
Start Command: `npm start`

Important: the JSON data and uploaded files are stored on the service filesystem. On hosting without persistent storage/database, data can be lost after a redeploy/restart. For a real production business site, connect a persistent database/storage later.

## Customization
Most normal customization can be done from the Admin > Website Settings screen after login.
