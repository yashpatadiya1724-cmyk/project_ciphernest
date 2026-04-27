const securityHeaders = (req, res, next) => {
  // Restrict script-src to 'self' and trusted CDNs
  // Deny frame-ancestors to prevent clickjacking
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; frame-ancestors 'none';"
  );
  
  // Enforce strict MIME type sniffing prevention
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Additional hardening
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  next();
};

module.exports = { securityHeaders };
