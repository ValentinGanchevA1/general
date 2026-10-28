import { ServiceUnavailableException } from '@nestjs/common';

import type { S3Service } from '../../common/s3.service';
import { StoriesController } from './stories.controller';
import type { StoriesService } from './stories.service';

const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const STORY_URL = `https://uploads.example/stories/${USER}/clip.mp4`;

function setup() {
  const story = { id: 'story-1' };
  const create = jest.fn().mockResolvedValue(story);
  const storyObjectMetadata = jest.fn().mockResolvedValue({
    contentLength: 1024 * 1024,
    contentType: 'video/mp4',
  });
  const deleteObjectsByKeys = jest.fn().mockResolvedValue(1);

  const stories = { create } as unknown as StoriesService;
  const s3 = { storyObjectMetadata, deleteObjectsByKeys } as unknown as S3Service;
  const controller = new StoriesController(stories, s3);

  return { controller, create, storyObjectMetadata, deleteObjectsByKeys, story };
}

function videoDto(mediaUrl = STORY_URL) {
  return {
    mediaUrl,
    mediaType: 'video' as const,
    location: { lat: 42.7, lng: 23.3 },
  };
}

describe('StoriesController presigned object validation', () => {
  it('allows a bounded uploaded object with matching media type', async () => {
    const { controller, create, storyObjectMetadata, deleteObjectsByKeys, story } = setup();

    await expect(controller.create(USER, videoDto())).resolves.toEqual({ story });

    expect(storyObjectMetadata).toHaveBeenCalledWith(`stories/${USER}/clip.mp4`);
    expect(deleteObjectsByKeys).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith(USER, videoDto());
  });

  it('rejects and cleans up an uploaded object above 18 MiB', async () => {
    const { controller, create, storyObjectMetadata, deleteObjectsByKeys } = setup();
    storyObjectMetadata.mockResolvedValueOnce({
      contentLength: 18 * 1024 * 1024 + 1,
      contentType: 'video/mp4',
    });

    await expect(controller.create(USER, videoDto())).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'story.media_too_large' }),
    });

    expect(deleteObjectsByKeys).toHaveBeenCalledWith([`stories/${USER}/clip.mp4`]);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects and cleans up a media type mismatch', async () => {
    const { controller, create, storyObjectMetadata, deleteObjectsByKeys } = setup();
    storyObjectMetadata.mockResolvedValueOnce({
      contentLength: 1024,
      contentType: 'image/jpeg',
    });

    await expect(controller.create(USER, videoDto())).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'story.media_type_unsupported' }),
    });

    expect(deleteObjectsByKeys).toHaveBeenCalledWith([`stories/${USER}/clip.mp4`]);
    expect(create).not.toHaveBeenCalled();
  });

  it('does not probe S3 for an untrusted path and delegates trust rejection to the service', async () => {
    const { controller, create, storyObjectMetadata, story } = setup();
    const dto = videoDto('https://evil.example/clip.mp4');

    await expect(controller.create(USER, dto)).resolves.toEqual({ story });

    expect(storyObjectMetadata).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith(USER, dto);
  });

  it('fails closed with retryable service-unavailable semantics when S3 HEAD fails', async () => {
    const { controller, create, storyObjectMetadata, deleteObjectsByKeys } = setup();
    storyObjectMetadata.mockRejectedValueOnce(new Error('s3 unavailable'));

    await expect(controller.create(USER, videoDto())).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    expect(deleteObjectsByKeys).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});
