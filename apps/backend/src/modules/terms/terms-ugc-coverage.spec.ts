import 'reflect-metadata';
import { REQUIRE_CURRENT_TERMS } from './require-terms.decorator';
import { StoriesController } from '../stories/stories.controller';
import { EventsController } from '../events/events.controller';
import { EventReviewsController } from '../events/event-reviews.controller';
import { ListingsController } from '../listings/listings.controller';
import { UsersController } from '../users/users.controller';
import { FeedController } from '../feed/feed.controller';
import { MessagingController } from '../messaging/messaging.controller';
import { InteractionsController } from '../interactions/interactions.controller';
import { GiftsController } from '../gifts/gifts.controller';
import { DatingController } from '../dating/dating.controller';
import { ContentReportsController } from '../content-reports/content-reports.controller';
import { TermsController } from './terms.controller';

describe('UGC Terms enforcement: route metadata coverage', () => {
  const cases: Array<[object, string[]]> = [
    [StoriesController.prototype, ['presign', 'uploadMediaBase64', 'uploadMediaFile', 'create', 'react']],
    [EventsController.prototype, ['create', 'rsvp', 'shareJoinToPulse', 'createPoll', 'vote', 'askQuestion', 'upvoteQuestion']],
    [EventReviewsController.prototype, ['create', 'edit']],
    [ListingsController.prototype, ['create', 'uploadPhoto', 'updateStatus', 'makeOffer', 'respondToOffer', 'counterOffer']],
    [UsersController.prototype, ['updateProfile', 'avatarPresignedUrl', 'uploadPhotoBase64', 'photoPresignedUrl', 'addPhoto', 'setCover']],
    [FeedController.prototype, ['createCheckIn', 'createPlaceCheckIn']],
    [MessagingController.prototype, ['create']],
    [InteractionsController.prototype, ['wave']],
    [GiftsController.prototype, ['send']],
    [DatingController.prototype, ['like']],
  ];

  for (const [prototype, methods] of cases) {
    for (const name of methods) {
      it(`${prototype.constructor.name}.${name} requires accepted current Terms`, () => {
        const method = (prototype as Record<string, unknown>)[name];
        expect(typeof method).toBe('function');
        expect(Reflect.getMetadata(REQUIRE_CURRENT_TERMS, method as object)).toBe(true);
      });
    }
  }

  it('keeps account deletion, reporting, read-only browsing and Terms acceptance accessible', () => {
    const unguarded: Array<[object, string]> = [
      [StoriesController.prototype, 'nearby'],
      [EventsController.prototype, 'nearby'],
      [ListingsController.prototype, 'browse'],
      [UsersController.prototype, 'deleteAccount'],
      [ContentReportsController.prototype, 'submit'],
      [TermsController.prototype, 'status'],
      [TermsController.prototype, 'accept'],
    ];
    for (const [proto, method] of unguarded) {
      const handler = (proto as Record<string, unknown>)[method];
      expect(typeof handler).toBe('function');
      expect(Reflect.getMetadata(REQUIRE_CURRENT_TERMS, handler as object)).toBeUndefined();
    }
  });
});
