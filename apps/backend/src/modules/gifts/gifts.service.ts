import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type {
  GiftBalance,
  GiftCatalogItem,
  GiftReceivedEvent,
  GiftSentResult,
  ReceivedGift,
} from '@g88/shared';

import { GamificationService } from '../gamification/gamification.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';
import { SendGiftDto } from './dto';

@Injectable()
export class GiftsService {
  private readonly logger = new Logger(GiftsService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly gamification: GamificationService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /** The active gift catalog, cheapest first. */
  catalog(): Promise<GiftCatalogItem[]> {
    return this.db.query<GiftCatalogItem[]>(
      `SELECT id, label, emoji, cost_xp AS "costXp"
         FROM gift_catalog
        WHERE active = true
        ORDER BY sort, cost_xp`,
    );
  }

  /** The caller's spendable wallet balance. */
  async balance(userId: string): Promise<GiftBalance> {
    const [row] = await this.db.query<Array<{ spendable_xp: number }>>(
      `SELECT spendable_xp FROM user_gamification WHERE user_id = $1`,
      [userId],
    );
    return { spendableXp: row?.spendable_xp ?? 0 };
  }

  /**
   * The caller's gift inbox, newest first. Marks everything unseen as seen
   * (fire-and-forget — a stale seen_at never blocks the read).
   */
  async received(userId: string, limit = 50): Promise<ReceivedGift[]> {
    const rows = await this.db.query<Array<{
      id: string; giftId: string; emoji: string; label: string;
      message: string | null; seenAt: string | null; createdAt: string;
      senderId: string; senderName: string; senderAvatar: string | null;
    }>>(
      `SELECT g.id, g.gift_id AS "giftId", c.emoji, c.label,
              g.message, g.seen_at AS "seenAt", g.created_at AS "createdAt",
              u.id AS "senderId", u.display_name AS "senderName",
              u.avatar_url AS "senderAvatar"
         FROM gifts g
         JOIN gift_catalog c ON c.id = g.gift_id
         JOIN users u ON u.id = g.sender_id
        WHERE g.recipient_id = $1
        ORDER BY g.created_at DESC
        LIMIT $2`,
      [userId, limit],
    );

    void this.db
      .query(
        `UPDATE gifts SET seen_at = NOW()
          WHERE recipient_id = $1 AND seen_at IS NULL`,
        [userId],
      )
      .catch((e) => this.logger.error(`mark-seen failed: ${e}`));

    return rows.map((r) => ({
      id: r.id,
      giftId: r.giftId,
      emoji: r.emoji,
      label: r.label,
      message: r.message,
      seenAt: r.seenAt,
      createdAt: r.createdAt,
      sender: { id: r.senderId, displayName: r.senderName, avatarUrl: r.senderAvatar },
    }));
  }

  /**
   * Send a gift: debit the sender's wallet and create the gift atomically under a
   * row lock so a double-tap can't double-spend. The recipient reward is awarded
   * post-commit (best-effort, daily-capped, idempotent per gift).
   */
  async send(senderId: string, dto: SendGiftDto): Promise<GiftSentResult> {
    if (dto.recipientId === senderId) {
      throw new BadRequestException({
        code: 'gift.self',
        message: 'You cannot send a gift to yourself.',
      });
    }

    const [item] = await this.db.query<Array<{
      id: string; cost_xp: number; emoji: string; label: string;
    }>>(
      `SELECT id, cost_xp, emoji, label FROM gift_catalog WHERE id = $1 AND active = true`,
      [dto.giftId],
    );
    if (!item) {
      throw new NotFoundException({ code: 'gift.unknown', message: 'Gift not found.' });
    }

    const [recipient] = await this.db.query<Array<{ id: string }>>(
      `SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [dto.recipientId],
    );
    if (!recipient) {
      throw new NotFoundException({
        code: 'gift.recipient_missing',
        message: 'Recipient not found.',
      });
    }

    const qr = this.db.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    let giftId: string;
    let createdAt: string;
    let newBalance: number;
    try {
      // Lock the sender's wallet row; check + debit inside the transaction.
      const [wallet] = await qr.query(
        `SELECT spendable_xp FROM user_gamification WHERE user_id = $1 FOR UPDATE`,
        [senderId],
      );
      const balance: number = wallet?.spendable_xp ?? 0;
      if (balance < item.cost_xp) {
        throw new BadRequestException({
          code: 'gift.insufficient_xp',
          message: `Not enough XP — this gift costs ${item.cost_xp} XP.`,
        });
      }

      await qr.query(
        `UPDATE user_gamification
            SET spendable_xp = spendable_xp - $2, updated_at = NOW()
          WHERE user_id = $1`,
        [senderId, item.cost_xp],
      );

      const [gift] = await qr.query(
        `INSERT INTO gifts (sender_id, recipient_id, gift_id, cost_xp, message)
              VALUES ($1, $2, $3, $4, $5)
           RETURNING id, created_at AS "createdAt"`,
        [senderId, dto.recipientId, item.id, item.cost_xp, dto.message ?? null],
      );

      await qr.commitTransaction();
      giftId = gift.id;
      createdAt = gift.createdAt;
      newBalance = balance - item.cost_xp;
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }

    // Post-commit, best-effort: reward the recipient. award() enforces the
    // 'gift.received' daily cap; the dedupeKey makes it idempotent per gift.
    void this.gamification
      .award(dto.recipientId, 'gift.received', { dedupeKey: `gift:${giftId}` })
      .catch((e) => this.logger.error(`gift.received reward failed: ${e}`));

    // Post-commit, best-effort: deliver live (socket) or via push if offline.
    void this.deliver(giftId, createdAt, senderId, dto.recipientId, item, dto.message)
      .catch((e) => this.logger.error(`gift delivery failed: ${e}`));

    return { giftId, spendableXp: newBalance };
  }

  /** Build the gift:received event (resolving the sender) and hand it to the gateway. */
  private async deliver(
    giftId: string,
    createdAt: string,
    senderId: string,
    recipientId: string,
    item: { id: string; emoji: string; label: string },
    message?: string,
  ): Promise<void> {
    const [sender] = await this.db.query<Array<{
      display_name: string; avatar_url: string | null;
    }>>(
      `SELECT display_name, avatar_url FROM users WHERE id = $1`,
      [senderId],
    );

    const evt: GiftReceivedEvent = {
      id: giftId,
      giftId: item.id,
      emoji: item.emoji,
      label: item.label,
      message: message ?? null,
      sender: {
        id: senderId,
        displayName: sender?.display_name ?? 'Someone',
        avatarUrl: sender?.avatar_url ?? null,
      },
      createdAt,
    };
    await this.realtime.emitGiftReceived(recipientId, evt);
  }
}
