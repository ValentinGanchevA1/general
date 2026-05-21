// scripts/seed.js — mock user profiles for local discovery testing
// Usage:  npm run seed          (from apps/backend/)
//   or:  DATABASE_URL=postgres://... node scripts/seed.js
//
// Change CENTER below to match the area you are testing.
// All seed users get password: Test1234!

const { Client } = require('pg');
const bcrypt = require('bcrypt');
const h3 = require('h3-js');

const CONNECTION_STRING =
  process.env.DATABASE_URL ?? 'postgres://g88:g88dev@localhost:5432/g88';

// ── Drop this pin where you want users to appear ─────────────────────────────
const CENTER = { lat: 43.2141, lng: 27.9147 }; // Varna, Bulgaria — city centre

const SEED_PASSWORD = 'Test1234!';
const BCRYPT_ROUNDS = 12;

// dlat/dlng are rough offsets from CENTER (~0.001° ≈ 111m lat, ~69m lng at 51°N)
const MOCK_USERS = [
  { name: 'Alex Rivera',   bio: 'Photographer & coffee addict',        avatar: 10, dlat:  0.000, dlng:  0.000 },
  { name: 'Sam Chen',      bio: 'Tech founder. Ask me about startups.', avatar: 15, dlat:  0.003, dlng: -0.003 },
  { name: 'Jordan Blake',  bio: 'Runner + bookworm. Mostly running.',   avatar: 22, dlat: -0.003, dlng:  0.002 },
  { name: 'Casey Morgan',  bio: 'Local food guide. I know the spots.',  avatar: 33, dlat:  0.005, dlng:  0.001 },
  { name: 'Riley Kim',     bio: 'Artist. Always creating something.',   avatar: 44, dlat: -0.005, dlng: -0.002 },
  { name: 'Taylor Osei',   bio: 'Music producer & weekend hiker.',      avatar: 55, dlat:  0.002, dlng:  0.005 },
  { name: 'Morgan Walsh',  bio: 'Digital nomad. Currently here.',       avatar: 64, dlat: -0.002, dlng: -0.005 },
  { name: 'Drew Solis',    bio: 'Fitness coach. Lets get moving!',      avatar: 76, dlat:  0.007, dlng: -0.001 },
  { name: 'Avery Lopes',   bio: 'Chef and recipe developer.',           avatar: 83, dlat: -0.007, dlng:  0.001 },
  { name: 'Quinn Adeyemi', bio: 'Lawyer by day, DJ by night.',          avatar: 90, dlat:  0.004, dlng: -0.007 },
  { name: 'Skyler Nguyen', bio: '40 countries and counting.',           avatar: 12, dlat: -0.004, dlng:  0.007 },
  { name: 'Reese Tanaka',  bio: 'UX designer. Hot takes welcome.',      avatar: 27, dlat:  0.001, dlng: -0.008 },
  { name: 'Finley Park',   bio: 'Open source and startup ecosystem.',   avatar: 38, dlat: -0.001, dlng:  0.008 },
  { name: 'Blake Hassan',  bio: 'Cyclist and environmentalist.',        avatar: 51, dlat:  0.008, dlng:  0.004 },
  { name: 'Noel Ferreira', bio: 'Comedian. Yes, actually funny.',       avatar: 62, dlat: -0.008, dlng: -0.004 },
];

function emailFor(name) {
  return name.toLowerCase().replace(/\s+/g, '.') + '@mock.g88.dev';
}

function fuzzToR10(lat, lng) {
  const cell = h3.latLngToCell(lat, lng, 10);
  const [fLat, fLng] = h3.cellToLatLng(cell);
  return { lat: fLat, lng: fLng };
}

function computeCells(lat, lng) {
  return {
    r4:  h3.latLngToCell(lat, lng, 4),
    r5:  h3.latLngToCell(lat, lng, 5),
    r6:  h3.latLngToCell(lat, lng, 6),
    r7:  h3.latLngToCell(lat, lng, 7),
    r8:  h3.latLngToCell(lat, lng, 8),
    r9:  h3.latLngToCell(lat, lng, 9),
    r10: h3.latLngToCell(lat, lng, 10),
  };
}

async function run() {
  const client = new Client({ connectionString: CONNECTION_STRING });
  await client.connect();
  console.log('Connected.\n');

  // Clear previous seed run
  const del = await client.query(
    `DELETE FROM users WHERE email LIKE '%@mock.g88.dev' RETURNING id`,
  );
  if (del.rowCount > 0) {
    console.log(`Removed ${del.rowCount} users from previous seed run.`);
  }

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, BCRYPT_ROUNDS);
  console.log('Inserting mock users...');

  const results = [];

  for (const u of MOCK_USERS) {
    const { lat, lng } = fuzzToR10(CENTER.lat + u.dlat, CENTER.lng + u.dlng);
    const cells = computeCells(lat, lng);
    const email = emailFor(u.name);
    const avatarUrl = `https://i.pravatar.cc/150?img=${u.avatar}`;

    await client.query(
      `INSERT INTO users
         (email, password_hash, display_name, bio, avatar_url,
          location,
          location_h3_r4, location_h3_r5, location_h3_r6,
          location_h3_r7, location_h3_r8, location_h3_r9, location_h3_r10,
          visibility, verification_level)
       VALUES
         ($1, $2, $3, $4, $5,
          ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography,
          $8, $9, $10, $11, $12, $13, $14,
          'public', 'none')`,
      // ST_MakePoint(X, Y) = ST_MakePoint(lng, lat)
      [email, passwordHash, u.name, u.bio, avatarUrl,
       lng, lat,
       cells.r4, cells.r5, cells.r6, cells.r7, cells.r8, cells.r9, cells.r10],
    );

    results.push({ name: u.name, email, lat: lat.toFixed(6), lng: lng.toFixed(6) });
    process.stdout.write('.');
  }

  console.log('\n');
  console.log(`${'Name'.padEnd(16)} ${'Email'.padEnd(34)} Coordinates`);
  console.log('─'.repeat(78));
  for (const r of results) {
    console.log(`${r.name.padEnd(16)} ${r.email.padEnd(34)} (${r.lat}, ${r.lng})`);
  }

  console.log(`\nPassword for all users: ${SEED_PASSWORD}`);
  console.log(`Center: ${CENTER.lat}, ${CENTER.lng} — edit CENTER in this file to move the cluster.`);

  await client.end();
}

run().catch((err) => {
  console.error('\nSeed failed:', err.message);
  process.exit(1);
});