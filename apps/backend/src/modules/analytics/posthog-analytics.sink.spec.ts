import { PostHogAnalyticsSink } from './posthog-analytics.sink';

const ORIGINAL_ENV = {
  POSTHOG_ENABLED: process.env.POSTHOG_ENABLED,
  POSTHOG_PROJECT_TOKEN: process.env.POSTHOG_PROJECT_TOKEN,
  POSTHOG_HOST: process.env.POSTHOG_HOST,
};

describe('PostHogAnalyticsSink', () => {
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(null, { status: 200 }),
    );
    delete process.env.POSTHOG_ENABLED;
    delete process.env.POSTHOG_PROJECT_TOKEN;
    delete process.env.POSTHOG_HOST;
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  afterAll(() => {
    for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('is disabled by default', async () => {
    const sink = new PostHogAnalyticsSink();

    await sink.capture('subject-hash', 'app.session_started', { path: 'map' });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends only the supplied pseudonymous subject and safe event payload', async () => {
    process.env.POSTHOG_ENABLED = 'true';
    process.env.POSTHOG_PROJECT_TOKEN = 'phc_test_project_token';
    process.env.POSTHOG_HOST = 'https://eu.i.posthog.com/';
    const sink = new PostHogAnalyticsSink();

    await sink.capture('pseudonymous-subject-hash', 'entity.opened', {
      entityType: 'person',
      surface: 'map',
      $process_person_profile: true,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe('https://eu.i.posthog.com/i/v0/e/');
    expect(init?.method).toBe('POST');

    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body).toEqual({
      api_key: 'phc_test_project_token',
      distinct_id: 'pseudonymous-subject-hash',
      event: 'entity.opened',
      properties: {
        entityType: 'person',
        surface: 'map',
        $process_person_profile: false,
      },
    });
  });

  it('never throws when PostHog is unavailable', async () => {
    process.env.POSTHOG_ENABLED = 'true';
    process.env.POSTHOG_PROJECT_TOKEN = 'phc_test_project_token';
    fetchSpy.mockRejectedValueOnce(new Error('network unavailable'));
    const sink = new PostHogAnalyticsSink();

    await expect(
      sink.capture('subject-hash', 'chat.message_sent', {}),
    ).resolves.toBeUndefined();
  });
});
