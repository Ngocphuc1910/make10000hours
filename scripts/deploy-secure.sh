#!/bin/bash

# ===================================================================
# SECURE DEPLOYMENT SCRIPT
# ===================================================================
# This script deploys the Make10000Hours application with security checks
# It ensures all security measures are in place before deployment
# ===================================================================

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="$PROJECT_ROOT/deploy-$(date +%Y%m%d-%H%M%S).log"

# Default values
ENVIRONMENT="production"
SKIP_SECURITY_CHECK=false
SKIP_TESTS=false
DRY_RUN=false
FORCE_DEPLOY=false

# ===================================================================
# HELPER FUNCTIONS
# ===================================================================

log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        "INFO")
            echo -e "${BLUE}[INFO]${NC} $message" | tee -a "$LOG_FILE"
            ;;
        "WARN")
            echo -e "${YELLOW}[WARN]${NC} $message" | tee -a "$LOG_FILE"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} $message" | tee -a "$LOG_FILE"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[SUCCESS]${NC} $message" | tee -a "$LOG_FILE"
            ;;
        *)
            echo "[$timestamp] $message" | tee -a "$LOG_FILE"
            ;;
    esac
}

print_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Secure deployment script for Make10000Hours application

OPTIONS:
    -e, --environment ENV    Target environment (development|staging|production) [default: production]
    -s, --skip-security     Skip security checks (NOT RECOMMENDED)
    -t, --skip-tests        Skip test execution
    -d, --dry-run          Show what would be deployed without actually deploying
    -f, --force            Force deployment even if checks fail (DANGEROUS)
    -h, --help             Show this help message

EXAMPLES:
    $0                                    # Deploy to production with all checks
    $0 -e staging                         # Deploy to staging
    $0 -d                                # Dry run for production
    $0 -e development --skip-tests        # Deploy to development without tests

SECURITY NOTE:
    This script performs comprehensive security checks before deployment.
    Only use --skip-security in emergency situations and with proper approval.

EOF
}

check_prerequisites() {
    log "INFO" "Checking prerequisites..."
    
    # Check if running from correct directory
    if [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
        log "ERROR" "Must be run from project root directory"
        exit 1
    fi
    
    # Check for required tools
    local tools=("node" "npm" "git")
    for tool in "${tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log "ERROR" "Required tool '$tool' is not installed"
            exit 1
        fi
    done
    
    # Check Node.js version
    local node_version=$(node --version | cut -d'v' -f2)
    if ! npx semver "$node_version" -r ">=18.0.0" &> /dev/null; then
        log "ERROR" "Node.js version $node_version is not supported. Requires >=18.0.0"
        exit 1
    fi
    
    log "SUCCESS" "Prerequisites check passed"
}

check_git_status() {
    log "INFO" "Checking git status..."
    
    # Check for uncommitted changes
    if [[ -n $(git status --porcelain) ]]; then
        log "ERROR" "Uncommitted changes detected. Please commit or stash changes before deployment."
        git status --short
        exit 1
    fi
    
    # Check if on correct branch for environment
    local current_branch=$(git branch --show-current)
    case $ENVIRONMENT in
        "production")
            if [[ "$current_branch" != "main" && "$current_branch" != "master" ]]; then
                log "ERROR" "Production deployments must be from main/master branch. Current: $current_branch"
                exit 1
            fi
            ;;
        "staging")
            if [[ "$current_branch" != "staging" && "$current_branch" != "main" && "$current_branch" != "master" ]]; then
                log "WARN" "Staging deployment from branch: $current_branch"
            fi
            ;;
    esac
    
    log "SUCCESS" "Git status check passed"
}

run_security_check() {
    if [[ "$SKIP_SECURITY_CHECK" == true ]]; then
        log "WARN" "SECURITY CHECKS SKIPPED - This is dangerous in production!"
        return 0
    fi
    
    log "INFO" "Running comprehensive security checks..."
    
    # Check for secrets in code
    log "INFO" "Scanning for secrets in codebase..."
    if grep -r "sk-[a-zA-Z0-9]" src/ --exclude-dir=node_modules 2>/dev/null; then
        log "ERROR" "Potential API keys found in source code!"
        exit 1
    fi
    
    # Check environment file configuration
    log "INFO" "Validating environment configuration..."
    case $ENVIRONMENT in
        "production")
            if [[ ! -f "$PROJECT_ROOT/.env.production" ]]; then
                log "ERROR" ".env.production file not found"
                exit 1
            fi
            ;;
        "staging")
            if [[ ! -f "$PROJECT_ROOT/.env.staging" ]]; then
                log "ERROR" ".env.staging file not found"
                exit 1
            fi
            ;;
    esac
    
    # Run npm audit
    log "INFO" "Checking for security vulnerabilities..."
    if ! npm audit --audit-level high; then
        if [[ "$FORCE_DEPLOY" != true ]]; then
            log "ERROR" "Security vulnerabilities found. Fix them or use --force to override"
            exit 1
        else
            log "WARN" "Security vulnerabilities found but deployment forced"
        fi
    fi
    
    # Check for .env files in git
    log "INFO" "Checking for committed environment files..."
    if git ls-files | grep -E "\.env$|\.env\." | grep -v "\.env\.example$" | grep -v "\.env\.template$"; then
        log "ERROR" "Environment files found in git! This is a security risk."
        exit 1
    fi
    
    # Run custom security check script if it exists
    if [[ -f "$SCRIPT_DIR/security-check.sh" ]]; then
        log "INFO" "Running custom security checks..."
        bash "$SCRIPT_DIR/security-check.sh"
    fi
    
    log "SUCCESS" "Security checks passed"
}

run_tests() {
    if [[ "$SKIP_TESTS" == true ]]; then
        log "WARN" "Tests skipped"
        return 0
    fi
    
    log "INFO" "Running tests..."
    
    # Install dependencies
    log "INFO" "Installing dependencies..."
    npm ci
    
    # Run linting
    log "INFO" "Running linter..."
    npm run lint
    
    # Run type checking
    log "INFO" "Running type check..."
    if command -v tsc &> /dev/null; then
        npx tsc --noEmit
    fi
    
    # Run unit tests if they exist
    if npm run | grep -q "test"; then
        log "INFO" "Running unit tests..."
        npm test
    fi
    
    # Run build test
    log "INFO" "Testing build process..."
    npm run build
    
    log "SUCCESS" "All tests passed"
}

deploy_application() {
    log "INFO" "Starting deployment to $ENVIRONMENT..."
    
    if [[ "$DRY_RUN" == true ]]; then
        log "INFO" "DRY RUN - Would deploy the following:"
        log "INFO" "- Environment: $ENVIRONMENT"
        log "INFO" "- Git commit: $(git rev-parse HEAD)"
        log "INFO" "- Build would be created and deployed"
        return 0
    fi
    
    # Set environment
    export NODE_ENV="$ENVIRONMENT"
    
    # Build application
    log "INFO" "Building application for $ENVIRONMENT..."
    case $ENVIRONMENT in
        "production")
            npm run build
            ;;
        "staging")
            npm run build
            ;;
        "development")
            npm run build
            ;;
    esac
    
    # Deploy based on environment
    case $ENVIRONMENT in
        "production")
            log "INFO" "Deploying to production..."
            # Add your production deployment commands here
            # Examples:
            # firebase deploy --only hosting
            # npm run deploy:prod
            # docker build and deploy
            
            # For now, just copy build files (customize as needed)
            if [[ -d "build" ]]; then
                log "INFO" "Build artifacts created successfully"
            else
                log "ERROR" "Build artifacts not found"
                exit 1
            fi
            ;;
        "staging")
            log "INFO" "Deploying to staging..."
            # Add staging deployment commands
            ;;
        "development")
            log "INFO" "Deploying to development..."
            # Add development deployment commands
            ;;
    esac
    
    log "SUCCESS" "Deployment completed successfully"
}

run_post_deployment_checks() {
    log "INFO" "Running post-deployment checks..."
    
    # Health check (customize URL as needed)
    local health_url
    case $ENVIRONMENT in
        "production")
            health_url="https://make10000hours.com"
            ;;
        "staging")
            health_url="https://staging.make10000hours.com"
            ;;
        "development")
            health_url="http://localhost:3001"
            ;;
    esac
    
    if [[ "$DRY_RUN" != true ]]; then
        log "INFO" "Checking application health at $health_url..."
        
        # Wait a bit for deployment to propagate
        sleep 10
        
        # Basic health check
        if command -v curl &> /dev/null; then
            if curl -f -s "$health_url" > /dev/null; then
                log "SUCCESS" "Application is responding"
            else
                log "ERROR" "Application health check failed"
                exit 1
            fi
        else
            log "WARN" "curl not available, skipping health check"
        fi
    fi
    
    log "SUCCESS" "Post-deployment checks passed"
}

cleanup() {
    log "INFO" "Cleaning up temporary files..."
    # Add any cleanup logic here
}

# ===================================================================
# MAIN SCRIPT
# ===================================================================

main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -s|--skip-security)
                SKIP_SECURITY_CHECK=true
                shift
                ;;
            -t|--skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -f|--force)
                FORCE_DEPLOY=true
                shift
                ;;
            -h|--help)
                print_usage
                exit 0
                ;;
            *)
                log "ERROR" "Unknown option: $1"
                print_usage
                exit 1
                ;;
        esac
    done
    
    # Validate environment
    if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
        log "ERROR" "Invalid environment: $ENVIRONMENT"
        print_usage
        exit 1
    fi
    
    # Start deployment process
    log "INFO" "Starting secure deployment process..."
    log "INFO" "Environment: $ENVIRONMENT"
    log "INFO" "Log file: $LOG_FILE"
    
    # Set trap for cleanup
    trap cleanup EXIT
    
    # Run deployment steps
    check_prerequisites
    check_git_status
    run_security_check
    run_tests
    deploy_application
    run_post_deployment_checks
    
    # Final success message
    log "SUCCESS" "🎉 Deployment to $ENVIRONMENT completed successfully!"
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        log "INFO" "Production deployment checklist:"
        log "INFO" "□ Monitor application logs for errors"
        log "INFO" "□ Verify all features are working"
        log "INFO" "□ Check performance metrics"
        log "INFO" "□ Monitor security alerts"
        log "INFO" "□ Update team on deployment status"
    fi
}

# Run main function
main "$@"