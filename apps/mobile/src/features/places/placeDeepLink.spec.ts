import {
  buildPlaceDeepLink,
  parsePlaceDeepLink,
  placeDeepLinkQueue,
} from './placeDeepLink';

const PLACE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('placeDeepLink', () => {
  beforeEach(() => {
    placeDeepLinkQueue.clear();
  });

  it('builds a canonical link containing only the NEXA place id', () => {
    expect(buildPlaceDeepLink(PLACE_ID)).toBe(`nexa://place/${PLACE_ID}`);
  });

  it('rejects invalid ids when building links', () => {
    expect(() => buildPlaceDeepLink('not-a-place')).toThrow('invalid place ID');
  });

  it('uses an isolated QA scheme and never accepts Production place links in QA', () => {
    const previous = process.env.NEXUS_WORLDS_QA;
    process.env.NEXUS_WORLDS_QA = '1';
    try {
      jest.isolateModules(() => {
        const qaLinks = require('./placeDeepLink') as typeof import('./placeDeepLink');
        expect(qaLinks.buildPlaceDeepLink(PLACE_ID)).toBe(`nexa-qa://place/${PLACE_ID}`);
        expect(qaLinks.parsePlaceDeepLink(`nexa-qa://place/${PLACE_ID}`)).toBe(PLACE_ID);
        expect(qaLinks.parsePlaceDeepLink(`nexa://place/${PLACE_ID}`)).toBeNull();
      });
    } finally {
      if (previous === undefined) {
        delete process.env.NEXUS_WORLDS_QA;
      } else {
        process.env.NEXUS_WORLDS_QA = previous;
      }
    }
  });

  it('parses exact place resources and ignores unrelated or malformed URLs', () => {
    expect(parsePlaceDeepLink(`nexa://place/${PLACE_ID}`)).toBe(PLACE_ID);
    expect(parsePlaceDeepLink(`nexa://place/${PLACE_ID}?source=share`)).toBe(PLACE_ID);
    expect(parsePlaceDeepLink(`nexa://place/${PLACE_ID}#map`)).toBe(PLACE_ID);
    expect(parsePlaceDeepLink(`nexa://place/${PLACE_ID}/extra`)).toBeNull();
    expect(parsePlaceDeepLink('nexa://user/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).toBeNull();
    expect(parsePlaceDeepLink('https://example.com/place/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).toBeNull();
    expect(parsePlaceDeepLink('nexa://place/not-a-uuid')).toBeNull();
  });

  it('keeps only the latest valid place intent and does not let invalid URLs overwrite it', () => {
    const otherId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    expect(placeDeepLinkQueue.enqueueUrl(`nexa://place/${PLACE_ID}`)).toBe(true);
    expect(placeDeepLinkQueue.enqueueUrl('nexa://place/not-a-uuid')).toBe(false);
    expect(placeDeepLinkQueue.getSnapshot()).toBe(PLACE_ID);

    expect(placeDeepLinkQueue.enqueueUrl(`nexa://place/${otherId}`)).toBe(true);
    expect(placeDeepLinkQueue.getSnapshot()).toBe(otherId);
  });

  it('clears only the expected pending intent', () => {
    const otherId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    placeDeepLinkQueue.enqueueUrl(`nexa://place/${PLACE_ID}`);
    placeDeepLinkQueue.clear(otherId);
    expect(placeDeepLinkQueue.getSnapshot()).toBe(PLACE_ID);

    placeDeepLinkQueue.clear(PLACE_ID);
    expect(placeDeepLinkQueue.getSnapshot()).toBeNull();
  });
});
