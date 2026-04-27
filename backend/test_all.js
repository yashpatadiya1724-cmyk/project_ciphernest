const fs = require('fs');
const path = require('path');

const walkSync = function(dir, filelist) {
  const files = fs.readdirSync(dir);
  filelist = filelist || [];
  files.forEach(function(file) {
    if (fs.statSync(path.join(dir, file)).isDirectory()) {
      filelist = walkSync(path.join(dir, file), filelist);
    }
    else {
      if (file.endsWith('.js') && !file.includes('test_all.js') && !file.includes('server.js')) {
        filelist.push(path.join(dir, file));
      }
    }
  });
  return filelist;
};

const backendDir = __dirname;
const allJsFiles = walkSync(backendDir).filter(f => !f.includes('node_modules'));

let hasError = false;

allJsFiles.forEach(file => {
  try {
    const mod = require(file);
    // If it's an object of exports, try to detect undefined exports, though require doesn't strictly fail.
  } catch (err) {
    console.error(`Error loading ${file}:`, err.message);
    hasError = true;
  }
});

if (!hasError) {
  console.log("All backend files loaded successfully.");
} else {
  process.exit(1);
}
