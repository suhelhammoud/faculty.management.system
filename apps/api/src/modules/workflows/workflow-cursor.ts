import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

const position = z.strictObject({ time: z.iso.datetime({ precision: 6 }), id: z.uuid() });
export type QueuePosition = z.infer<typeof position>;

export function queueCursor(secret: string, scope: string) {
  const key = createHmac('sha256', secret).update('faculty:workflow-queue-cursor:v1').digest();
  const aad = Buffer.from(scope);
  return {
    encode(value: QueuePosition) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(aad);
      const data = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url');
    },
    decode(token: string | undefined): QueuePosition | undefined {
      if (!token) return undefined;
      try {
        const bytes = Buffer.from(token, 'base64url');
        if (bytes.toString('base64url') !== token) throw new Error('Noncanonical cursor');
        const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
        decipher.setAAD(aad);
        decipher.setAuthTag(bytes.subarray(12, 28));
        const decoded = Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]);
        return position.parse(JSON.parse(decoded.toString()));
      } catch {
        throw new BadRequestException('Invalid workflow cursor');
      }
    },
  };
}
