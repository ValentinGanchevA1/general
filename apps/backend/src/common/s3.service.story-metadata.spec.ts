import { S3Service } from './s3.service';

const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const KEY = `stories/${USER}/clip.mp4`;
const PUBLIC_URL = `https://g88-uploads-dev.s3.eu-north-1.amazonaws.com/${KEY}`;

describe('S3Service story object metadata', () => {
  const previousBucket = process.env.AWS_S3_BUCKET;
  const previousRegion = process.env.AWS_REGION;

  beforeEach(() => {
    process.env.AWS_S3_BUCKET = 'g88-uploads-dev';
    process.env.AWS_REGION = 'eu-north-1';
  });

  afterAll(() => {
    if (previousBucket === undefined) delete process.env.AWS_S3_BUCKET;
    else process.env.AWS_S3_BUCKET = previousBucket;
    if (previousRegion === undefined) delete process.env.AWS_REGION;
    else process.env.AWS_REGION = previousRegion;
  });

  it('does not probe non-canonical hosts or another user prefix', async () => {
    const service = new S3Service();
    const send = jest.fn();
    (service as unknown as { client: { send: jest.Mock } }).client = { send };

    await expect(
      service.storyObjectMetadata(USER, `https://evil.example/${KEY}`),
    ).resolves.toBeNull();
    await expect(
      service.storyObjectMetadata(
        USER,
        `https://g88-uploads-dev.s3.eu-north-1.amazonaws.com/stories/${OTHER}/clip.mp4`,
      ),
    ).resolves.toBeNull();

    expect(send).not.toHaveBeenCalled();
  });

  it('HEADs only a canonical user-owned story key', async () => {
    const service = new S3Service();
    const send = jest.fn().mockResolvedValue({
      ContentLength: 4096,
      ContentType: 'video/mp4',
    });
    (service as unknown as { client: { send: jest.Mock } }).client = { send };

    await expect(service.storyObjectMetadata(USER, PUBLIC_URL)).resolves.toEqual({
      key: KEY,
      contentLength: 4096,
      contentType: 'video/mp4',
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      input: { Bucket: 'g88-uploads-dev', Key: KEY },
    });
  });
});
