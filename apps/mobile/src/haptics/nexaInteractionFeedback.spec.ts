import { nexaHaptics } from './nexaHaptics';
import { withNexaMutationFeedback } from './nexaInteractionFeedback';

describe('NEXA interaction feedback', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('emits the requested success intent only after the mutation resolves', async () => {
    const connect = jest.spyOn(nexaHaptics, 'connect').mockImplementation(() => undefined);
    const error = jest.spyOn(nexaHaptics, 'error').mockImplementation(() => undefined);

    const result = await withNexaMutationFeedback(async () => 'ok', 'connect');

    expect(result).toBe('ok');
    expect(connect).toHaveBeenCalledTimes(1);
    expect(error).not.toHaveBeenCalled();
  });

  it('uses commit as the default successful mutation signal', async () => {
    const commit = jest.spyOn(nexaHaptics, 'commit').mockImplementation(() => undefined);

    await withNexaMutationFeedback(async () => 42);

    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('emits error feedback and preserves the original failure', async () => {
    const error = jest.spyOn(nexaHaptics, 'error').mockImplementation(() => undefined);
    const failure = new Error('network');

    await expect(
      withNexaMutationFeedback(async () => {
        throw failure;
      }, 'success'),
    ).rejects.toBe(failure);

    expect(error).toHaveBeenCalledTimes(1);
  });
});
