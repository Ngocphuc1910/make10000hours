# Environment Configuration Files

This directory contains environment configuration files for the project.

## Files

- `.env`: Default environment variables for all environments
- `.env.local`: Local environment variables that override the defaults (not committed to git)
- `.env.production`: Production-specific environment variables
- `.env.example`: Example environment file with placeholder values for documentation
- `.env.development.local.backup`: Backup of development environment variables

## Usage

The environment files are structured according to the Create React App environment variables system:

1. `.env`: Default values for all environments
2. `.env.development` or `.env.production`: Environment-specific values
3. `.env.local`: Local overrides for default values (not tracked in Git)
4. `.env.development.local` or `.env.production.local`: Local overrides for environment-specific values

## Important Note

These files contain sensitive information like API keys. Make sure that:

1. Files with actual credentials are listed in `.gitignore`
2. Only example files without real credentials are committed to the repository
3. Follow the secure practices described in the project documentation

## Usage with Create React App

Create React App requires environment files to be in the root directory to be properly loaded. To accommodate this:

1. The main environment files are stored in this directory for organization
2. Copies of the files are maintained in the root directory for Create React App
3. When you update an environment file, run `npm run env:sync` to keep them in sync

This approach balances organization with compatibility while still making the environment files accessible to the build system.