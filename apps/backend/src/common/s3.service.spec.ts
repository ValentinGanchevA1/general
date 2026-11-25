import { GetObjectCommand } from '@aws-sdk/client-s3';
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
  const baseUrl = `https://${bucket}.s3.${region}.amazonaws.com`;

  beforeEach(() => {
    process.env.AWS_S3_BUCKET = bucket;
    process.env.AWS_REGION = region;
    jest.clearAllMocks();
    jest.mocked(getSignedUrl).mockResolvedValue('https://signed.example/read');
  });

  afterEach(() => {
    delete process.env.AWS_S3_BUCKET;
    delete process.env.AWS_REGION;
  });

  it('signs canonical photo media with a bounded one-hour read URL', async () => {
    const service = new S3Service();

    await expect(service.mediaReadUrl(`${baseUrl}/photos/user-1/photo.jpg`)).resolves.toBe(
      'https://signed.example/read',
    );

    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(GetObjectCommand),
      { expiresIn: 60 * 60 },
    );
  });

  it('preserves external media URLs without signing them', async () => {
    const service = new S3Service();
    const external = 'https://images.example.com/avatar.jpg';

    await expect(service.mediaReadUrl(external)).resolves.toBe(external);
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it('refuses to sign verification objects', async () => {
    const service = new S3Service();

    await expect(
      service.mediaReadUrl(`${baseUrl}/verifications/user-1/id-front.jpg`),
    ).rejects.toThrow('not eligible');
    expect(getSignedUrl).not.toHaveBeenCalled();
  });

  it('refuses malformed canonical object paths', async () => {
    const service = new S3Service();

    await expect(service.mediaReadUrl(`${baseUrl}/photos/user-1`)).rejects.toThrow(
      'not eligible',
    );
    expect(getSignedUrl).not.toHaveBeenCalled();
  });
});
