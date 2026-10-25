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

export interface RekognitionReadiness {
  enabled: boolean;
  configured: boolean;
  region: string;
  status: 'ready' | 'disabled' | 'misconfigured';
  issue: string | null;
}

const DEFAULT_REKOGNITION_REGION = 'eu-central-1';

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
  private readonly enabled: boolean;
  private readonly region: string;
  private readonly regionExplicitlyConfigured: boolean;

  constructor() {
    this.enabled = process.env.REKOGNITION_ENABLED === 'true';
    const configuredRegion = process.env.AWS_REKOGNITION_REGION?.trim();
    this.regionExplicitlyConfigured = Boolean(configuredRegion);
    this.region = configuredRegion || DEFAULT_REKOGNITION_REGION;
    this.client = this.enabled ? new RekognitionClient({ region: this.region }) : null;
  }

  getReadiness(): RekognitionReadiness {
    if (!this.enabled) {
      return {
        enabled: false,
        configured: false,
        region: this.region,
        status: 'disabled',
        issue: 'REKOGNITION_ENABLED is not true',
      };
    }

    if (!this.regionExplicitlyConfigured) {
      return {
        enabled: true,
        configured: false,
        region: this.region,
        status: 'misconfigured',
        issue: 'AWS_REKOGNITION_REGION is not explicitly configured',
      };
    }

    // Production incident guard: eu-north-1 currently has no Rekognition endpoint.
    // Keep storage AWS_REGION independent; verification analysis uses raw image bytes.
    if (this.region === 'eu-north-1') {
      return {
        enabled: true,
        configured: false,
        region: this.region,
        status: 'misconfigured',
        issue: 'AWS_REKOGNITION_REGION eu-north-1 is unsupported; use eu-central-1 or another supported Rekognition region',
      };
    }

    return {
      enabled: true,
      configured: true,
      region: this.region,
      status: 'ready',
      issue: null,
    };
  }

  /**
   * Assist-only: never throws to the caller. Fail-open → status error/skipped
   * so submit still lands as pending for human review.
   *
   * Images are sent as bytes rather than S3Object references. This deliberately
   * decouples private verification storage from the Rekognition region: AWS
   * requires S3Object buckets to be in the same region as Rekognition, while the
   * existing verification bucket is in eu-north-1 where Rekognition is unavailable.
   */
  async analyzeVerification(
    selfieBase64: string,
    idFrontBase64: string,
  ): Promise<VerificationFaceAnalysis> {
    if (!this.client) {
      return SKIPPED;
    }

    const selfieBytes = Buffer.from(selfieBase64, 'base64');
    const idFrontBytes = Buffer.from(idFrontBase64, 'base64');

    try {
      const [selfieDetect, idDetect] = await Promise.all([
        this.client.send(
          new DetectFacesCommand({
            Image: { Bytes: selfieBytes },
            Attributes: ['DEFAULT'],
          }),
        ),
        this.client.send(
          new DetectFacesCommand({
            Image: { Bytes: idFrontBytes },
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
          SourceImage: { Bytes: selfieBytes },
          TargetImage: { Bytes: idFrontBytes },
          SimilarityThreshold: 0,
        }),
      );

      const best = (compare.FaceMatches ?? []).reduce<number | null>((acc, m) => {
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
      const safeError = err instanceof Error && err.name ? err.name : 'RekognitionError';
      this.logger.warn(`Rekognition analyze failed: ${message}`);
      return {
        status: 'error',
        faceSimilarity: null,
        selfieFaceCount: null,
        idFrontFaceCount: null,
        selfieFaceConfidence: null,
        idFrontFaceConfidence: null,
        error: safeError.slice(0, 120),
      };
    }
  }
}
