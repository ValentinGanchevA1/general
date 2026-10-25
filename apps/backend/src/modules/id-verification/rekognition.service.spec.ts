import { RekognitionService } from './rekognition.service';

const send = jest.fn();

jest.mock('@aws-sdk/client-rekognition', () => ({
  RekognitionClient: jest.fn().mockImplementation(() => ({ send })),
  DetectFacesCommand: jest.fn().mockImplementation((input) => ({ input, _type: 'DetectFaces' })),
  CompareFacesCommand: jest.fn().mockImplementation((input) => ({ input, _type: 'CompareFaces' })),
}));

describe('RekognitionService', () => {
  const prevEnabled = process.env.REKOGNITION_ENABLED;
  const prevBucket = process.env.AWS_S3_BUCKET;
  const prevRegion = process.env.AWS_REGION;

  afterEach(() => {
    send.mockReset();
    process.env.REKOGNITION_ENABLED = prevEnabled;
    process.env.AWS_S3_BUCKET = prevBucket;
    process.env.AWS_REGION = prevRegion;
  });

  it('returns skipped when REKOGNITION_ENABLED is not true', async () => {
    process.env.REKOGNITION_ENABLED = 'false';
    process.env.AWS_S3_BUCKET = 'bucket';
    const svc = new RekognitionService();
    const res = await svc.analyzeVerification('a.jpg', 'b.jpg');
    expect(res.status).toBe('skipped');
    expect(send).not.toHaveBeenCalled();
  });

  it('reports disabled readiness without exposing credentials', () => {
    process.env.REKOGNITION_ENABLED = 'false';
    process.env.AWS_S3_BUCKET = 'private-bucket';
    process.env.AWS_REGION = 'eu-north-1';

    const svc = new RekognitionService();
    const readiness = svc.getReadiness();

    expect(readiness).toEqual({
      enabled: false,
      configured: false,
      region: 'eu-north-1',
      status: 'disabled',
      issue: 'REKOGNITION_ENABLED is not true',
    });
    expect(JSON.stringify(readiness)).not.toContain('private-bucket');
  });

  it('reports misconfigured readiness when enabled without a bucket', () => {
    process.env.REKOGNITION_ENABLED = 'true';
    delete process.env.AWS_S3_BUCKET;

    const svc = new RekognitionService();

    expect(svc.getReadiness().status).toBe('misconfigured');
    expect(svc.getReadiness().issue).toBe('AWS_S3_BUCKET is missing');
  });

  it('returns ok with similarity when DetectFaces + CompareFaces succeed', async () => {
    process.env.REKOGNITION_ENABLED = 'true';
    process.env.AWS_S3_BUCKET = 'g88-uploads-dev';
    send
      .mockResolvedValueOnce({ FaceDetails: [{ Confidence: 99.1 }] })
      .mockResolvedValueOnce({ FaceDetails: [{ Confidence: 97.2 }] })
      .mockResolvedValueOnce({ FaceMatches: [{ Similarity: 94.5 }] });

    const svc = new RekognitionService();
    const res = await svc.analyzeVerification(
      'verifications/u1/selfie.jpg',
      'verifications/u1/id.jpg',
    );

    expect(svc.getReadiness().status).toBe('ready');
    expect(res.status).toBe('ok');
    expect(res.faceSimilarity).toBe(94.5);
    expect(res.selfieFaceCount).toBe(1);
    expect(res.idFrontFaceCount).toBe(1);
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('returns no_face_selfie when selfie has zero faces', async () => {
    process.env.REKOGNITION_ENABLED = 'true';
    process.env.AWS_S3_BUCKET = 'g88-uploads-dev';
    send
      .mockResolvedValueOnce({ FaceDetails: [] })
      .mockResolvedValueOnce({ FaceDetails: [{ Confidence: 90 }] });

    const svc = new RekognitionService();
    const res = await svc.analyzeVerification('s.jpg', 'i.jpg');
    expect(res.status).toBe('no_face_selfie');
    expect(res.faceSimilarity).toBeNull();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('returns no_face_id when ID has zero faces', async () => {
    process.env.REKOGNITION_ENABLED = 'true';
    process.env.AWS_S3_BUCKET = 'g88-uploads-dev';
    send
      .mockResolvedValueOnce({ FaceDetails: [{ Confidence: 90 }] })
      .mockResolvedValueOnce({ FaceDetails: [] });

    const svc = new RekognitionService();
    const res = await svc.analyzeVerification('s.jpg', 'i.jpg');
    expect(res.status).toBe('no_face_id');
  });

  it('fail-open: returns a sanitized error status when AWS throws', async () => {
    process.env.REKOGNITION_ENABLED = 'true';
    process.env.AWS_S3_BUCKET = 'g88-uploads-dev';
    const awsError = new Error('AccessDenied: private bucket/key details');
    awsError.name = 'AccessDeniedException';
    send.mockRejectedValueOnce(awsError);

    const svc = new RekognitionService();
    const res = await svc.analyzeVerification('s.jpg', 'i.jpg');
    expect(res.status).toBe('error');
    expect(res.error).toBe('AccessDeniedException');
    expect(res.error).not.toContain('private bucket');
  });
});
