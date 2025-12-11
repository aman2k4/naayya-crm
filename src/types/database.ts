import { z } from 'zod';

// Teacher Cancellation Policy types
export interface TeacherCancellationPolicy {
  id: string;
  studio_id: string;
  teachers_can_cancel: boolean;
  min_cancellation_hours: number;
  max_enrollment_threshold: number | null;
  require_admin_approval: boolean;
  custom_message: string | null;
  created_at: string;
  updated_at: string;
}

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  created_at: z.string(),
  app_metadata: z.object({
    provider: z.string(),
    providers: z.array(z.string()),
  }),
  user_metadata: z.record(z.string(), z.any()),
  aud: z.string(),
});

export interface Class {
  id: string;
  created_at: string;
  name: string;
  sub_heading: string | null;
  description: string | null;
  image_url: string | null;
  teacher_id: string;
  location_id: string;
  category: string | null;
  studio_id: string;
  location?: Location;
  tags: string[];
  teacher?: Teacher;
  price_display_text: string | null;
  co_teachers?: ClassTeacherLink[];
}

// Define and export AttendanceStatus type
export type AttendanceStatus = 'pending' | 'attended' | 'no_show';

// Archive Class Instance RPC Response Types
export interface ArchiveClassInstanceBookingData {
  booking_id: string;
  profile_id: string;
  profile_email: string;
  subscription_id: string | null;
  profile_credit_id: string | null;
  class_instance_id: string;
  booking_status: 'admin_cancelled' | 'user_cancelled' | 'cancelled' | 'confirmed';
  cancellation_note: string | null;
  cancellation_summary: string | null;
  was_eligible_for_refund?: boolean | null;
}

export interface ArchiveClassInstanceResponse {
  success: boolean;
  error?: string;
  error_detail?: string;
  cancelled_bookings_count?: number;
  bookings?: ArchiveClassInstanceBookingData[];
  instance_id?: string;
  studio_id?: string;
  cancellation_note?: string | null;
  cancellation_summary?: string | null;
}

export type Booking = {
  id: string;
  created_at: string;
  updated_at: string;
  class_instance_id: string;
  booking_status: 'confirmed' | 'cancelled' | 'user_cancelled' | 'admin_cancelled'; // IN DB this is text without constraints
  booking_date: string;
  profile_credit_id: string;
  notes?: string;
  profile_id: string;
  profile: Profile;
  studio_id: string;
  studio: Studio;
  // Use the exported type alias
  attendance_status: AttendanceStatus; // IN DB this is text without constraints
  temporary_profile?: TemporaryProfile;
}

export interface Schedule {
  id: string;
  created_at: string; // UTC ISO string
  start_datetime: string; // UTC ISO string
  end_datetime: string; // UTC ISO string
  recurrence_rule: string | null;
  recurrence_end: string | null; // UTC ISO string
  description: string | null;
  studio_id: string;
  updated_at: string; // UTC ISO string
  hasInstances?: boolean;
  class_instances?: Array<{
    count: number;
  }>;
}

export interface ClassInstance {
  id: string;
  created_at: string;
  updated_at: string | null;
  schedule_id: string;
  class_id: string;
  teacher_id: string;
  location_id: string;
  start_time: string;
  end_time: string;
  studio_id: string;
  status: 'pending' | 'scheduled' | 'cancelled' | 'completed';
  is_archived: boolean;
  archived_at: string | null;
  bookings?: Array<{
    id: string;
    booking_status: string;
  }>;
}

export type Teacher = {
  id: string;
  created_at: string;
  user_id: string | null;
  name: string;
  bio: string | null;
  image_url: string | null;
  studio_id: string;
  primary_style: string | null;
  instagram_handle: string | null;
  profile?: {
    email: string;
    first_name: string | null;
    last_name: string | null;
    profile_picture_path: string | null;
  }
}

// Teacher link types for multiple teachers per class/instance
export interface ClassTeacherLink {
  id: string;
  class_id: string;
  teacher_id: string;
  studio_id: string;
  role: 'primary' | 'co' | 'assistant' | 'substitute' | 'guest';
  created_at: string;
  updated_at: string;
  teacher?: Teacher;
}

export interface ClassInstanceTeacherLink {
  id: string;
  class_instance_id: string;
  teacher_id: string;
  studio_id: string;
  role: 'primary' | 'co' | 'assistant' | 'substitute' | 'guest';
  created_at: string;
  updated_at: string;
  teacher?: Teacher;
}

export type Location = {
  id: string;
  created_at: string;
  name: string;
  description: string;
  image_url: string;
  capacity: number;
  studio_id: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
  google_maps_url?: string;
  place_id?: string;
  timezone: string;
  phone_number?: string;
  is_active: boolean;
  parent_location_id?: string | null;
}

export interface Product {
  id: string;
  created_at: string;
  name: string;
  price: number;  // Price in major currency units (euros/dollars) - legacy field
  price_cents?: number;  // Price in smallest currency unit (cents) - preferred field
  updated_at?: string;  // Added missing column
  description: string;
  display_name: string;
  credits: number | null;
  category: string;
  validity_period: number | null;
  is_active: boolean;
  stripe_product_id?: string;
  stripe_price_id?: string;
  payment_url?: string;
  studio_id: string;
  is_archived: boolean;
  archived_at: string | null;
  product_type: 'physical' | 'digital' | 'subscription' | 'gift_card';
  currency: string;  // Added missing column
  stripe_product_location?: 'platform' | 'connected';  // Where Stripe product lives (2025-11-27)
  image_url?: string | null;  // Optional product image URL for Stripe receipts (2025-11-27)
  // Subscription-specific fields
  subscription_interval?: 'day' | 'week' | 'month' | 'year' | null;
  subscription_interval_count?: number | null;
  usage_limit?: number | null; // null = unlimited
  auto_renewal?: boolean;
  activation_type?: 'immediate' | 'first_use' | 'scheduled' | null;
  eligibility_type?: 'everyone' | 'once_per_customer' | 'first_subscription_only' | null;
  fixed_start_date?: string | null;
  fixed_end_date?: string | null;
  // Class count for admin UI display
  class_count?: number;
}

export interface ExtendedClassInstance {
    id: string;
    class_id: string;
    start_time: string;
    end_time: string;
    status: 'scheduled' | 'cancelled' | 'completed' | 'pending';
    location_id: string;
    teacher_id: string;
    is_archived: boolean;
    archived_at: string | null;
    created_at: string;
    updated_at: string | null;
    class: {
      id: string;
      name: string;
      sub_heading: string | null;
      description: string | null;
      image_url: string | null;
      price_display_text: string | null;
      category: string | null;
    };
    teacher: {
      id: string;
      name: string;
      created_at: string;
      user_id: string | null;
      bio: string | null;
      image_url: string | null;
      studio_id: string;
      primary_style: string | null;
      instagram_handle: string | null;
    };
    location: {
      name: string;
      description: string;
      created_at: string;
      updated_at: string;
      capacity: number;
      timezone: string;
      address_line_1?: string | null;
      address_line_2?: string | null;
      city?: string | null;
      state?: string | null;
      postal_code?: string | null;
      country?: string | null;
    };
    studio_id: string;
    schedule_id?: string;
    schedule?: {
      id: string;
      created_at: string;
      updated_at: string;
      recurrence_rule: string | null;
      start_datetime: string;
      end_datetime: string;
      recurrence_end: string | null;
      description: string | null;
    };
    studio: Studio;
    co_teachers?: ClassInstanceTeacherLink[];
    bookings?: Array<{
        id: string;
        created_at: string;
        booking_status: 'confirmed' | 'cancelled' | 'user_cancelled' | 'admin_cancelled';
        // Use the exported type alias
        attendance_status: AttendanceStatus;
        booking_date: string | null;
        studio_id: string;
        profile_credit_id: string | null;
        cancellation_note?: string | null;
        cancelled_by?: string | null;
        cancelled_at?: string | null;
        was_eligible_for_refund?: boolean | null;
        user_cancellation_note?: string | null;
        notes?: string;
        temporary_profile?: TemporaryProfile;
        profile: {
          id: string;
            first_name: string | null;
            last_name: string | null;
            email: string;
            disclosures: { type: string; details: string; created_at: string }[] | null;
        };
        profile_credit?: {
            id: string;
            remaining_credits: number;
            expiry_date: string | null;
            product: {
                display_name: string;
                credits: number;
                validity_period: number;
            }
        } | null;
    }>;
    booking_count?: number; // Optional count of confirmed bookings, populated by API when includeBookingCount=true
}

export interface ClassProduct {
  id: string;
  class_id: string;
  product_id: string;
  created_at: string;
  studio_id: string;
  class?: Class;
  product?: Product;
}

export interface Profile {
  id: string;
  user_id: string;
  role: 'admin' | 'owner' | 'manager' | 'teacher' | 'user';
  first_name: string | null;
  last_name: string | null;
  age: number | null;
  email: string;
  phone: string | null;
  date_of_birth: string | null;
  created_at: string;
  updated_at: string;
  profile_picture_path: string | null;
  bio: string | null;
  disclosures: { type: string; details: string; created_at: string }[] | null;
  preferred_language: 'en' | 'fr' | 'lb' | 'de' | 'nl' | 'es' | null;
}

export interface ProfileUpdateFields {
  first_name?: string | null;
  last_name?: string | null;
  age?: number | null;
  phone?: string | null;
  date_of_birth?: string | null;
  profile_picture_path?: string | null;
  bio?: string | null;
  updated_at?: string;
  disclosures?: { type: string; details: string; created_at: string }[] | null;
  preferred_language?: 'en' | 'fr' | 'lb' | 'de' | 'nl' | 'es' | null;
}

export interface CreateClassProductInput {
  class_id: string;
  product_id: string;
  studio_id: string;
}

export interface Payment {
  id: string;
  created_at: string;
  updated_at: string;
  profile_id: string;
  studio_id: string;
  product_id: string;
  amount: number;
  payment_status: string;
  stripe_session_id?: string | null; // Checkout Session IDs (cs_xxx)
  stripe_payment_intent_id?: string | null; // Payment Intent IDs (pi_xxx)
  stripe_customer_id?: string | null;
  stripe_payment_method_id?: string | null;
  notes: string | null;
  currency: string;
  payment_method?: string;
  profile?: {
    first_name: string;
    last_name: string;
    email: string;
  };
  product?: {
    name: string;
    display_name: string;
    price_cents?: number;
    credits?: number;
    is_active?: boolean;
    is_archived?: boolean;
  };
  class_instance?: {
    start_time: string;
    class?: {
      name: string;
    };
  };
}

export interface PaymentTransaction {
  id: string;
  payment_id: string;
  payment_method: 'stripe' | 'paypal' | 'square' | 'manual' | string;
  studio_id: string;
  original_amount: number; // Amount in smallest currency units (cents for USD/EUR, etc.)
  discount_amount: number; // Amount in smallest currency units (cents for USD/EUR, etc.)
  final_amount: number; // Amount in smallest currency units (cents for USD/EUR, etc.)
  net_amount: number; // Amount in smallest currency units (cents for USD/EUR, etc.)
  fees: {
    application_fee?: number; // Platform application fee in smallest currency units (cents)
    platform_fee?: number; // Stripe's fee on platform application fee in smallest currency units (cents)
    platform_net?: number; // What platform actually receives in smallest currency units (cents)
    stripe_processing_fee?: number; // Stripe's processing fee to connected account in smallest currency units (cents)
    connected_account_net?: number; // What connected account receives in smallest currency units (cents)
    total_fees?: number; // Total fees deducted from customer payment in smallest currency units (cents)
    breakdown?: Array<{
      type: string;
      amount: number; // Amount in smallest currency units (cents)
      description?: string;
      application_fee_id?: string; // For tracking specific application fees
      balance_transaction_id?: string; // For tracking specific balance transactions
    }>;
  };
  processor_transaction_id?: string;
  processor_metadata?: Record<string, any>;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentWithTransaction extends Payment {
  payment_transactions?: PaymentTransaction[];
}

export interface UserCredit { // it is called profile_credit in the db
  id: string;
  created_at: string;
  updated_at: string | null;
  profile_id: string;
  remaining_credits: number;
  expiry_date: string | null;
  studio_id: string;
  product_id: string;
  payment_id: string;
  product: {
    id: string;
    display_name: string;
    credits: number;
    validity_period: number;
  }
}

export interface ClassPass {
  id: string;
  created_at: string;
  profile_id: string;
  product_id: string;
  sessions_remaining: number;
  expiry_date: string;
  status: 'active' | 'expired' | 'cancelled';
}

export interface BookingWithClassInstance extends Booking {
  id: string;
  created_at: string;
  updated_at: string;
  class_instance_id: string;
  booking_status: 'confirmed' | 'cancelled' | 'user_cancelled' | 'admin_cancelled';
  booking_date: string;
  notes?: string;
  cancellation_note?: string | null;
  cancelled_by?: string | null;
  cancelled_at?: string | null;
  was_eligible_for_refund?: boolean | null;
  user_cancellation_note?: string | null;
  profile_id: string;
  studio_id: string;
  studio: Studio;
  classInstance: ClassInstance & {
    class: Class;
    teacher: Teacher;
    location: Location;
  };
  profile_credit: {
    id: string;
    remaining_credits: number;
    expiry_date: string | null;
    product?: {
      id: string;
      name: string;
      display_name?: string | null;
      credits: number;
      validity_period?: number;
    }
  } | null;
  profile: Profile;
}

export interface BookingView {
  id: string;
  created_at: string;
  booking_status: 'confirmed' | 'cancelled' | 'completed' | 'user_cancelled' | 'admin_cancelled';
  cancellation_reason?: string | null;
  cancelled_by?: string | null;
  cancelled_at?: string | null;
  was_eligible_for_refund?: boolean | null;
  user_cancellation_note?: string | null;
  cancellation_note?: string | null;
  notes?: string | null;
  class_instance_id: string;
  profile_id: string;
  profile_credit_id?: string | null;
  subscription_id?: string | null;
  class_instance: {
    class: {
      name: string;
      image_url?: string;
      description?: string;
      sub_heading?: string;
    };
    location: {
      name: string;
      description?: string;
      timezone: string;
    };
    teacher: {
      name: string;
      bio?: string;
      image_url?: string;
    };
    start_time: string;
    end_time: string;
  };
}

export interface Studio {
  id: string;
  created_at: string;
  name: string | null;
  address: string | null;
  image_url: string | null;
  logo_url: string | null;
  instagram_handle: string | null; 
  youtube_handle: string | null;
  substack_handle: string | null;
  website_url: string | null;
  contact_email: string | null;
  slug: string;
  stripe_account_id?: string;
  // DEPRECATED: stripe_account_status - use studio_stripe_accounts.charges_enabled && payouts_enabled instead
  is_test_account?: boolean;
  listing_visibility?: 'public' | 'invite_only' | 'hidden' | 'test';
  listed_at?: string | null;
  timezone?: string | null;
}

// Add this interface near other payment-related interfaces
export interface StripeSessionMetadata {
  product_id: string;
  class_instance_id: string;
  user_name: string;
  user_email: string;
  studio_id: string;
  stripe_product_id?: string;
  amount?: string;
  currency?: string;
  payment_status?: string;
  profile_id?: string;
  size?: string;
  product_type: 'physical' | 'digital' | 'subscription' | 'gift_card';
  stripe_account_id?: string;
  client_platform?: string; // Platform tracking: 'web', 'ios', 'android'
  // Wallet/gift card redemption metadata
  wallet_amount?: string; // Amount in cents to redeem from wallet
  wallet_gift_card_ids?: string; // Comma-separated list of gift card IDs to redeem from
}

export interface UserRoleResponse {
  id: string;
  profile_id: string;
  role: 'customer' | 'teacher' | 'manager' | 'owner' ;
  studio_id: string;
  created_at: string;
  profile: {
    email: string;
    first_name: string | null;
    last_name: string | null;
  };
  studio: {
    name: string | null;
    address: string | null;
    image_url: string | null;
  };
}

// Add this new type definition
export type UserRole = {
  id: string;
  profile_id: string;
  role: 'teacher' | 'manager' | 'owner' | 'customer' | 'admin';
  studio_id: string;
  created_at: string;
  studio?: {
    id: string;
    name: string | null;
    slug: string;
    address: string | null;
    image_url: string | null;
  };
  profile?: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    profile_picture_path: string | null;
  };
};

export interface CreditInfo {
  id: string;
  remaining_credits: number;
  updated_at: string;
  created_at: string;
  expiry_date: string | null;
  payment_id?: string;
  profile_id: string;
  studio_id: string;
  product: {
    id: string;
    name: string;
    display_name: string;
    description: string | null;
    category: string | null;
    validity_period: number | null;
    price?: number;
    credits?: number;
    product_type?: 'physical' | 'digital';
  }
}


export interface StudioResponse {
  id: string;
  name: string | null;
  slug: string;
  image_url: string | null;
  address: string | null;
  created_at: string;
}

// Add this with the other interfaces
export interface ConflictingInstance {
  start_time: string;
  end_time: string;
  class: {
    name: string;
  };
  location: {
    name: string;
  };
}

export interface ProductFormData {
  name: string;
  display_name: string;
  price: number;
  price_cents?: number;
  description?: string;
  category?: string;
  credits: number;
  validity_period?: number;
  is_active: boolean;
  currency: string;
  studio_id?: string;
  stripe_product_id?: string;
  stripe_price_id?: string;
  payment_url?: string;
  product_type: 'physical' | 'digital' | 'subscription' | 'gift_card';
  // Subscription-specific fields
  subscription_interval?: 'day' | 'week' | 'month' | 'year';
  subscription_interval_count?: number;
  usage_limit?: number; // undefined = unlimited
  auto_renewal?: boolean;
  activation_type?: 'immediate' | 'first_use' | 'scheduled';
  eligibility_type?: 'everyone' | 'once_per_customer' | 'first_subscription_only';
  fixed_start_date?: string;
  fixed_end_date?: string;
}

export interface ActiveProduct {
  id: string;
  created_at: string;
  name: string;
  price: number;
  description: string;
  display_name: string;
  currency: string;
  credits: number | null;
  category: string;
  validity_period: number | null;
  is_active: boolean;
  stripe_product_id?: string;
  stripe_price_id?: string;
  payment_url?: string;
  studio_id: string;
  is_archived: boolean;
  archived_at: string | null;
  purchaseDate: string;
  purchaseDateFormatted: string;
  paymentSource: {
    type: 'user' | 'admin';
    details: string;
  };
}

export interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  valid_from: string | null;
  valid_until: string | null;
  redemption_limit: number | null;
  times_redeemed: number;
  profile_id: string | null;
  is_active: boolean;
  studio_id: string;
  created_at: string;
  updated_at: string | null;
}

export interface TemporaryProfile {
  first_name: string;
  last_name: string;
  email: string;
  comment: string;
}

export interface Inventory {
  id: string;
  product_id: string;
  studio_id: string;
  variant: Record<string, string>;
  quantity_in_stock: number;
  created_at: string;
  updated_at: string;
  product?: Product;
}

export interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface PhysicalProductWithImages extends Product {
  product_images?: ProductImage[];
  product_type: 'physical';
  category: string;
  currency: string;
}

export interface CartItem {
  id: string;
  productId: string;
  priceId: string;
  name: string;
  inventoryId: string;
  variant: string;
  quantity: number;
  price: number;
  imageUrl?: string;
  currency: string;
}

export interface Cart {
  items: CartItem[];
  subtotal: number;  // Subtotal in smallest currency unit (cents)
  currency: string;  // Currency code from payment context
}

export interface Order {
  id: string;
  profile_id: string;
  payment_id: string;
  product_id: string;
  studio_id: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  shipping_address: {
    name: string;
    address: {
      line1: string;
      line2?: string;
      city: string;
      state: string;
      postal_code: string;
      country: string;
    };
  };
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  created_at: string;
  product_id: string;
  order_id: string;
  quantity: number;
  price: number;
  inventory_id: string;
  product: {
    name: string;
    description: string;
  };
  inventory: {
    variant: Record<string, string>;
  };
}

export interface OrderWithDetails {
  id: string;
  created_at: string;
  updated_at: string;
  profile_id: string;
  payment_id: string;
  studio_id: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  shipping_address: {
    name: string;
    address: {
      line1: string;
      line2?: string;
      city: string;
      state: string;
      postal_code: string;
      country: string;
    };
  };
  
  profile: {
    email: string;
    first_name: string | null;
    last_name: string | null;
  };
  
  payment: {
    currency: string;
  };
  
  order_items: Array<OrderItem>;
}

export interface Feedback {
  id: string;
  studio_id: string;
  class_instance_id: string;
  teacher_id: string;
  profile_id: string;
  rating: number;
  feedback_text: string | null;
  feedback_type: 'public' | 'private';
  is_approved: boolean;
  approved_at: string | null;
  created_at: string;
}

export interface FeedbackWithDetails extends Feedback {
  class_instance: {
    class: {
      name: string;
      sub_heading: string | null;
    };
    start_time: string;
  };
  teacher: {
    name: string;
    image_url: string | null;
  };
  profile: {
    first_name: string | null;
    last_name: string | null;
    email: string;
    image_url: string | null;
  };
}

// Add this interface for the request body
export interface FeedbackSubmission {
  class_instance_id: string;
  feedback_text?: string;
  feedback_type: 'public' | 'private';
  rating: number;
}

export interface FeedbackStatus {
  hasPrivate: boolean;
  hasPublic: boolean;
}

export interface ReferralLink {
  id: string;
  profile_id: string;
  studio_id: string;
  referral_code: string;
  created_at: string;
  expires_at: string | null;
  max_uses: number;
  uses: number;
}

export interface ReferralData {
  id: string;
  referral_code: string;
  studio_id: string;
  profile_id: string;
  created_at: string;
  studio: {
    id: string;
    name: string | null;
    image_url: string | null;
    slug: string;
  };
  referrer: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    profile_picture_path: string | null;
  };
}

export interface Referral {
  id: string;
  referrer_profile_id: string;
  referred_profile_id: string;
  studio_id: string;
  referral_code: string;
  reward_status: 'pending' | 'completed' | 'revoked';
  created_at: string;
}

export interface TeacherStats {
  totalClasses: number;
  totalBookings: number;
  bookingsByStatus: {
    confirmed: number;
    cancelled: number;
    pending: number;
    user_cancelled: number;
    admin_cancelled: number;
  };
  attendanceByStatus: {
    attended: number;
    no_show: number;
    pending: number;
  };
  monthlyStats: Array<{
    month: string;
    totalClasses: number;
    totalBookings: number;
    bookingsByStatus: {
      confirmed: number;
      cancelled: number;
      pending: number;
      user_cancelled: number;
      admin_cancelled: number;
    };
    attendanceByStatus: {
      attended: number;
      no_show: number;
      pending: number;
    };
  }>;
  classInstances: Array<{
    id: string;
    classId?: string;
    startTime: string;
    className?: string;
    totalBookings: number;
    bookingsByStatus: {
      confirmed: number;
      cancelled: number;
      pending: number;
      user_cancelled: number;
      admin_cancelled: number;
    };
    attendanceByStatus: {
      attended: number;
      no_show: number;
      pending: number;
    };
  }>;
  archivedClassesCount: number;
}

export interface Contract {
  id: string;
  created_at: string;
  studio_id: string;
  contract_type: 'membership' | 'teacher_contract' | 'staff_contract';
  title: string;
  description?: string;
  document_url?: string;
  is_active: boolean;
  start_date?: string;
  end_date?: string;
  version: number;
  updated_at: string;
}

export interface ContractAssignment {
  id: string;
  contract_id: string;
  contract_version_id: string;
  assignee_id: string;
  assignment_date: string;
  status: 'pending' | 'signed' | 'rejected' | 'active' | 'terminated';
  signature_url?: string;
  signed_at?: string;
  is_current: boolean;
}

export interface CreateContractInput {
  studio_id: string;
  contract_type: Contract['contract_type'];
  title: string;
  description?: string;
  document_url?: string;
  start_date?: string;
  end_date?: string;
}

export interface UpdateContractInput {
  title?: string;
  description?: string;
  document_url?: string;
  is_active?: boolean;
  contract_type?: Contract['contract_type'];
  start_date?: string | null;
  end_date?: string | null;
  version?: number;
  updated_at?: string;
  studio_id?: string;
}

export interface CreateAssignmentInput {
  contract_id: string;
  contract_version_id: string;
  assignee_id: string;
  status?: ContractAssignment['status'];
}

export interface UpdateAssignmentInput {
  status?: ContractAssignment['status'];
  signature_url?: string;
  signed_at?: string;
  is_current?: boolean;
}

// Update the ContractVersion interface to match the table structure
export interface ContractVersion {
  id: string;
  contract_id: string;
  version_number: number;  // Changed from version
  version_date: string;    // Changed from updated_at
  document_url: string;
  changelog?: string;      // Changed from change_notes
  is_current: boolean;     // Added new field
}

// Stripe Customer Management
export interface StripePaymentMethod {
  id: string;
  stripe_payment_method_id: string | null; // Legacy field - use connected_payment_method_id instead
  platform_payment_method_id: string | null; // Platform account PM (iOS/Android destination charges)
  connected_payment_method_id: string | null; // Cloned PM on connected studio account
  connected_stripe_account_id: string | null; // Studio account where PM was cloned
  stripe_customer_id: string; // Legacy - use connected_customer_id instead
  platform_customer_id: string | null; // Customer ID on platform account (iOS/Android)
  connected_customer_id: string | null; // Customer ID on connected studio account
  profile_id: string;
  studio_id: string;
  type: string;
  card_brand: string | null;
  card_last4: string | null;
  card_exp_month: number | null;
  card_exp_year: number | null;
  card_funding: string | null;
  card_fingerprint: string | null; // Stripe's unique identifier for physical card
  is_default: boolean;
  source: 'web' | 'ios' | 'android'; // Track origin platform
  created_at: string;
  updated_at: string;
}

export interface ContractAssignmentWithDetails extends ContractAssignment {
  assignee: Profile;
  contract: Contract;
  contract_version: ContractVersion;
}


export interface TeacherPayout {
  classDetails: Array<{
    tags: string[];
    configSource?: 'class' | 'tag' | 'default';
    configTag?: string;
  }>;
}

// Add this with the other interfaces
export interface StudioOwner {
  profile: {
    email: string;
    first_name: string | null;
    last_name: string | null;
  };
}

export interface StripeProduct {
  id: string
  name: string
  description: string | null
  active: boolean
  default_price: string | null
  images: string[]
  metadata: Record<string, string>
  created: number
  updated: number
  price: number | null
  price_id: string | null
  prices?: {
    id: string
    unit_amount: number | null
    currency: string
    recurring: {
      interval: 'day' | 'week' | 'month' | 'year'
      interval_count: number
    } | null
    tax_behavior?: 'inclusive' | 'exclusive'
  }[]
}

// Add this interface for Studio Waivers
export interface StudioWaiver {
  id: string; // UUID
  studio_id: string; // UUID, FK to studios.id
  name: string;
  slug: string;
  type: 'built_in' | 'custom';
  description?: string | null;
  content: string; // The actual waiver content (HTML or Markdown)
  is_active: boolean;
  version: number;
  created_at: string; // ISO 8601 date string
  updated_at: string; // ISO 8601 date string
}

// Add this interface for Resend email events
export interface EmailEvent {
  id: string; // UUID, primary key
  created_at: string; // ISO timestamp when event was received
  email_id: string; // Resend email ID
  to: string; // Recipient email address
  from?: string | null; // Sender email address (mainly for 'sent' events)
  subject?: string | null; // Email subject (mainly for 'sent' events)
  event_type: string; // Event type (sent, delivered, opened, bounced, etc.)
  event_timestamp: string; // ISO timestamp of the event
  broadcast_id?: string | null; // For broadcast emails
  tags?: Record<string, string> | null; // Email tags
  click_data?: Record<string, any> | null; // Click tracking data for email.clicked events
  data: Record<string, any>; // Raw event payload from Resend
}

export interface SocialMediaDesign {
  id: string;
  studio_id: string;
  title: string;
  description: string | null;
  platform: string; // instagram, facebook, tiktok, etc.
  content_type: string; // story, post, reel, etc.
  template_type: string; // class-single-day, teacher-info, class-weekly, etc.
  image_url: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  design_data: Record<string, any> | null; // JSON design configuration for re-editing
  created_by: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

// Program View Types
export interface ProgramSchedulePattern {
  recurrence_rule: string | null;
  start_time: string; // Time of day (e.g., "17:00")
  end_time: string;
  duration: number; // in minutes
  days_of_week?: string[]; // For weekly: ["Monday", "Thursday"]
  formatted_schedule: string; // "Every Monday at 5:00 PM"
}

export interface ProgramData {
  id: string;
  name: string;
  sub_heading: string | null;
  description: string | null;
  image_url: string | null;
  teacher: Teacher;
  location: Location;
  schedule_pattern: ProgramSchedulePattern;
  price_display_text: string | null;
  category: string | null;
  tags: string[];
  studio_id: string;
  created_at: string;
  // Optional fields for filtering/display
  next_class_time?: string; // Next upcoming class instance
  next_class_instance_id?: string; // ID of the next upcoming class instance
  total_instances?: number; // Total number of scheduled instances
  booking_count?: number; // Total confirmed bookings for this program (for popularity sorting)
}

export interface ProgramFilter {
  teacherId?: string;
  teacherIds?: string[]; // Support multiple teachers
  locationId?: string;
  locationIds?: string[]; // Support multiple locations
  category?: string;
  categories?: string[]; // Support multiple categories
  timeOfDay?: 'morning' | 'afternoon' | 'evening';
  dayOfWeek?: string;
  search?: string;
  sortBy?: 'upcoming' | 'popular' | 'alphabetical';
}

// Subscription Types
export interface Subscription {
  id: string;
  profile_id: string;
  purchased_by_profile_id: string;
  product_id: string;
  studio_id: string;
  stripe_subscription_id?: string;
  status: 'pending' | 'incomplete' | 'trialing' | 'active' | 'past_due' | 'paused' | 'cancelled';
  
  // Immutable snapshots
  snapshot_price: number;
  snapshot_currency: string;
  snapshot_interval: 'day' | 'week' | 'month' | 'year';
  snapshot_interval_count: number;
  snapshot_usage_limit?: number;
  snapshot_eligibility_type: 'everyone' | 'once_per_customer' | 'first_subscription_only';
  snapshot_product_display_name: string;
  snapshot_activation_type: 'immediate' | 'first_use' | 'scheduled';
  
  // Dynamic fields
  current_period_start?: string;
  current_period_end?: string;
  billing_cycle_anchor?: string;
  next_renewal_date?: string;
  trial_start?: string;
  trial_end?: string;
  cancel_at_period_end: boolean;
  cancelled_at?: string;
  cancellation_reason?: string;
  quantity: number;
  default_payment_method_id?: string;
  paused_until?: string;
  activation_date?: string;
  first_use_date?: string;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionPeriod {
  id: string;
  subscription_id: string;
  studio_id: string;
  period_start: string;
  period_end: string;
  usage_count: number;
  usage_limit?: number;
  billing_amount: number;
  stripe_invoice_id?: string;
  status: 'active' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

// API Response Types
export interface SubscriptionSummary {
  activeSubscriptions: {
    id: string;
    status: string;
    product_name: string;
    price: number;
    currency: string;
    interval: string;
    current_usage: number;
    usage_limit?: number;
    next_renewal_date?: string;
    cancel_at_period_end: boolean;
    period_start?: string;
    period_end?: string;
    cancelled_at?: string;
    cancellation_reason?: string;
    created_at: string;
  }[];
  totalActiveCount: number;
  totalLifetimeValue: number;
  hasInactiveSubscriptions: boolean;
  inactiveCount: number;
}

export interface LifetimeValue {
  total: number;
  currency: string;
  breakdown: {
    bundles: number;      // digital/prepaid products  
    memberships: number;  // subscription products
    physical: number;     // physical products
  };
}

export interface ClassStats {
  totalBookings: number;    // Total confirmed bookings
  attended: number;         // Classes marked as attended
  noShows: number;         // Classes marked as no-show
  pending: number;         // Classes with pending attendance
  attendanceRate: number;  // Percentage of attended classes (excluding pending)
}

// Gift Card Types
export type GiftCardStatus = 'active' | 'redeemed' | 'expired' | 'cancelled';
export type GiftCardTransactionType = 'purchase' | 'redemption' | 'refund';
export type GiftCardTheme = 'classic' | 'snowfall' | 'sparkle' | 'hearts' | 'elegant';
export type EffectIntensity = 'off' | 'subtle' | 'normal';

export interface GiftCardDesignConfig {
  theme?: GiftCardTheme;
  effectIntensity?: EffectIntensity;
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string;
  logoUrl?: string;
}

export interface GiftCardTemplate {
  id: string;
  studio_id: string;
  product_id: string;
  stripe_product_id: string;
  name: string;
  validity_days: number;
  currency: string;
  design_config: GiftCardDesignConfig;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by?: string;
}

export interface GiftCardPriceTier {
  id: string;
  template_id: string;
  stripe_price_id: string;
  amount_cents: number;
  currency: string;
  display_order: number;
  created_at: string;
}

export interface GiftCard {
  id: string;
  studio_id: string;
  template_id: string;
  price_tier_id: string;
  product_id: string;
  purchaser_id: string;
  payment_id: string;
  stripe_payment_intent_id?: string;
  recipient_email?: string;
  recipient_name?: string;
  code: string;
  initial_amount_cents: number;
  remaining_balance_cents: number;
  currency: string;
  message?: string;
  sender_name?: string;
  recipient_email_sent_at?: string;
  downloaded_at?: string;
  status: GiftCardStatus;
  created_at: string;
  updated_at: string;
  expires_at: string;
  last_redeemed_at?: string;
}

export interface GiftCardTransaction {
  id: string;
  gift_card_id: string;
  studio_id: string;
  payment_id?: string;
  profile_id?: string;
  amount_cents: number;
  transaction_type: GiftCardTransactionType;
  balance_after_cents: number;
  booking_id?: string;
  created_at: string;
  created_by?: string;
}

// Extended types with relations
export interface GiftCardTemplateWithTiers extends GiftCardTemplate {
  price_tiers: GiftCardPriceTier[];
  product?: Product;
}

export interface GiftCardWithDetails extends GiftCard {
  template: GiftCardTemplate;
  price_tier: GiftCardPriceTier;
  purchaser: Profile;
  payment?: Payment;
  transactions?: GiftCardTransaction[];
}

// Form input types
export interface CreateGiftCardTemplateInput {
  studio_id: string;
  name: string;
  validity_days: number;
  price_tiers: {
    amount_cents: number;
    display_order: number;
  }[];
  design_config: GiftCardDesignConfig;
  created_by: string;
}

export interface UpdateGiftCardTemplateInput {
  name?: string;
  validity_days?: number;
  design_config?: Partial<GiftCardDesignConfig>;
  is_active?: boolean;
  updated_by: string;
}

export interface CreateGiftCardPurchaseInput {
  template_id: string;
  price_tier_id: string;
  recipient_email?: string;
  recipient_name?: string;
  message?: string;
  sender_name: string;
  client_platform?: string;
}

export interface GiftCardRedemptionInput {
  code: string;
  amount_cents: number;
  payment_id?: string;
  booking_id?: string;
}
