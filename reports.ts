import * as pg from 'pg';
import * as mysql from 'mysql';

const config = require('./config');

function mQuery(mCon: mysql.Connection, query: string, ...params: (string | number)[]): Promise<[ { [key: string]: any; }[], mysql.FieldInfo[] ]> {
  return new Promise((resolve, reject) => {
    mCon.query(query, params, (error, results, fields) => {
      if (error) reject(error);
      resolve([ results, fields ]);
    });
  });
}

async function init(): Promise<[ mysql.Connection, pg.Client ]> {
  let mCon: mysql.Connection, pCon: pg.Client;
  // Initialize MySQL connection
  var { host, user, password, database } = config.mysql;
  mCon = mysql.createConnection({ host, user, password, database, stringifyObjects: true });
  mCon.connect();
  // Initialize PG connection
  var { host, user, password, database } = config.pg;
  pCon = new pg.Client({ host, user, password, database });
  await pCon.connect();
  return [ mCon, pCon ];
}

async function main() {
  const [ mCon, pCon ] = await init();
  const colStr = `id, who, x, y, message, pixel_id, time, claimed_by, closed, reported`;
  const [ results ] = await mQuery(mCon, `SELECT ${colStr} FROM reports`);
  console.log('Starting...');
  for (const result of results) {
    const { id, who, x, y, message, pixel_id, time, claimed_by, reported } = result;
    const closed = result.closed === 1;
    console.log('Reported:', reported, typeof reported);
    const vals = [ id, who, x, y, message, pixel_id, time, claimed_by, closed, reported ];
    const stmt = `INSERT INTO reports (${colStr}) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`;
    try {
      await pCon.query(stmt, vals);
    } catch (err) {
      console.log('Could not execute insert statement! Investigate me!');
      console.error(err);
      process.exit(1);
    }
  }
  console.log('Done!');
  process.exit(0);
}

main();
