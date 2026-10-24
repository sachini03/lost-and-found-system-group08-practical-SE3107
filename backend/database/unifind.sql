-- =========================================================
-- UniFind: Lost and Found System
-- Database: PostgreSQL
-- =========================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- 1. ENUM TYPES
-- =========================================================

CREATE TYPE user_role AS ENUM ('USER', 'MODERATOR', 'ADMIN');
CREATE TYPE item_type AS ENUM ('LOST', 'FOUND');
CREATE TYPE item_status AS ENUM (
    'ACTIVE', 'UNDER_CLAIM', 'RETURNED', 'CLOSED', 'REMOVED'
);
CREATE TYPE claim_status AS ENUM (
    'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'
);
CREATE TYPE match_status AS ENUM (
    'PENDING', 'ACCEPTED', 'DISMISSED', 'RESOLVED'
);
CREATE TYPE conversation_status AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE notification_type AS ENUM (
    'POTENTIAL_MATCH', 'NEW_MESSAGE', 'CLAIM_UPDATE',
    'ITEM_UPDATE', 'SYSTEM'
);
CREATE TYPE flag_status AS ENUM (
    'PENDING', 'REVIEWING', 'RESOLVED', 'DISMISSED'
);

-- =========================================================
-- 2. USERS
-- =========================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'USER',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- 3. SRI LANKAN DISTRICTS (ALL 25)
-- =========================================================

CREATE TABLE districts (
    id SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE
);

INSERT INTO districts (name) VALUES
('Ampara'),
('Anuradhapura'),
('Badulla'),
('Batticaloa'),
('Colombo'),
('Galle'),
('Gampaha'),
('Hambantota'),
('Jaffna'),
('Kalutara'),
('Kandy'),
('Kegalle'),
('Kilinochchi'),
('Kurunegala'),
('Mannar'),
('Matale'),
('Matara'),
('Monaragala'),
('Mullaitivu'),
('Nuwara Eliya'),
('Polonnaruwa'),
('Puttalam'),
('Ratnapura'),
('Trincomalee'),
('Vavuniya');

-- =========================================================
-- 4. INSTITUTIONS (OPTIONAL)
-- =========================================================

CREATE TABLE institutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    district_id SMALLINT REFERENCES districts(id),
    address TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (name, district_id)
);

-- =========================================================
-- 5. CATEGORIES AND SUBCATEGORIES
-- =========================================================

CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE subcategories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES categories(id)
        ON DELETE RESTRICT,
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (category_id, name),
    UNIQUE (id, category_id)
);

INSERT INTO categories (name, description) VALUES
('Electronics', 'Phones, laptops and electronic devices'),
('Documents', 'Identity cards, licences and certificates'),
('Bags', 'Backpacks, handbags and luggage'),
('Keys', 'Keys and keychains'),
('Clothing', 'Clothes, uniforms and accessories'),
('Jewellery', 'Rings, watches and jewellery'),
('Books', 'Books, notebooks and stationery'),
('Wallets', 'Wallets and purses'),
('Sports Equipment', 'Sports and fitness equipment'),
('Other', 'Items that do not fit another category');

-- =========================================================
-- 6. ITEMS: LOST AND FOUND REPORTS
-- =========================================================

CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES users(id)
        ON DELETE RESTRICT,
    item_type item_type NOT NULL,
    category_id UUID NOT NULL,
    subcategory_id UUID,
    title VARCHAR(180) NOT NULL,
    description TEXT NOT NULL,
    brand VARCHAR(120),
    model VARCHAR(120),
    color VARCHAR(80),
    district_id SMALLINT NOT NULL REFERENCES districts(id),
    institution_id UUID REFERENCES institutions(id)
        ON DELETE SET NULL,
    location_description VARCHAR(255),
    event_date DATE NOT NULL,
    status item_status NOT NULL DEFAULT 'ACTIVE',
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    returned_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    FOREIGN KEY (subcategory_id, category_id)
        REFERENCES subcategories(id, category_id)
        ON DELETE RESTRICT,

    CHECK (char_length(title) >= 3),
    CHECK (char_length(description) >= 5),
    CHECK (event_date <= CURRENT_DATE),
    CHECK (
        (status = 'RETURNED' AND returned_at IS NOT NULL)
        OR status <> 'RETURNED'
    )
);

CREATE INDEX idx_items_type_status
    ON items(item_type, status);

CREATE INDEX idx_items_district
    ON items(district_id);

CREATE INDEX idx_items_category
    ON items(category_id);

CREATE INDEX idx_items_event_date
    ON items(event_date DESC);

CREATE INDEX idx_items_reporter
    ON items(reporter_id);

CREATE INDEX idx_items_public_active
    ON items(is_public, created_at DESC)
    WHERE status = 'ACTIVE';

-- =========================================================
-- 7. ITEM IMAGES
-- Store file URLs/object keys, not image binary data.
-- Keep private evidence separate from public photos.
-- =========================================================

CREATE TABLE item_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES items(id)
        ON DELETE CASCADE,
    storage_key TEXT NOT NULL UNIQUE,
    is_private_evidence BOOLEAN NOT NULL DEFAULT FALSE,
    caption VARCHAR(255),
    sort_order SMALLINT NOT NULL DEFAULT 0,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (sort_order >= 0)
);

CREATE INDEX idx_item_images_item
    ON item_images(item_id);

-- =========================================================
-- 8. POTENTIAL MATCHES
-- One row per unique lost/found pair.
-- =========================================================

CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lost_item_id UUID NOT NULL REFERENCES items(id)
        ON DELETE RESTRICT,
    found_item_id UUID NOT NULL REFERENCES items(id)
        ON DELETE RESTRICT,
    score NUMERIC(5,2) NOT NULL DEFAULT 0,
    status match_status NOT NULL DEFAULT 'PENDING',
    match_reasons JSONB NOT NULL DEFAULT '[]'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (lost_item_id, found_item_id),
    CHECK (lost_item_id <> found_item_id),
    CHECK (score >= 0 AND score <= 100),
    CHECK (jsonb_typeof(match_reasons) = 'array')
);

CREATE INDEX idx_matches_lost
    ON matches(lost_item_id, status);

CREATE INDEX idx_matches_found
    ON matches(found_item_id, status);

-- =========================================================
-- 9. OWNERSHIP CLAIMS
-- Verification answers should not be public.
-- =========================================================

CREATE TABLE claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES items(id)
    ON DELETE RESTRICT,
    claimant_id UUID NOT NULL REFERENCES users(id)
        ON DELETE RESTRICT,
    status claim_status NOT NULL DEFAULT 'PENDING',
    claim_message TEXT NOT NULL,
    verification_notes TEXT,
    reviewed_by UUID REFERENCES users(id)
        ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_claims_item_status
    ON claims(item_id, status);

CREATE INDEX idx_claims_claimant
    ON claims(claimant_id, created_at DESC);

-- =========================================================
-- 10. CONVERSATIONS
-- Messages are mediated by the platform.
-- =========================================================

CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID REFERENCES items(id)
        ON DELETE RESTRICT,
    participant_one_id UUID NOT NULL REFERENCES users(id)
        ON DELETE RESTRICT,
    participant_two_id UUID NOT NULL REFERENCES users(id)
        ON DELETE RESTRICT,
    status conversation_status NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (participant_one_id <> participant_two_id)
);

CREATE INDEX idx_conversations_participant_one
    ON conversations(participant_one_id, updated_at DESC);

CREATE INDEX idx_conversations_participant_two
    ON conversations(participant_two_id, updated_at DESC);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id)
        ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id)
        ON DELETE RESTRICT,
    body TEXT NOT NULL,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (char_length(body) BETWEEN 1 AND 5000)
);

CREATE INDEX idx_messages_conversation
    ON messages(conversation_id, created_at);

-- =========================================================
-- 11. NOTIFICATIONS
-- =========================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id)
        ON DELETE CASCADE,
    notification_type notification_type NOT NULL,
    title VARCHAR(180) NOT NULL,
    body TEXT NOT NULL,
    item_id UUID REFERENCES items(id)
        ON DELETE SET NULL,
    match_id UUID REFERENCES matches(id)
        ON DELETE SET NULL,
    message_id UUID REFERENCES messages(id)
        ON DELETE SET NULL,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_unread
    ON notifications(user_id, created_at DESC)
    WHERE read_at IS NULL;

-- Prevent duplicate match notifications for the same user/match.
CREATE UNIQUE INDEX uq_match_notification
    ON notifications(user_id, match_id)
    WHERE notification_type = 'POTENTIAL_MATCH'
      AND match_id IS NOT NULL;

-- =========================================================
-- 12. SAVED ITEMS
-- =========================================================

CREATE TABLE saved_items (
    user_id UUID NOT NULL REFERENCES users(id)
        ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id)
        ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, item_id)
);

-- =========================================================
-- 13. MODERATION FLAGS
-- =========================================================

CREATE TABLE item_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES items(id)
        ON DELETE CASCADE,
    reporter_id UUID NOT NULL REFERENCES users(id)
        ON DELETE RESTRICT,
    reason VARCHAR(100) NOT NULL,
    details TEXT,
    status flag_status NOT NULL DEFAULT 'PENDING',
    reviewed_by UUID REFERENCES users(id)
        ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_item_flags_status
    ON item_flags(status, created_at);

-- =========================================================
-- 14. AUDIT LOGS
-- Do not store passwords, tokens or private evidence here.
-- =========================================================

CREATE TABLE audit_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_id UUID REFERENCES users(id)
        ON DELETE SET NULL,
    action VARCHAR(120) NOT NULL,
    entity_type VARCHAR(80) NOT NULL,
    entity_id UUID,
    details JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (jsonb_typeof(details) = 'object')
);

CREATE INDEX idx_audit_logs_actor
    ON audit_logs(actor_id, created_at DESC);

CREATE INDEX idx_audit_logs_entity
    ON audit_logs(entity_type, entity_id);

COMMIT;
