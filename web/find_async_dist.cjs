const fs = require('fs');
const path = require('path');
function walk(dir) {
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    if (fs.statSync(file).isDirectory()) walk(file);
    else if (file.endsWith('.js')) {
      const c = fs.readFileSync(file, 'utf8');
      const lines = c.split('\n');
      lines.forEach((l, i) => {
        const regex = /\basync\b(?!\s*function)(?!\s*\()(?!\s*[a-zA-Z0-9_{}\[\]]+\s*=>)/g;
        let m;
        while ((m = regex.exec(l)) !== null) {
          console.log(`${file}:${i+1} => ${l.substring(Math.max(0, m.index-30), m.index+50)}`);
        }
      });
    }
  });
}
walk('/home/ubuntu/agro-open/web/dist/assets');
