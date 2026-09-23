// vercel.json explicitly rewrites all /api/* paths to this function.
// The Express application itself remains in backend/server.js for local use.
module.exports = require('../backend/server');
