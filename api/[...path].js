// Vercel routes every /api/* request to this serverless entry point.
// The Express application itself remains in backend/server.js for local use.
module.exports = require('../backend/server');
