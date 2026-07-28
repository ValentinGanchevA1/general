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

  afterEach(() => {
    send.mockReset();
    process.env.REKOGNITION_ENABLED = prevEnabled;
    process.env.AWS_S3_BUCKET = prevBucket;
  });

  it('returns skipped when REKOGNITION_ENABLED is not true', async () => {
    process.env.REKOGNITION_ENABLED = 'false';
    process.env.AWS_S3_BUCKET = 'bucket';
    const svc = new RekognitionService();
    const res = await svc.analyzeVerification('a.jpg', 'b.jpg');
    expect(res.status).toBe('skipped');
    expect(send).not.toHaveBeenCalled();
  });

  it('returns ok with similarity when DetectFaces + CompareFaces succeed', async () => {
    process.env.REKOGNITION_ENABLED = 'true';
    process.env.AWS_S3_BUCKET = 'g88-uploads-dev';
    send
      .mockResolvedValueOnce({ FaceDetails: [{ Confidence: 99.1 }] })
      .mockResolvedValueOnce({ FaceDetails: [{ Confidence: 97.2 }] })
      .mockResolvedValueOnce({ FaceMatches: [{ Similarity: 94.5 }] });

    const svc = new RekognitionService();
    const res = await svc.analyzeVerification('verifications/u1/selfie.jpg', 'verifications/u1/id.jpg');

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

  it('fail-open: returns error status when AWS throws', async () => {
    process.env.REKOGNITION_ENABLED = 'true';
    process.env.AWS_S3_BUCKET = 'g88-uploads-dev';
    send.mockRejectedValueOnce(new Error('AccessDenied'));

    const svc = new RekognitionService();
    const res = await svc.analyzeVerification('s.jpg', 'i.jpg');
    expect(res.status).toBe('error');
    expect(res.error).toContain('AccessDenied');
  });
});
