import { validate } from 'class-validator';

import { SubmitIdVerificationDto } from './submit-id-verification.dto';

function validDto(): SubmitIdVerificationDto {
  return Object.assign(new SubmitIdVerificationDto(), {
    selfie: 'ZmFrZQ==',
    selfieContentType: 'image/jpeg',
    idFront: 'ZmFrZQ==',
    idFrontContentType: 'image/png',
  });
}

describe('SubmitIdVerificationDto', () => {
  it('accepts the supported verification image MIME types', async () => {
    const dto = validDto();
    dto.idBack = 'ZmFrZQ==';
    dto.idBackContentType = 'image/heic';

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects arbitrary content types', async () => {
    const dto = validDto();
    Object.assign(dto, { selfieContentType: 'application/pdf' });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'selfieContentType')).toBe(true);
  });

  it('rejects empty required image payloads before decode/upload', async () => {
    const dto = validDto();
    dto.selfie = '';

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'selfie')).toBe(true);
  });
});
