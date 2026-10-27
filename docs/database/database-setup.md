
#  Database Setup Guide

## 1. Overview

The HOPE ERP project uses Supabase as its database platform. Supabase provides a PostgreSQL database for storing and managing application data.

## 2. Prerequisites

Before starting, make sure you have:

- Git
- Visual Studio Code
- Node.js and npm
- A Supabase account
- Access to the team's Supabase project

## 3. Initial Setup

1. Clone the team's GitHub repository.
2. Open the repository in VS Code.
3. Open the VS Code terminal.
4. Log in to Supabase:

   npx.cmd supabase login

5. Link the repository to the team's Supabase project:

   npx.cmd supabase link

6. Select the correct project and complete authentication.

## 4. Database Migrations

Database migrations are SQL files used to manage changes to the database structure.

Migration files are stored in:

supabase/migrations/

Create a new migration using:

npx.cmd supabase migration new migration_name

Before applying migrations, review the SQL files and coordinate with the Scrum Master.

Preview pending migrations using:

npx.cmd supabase db push --linked --dry-run

After approval, apply migrations using:

npx.cmd supabase db push --linked

Do not apply unreviewed migrations to the shared database.

## 5. Database Verification

1. Open the Supabase Dashboard.
2. Select the HOPE ERP project.
3. Open SQL Editor.
4. Run the following query:

SELECT 1 AS connection_test;

5. A result of 1 confirms that the SQL Editor can execute a query.

## 6. Security Guidelines

- Never commit database passwords or access tokens.
- Do not upload .env files containing secrets.
- Use individual Supabase accounts for team access.
- Enable Row Level Security for application tables.
- Review database changes before merging Pull Requests.

## 7. Known Setup Issue

The Supabase CLI has encountered a database connection timeout during migration checks.

The SQL Editor works, but CLI migration connectivity still requires verification.

Database migrations must not be applied until the connection issue is resolved.
