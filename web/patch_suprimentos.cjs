const fs = require('fs');
let code = fs.readFileSync('src/pages/admin/suprimentos/Suprimentos.jsx', 'utf8');

const firstOccurrence = code.indexOf('const [sincronizandoSEFAZ, setSincronizandoSEFAZ] = useState(false);');
const secondOccurrence = code.indexOf('const [sincronizandoSEFAZ, setSincronizandoSEFAZ] = useState(false);', firstOccurrence + 10);

if (secondOccurrence !== -1) {
  // It looks like everything from the first occurrence to the second occurrence is duplicated or misplaced.
  // Wait, let's just find the duplicate block and remove it.
}
