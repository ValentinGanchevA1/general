import { RekognitionService } from './rekognition.service';

const send = jest.fn();

jest.mock('@aws-sdk/client-rekognition', () => ({
  RekognitionClient: jest.fn().mockImplementation(() => ({ send })),
  DetectFacesCommand: jest.fn().mockImplementation((input) => ({ input, _type: 'DetectFaces' })),
  CompareFacesCommand: jest.fn().mockImplementation((input) => ({ input, _type: 'CompareFaces' })),
}));

const SELFIE_BYTES = Buffer.from('selfie-image-bytes');
const ID_BYTES = Buffer.from('id-image-bytes');
const SELFIE_B64 = SELFIE_BYTES.toString('base64');
const ID_B64 = ID_BYTES.toString('base64');

describe('RekognitionService', () => {
  const prevEnabled = process.env.REKOGNITION_ENABLED;
  const prevBucket = process.env.AWS_S3_BUCKET;
  const prevRegion = process.env.AWS_REGION;
  const prevRekognitionRegion = process.env.AWS_REKOGNITION_REGION;

  afterEach(() => {
    send.mockReset();
    if (prevEnabled === undefined) delete process.env.REKOGNITION_ENABLED;
    else process.env.REKOGNITION_ENABLED = prevEnabled;
    if (prevBucket === undefined) delete process.env.AWS_S3_BUCKET;
    else process.env.AWS_S3_BUCKET = prevBucket;
    if (prevRegion === undefined) delete process.env.AWS_REGION;
    else process.env.AWS_REGION = prevRegion;
    if (prevRekognitionRegion === undefined) delete process.env.AWS_REKOGNITION_REGION;
    else process.env.AWS_REKOGNITION_REGION = prevRekognitionRegion;
  });

  it('returns skipped when REKOGNITION_ENABLED is not true', async () => {
    process.env.REKOGNITION_ENABLED = 'false';
    process.env.AWS_REKOGNITION_REGION = 'eu-central-1';
    const svc = new RekognitionService();
    const res = await svc.analyzeVerification(SELFIE_B64, ID_B64);
    expect(res.status).toBe('skipped');
    expect(send).not.toHaveBeenCalled();
  });

  it('reports disabled readiness without exposing storage configuration', () => {
    process.env.REKOGNITION_ENABLED = 'false';
    process.env.AWS_S3_BUCKET = 'private-bucket';
    process.env.AWS_REGION = 'eu-north-1';
    process.env.AWS_REKOGNITION_REGION = 'eu-central-1';

    const svc = new RekognitionService();
    const readiness = svc.getReadiness();

    expect(readiness).toEqual({
      enabled: false,
      configured: false,
      region: 'eu-central-1',
      status: 'disabled',
      issue: 'REKOGNITION_ENABLED is not true',
    });
    expect(JSON.stringify(readiness)).not.toContain('private-bucket');
  });

  it('requires an explicit Rekognition region when enabled', () => {
    process.env.REKOGNITION_ENABLED = 'true';
    delete process.env.AWS_REKOGNITION_REGION;

    const svc = new RekognitionService();

    expect(svc.getReadiness()).toEqual({
      enabled: true,
      configured: false,
      region: 'eu-central-1',
      status: 'misconfigured',
      issue: 'AWS_REKOGNITION_REGION is not explicitly configured',
    });
  });

  it('rejects eu-north-1 readiness because Rekognition has no endpoint there', () => {
    process.env.REKOGNITION_ENABLED = 'true';
    process.env.AWS_REKOGNITION_REGION = 'eu-north-1';

    const svc = new RekognitionService();

    expect(svc.getReadiness().status).toBe('misconfigured');
    expect(svc.getReadiness().issue).toContain('eu-north-1 is unsupported');
  });

  it('returns ok with similarity and sends image bytes rather than S3Object references', async () => {
    process.env.REKOGNITION_ENABLED = 'true';
    process.env.AWS_REGION = 'eu-north-1';
    process.env.AWS_S3_BUCKET = 'g88-uploads-dev';
    process.env.AWS_REKOGNITION_REGION = 'eu-central-1';
    send
      .mockResolvedValueOnce({ FaceDetails: [{ Confidence: 99.1 }] })
      .mockResolvedValueOnce({ FaceDetails: [{ Confidence: 97.2 }] })
      .mockResolvedValueOnce({ FaceMatches: [{ Similarity: 94.5 }] });

    const svc = new RekognitionService();
    const res = await svc.analyzeVerification(SELFIE_B64, ID_B64);

    expect(svc.getReadiness().status).toBe('ready');
    expect(svc.getReadiness().region).toBe('eu-central-1');
    expect(res.status).toBe('ok');
    expect(res.faceSimilarity).toBe(94.5);
    expect(res.selfieFaceCount).toBe(1);
    expect(res.idFrontFaceCount).toBe(1);
    expect(send).toHaveBeenCalledTimes(3);

    const selfieDetect = send.mock.calls[0]?.[0] as { input?: { Image?: unknown } };
    const idDetect = send.mock.calls[1]?.[0] as { input?: { Image?: unknown } };
    const compare = send.mock.calls[2]?.[0] as {
      input?: { SourceImage?: unknown; TargetImage?: unknown };
    };
    expect(selfieDetect.input?.Image).toEqual({ Bytes: SELFIE_BYTES });
    expect(idDetect.input?.Image).toEqual({ Bytes: ID_BYTES });
    expect(compare.input?.SourceImage).toEqual({ Bytes: SELFIE_BYTES });
    expect(compare.input?.TargetImage).toEqual({ Bytes: ID_BYTES });
  });

  it('returns no_face_selfie when selfie has zero faces', async () => {
    process.env.REKOGNITION_ENABLED = 'true';
    process.env.AWS_REKOGNITION_REGION = 'eu-central-1';
    send
      .mockResolvedValueOnce({ FaceDetails: [] })
      .mockResolvedValueOnce({ FaceDetails: [{ Confidence: 90 }] });

    const svc = new RekognitionService();
    const res = await svc.analyzeVerification(SELFIE_B64, ID_B64);
    expect(res.status).toBe('no_face_selfie');
    expect(res.faceSimilarity).toBeNull();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('returns no_face_id when ID has zero faces', async () => {
    process.env.REKOGNITION_ENABLED = 'true';
    process.env.AWS_REKOGNITION_REGION = 'eu-central-1';
    send
      .mockResolvedValueOnce({ FaceDetails: [{ Confidence: 90 }] })
      .mockResolvedValueOnce({ FaceDetails: [] });

    const svc = new RekognitionService();
    const res = await svc.analyzeVerification(SELFIE_B64, ID_B64);
    expect(res.status).toBe('no_face_id');
  });

  it('fail-open: returns a sanitized error status when AWS throws', async () => {
    process.env.REKOGNITION_ENABLED = 'true';
    process.env.AWS_REKOGNITION_REGION = 'eu-central-1';
    const awsError = new Error('AccessDenied: private request details');
    awsError.name = 'AccessDeniedException';
    send.mockRejectedValueOnce(awsError);

    const svc = new RekognitionService();
    const res = await svc.analyzeVerification(SELFIE_B64, ID_B64);
    expect(res.status).toBe('error');
    expect(res.error).toBe('AccessDeniedException');
    expect(res.error).not.toContain('private request');
  });
});
