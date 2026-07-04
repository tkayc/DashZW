-- Run this FIRST while connected to the default "postgres" database in pgAdmin.
-- Then connect to "dashzw" and run 001_dashzw_full_schema.sql

CREATE DATABASE dashzw
  WITH
  ENCODING = 'UTF8'
  TEMPLATE = template0;
