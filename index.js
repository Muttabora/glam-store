// server.js
// Simple product backend with Cloudinary image upload + MongoDB
// Run: node server.js  (or npm run dev)

// --- Imports
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');
require('dotenv').config(); // loads .env

// --- Config from .env
const PORT = process.env.PORT || 0000;
const MONGO_URI = process.env.MONGO_URI;
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUD_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUD_SECRET = process.env.CLOUDINARY_API_SECRET;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'changeme';

// --- Cloudinary setup
cloudinary.config({
  cloud_name: CLOUD_NAME,
  api_key: CLOUD_KEY,
  api_secret: CLOUD_SECRET
});

// --- Connect to MongoDB
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('? MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// --- Mongoose product schema
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  brand: String,
  size: String,
  description: String,
  price: { type: Number, default: 0 },
  imageUrl: String,
  createdAt: { type: Date, default: Date.now }
});

const Product = mongoose.model('Product', productSchema);

// --- Express app
const app = express();
app.use(cors({endearing-boba-568eca.netlify.app}));              // allow requests from browser (or restrict in prod)
app.use(express.json());      // parse JSON bodies
app.use(express.urlencoded({ extended: true }));

// Serve frontend files (public folder)
//app.use(express.static(path.join(__dirname, 'public')));

// --- Simple admin check middleware
function checkAdmin(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  next();
}

// --- Login endpoint (simple)
// POST /api/login  { "password": "..." }
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ ok: false, error: 'Missing password' });
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ ok: false, error: 'Wrong password' });

  // In production use a proper token (JWT or session). Here we return ADMIN_TOKEN from .env
  return res.json({ ok: true, token: ADMIN_TOKEN });
});

// --- GET all products (public)
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    console.error('GET /api/products error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Get single product
app.get('/api/products/:id', async (req, res) => {
  try {
    const p = await Product.findById(req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found' });
    res.json(p);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Create product (admin only)
// POST /api/products  { name, brand, size, description, price, imageUrl }
app.post('/api/products', checkAdmin, async (req, res) => {
  try {
    const { name, brand, size, description, price, imageUrl } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const prod = new Product({ name, brand, size, description, price, imageUrl });
    await prod.save();
    res.json(prod);
  } catch (err) {
    console.error('POST /api/products error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Update product (admin only)
app.put('/api/products/:id', checkAdmin, async (req, res) => {
  try {
    const updated = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) {
    console.error('PUT /api/products/:id error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Delete product (admin only)
app.delete('/api/products/:id', checkAdmin, async (req, res) => {
  try {
    const removed = await Product.findByIdAndDelete(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/products/:id error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Image upload: multer writes file to tmp directory, then we upload to Cloudinary
const upload = multer({ dest: 'tmp/' });

// POST /api/upload (form-data with field 'image')
app.post('/api/upload', checkAdmin, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Upload the file to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'jubilate_products'
    });

    // Delete local tmp file
    fs.unlinkSync(req.file.path);

    // Return the secure URL
    res.json({ ok: true, url: result.secure_url, public_id: result.public_id });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// --- Fallback: serve index.html for any other routes (if you want client-side routing)
// (optional, keep if needed)
//app.get('*', (req, res) => {res.sendFile(path.join(__dirname, 'public', 'index.html'));});

// --- Start server
app.listen(PORT, () => {
  console.log(`?? Server running on http://localhost:${PORT}`);

});

