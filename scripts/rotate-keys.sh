#!/bin/bash

# ===================================================================
# EMERGENCY KEY ROTATION SCRIPT
# ===================================================================
# This script provides emergency credential rotation capabilities
# Use when credentials have been compromised or exposed
# ===================================================================

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="$PROJECT_ROOT/key-rotation-$(date +%Y%m%d-%H%M%S).log"

# Default values
EMERGENCY_MODE=false
SERVICE=""
ALL_SERVICES=false
DRY_RUN=false
BACKUP_OLD_KEYS=true

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
        "CRITICAL")
            echo -e "${RED}${BOLD}[CRITICAL]${NC} $message" | tee -a "$LOG_FILE"
            ;;
        *)
            echo "[$timestamp] $message" | tee -a "$LOG_FILE"
            ;;
    esac
}

print_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Emergency credential rotation script for Make10000Hours application

OPTIONS:
    -s, --service SERVICE    Rotate keys for specific service (openai|supabase|firebase|google|lemon)
    -a, --all               Rotate all service credentials
    -e, --emergency         Emergency mode - rotate immediately without confirmations
    -d, --dry-run          Show what would be rotated without actually doing it
    -n, --no-backup        Don't backup old keys (not recommended)
    -h, --help             Show this help message

SERVICES:
    openai      OpenAI API key
    supabase    Supabase project credentials
    firebase    Firebase project credentials
    google      Google OAuth credentials
    lemon       Lemon Squeezy API key
    all         All of the above

EXAMPLES:
    $0 --service openai                    # Rotate OpenAI API key
    $0 --all --emergency                   # Emergency rotation of all keys
    $0 --service firebase --dry-run        # Show what Firebase rotation would do

EMERGENCY USAGE:
    If credentials are compromised:
    1. Run: $0 --all --emergency
    2. Follow the on-screen instructions
    3. Update all deployment environments
    4. Test application functionality

SECURITY NOTE:
    This script will:
    1. Backup existing credentials (unless --no-backup)
    2. Generate/retrieve new credentials
    3. Update environment files
    4. Provide instructions for manual steps

EOF
}

confirm_action() {
    local message="$1"
    
    if [[ "$EMERGENCY_MODE" == true ]]; then
        log "WARN" "Emergency mode - skipping confirmation for: $message"
        return 0
    fi
    
    echo -e "${YELLOW}$message${NC}"
    read -p "Continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "INFO" "Operation cancelled by user"
        exit 0
    fi
}

backup_current_credentials() {
    if [[ "$BACKUP_OLD_KEYS" != true ]]; then
        log "WARN" "Skipping credential backup as requested"
        return 0
    fi
    
    log "INFO" "Backing up current credentials..."
    
    local backup_dir="$PROJECT_ROOT/credential-backups/$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$backup_dir"
    
    # Backup environment files (with credentials redacted in log)
    for env_file in .env .env.local .env.production .env.development; do
        if [[ -f "$PROJECT_ROOT/$env_file" ]]; then
            cp "$PROJECT_ROOT/$env_file" "$backup_dir/"
            log "INFO" "Backed up $env_file"
        fi
    done
    
    # Create backup information file
    cat > "$backup_dir/backup-info.txt" << EOF
Credential Backup Information
============================
Backup Date: $(date)
Reason: Key rotation via rotate-keys.sh
Emergency Mode: $EMERGENCY_MODE
Services: $SERVICE
Git Commit: $(git rev-parse HEAD 2>/dev/null || echo "Unknown")

IMPORTANT: 
- These files contain sensitive credentials
- Store securely and delete when no longer needed
- Never commit these backup files to version control
EOF
    
    # Secure the backup directory
    chmod 700 "$backup_dir"
    chmod 600 "$backup_dir"/*
    
    log "SUCCESS" "Credentials backed up to: $backup_dir"
    echo "$backup_dir" > "$PROJECT_ROOT/.last-credential-backup"
}

rotate_openai_key() {
    log "INFO" "Rotating OpenAI API key..."
    
    if [[ "$DRY_RUN" == true ]]; then
        log "INFO" "DRY RUN - Would rotate OpenAI API key"
        return 0
    fi
    
    log "CRITICAL" "MANUAL ACTION REQUIRED: OpenAI API Key Rotation"
    echo
    echo "To rotate your OpenAI API key:"
    echo "1. Go to https://platform.openai.com/api-keys"
    echo "2. Click 'Create new secret key'"
    echo "3. Name it: emergency-key-$(date +%Y%m%d)"
    echo "4. Copy the new key"
    echo "5. Update your environment variables"
    echo "6. Delete the old key"
    echo
    
    if [[ "$EMERGENCY_MODE" != true ]]; then
        read -p "Press Enter when you have the new OpenAI API key ready..."
        read -p "Enter the new OpenAI API key (input will be hidden): " -s new_key
        echo
        
        if [[ -n "$new_key" ]]; then
            # Update environment files
            update_env_variable "VITE_OPENAI_API_KEY" "$new_key"
            log "SUCCESS" "OpenAI API key updated in environment files"
        else
            log "ERROR" "No key provided"
            return 1
        fi
    else
        log "CRITICAL" "Emergency mode - You must manually update OpenAI API key immediately!"
    fi
}

rotate_supabase_credentials() {
    log "INFO" "Rotating Supabase credentials..."
    
    if [[ "$DRY_RUN" == true ]]; then
        log "INFO" "DRY RUN - Would rotate Supabase credentials"
        return 0
    fi
    
    log "CRITICAL" "MANUAL ACTION REQUIRED: Supabase Credentials Rotation"
    echo
    echo "To rotate your Supabase credentials:"
    echo "1. Go to https://supabase.com/dashboard"
    echo "2. Select your project"
    echo "3. Go to Settings > API"
    echo "4. If service role key was exposed, reset it"
    echo "5. Review and strengthen Row Level Security policies"
    echo "6. Check database logs for unauthorized access"
    echo
    
    if [[ "$EMERGENCY_MODE" != true ]]; then
        confirm_action "Have you completed the Supabase credential rotation?"
    fi
    
    log "WARN" "Supabase credentials should be reviewed and potentially rotated manually"
}

rotate_firebase_credentials() {
    log "INFO" "Rotating Firebase credentials..."
    
    if [[ "$DRY_RUN" == true ]]; then
        log "INFO" "DRY RUN - Would rotate Firebase credentials"
        return 0
    fi
    
    log "CRITICAL" "MANUAL ACTION REQUIRED: Firebase Credentials Rotation"
    echo
    echo "To rotate your Firebase credentials:"
    echo "1. Go to Firebase Console > Project Settings > Service Accounts"
    echo "2. Generate new private key"
    echo "3. Update GOOGLE_APPLICATION_CREDENTIALS path"
    echo "4. Review Firestore security rules"
    echo "5. Check authentication logs"
    echo "6. Delete old service account keys"
    echo
    
    if [[ "$EMERGENCY_MODE" != true ]]; then
        confirm_action "Have you completed the Firebase credential rotation?"
    fi
    
    log "WARN" "Firebase credentials should be reviewed and potentially rotated manually"
}

rotate_google_oauth() {
    log "INFO" "Rotating Google OAuth credentials..."
    
    if [[ "$DRY_RUN" == true ]]; then
        log "INFO" "DRY RUN - Would rotate Google OAuth credentials"
        return 0
    fi
    
    log "CRITICAL" "MANUAL ACTION REQUIRED: Google OAuth Rotation"
    echo
    echo "To rotate your Google OAuth credentials:"
    echo "1. Go to Google Cloud Console > APIs & Credentials"
    echo "2. Find your OAuth 2.0 Client ID"
    echo "3. Reset client secret"
    echo "4. Review OAuth consent screen"
    echo "5. Check for unauthorized grants"
    echo "6. Update application configuration"
    echo
    
    if [[ "$EMERGENCY_MODE" != true ]]; then
        confirm_action "Have you completed the Google OAuth rotation?"
    fi
    
    log "WARN" "Google OAuth credentials should be reviewed and potentially rotated manually"
}

rotate_lemon_squeezy_key() {
    log "INFO" "Rotating Lemon Squeezy API key..."
    
    if [[ "$DRY_RUN" == true ]]; then
        log "INFO" "DRY RUN - Would rotate Lemon Squeezy API key"
        return 0
    fi
    
    log "CRITICAL" "MANUAL ACTION REQUIRED: Lemon Squeezy API Key Rotation"
    echo
    echo "To rotate your Lemon Squeezy API key:"
    echo "1. Go to Lemon Squeezy Dashboard > Settings > API"
    echo "2. Delete the compromised API key"
    echo "3. Create a new API key"
    echo "4. Update environment variables"
    echo "5. Review payment/subscription activity for suspicious transactions"
    echo "6. Check webhook logs"
    echo
    
    if [[ "$EMERGENCY_MODE" != true ]]; then
        read -p "Press Enter when you have the new Lemon Squeezy API key ready..."
        read -p "Enter the new Lemon Squeezy API key (input will be hidden): " -s new_key
        echo
        
        if [[ -n "$new_key" ]]; then
            update_env_variable "VITE_LEMON_SQUEEZY_API_KEY" "$new_key"
            log "SUCCESS" "Lemon Squeezy API key updated in environment files"
        else
            log "ERROR" "No key provided"
            return 1
        fi
    else
        log "CRITICAL" "Emergency mode - You must manually update Lemon Squeezy API key immediately!"
    fi
}

update_env_variable() {
    local var_name="$1"
    local var_value="$2"
    
    # Update in multiple environment files
    for env_file in .env .env.local .env.production; do
        if [[ -f "$PROJECT_ROOT/$env_file" ]]; then
            if grep -q "^$var_name=" "$PROJECT_ROOT/$env_file"; then
                # Update existing variable
                if [[ "$OSTYPE" == "darwin"* ]]; then
                    # macOS
                    sed -i '' "s/^$var_name=.*/$var_name=$var_value/" "$PROJECT_ROOT/$env_file"
                else
                    # Linux
                    sed -i "s/^$var_name=.*/$var_name=$var_value/" "$PROJECT_ROOT/$env_file"
                fi
                log "INFO" "Updated $var_name in $env_file"
            else
                # Add new variable
                echo "$var_name=$var_value" >> "$PROJECT_ROOT/$env_file"
                log "INFO" "Added $var_name to $env_file"
            fi
        fi
    done
}

run_post_rotation_checks() {
    log "INFO" "Running post-rotation checks..."
    
    if [[ "$DRY_RUN" == true ]]; then
        log "INFO" "DRY RUN - Would run post-rotation checks"
        return 0
    fi
    
    # Check that environment files don't have obvious issues
    for env_file in .env .env.local .env.production; do
        if [[ -f "$PROJECT_ROOT/$env_file" ]]; then
            # Check for empty values
            if grep -q "=$" "$PROJECT_ROOT/$env_file"; then
                log "WARN" "Empty environment variables found in $env_file"
            fi
            
            # Check for placeholder values
            if grep -q "your-.*-here" "$PROJECT_ROOT/$env_file"; then
                log "WARN" "Placeholder values found in $env_file"
            fi
        fi
    done
    
    # Test basic application functionality if possible
    if command -v npm &> /dev/null && [[ -f "$PROJECT_ROOT/package.json" ]]; then
        log "INFO" "Testing application build..."
        cd "$PROJECT_ROOT"
        if npm run build &> /dev/null; then
            log "SUCCESS" "Application build successful"
        else
            log "ERROR" "Application build failed - check credentials"
        fi
    fi
    
    log "SUCCESS" "Post-rotation checks completed"
}

print_final_instructions() {
    log "INFO" "Key rotation process completed"
    echo
    echo -e "${BOLD}IMPORTANT NEXT STEPS:${NC}"
    echo "1. 🚀 Deploy updated credentials to all environments"
    echo "2. 🧪 Test all application functionality thoroughly"
    echo "3. 📊 Monitor API usage for any anomalies"
    echo "4. 🔐 Update CI/CD environment variables"
    echo "5. 👥 Notify team members of the rotation"
    echo "6. 📝 Document the incident (if applicable)"
    echo
    
    if [[ "$EMERGENCY_MODE" == true ]]; then
        echo -e "${RED}${BOLD}EMERGENCY MODE ACTIVE${NC}"
        echo "- This was an emergency rotation"
        echo "- Follow up with comprehensive security review"
        echo "- Implement additional monitoring"
        echo "- Review and update security procedures"
        echo
    fi
    
    echo "Credential backup location: $(cat "$PROJECT_ROOT/.last-credential-backup" 2>/dev/null || echo "None")"
    echo "Rotation log: $LOG_FILE"
}

# ===================================================================
# MAIN SCRIPT
# ===================================================================

main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -s|--service)
                SERVICE="$2"
                shift 2
                ;;
            -a|--all)
                ALL_SERVICES=true
                shift
                ;;
            -e|--emergency)
                EMERGENCY_MODE=true
                shift
                ;;
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -n|--no-backup)
                BACKUP_OLD_KEYS=false
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
    
    # Validate arguments
    if [[ "$ALL_SERVICES" != true && -z "$SERVICE" ]]; then
        log "ERROR" "Must specify either --service or --all"
        print_usage
        exit 1
    fi
    
    if [[ -n "$SERVICE" && "$ALL_SERVICES" == true ]]; then
        log "ERROR" "Cannot specify both --service and --all"
        print_usage
        exit 1
    fi
    
    if [[ -n "$SERVICE" && ! "$SERVICE" =~ ^(openai|supabase|firebase|google|lemon)$ ]]; then
        log "ERROR" "Invalid service: $SERVICE"
        print_usage
        exit 1
    fi
    
    # Start rotation process
    log "INFO" "Starting credential rotation process..."
    log "INFO" "Emergency mode: $EMERGENCY_MODE"
    log "INFO" "Dry run: $DRY_RUN"
    log "INFO" "Log file: $LOG_FILE"
    
    if [[ "$EMERGENCY_MODE" == true ]]; then
        log "CRITICAL" "🚨 EMERGENCY CREDENTIAL ROTATION ACTIVATED 🚨"
        log "CRITICAL" "This will rotate credentials immediately!"
        sleep 2
    else
        confirm_action "This will rotate API credentials. This action cannot be undone."
    fi
    
    # Backup current credentials
    backup_current_credentials
    
    # Rotate specified services
    if [[ "$ALL_SERVICES" == true ]]; then
        log "INFO" "Rotating all service credentials..."
        rotate_openai_key
        rotate_supabase_credentials
        rotate_firebase_credentials
        rotate_google_oauth
        rotate_lemon_squeezy_key
    else
        case $SERVICE in
            "openai")
                rotate_openai_key
                ;;
            "supabase")
                rotate_supabase_credentials
                ;;
            "firebase")
                rotate_firebase_credentials
                ;;
            "google")
                rotate_google_oauth
                ;;
            "lemon")
                rotate_lemon_squeezy_key
                ;;
        esac
    fi
    
    # Post-rotation checks
    run_post_rotation_checks
    
    # Final instructions
    print_final_instructions
    
    log "SUCCESS" "🔐 Credential rotation process completed!"
}

# Run main function
main "$@"