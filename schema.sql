-- Sales Call Management Database Schema
-- Run this in your PostgreSQL database: sales_call_db

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'agent',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Call records table
CREATE TABLE IF NOT EXISTS call_records (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    principal_phone VARCHAR(20) NOT NULL,
    alternative_phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    sale_type VARCHAR(200) NOT NULL,
    sale_id_1 VARCHAR(100),
    sale_id_2 VARCHAR(100),
    sale_completed BOOLEAN DEFAULT FALSE,
    callback_required BOOLEAN DEFAULT FALSE,
    callback_datetime TIMESTAMP,
    sale_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default users with plain text passwords for easy testing
INSERT INTO users (username, password_hash, role) VALUES 
('admin', 'admin123', 'admin'),
('agent1', 'pass123', 'agent'),
('agent2', 'pass456', 'agent')
ON CONFLICT (username) DO UPDATE SET
password_hash = EXCLUDED.password_hash,
role = EXCLUDED.role;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_call_records_user_id ON call_records(user_id);
CREATE INDEX IF NOT EXISTS idx_call_records_callback ON call_records(callback_datetime) WHERE callback_required = true;
CREATE INDEX IF NOT EXISTS idx_call_records_sale_date ON call_records(sale_date);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_call_records_updated_at ON call_records;
CREATE TRIGGER update_call_records_updated_at BEFORE UPDATE ON call_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
