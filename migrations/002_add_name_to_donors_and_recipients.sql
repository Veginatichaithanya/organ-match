-- Migration: Add name column to donors and recipients tables

ALTER TABLE donors 
ADD COLUMN IF NOT EXISTS name VARCHAR(255);

ALTER TABLE recipients 
ADD COLUMN IF NOT EXISTS name VARCHAR(255);
