const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 3000;
const DIR = __dirname;

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.md': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg'
};

const dataDir = path.join(DIR, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const agyConfigDir = path.join(dataDir, 'agy-config');
if (!fs.existsSync(agyConfigDir)) fs.mkdirSync(agyConfigDir, { recursive: true });

const atsDir = path.join(dataDir, 'ats');
if (!fs.existsSync(atsDir)) fs.mkdirSync(atsDir, { recursive: true });

const server = http.createServer((req, res) => {
  const pathname = req.url.split('?')[0];

  if (req.method === 'POST' && pathname === '/save') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const fileContent = JSON.stringify(data, null, 2) + '\n';
        const dataPath = path.join(DIR, 'data', 'data.json');
        
        fs.writeFileSync(dataPath, fileContent);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        console.error(err);
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/ats-folders') {
    fs.readdir(atsDir, { withFileTypes: true }, (err, files) => {
      if (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
        return;
      }
      const folders = files.filter(f => f.isDirectory()).map(f => f.name);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(folders));
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/agy') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const { prompt, effort = 'medium' } = JSON.parse(body);
        const cmdArgs = ['-p', 'agy', '--model', 'gemini-3.6-flash', '--effort', effort, '--add-dir', '/app/data', '--dangerously-skip-permissions', '--print', prompt];
        console.log(`[EXEC] Running command: unbuffer ${cmdArgs.join(' ')}`);
        
        const child = spawn('unbuffer', cmdArgs, {
          env: { ...process.env, TERM: 'dumb', NO_COLOR: '1' }
        });
        
        res.writeHead(200, {
          'Content-Type': 'text/plain',
          'Transfer-Encoding': 'chunked'
        });
        
        // Regex to match ANSI escape codes including extended CSI and DCS sequences, and remove carriage returns
        const stripAnsi = (str) => str.replace(/\x1B\[[^a-zA-Z]*[a-zA-Z]/g, '').replace(/\r/g, '');

        child.stdout.on('data', (data) => {
          const cleanStr = stripAnsi(data.toString());
          process.stdout.write(cleanStr); // Log to Docker
          res.write(cleanStr);
        });
        child.stderr.on('data', (data) => {
          const cleanStr = stripAnsi(data.toString());
          process.stderr.write(cleanStr); // Log to Docker
          res.write(cleanStr);
        });
        child.on('close', (code) => {
          console.log(`\n[EXEC] Process exited with code ${code}`);
          res.end(`\n\nProcess exited with code ${code}`);
        });
        child.on('error', (err) => {
          res.write(`\n\nFailed to start process: ${err.message}\nMake sure 'ato' is installed and accessible in this environment.`);
          res.end();
        });
      } catch (err) {
        res.writeHead(500);
        res.end(err.message);
      }
    });
    return;
  }

  let filePath;
  if (pathname === '/') {
    filePath = path.join(DIR, 'index.html');
  } else {
    filePath = path.join(DIR, pathname);
  }
  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'EISDIR') {
        fs.readdir(filePath, (err, files) => {
          if (err) {
            res.writeHead(500);
            res.end('Server Error: ' + err.code);
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            let html = `<html><head><style>body{font-family:sans-serif;padding:20px;background:#1a1a1a;color:#fff;} a{color:#4fc3f7;text-decoration:none;display:block;padding:8px 0;} a:hover{text-decoration:underline;}</style></head><body><h2>Files in ${pathname}</h2><ul>`;
            files.forEach(file => {
              const fileHref = pathname.endsWith('/') ? `${pathname}${file}` : `${pathname}/${file}`;
              html += `<li><a href="${fileHref}">${file}</a></li>`;
            });
            html += `</ul></body></html>`;
            res.end(html);
          }
        });
        return;
      }
      if(error.code == 'ENOENT') {
        if (pathname === '/data/data.json') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end('[]\n');
        } else {
          res.writeHead(404);
          res.end('File not found');
        }
      }
      else {
        res.writeHead(500);
        res.end('Server Error: '+error.code);
      }
    }
    else {
      const headers = { 'Content-Type': contentType };
      if (pathname === '/data/data.json') {
        headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
        headers['Pragma'] = 'no-cache';
        headers['Expires'] = '0';
      }
      res.writeHead(200, headers);
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
