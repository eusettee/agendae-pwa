const fs = require('node:fs');
const path = require('node:path');
let connection;
let ready;
function connect() {
  if (connection) return connection;
  if (process.env.VERCEL) {
      const error = new Error('Configure o Cloud Firestore para ativar as contas.');
      error.status = 503; throw error;
    }
    const { DatabaseSync } = require('node:sqlite');
    const filename = process.env.SQLITE_PATH || path.join(__dirname, '..', 'data', 'agendae.sqlite');
    if (filename !== ':memory:') fs.mkdirSync(path.dirname(filename), { recursive: true });
    const sqlite = new DatabaseSync(filename);
    sqlite.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
    connection = {
      query: async (text, values = []) => {
        const statement = sqlite.prepare(text);
        const indexes = [...text.matchAll(/\$(\d+)/g)].map(match => Number(match[1]));
        const bindings = Object.fromEntries([...new Set(indexes)].map(index => [`$${index}`, values[index - 1]]));
        if (/^\s*(SELECT|WITH)\b/i.test(text) || /\bRETURNING\b/i.test(text)) {
          const rows = statement.all(bindings); return { rows, rowCount: rows.length };
        }
        const result = statement.run(bindings); return { rows: [], rowCount: result.changes };
      }
    };
  return connection;
}
async function query(text, values = []) {
  const db = connect();
  if (!ready) {
    const schema = fs.readFileSync(path.join(__dirname, '..', 'migrations', '001-initial.sql'), 'utf8');
    ready = (async () => { for (const statement of schema.split(';').filter(sql => sql.trim())) await db.query(statement); })().catch(error => { ready = undefined; throw error; });
  }
  await ready;
  return db.query(text, values);
}
function isConflict(error) { return /UNIQUE constraint failed/.test(error.message); }
module.exports = { query, isConflict };
