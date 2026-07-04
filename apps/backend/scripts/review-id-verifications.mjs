import 'dotenv/config';
import pg from 'pg';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL }); // Database connection pool
const s3 = new S3Client({ region: 'eu-north-1' }); // AWS S3 client for object storage
const bucket = process.env.AWS_S3_BUCKET;

async function presign(key) {
	if (!key) return null;
	return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 900 });
}

const { rows } = await pool.query(
	`SELECT v.id, v.user_id, u.display_name, v.selfie_url, v.id_front_url, v.id_back_url, v.created_at
   FROM user_id_verifications v
   JOIN users u ON u.id = v.user_id
   WHERE v.status = 'pending'
   ORDER BY v.created_at ASC`
);

/**
 * @typedef {object} Row
 * @property {number} id
 * @property {string} user_id
 * @property {string} display_name
 * @property {string} selfie_url
 * @property {string} id_front_url
 * @property {string} id_back_url
 * @property {string} created_at
 */

for (const /** @type {Row} */ row of rows) {
	console.log(`\n--- ${row.display_name} (${row.user_id}) submitted ${row.created_at} ---`);
	console.log('Selfie:  ', await presign(row.selfie_url));
	console.log('ID front:', await presign(row.id_front_url));
	console.log('ID back: ', await presign(row.id_back_url));
	console.log(`Decide:  curl -X POST $API/id-verification/admin/${row.user_id}/decide \\`);
	console.log(`  -H "Authorization: Bearer $ADMIN_JWT" -H "Content-Type: application/json" \\`);
	console.log(`  -d '{"decision":"approved"}'`);
}

await pool.end();
