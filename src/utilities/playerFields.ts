import type { PlayerFieldDefinition } from '../types/database';

const FORBIDDEN_FIELD_PATTERN = /(password|passcode|pin|otp|one_time|secret|token|cvv)/i;

export interface PlayerFieldValidationResult {
  valid: boolean;
  errors: Record<string, string>;
  sanitizedDetails: Record<string, string>;
  targetPlayerUid: string;
  targetServerId: string | null;
}

export function isSensitiveFieldForbidden(keyOrLabel: string): boolean {
  return FORBIDDEN_FIELD_PATTERN.test(keyOrLabel);
}

/**
 * Validates and normalizes dynamic per-game player information fields.
 * Strictly prohibits requesting passwords, OTPs, or sensitive credentials.
 */
export function sanitizeAndValidatePlayerFields(
  schema: PlayerFieldDefinition[],
  submitted: Record<string, string>
): PlayerFieldValidationResult {
  const errors: Record<string, string> = {};
  const sanitizedDetails: Record<string, string> = {};

  const safeSchema =
    schema.length > 0
      ? schema
      : [
          {
            key: 'player_id',
            label: 'Player ID',
            type: 'text' as const,
            placeholder: 'Enter Player ID',
            required: true,
          },
        ];

  for (const field of safeSchema) {
    if (isSensitiveFieldForbidden(field.key) || isSensitiveFieldForbidden(field.label)) {
      errors[field.key] = 'Sensitive credentials such as passwords or OTPs are not permitted.';
      continue;
    }

    const raw = typeof submitted[field.key] === 'string' ? submitted[field.key].trim() : '';

    if (field.required && !raw) {
      errors[field.key] = `${field.label} is required.`;
      continue;
    }

    if (raw.length > 80) {
      errors[field.key] = `${field.label} must not exceed 80 characters.`;
      continue;
    }

    if (field.type === 'select' && field.options && field.options.length > 0 && raw) {
      if (!field.options.includes(raw)) {
        errors[field.key] = `Please choose a valid ${field.label}.`;
        continue;
      }
    }

    if (raw) {
      sanitizedDetails[field.key] = raw;
    }
  }

  const primaryUidKey =
    safeSchema.find((f) => /player|uid|riot|user/i.test(f.key))?.key || safeSchema[0].key;
  const serverKey = safeSchema.find((f) => /server|zone|tag|shard/i.test(f.key))?.key;

  const targetPlayerUid = sanitizedDetails[primaryUidKey] || Object.values(sanitizedDetails)[0] || '';
  const targetServerId = serverKey ? sanitizedDetails[serverKey] || null : null;

  return {
    valid: Object.keys(errors).length === 0 && targetPlayerUid.length > 0,
    errors,
    sanitizedDetails,
    targetPlayerUid,
    targetServerId,
  };
}

export function mapCustomerOrderStatusLabel(
  orderStatus: string
): 'Pending' | 'Processing' | 'Completed' | 'Failed' | 'Cancelled' {
  switch (orderStatus) {
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    case 'cancelled':
    case 'refunded':
      return 'Cancelled';
    case 'awaiting_payment':
    case 'paid':
    case 'fulfilling':
      return 'Processing';
    case 'pending':
    default:
      return 'Pending';
  }
}

export function mapDeliveryStatusLabel(
  fulfillmentStatus: string
): 'Pending' | 'Processing' | 'Delivered' | 'Failed' {
  switch (fulfillmentStatus) {
    case 'delivered':
      return 'Delivered';
    case 'failed':
      return 'Failed';
    case 'queued':
    case 'manual_review':
      return 'Processing';
    case 'pending':
    default:
      return 'Pending';
  }
}
