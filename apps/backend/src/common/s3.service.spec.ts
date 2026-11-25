import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { S3Service } from './s3.service';

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn() })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  GetObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  HeadObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  ListObjectsV2Command: jest.fn().mockImplementation((input) => ({ input })),
  DeleteObjectsCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

describe('S3Service mediaReadUrl', () => {
  const bucket = 'g88-uploads-dev';
  const region = 'eu-north-1';
  const ownerId = '11111111-1111-4111-8111-111111111111';
  const baseUrl = `https://${bucket}.s3.${region}.amazonaws.com`;
  const originalBucket = process.env.AWS_S3_BUCKET;
  const originalRegion = process.env.AWS_REGION;

  beforeEach(() => {
    process.env.AWS_S3_BUCKET = bucket;
    process.env.AWS_REGION = region;
    jest.clearAllMocks();
    jest.mocked(getSignedUrl).mockResolvedValue('https://signed.example/read');
  });

  afterEach(() => {
    if (originalBucket === undefined) delete process.env.AWS_S3_BUCKET;
    else process.env.AWS_S3_BUCKET = originalBucket;
    if (originalRegion === undefined) delete process.env.AWS_REGION;
    else process.env.AWS_REGION = originalRegion;
  });

  it('signs canonical photo media with a bounded one-hour read URL', async () => {
    const service = new S3Service();

    await expect(service.mediaReadUrl(`${baseUrl}/photos/${ownerId}/photo.jpg`, ownerId)).resolves.toBe(
      'https://signed.example/read',
    );

    const [client, command, options] = jest.mocked(getSignedUrl).mock.calls[0] ?? [];
    expect(client).toBeDefined();
    expect(command).toEqual({
      input: { Bucket: bucket, Key: `photos/${ownerId}/photo.jpg` },
    });
    expect(options).toEqual({ expiresIn: 60 * 60 });
  });

  it('preserves external media URLs without signing them', async () => {
    const service = new S3Service();
    const external = 'https://images.example.com/avatar.jpg';

    await expect(service.mediaReadUrl(external, ownerId)).resolves.toBe(external);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it('refuses to sign verification objects', async () => {
    const service = new S3Service();

    await expect(
      service.mediaReadUrl(`${baseUrl}/verifications/${ownerId}/id-front.jpg`, ownerId),
    ).rejects.toThrow('not eligible');
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it('refuses canonical media objects owned by a different user', async () => {
    const service = new S3Service();

    await expect(
      service.mediaReadUrl(
        `${baseUrl}/photos/22222222-2222-4222-8222-222222222222/photo.jpg`,
        ownerId,
      ),
    ).rejects.toThrow('not eligible');
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it('refuses malformed canonical object paths', async () => {
    const service = new S3Service();

    await expect(service.mediaReadUrl(`${baseUrl}/photos/${ownerId}`, ownerId)).rejects.toThrow(
      'not eligible',
    );
    expect(getSignedUrl).not.toHaveBeenCalled();
  });
});
