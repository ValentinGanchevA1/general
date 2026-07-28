import { Injectable, Logger } from '@nestjs/common';
import {
  RekognitionClient,
  DetectFacesCommand,
  CompareFacesCommand,
} from '@aws-sdk/client-rekognition';

export type RekognitionStatus =
  | 'skipped'
  | 'ok'
  | 'no_face_selfie'
  | 'no_face_id'
  | 'error';

export interface VerificationFaceAnalysis {
  status: RekognitionStatus;
  faceSimilarity: number | null;
  selfieFaceCount: number | null;
  idFrontFaceCount: number | null;
  selfieFaceConfidence: number | null;
  idFrontFaceConfidence: number | null;
  error: string | null;
}

const SKIPPED: VerificationFaceAnalysis = {
  status: 'skipped',
  faceSimilarity: null,
  selfieFaceCount: null,
  idFrontFaceCount: null,
  selfieFaceConfidence: null,
  idFrontFaceConfidence: null,
  error: null,
};

@Injectable()
export class RekognitionService {
  private readonly logger = new Logger(RekognitionService.name);
  private readonly client: RekognitionClient | null;
  private readonly bucket: string;
  private readonly enabled: boolean;

  constructor() {
    this.enabled = process.env.REKOGNITION_ENABLED === 'true';
    this.bucket = process.env.AWS_S3_BUCKET ?? '';
    const region = process.env.AWS_REGION ?? 'eu-north-1';
    this.client =
      this.enabled && this.bucket
        ? new RekognitionClient({ region })
        : null;
  }

  /**
   * Assist-only: never throws to the caller. Fail-open → status error/skipped
   * so submit still lands as pending for human review.
   */
  async analyzeVerification(
    selfieKey: string,
    idFrontKey: string,
  ): Promise<VerificationFaceAnalysis> {
    if (!this.client || !this.bucket) {
      return SKIPPED;
    }

    try {
      const [selfieDetect, idDetect] = await Promise.all([
        this.client.send(
          new DetectFacesCommand({
            Image: { S3Object: { Bucket: this.bucket, Name: selfieKey } },
            Attributes: ['DEFAULT'],
          }),
        ),
        this.client.send(
          new DetectFacesCommand({
            Image: { S3Object: { Bucket: this.bucket, Name: idFrontKey } },
            Attributes: ['DEFAULT'],
          }),
        ),
      ]);

      const selfieFaces = selfieDetect.FaceDetails ?? [];
      const idFaces = idDetect.FaceDetails ?? [];
      const selfieFaceCount = selfieFaces.length;
      const idFrontFaceCount = idFaces.length;
      const selfieFaceConfidence = selfieFaces[0]?.Confidence ?? null;
      const idFrontFaceConfidence = idFaces[0]?.Confidence ?? null;

      if (selfieFaceCount === 0) {
        return {
          status: 'no_face_selfie',
          faceSimilarity: null,
          selfieFaceCount,
          idFrontFaceCount,
          selfieFaceConfidence,
          idFrontFaceConfidence,
          error: null,
        };
      }
      if (idFrontFaceCount === 0) {
        return {
          status: 'no_face_id',
          faceSimilarity: null,
          selfieFaceCount,
          idFrontFaceCount,
          selfieFaceConfidence,
          idFrontFaceConfidence,
          error: null,
        };
      }

      // SimilarityThreshold 0 → always return the best score for the admin UI.
      const compare = await this.client.send(
        new CompareFacesCommand({
          SourceImage: { S3Object: { Bucket: this.bucket, Name: selfieKey } },
          TargetImage: { S3Object: { Bucket: this.bucket, Name: idFrontKey } },
          SimilarityThreshold: 0,
        }),
      );

      const best = (compare.FaceMatches ?? []).reduce<
        number | null
      >((acc, m) => {
        const s = m.Similarity;
        if (s === undefined) return acc;
        return acc === null ? s : Math.max(acc, s);
      }, null);

      return {
        status: 'ok',
        faceSimilarity: best,
        selfieFaceCount,
        idFrontFaceCount,
        selfieFaceConfidence,
        idFrontFaceConfidence,
        error: null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Rekognition analyze failed: ${message}`);
      return {
        status: 'error',
        faceSimilarity: null,
        selfieFaceCount: null,
        idFrontFaceCount: null,
        selfieFaceConfidence: null,
        idFrontFaceConfidence: null,
        error: message.slice(0, 500),
      };
    }
  }
}
