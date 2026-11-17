import { completeProfileEditSave } from './completeProfileEditSave';

describe('Edit Profile with optional Personal Labels', () => {
  it('does not save labels when profile validation or PATCH failed', async () => {
    const saveLabels = jest.fn().mockResolvedValue(true);
    expect(await completeProfileEditSave(false, saveLabels)).toBe(false);
    expect(saveLabels).not.toHaveBeenCalled();
  });

  it('keeps the editor open when saving labels fails', async () => {
    const saveLabels = jest.fn().mockResolvedValue(false);
    expect(await completeProfileEditSave(true, saveLabels)).toBe(false);
    expect(saveLabels).toHaveBeenCalledTimes(1);
  });

  it('completes if both profile and labels save', async () => {
    expect(await completeProfileEditSave(true, async () => true)).toBe(true);
  });

  it('preserves the existing profile flow when labels are disabled or unchanged', async () => {
    expect(await completeProfileEditSave(true, null)).toBe(true);
    expect(await completeProfileEditSave(false, null)).toBe(false);
  });
});
