import * as pg from 'pg';
import * as mysql from 'mysql';
const ip6addr = require('ip6addr');

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
  // Both databases are now connected
  // Database tables (as of 11/23/2019):
  const tables = {
    'pixels': 'SELECT id, x, y, color, who, secondary_id, time, mod_action, rollback_action, undone, undo_action, most_recent FROM pixels',
    'users': 'SELECT id, username, login, signup_time, cooldown_expiry, role, ban_expiry, INET6_NTOA(signup_ip), INET6_NTOA(last_ip), last_ip_alert, perma_chat_banned, chat_ban_expiry, chat_ban_reason, ban_reason, pixel_count, pixel_count_alltime, user_agent, stacked, is_rename_requested, discord_name, chat_name_color FROM users',
    'sessions': 'SELECT id, who, token, time FROM sessions',
    'lookups': 'SELECT id, who, time, INET6_NTOA(ip) FROM lookups',
    'admin_log': 'SELECT id, channel, level, message, time, userid FROM admin_log',
    'reports': 'SELECT id, who, x, y, message, pixel_id, time, claimed_by, closed, reported FROM reports',
    'stats': 'SELECT id, channel, value, timestamp FROM stats',
    'admin_notes': 'SELECT id, user_id, target_id, reply_to, message, timestamp FROM admin_notes',
    'banlogs': 'SELECT id, `when`, banner, banned, ban_expiry, action, ban_reason FROM banlogs',
    'chat_messages': 'SELECT nonce, author, sent, content, filtered, purged, purged_by FROM chat_messages',
    'chat_reports': 'SELECT id, time, chat_message, report_message, target, initiator, claimed_by, closed FROM chat_reports',
    'ip_log': 'SELECT id, user, INET6_NTOA(ip), last_used FROM ip_log',
    'notifications': 'SELECT id, time, expiry, title, content, who FROM notifications',
    'chatbans': 'SELECT id, target, initiator, `when`, type, expiry, reason, purged FROM chatbans'
  };
  const migrationBools = {
    pixels: [ 'mod_action', 'rollback_action', 'undone', 'undo_action', 'most_recent' ],
    users: [ 'last_ip_alert', 'perma_chat_banned', 'is_rename_requested' ],
    reports: [ 'closed' ],
    chat_messages: [ 'purged' ],
    chat_reports: [ 'closed' ],
    chatbans: [ 'purged' ]
  };
  let interval;
  const tableNames = Object.keys(tables);
  for (let i = 0; i < tableNames.length; i++) {
    let j = 0;
    const tableName = tableNames[i];
    const table = tables[tableName];
    console.log('Insertion count on table "' + tableName + '":');
    const [ results, fields ] = await mQuery(mCon, table);
    for (const result of results) {
      for (const key of Object.keys(result)) {
        if (typeof migrationBools[tableName] !== 'undefined') {
          if (migrationBools[tableName].includes(key)) {
            result[key] = result[key] === 1
          }
        }
        if (result[key] === '0000-00-00 00:00:00') {
          result[key] = null;
        }
      }
      const stmt = `INSERT INTO "${tableName}" VALUES (${fields.map(f => '$' + (fields.indexOf(f) + 1)).join(', ')})`;
      const vals = Object.values(result);
      try {
        j++;
        if (typeof interval === 'undefined') interval = setInterval(() => {
          process.stdout.clearLine(-1);
          process.stdout.cursorTo(0);
          process.stdout.write(j.toString());
        }, 1000);
        await pCon.query(stmt, vals);
      } catch (err) {
        console.log('Could not execute insert statement! Investigate me!');
        console.log('Fields:', fields.map(field => field.name));
        console.log('Query:', stmt, vals);
        console.error(err);
        process.exit(1);
      }
    }
    console.log();
    j = 0;
  }
  clearInterval(interval);
  console.log('Done!');
  process.exit(0);
}

main();
