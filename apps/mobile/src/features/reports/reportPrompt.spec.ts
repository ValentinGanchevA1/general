import { appAlert } from '@/ui/appAlert';
import type { AppDispatch } from '@/store';
import { showContentReportPrompt } from './reportPrompt';
import { submitContentReport } from './reportsSlice';

jest.mock('@/ui/appAlert', () => ({ appAlert: jest.fn() }));

const targetId = '11111111-1111-4111-8111-111111111111';
const alerts = jest.mocked(appAlert);
const flush = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('report prompt — success only after backend acknowledgment', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('sends story target and does not show fake success until resolved', async () => {
    let resolveRequest: (action: unknown) => void = () => undefined;
    const pending = new Promise<unknown>(resolve => { resolveRequest = resolve; });
    const dispatch = jest.fn().mockReturnValue(pending) as unknown as AppDispatch;
    showContentReportPrompt(dispatch, 'story', targetId);
    const first = alerts.mock.calls[0];
    expect(first?.[0]).toBe('Report story');
    const spam = first?.[2]?.find(button => button.text === 'Spam or scam');
    expect(spam).toBeDefined();
    spam?.onPress?.();
    expect(alerts).toHaveBeenCalledTimes(1);
    resolveRequest({ type: submitContentReport.fulfilled.type, payload: { reported: true } });
    await flush();
    expect(alerts).toHaveBeenLastCalledWith(
      'Report sent', 'Thank you. Your report has been received for review.',
    );
  });

  it('surfaces backend failures rather than claiming a report was filed', async () => {
    const dispatch = jest.fn().mockResolvedValue({
      type: submitContentReport.rejected.type, payload: 'Network unavailable',
    }) as unknown as AppDispatch;
    showContentReportPrompt(dispatch, 'user', targetId);
    const reason = alerts.mock.calls[0]?.[2]?.find(button => button.text === 'Harassment or bullying');
    reason?.onPress?.();
    await flush();
    expect(alerts).toHaveBeenLastCalledWith('Report not sent', 'Network unavailable');
    expect(alerts.mock.calls.some(([title]) => title === 'Report sent')).toBe(false);
  });

  it('does not falsely acknowledge a request skipped by the Redux concurrency gate', async () => {
    const dispatch = jest.fn().mockResolvedValue({
      type: submitContentReport.rejected.type, payload: undefined,
      error: { name: 'ConditionError' },
    }) as unknown as AppDispatch;
    showContentReportPrompt(dispatch, 'user', targetId);
    alerts.mock.calls[0]?.[2]?.find(button => button.text === 'Spam or scam')?.onPress?.();
    await flush();
    expect(alerts.mock.calls.some(([title]) => title === 'Report sent')).toBe(false);
  });
});
