
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA = path.join(ROOT, "data");
const UPLOADS = path.join(ROOT, "uploads");

fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(UPLOADS, { recursive: true });

const DB = path.join(DATA, "db.json");
const defaultDb = {
  settings: {
    siteName: "NEXPROPERTY",
    tagline: "Find a place you will love.",
    phone: "+95 9 000 000 000",
    email: "hello@nexproperty.com",
    address: "Yangon, Myanmar",
    heroTitle: "Find Your Next Property",
    heroText: "Buy, sell and discover homes, apartments, land and commercial properties with NEXPROPERTY.",
    primary: "#0f5132",
    accent: "#d8f36a",
    logoText: "NEX",
    currency: "MMK"
  },
  properties: [
    {
      id: "p1",
      title: "Modern City Apartment",
      location: "Yangon",
      type: "Apartment",
      price: "180,000,000",
      beds: "3",
      baths: "2",
      area: "1,450 sqft",
      image: "",
      featured: true,
      description: "A bright modern apartment with convenient city access."
    },
    {
      id: "p2",
      title: "Family House",
      location: "North Dagon",
      type: "House",
      price: "350,000,000",
      beds: "4",
      baths: "3",
      area: "2,400 sqft",
      image: "",
      featured: true,
      description: "Spacious family home with parking and a quiet neighborhood."
    }
  ]
};

function loadDb() {
  try {
    if (!fs.existsSync(DB)) fs.writeFileSync(DB, JSON.stringify(defaultDb, null, 2));
    return JSON.parse(fs.readFileSync(DB, "utf8"));
  } catch {
    return JSON.parse(JSON.stringify(defaultDb));
  }
}
function saveDb(db) {
  fs.writeFileSync(DB, JSON.stringify(db, null, 2));
}
let db = loadDb();

const sessions = new Map();
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "admin123";

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
      cb(null, crypto.randomBytes(8).toString("hex") + ext);
    }
  }),
  limits: { fileSize: 8 * 1024 * 1024 }
});

function auth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "") || req.cookies?.token;
  if (!token || !sessions.has(token)) return res.status(401).json({ error: "Unauthorized" });
  req.admin = true;
  next();
}

function cookieToken(req) {
  const raw = req.headers.cookie || "";
  const match = raw.match(/(?:^|;\s*)token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}
function authCookie(req) {
  const token = cookieToken(req);
  return token && sessions.has(token);
}

app.get("/api/properties", (_req, res) => {
  res.json(db.properties);
});
app.get("/api/settings", (_req, res) => res.json(db.settings));

app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  if (username !== ADMIN_USER || password !== ADMIN_PASS)
    return res.status(401).json({ error: "Invalid username or password" });
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, true);
  res.setHeader("Set-Cookie", `token=${token}; Path=/; HttpOnly; SameSite=Lax`);
  res.json({ ok: true });
});
app.post("/api/logout", (req, res) => {
  const token = cookieToken(req);
  if (token) sessions.delete(token);
  res.setHeader("Set-Cookie", "token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax");
  res.json({ ok: true });
});
app.get("/api/me", (req, res) => res.json({ authenticated: authCookie(req) }));

app.get("/api/admin/data", (req, res) => {
  if (!authCookie(req)) return res.status(401).json({ error: "Unauthorized" });
  res.json(db);
});
app.put("/api/admin/settings", (req, res) => {
  if (!authCookie(req)) return res.status(401).json({ error: "Unauthorized" });
  db.settings = { ...db.settings, ...req.body };
  saveDb(db);
  res.json(db.settings);
});
app.post("/api/admin/properties", (req, res) => {
  if (!authCookie(req)) return res.status(401).json({ error: "Unauthorized" });
  const item = { ...req.body, id: "p_" + Date.now() };
  db.properties.unshift(item);
  saveDb(db);
  res.json(item);
});
app.put("/api/admin/properties/:id", (req, res) => {
  if (!authCookie(req)) return res.status(401).json({ error: "Unauthorized" });
  const i = db.properties.findIndex(p => p.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: "Not found" });
  db.properties[i] = { ...db.properties[i], ...req.body };
  saveDb(db);
  res.json(db.properties[i]);
});
app.delete("/api/admin/properties/:id", (req, res) => {
  if (!authCookie(req)) return res.status(401).json({ error: "Unauthorized" });
  db.properties = db.properties.filter(p => p.id !== req.params.id);
  saveDb(db);
  res.json({ ok: true });
});
app.post("/api/admin/upload", upload.single("image"), (req, res) => {
  if (!authCookie(req)) return res.status(401).json({ error: "Unauthorized" });
  if (!req.file) return res.status(400).json({ error: "No image" });
  res.json({ url: "/uploads/" + req.file.filename });
});

app.use("/uploads", express.static(UPLOADS));

const PUBLIC_HTML = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>NEXPROPERTY</title>
<style>
:root{--p:#0f5132;--a:#d8f36a;--ink:#13231b;--muted:#66736d;--bg:#f6f8f5}
*{box-sizing:border-box}body{margin:0;font-family:Inter,Arial,sans-serif;color:var(--ink);background:var(--bg)}
nav{height:74px;display:flex;align-items:center;justify-content:space-between;padding:0 6%;background:#fff;position:sticky;top:0;z-index:5;box-shadow:0 2px 18px #0000000c}
.brand{font-weight:900;font-size:25px;letter-spacing:1px;color:var(--p)}.brand span{color:#89a900}
nav a{color:var(--ink);text-decoration:none;margin-left:24px;font-weight:600}.admin{padding:10px 16px;border-radius:999px;background:var(--p);color:#fff!important}
.hero{padding:75px 6% 60px;background:linear-gradient(135deg,var(--p),#123e2b);color:#fff}
.hero h1{font-size:clamp(42px,6vw,76px);line-height:.98;max-width:760px;margin:15px 0}.hero p{font-size:19px;max-width:650px;color:#dce8e1}
.search{margin-top:35px;background:#fff;border-radius:18px;padding:12px;display:flex;gap:10px;max-width:900px;box-shadow:0 15px 40px #0003}.search input,.search select{flex:1;padding:14px;border:1px solid #e4e8e5;border-radius:12px;font-size:15px}.search button{background:var(--a);border:0;border-radius:12px;padding:0 24px;font-weight:800}
section{padding:65px 6%}.head{display:flex;justify-content:space-between;gap:20px;align-items:end;margin-bottom:25px}.head h2{font-size:35px;margin:0}.muted{color:var(--muted)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:22px}.card{background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 30px #0000000a}.photo{height:205px;background:linear-gradient(135deg,#dfe9e3,#b9c9c0);display:flex;align-items:center;justify-content:center;color:#6b7d73;font-size:44px}.photo img{width:100%;height:100%;object-fit:cover}.body{padding:20px}.tag{display:inline-block;padding:6px 10px;border-radius:999px;background:#eef6e7;color:var(--p);font-size:12px;font-weight:800}.price{font-size:21px;font-weight:900;color:var(--p)}.meta{color:var(--muted);font-size:14px}
.about{background:#fff}.contact{background:var(--p);color:#fff}.contact .muted{color:#d7e6dd}
footer{padding:25px 6%;background:#0a3421;color:#c7d6ce}
@media(max-width:700px){nav a:not(.admin){display:none}.search{flex-direction:column}.search button{height:48px}.hero{padding-top:45px}}
</style></head>
<body>
<nav><div class="brand" id="brand">NEX<span>PROPERTY</span></div><div><a href="#properties">Properties</a><a href="#about">About</a><a class="admin" href="/admin">Admin</a></div></nav>
<header class="hero"><div class="muted" style="color:#b8d2c5">REAL ESTATE • MYANMAR</div><h1 id="heroTitle">Find Your Next Property</h1><p id="heroText">Buy, sell and discover properties with NEXPROPERTY.</p>
<div class="search"><input id="q" placeholder="Search location or property name"><select id="type"><option value="">All types</option><option>House</option><option>Apartment</option><option>Condo</option><option>Land</option><option>Commercial</option></select><button onclick="load()">Search</button></div></header>
<section id="properties"><div class="head"><div><div class="muted">NEXPROPERTY COLLECTION</div><h2>Featured Properties</h2></div><div class="muted" id="count"></div></div><div class="grid" id="grid"></div></section>
<section class="about" id="about"><div class="head"><div><div class="muted">ABOUT US</div><h2>Property made simpler.</h2></div></div><p class="muted" style="max-width:760px;font-size:18px">NEXPROPERTY is a modern property platform where owners and buyers can discover homes, land and commercial spaces. Use the Admin panel to manage listings and customize the site.</p></section>
<section class="contact" id="contact"><div class="head"><div><div style="opacity:.7">CONTACT</div><h2>Let's find your next place.</h2><p class="muted" id="contactText"></p></div></div></section>
<footer>© <span id="year"></span> <span id="footName">NEXPROPERTY</span>. All rights reserved.</footer>
<script>
let all=[];
async function init(){const s=await fetch('/api/settings').then(r=>r.json());document.documentElement.style.setProperty('--p',s.primary||'#0f5132');document.documentElement.style.setProperty('--a',s.accent||'#d8f36a');document.title=s.siteName;document.getElementById('brand').innerHTML=(s.logoText||'NEX')+'<span>'+(s.siteName||'PROPERTY').replace(s.logoText||'NEX','')+'</span>';document.getElementById('heroTitle').textContent=s.heroTitle;document.getElementById('heroText').textContent=s.heroText;document.getElementById('contactText').innerHTML=(s.phone||'')+' · '+(s.email||'')+' · '+(s.address||'');document.getElementById('footName').textContent=s.siteName;all=await fetch('/api/properties').then(r=>r.json());load()}
function load(){const q=(document.getElementById('q').value||'').toLowerCase();const t=document.getElementById('type').value;const list=all.filter(p=>(!q||((p.title||'')+' '+(p.location||'')).toLowerCase().includes(q))&&(!t||p.type===t));document.getElementById('count').textContent=list.length+' properties';document.getElementById('grid').innerHTML=list.map(p=>'<article class="card"><div class="photo">'+(p.image?'<img src="'+p.image+'">':'⌂')+'</div><div class="body"><span class="tag">'+(p.type||'Property')+'</span><h3>'+esc(p.title)+'</h3><div class="meta">📍 '+esc(p.location||'')+' · '+esc(p.beds||'0')+' beds · '+esc(p.baths||'0')+' baths · '+esc(p.area||'')+'</div><p class="price">'+esc(p.price||'Price on request')+'</p><div class="meta">'+esc(p.description||'')+'</div></div></article>').join('')||'<p class="muted">No properties found.</p>'}
function esc(x){return String(x).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]))}
document.getElementById('year').textContent=new Date().getFullYear();init();
</script></body></html>`;

const ADMIN_HTML = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NEXPROPERTY Admin</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;background:#f3f6f4;color:#14231c}.top{background:#0f5132;color:#fff;padding:18px 5%;display:flex;justify-content:space-between;align-items:center}.top strong{font-size:22px}.top button{border:0;padding:9px 14px;border-radius:8px}.wrap{max-width:1200px;margin:30px auto;padding:0 18px}.login,.panel{background:#fff;border-radius:18px;padding:25px;box-shadow:0 8px 30px #0001;margin-bottom:20px}.login{max-width:430px;margin:70px auto}.input{width:100%;padding:12px;margin:7px 0 12px;border:1px solid #d9e0dc;border-radius:9px}.btn{background:#0f5132;color:#fff;border:0;padding:11px 17px;border-radius:9px;font-weight:700;cursor:pointer}.btn.alt{background:#d8f36a;color:#152016}.danger{background:#c83c3c}.tabs{display:flex;gap:10px;margin-bottom:18px}.hidden{display:none}.table{width:100%;border-collapse:collapse}.table th,.table td{padding:12px;border-bottom:1px solid #edf0ee;text-align:left}.row{display:grid;grid-template-columns:1fr 1fr;gap:15px}@media(max-width:700px){.row{grid-template-columns:1fr}.table{font-size:13px}}
</style></head><body><div class="top"><strong>NEXPROPERTY ADMIN</strong><div><a href="/" style="color:white;margin-right:12px">View Site</a><button onclick="logout()">Logout</button></div></div>
<div class="wrap">
<div id="login" class="login"><h2>Admin Login</h2><p>Manage properties and customize your website.</p><input class="input" id="u" placeholder="Username" value="admin"><input class="input" id="pw" type="password" placeholder="Password"><button class="btn" onclick="login()">Login</button><p id="err" style="color:#c33"></p></div>
<div id="dash" class="hidden"><div class="tabs"><button class="btn" onclick="tab('props')">Properties</button><button class="btn alt" onclick="tab('settings')">Website Settings</button></div>
<div id="props" class="panel"><h2>Properties</h2><button class="btn alt" onclick="newProp()">+ Add Property</button><div style="overflow:auto;margin-top:18px"><table class="table"><thead><tr><th>Title</th><th>Location</th><th>Type</th><th>Price</th><th>Actions</th></tr></thead><tbody id="rows"></tbody></table></div></div>
<div id="settings" class="panel hidden"><h2>Website Settings</h2><div class="row"><div><label>Site Name</label><input class="input" id="siteName"><label>Logo Text</label><input class="input" id="logoText"><label>Tagline</label><input class="input" id="tagline"><label>Phone</label><input class="input" id="phone"><label>Email</label><input class="input" id="email"></div><div><label>Address</label><input class="input" id="address"><label>Hero Title</label><input class="input" id="heroTitle"><label>Hero Text</label><textarea class="input" id="heroText" rows="5"></textarea><label>Primary Color</label><input class="input" id="primary"><label>Accent Color</label><input class="input" id="accent"></div></div><button class="btn" onclick="saveSettings()">Save Website Settings</button></div>
<div id="form" class="panel hidden"><h2 id="formTitle">Add Property</h2><div class="row"><div><input class="input" id="ptitle" placeholder="Property title"><input class="input" id="plocation" placeholder="Location"><input class="input" id="ptype" placeholder="Type (House/Apartment/Land)"><input class="input" id="pprice" placeholder="Price"><input class="input" id="pbeds" placeholder="Beds"><input class="input" id="pbaths" placeholder="Baths"><input class="input" id="parea" placeholder="Area"></div><div><input class="input" id="pimage" placeholder="Image URL (optional)"><textarea class="input" id="pdesc" rows="8" placeholder="Description"></textarea><label><input type="checkbox" id="pfeatured"> Featured</label></div></div><button class="btn" onclick="saveProp()">Save</button> <button class="btn" onclick="closeForm()">Cancel</button></div></div></div>
<script>
let data=null,editing=null;
async function me(){const r=await fetch('/api/me');if((await r.json()).authenticated){showDash();loadData()}}
function showDash(){document.getElementById('login').classList.add('hidden');document.getElementById('dash').classList.remove('hidden')}
async function login(){const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:u.value,password:pw.value})});if(r.ok){showDash();loadData()}else{err.textContent='Login failed'}}
async function loadData(){data=await fetch('/api/admin/data').then(r=>r.json());render();fillSettings()}
function render(){rows.innerHTML=data.properties.map(p=>'<tr><td>'+esc(p.title)+'</td><td>'+esc(p.location)+'</td><td>'+esc(p.type)+'</td><td>'+esc(p.price)+'</td><td><button class="btn" onclick="editProp(\\''+p.id+'\\')">Edit</button> <button class="btn danger" onclick="delProp(\\''+p.id+'\\')">Delete</button></td></tr>').join('')}
function newProp(){editing=null;formTitle.textContent='Add Property';clearForm();form.classList.remove('hidden')}
function editProp(id){editing=id;const p=data.properties.find(x=>x.id===id);formTitle.textContent='Edit Property';[['ptitle','title'],['plocation','location'],['ptype','type'],['pprice','price'],['pbeds','beds'],['pbaths','baths'],['parea','area'],['pimage','image'],['pdesc','description']].forEach(([a,b])=>document.getElementById(a).value=p[b]||'');pfeatured.checked=!!p.featured;form.classList.remove('hidden')}
function clearForm(){['ptitle','plocation','ptype','pprice','pbeds','pbaths','parea','pimage','pdesc'].forEach(id=>document.getElementById(id).value='');pfeatured.checked=false}
function closeForm(){form.classList.add('hidden')}
async function saveProp(){const p={title:ptitle.value,location:plocation.value,type:ptype.value,price:pprice.value,beds:pbeds.value,baths:pbaths.value,area:parea.value,image:pimage.value,description:pdesc.value,featured:pfeatured.checked};const url=editing?'/api/admin/properties/'+editing:'/api/admin/properties';await fetch(url,{method:editing?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)});closeForm();loadData()}
async function delProp(id){if(confirm('Delete this property?')){await fetch('/api/admin/properties/'+id,{method:'DELETE'});loadData()}}
function fillSettings(){const s=data.settings;['siteName','logoText','tagline','phone','email','address','heroTitle','heroText','primary','accent'].forEach(k=>document.getElementById(k).value=s[k]||'')}
async function saveSettings(){const o={};['siteName','logoText','tagline','phone','email','address','heroTitle','heroText','primary','accent'].forEach(k=>o[k]=document.getElementById(k).value);await fetch('/api/admin/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(o)});alert('Saved');loadData()}
function tab(x){props.classList.toggle('hidden',x!=='props');settings.classList.toggle('hidden',x!=='settings');form.classList.add('hidden')}
async function logout(){await fetch('/api/logout',{method:'POST'});location.reload()}
function esc(x){return String(x||'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]))}
me();
</script></body></html>`;

app.get("/admin", (_req, res) => res.type("html").send(ADMIN_HTML));
app.get("/", (_req, res) => res.type("html").send(PUBLIC_HTML));
app.listen(PORT, () => console.log(`NEXPROPERTY running on port ${PORT}`));
