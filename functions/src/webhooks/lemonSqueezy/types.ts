// Lemon Squeezy Webhook Types

export interface LemonSqueezyWebhookEvent {
  meta: {
    event_name: string;
    custom_data?: Record<string, any>;
  };
  data: {
    type: string;
    id: string;
    attributes: Record<string, any>;
    relationships?: Record<string, any>;
  };
}

export interface LemonSqueezyWebhookHeaders {
  'x-event-name'?: string;
  'x-signature'?: string;
  'content-type'?: string;
  'user-agent'?: string;
}

// Subscription Event Types
export type SubscriptionEventType = 
  | 'subscription_created'
  | 'subscription_updated' 
  | 'subscription_cancelled'
  | 'subscription_expired'
  | 'subscription_paused'
  | 'subscription_unpaused'
  | 'subscription_resumed'
  | 'subscription_payment_success'
  | 'subscription_payment_failed'
  | 'subscription_payment_recovered'
  | 'subscription_payment_refunded';

// Order Event Types  
export type OrderEventType = 
  | 'order_created'
  | 'order_refunded';

export type WebhookEventType = SubscriptionEventType | OrderEventType;

// Subscription Attributes (from Lemon Squeezy API)
export interface SubscriptionAttributes {
  store_id: number;
  customer_id: number;
  order_id: number;
  order_item_id: number;
  product_id: number;
  variant_id: number;
  product_name: string;
  variant_name: string;
  user_name: string;
  user_email: string;
  status: 'active' | 'cancelled' | 'expired' | 'past_due' | 'unpaid' | 'paused';
  status_formatted: string;
  card_brand: string;
  card_last_four: string;
  pause: any;
  cancelled: boolean;
  trial_ends_at: string | null;
  billing_anchor: number;
  first_subscription_item: {
    id: number;
    subscription_id: number;
    price_id: number;
    quantity: number;
    created_at: string;
    updated_at: string;
  };
  urls: {
    update_payment_method: string;
    customer_portal: string;
  };
  renews_at: string;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

// Order Attributes (from Lemon Squeezy API)
export interface OrderAttributes {
  store_id: number;
  customer_id: number;
  identifier: string;
  order_number: number;
  user_name: string;
  user_email: string;
  currency: string;
  currency_rate: string;
  subtotal: number;
  discount_total: number;
  tax: number;
  total: number;
  subtotal_usd: number;
  discount_total_usd: number;
  tax_usd: number;
  total_usd: number;
  tax_name: string;
  tax_rate: string;
  status: 'pending' | 'paid' | 'void' | 'refunded' | 'partial_refund';
  status_formatted: string;
  refunded: boolean;
  refunded_at: string | null;
  subtotal_formatted: string;
  discount_total_formatted: string;
  tax_formatted: string;
  total_formatted: string;
  first_order_item: {
    id: number;
    order_id: number;
    product_id: number;
    variant_id: number;
    product_name: string;
    variant_name: string;
    price: number;
    quantity: number;
    created_at: string;
    updated_at: string;
  };
  created_at: string;
  updated_at: string;
}

// Webhook Processing Result
export interface WebhookProcessingResult {
  success: boolean;
  eventType: string;
  eventId: string;
  userId?: string;
  error?: string;
  processingTime: number;
}

// User Subscription Update Data
export interface SubscriptionUpdateData {
  plan: 'free' | 'pro';
  billing?: 'monthly' | 'annual';
  status: 'active' | 'cancelled' | 'past_due' | 'on_trial' | 'expired';
  lemonSqueezyId?: string;
  customerId?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  trialEnd?: Date;
  cardBrand?: string;
  cardLastFour?: string;
  updatedAt: Date;
}

// Webhook Log Entry
export interface WebhookLogEntry {
  eventId: string;
  eventType: string;
  userId?: string;
  payload: LemonSqueezyWebhookEvent;
  processingResult: WebhookProcessingResult;
  timestamp: Date;
  signature: string;
  retryCount?: number;
}