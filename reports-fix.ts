// This script will update the reported and time columns in config.pg on each ID match

import * as pg from 'pg';

const config = require('./config');

async function init(): Promise<[ pg.Client, pg.Client ]> {
  let aCon: pg.Client, bCon: pg.Client;
  // Initialize PG connection A
  var { host, user, password, database } = config.pg;
  aCon = new pg.Client({ host, user, password, database });
  await aCon.connect();
  // Initialize PG connection B
  var { host, user, password, database } = config.pg2;
  bCon = new pg.Client({ host, user, password, database });
  await bCon.connect();
  return [ aCon, bCon ];
}

async function main() {
  const [ aCon, bCon ] = await init();
  const reportsQuery = await bCon.query(`SELECT * FROM reports`);
  console.log('Updating reports...');
  for (const report of reportsQuery.rows) {
    await aCon.query(`UPDATE reports SET reported = $1, time = $2 WHERE id = $3`, [ report.reported, report.time, report.id ]);
  }
  console.log('Done!');
  process.exit(0);
}

main();
