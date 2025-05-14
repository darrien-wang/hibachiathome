-- 创建押金表
CREATE TABLE IF NOT EXISTS deposits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id),
  amount DECIMAL(10, 2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  transaction_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_deposits_booking_id ON deposits(booking_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);

-- 修改预订表，添加押金字段
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deposit DECIMAL(10, 2);
