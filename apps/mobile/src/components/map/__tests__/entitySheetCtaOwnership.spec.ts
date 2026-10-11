/**
 * Option B — locks map CTA ownership after Option A/C:
 * - EntityBottomSheet must not POST /dating/likes or /dating/pass
 * - MapScreen must wire onWave / onLike / onPass / onMessage for user pins
 */
import fs from 'node:fs';
import path from 'node:path';

const sheetPath = path.join(__dirname, '../EntityBottomSheet.tsx');
const mapPath = path.join(__dirname, '../../../screens/MapScreen.tsx');

describe('map CTA ownership (Option A/B/C)', () => {
	const sheet = fs.readFileSync(sheetPath, 'utf8');
	const map = fs.readFileSync(mapPath, 'utf8');

	it('EntityBottomSheet has no local dating Like/Pass API', () => {
		expect(sheet).not.toMatch(/\/dating\/likes/);
		expect(sheet).not.toMatch(/\/dating\/pass/);
		expect(sheet).not.toMatch(/localLiking/);
	});

	it('MapScreen wires parent-owned handlers for user pins', () => {
		expect(map).toMatch(/onWave:\s*\(\)\s*=>/);
		expect(map).toMatch(/onLike:\s*\(\)\s*=>/);
		expect(map).toMatch(/onPass:\s*\(\)\s*=>/);
		expect(map).toMatch(/onMessage:\s*\(\)\s*=>/);
		expect(map).toMatch(/openSheetMessage/);
	});
});
