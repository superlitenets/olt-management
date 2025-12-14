-- Initialize OLT Management Database
-- This script runs when the PostgreSQL container starts for the first time

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Grant permissions (if needed for specific users)
-- CREATE USER oltadmin WITH PASSWORD 'changeme';
-- GRANT ALL PRIVILEGES ON DATABASE oltmanagement TO oltadmin;

-- Create indexes for performance (Drizzle will create the tables)
-- These will be created after migrations run
