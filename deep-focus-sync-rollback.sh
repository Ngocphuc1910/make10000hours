#!/bin/bash

# Deep Focus Sync Fix Rollback Script
# Safely reverts all Phase 2-4 changes if issues are detected

set -e  # Exit on any error

# Configuration
BACKUP_PREFIX="extension_backup_"
ROLLBACK_LOG="rollback_$(date '+%Y%m%d_%H%M%S').log"
FEATURE_BRANCH="deep-focus-sync-fix-phase2"
MAIN_BRANCH="feature/insights"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$ROLLBACK_LOG"
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$ROLLBACK_LOG"
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$ROLLBACK_LOG"
}

# Function to find the most recent backup
find_latest_backup() {
    local latest_backup=""
    local latest_time=0
    
    for backup_dir in ${BACKUP_PREFIX}*; do
        if [[ -d "$backup_dir" ]]; then
            # Extract timestamp from backup name
            timestamp=$(echo "$backup_dir" | sed "s/${BACKUP_PREFIX}//")
            # Convert to epoch time for comparison
            if [[ "$timestamp" =~ ^[0-9]{8}_[0-9]{6}$ ]]; then
                epoch_time=$(date -j -f "%Y%m%d_%H%M%S" "$timestamp" +%s 2>/dev/null || echo "0")
                if (( epoch_time > latest_time )); then
                    latest_time=$epoch_time
                    latest_backup=$backup_dir
                fi
            fi
        fi
    done
    
    echo "$latest_backup"
}

# Function to verify backup integrity
verify_backup() {
    local backup_dir=$1
    
    log "Verifying backup integrity: $backup_dir"
    
    # Check essential files exist
    local essential_files=(
        "models/StorageManager.js"
        "models/FocusTimeTracker.js"
        "background.js"
        "manifest.json"
    )
    
    for file in "${essential_files[@]}"; do
        if [[ ! -f "$backup_dir/$file" ]]; then
            log_error "Essential file missing in backup: $file"
            return 1
        fi
    done
    
    # Check StorageManager doesn't have our enhanced methods (pre-enhancement backup)
    if grep -q "validateSession\|sanitizeSessionData\|getAllActiveSessions" "$backup_dir/models/StorageManager.js"; then
        log_warning "Backup contains enhanced methods - may not be pre-enhancement backup"
    fi
    
    log "Backup verification passed"
    return 0
}

# Function to create emergency backup of current state
create_emergency_backup() {
    local emergency_backup="emergency_backup_$(date '+%Y%m%d_%H%M%S')"
    
    log "Creating emergency backup of current state: $emergency_backup"
    
    if [[ -d "extension" ]]; then
        cp -r extension "$emergency_backup"
        log "Emergency backup created: $emergency_backup"
    else
        log_error "Extension directory not found for emergency backup"
        return 1
    fi
}

# Function to restore from backup
restore_from_backup() {
    local backup_dir=$1
    
    log "Starting restoration from backup: $backup_dir"
    
    # Remove current extension directory
    if [[ -d "extension" ]]; then
        log "Removing current extension directory"
        rm -rf extension
    fi
    
    # Restore from backup
    log "Restoring extension from backup"
    cp -r "$backup_dir" extension
    
    # Verify restoration
    if [[ -f "extension/models/StorageManager.js" ]]; then
        log "Extension restoration completed successfully"
        return 0
    else
        log_error "Extension restoration failed - essential files missing"
        return 1
    fi
}

# Function to reset git state
reset_git_state() {
    log "Resetting git state to main branch"
    
    # Check current branch
    current_branch=$(git branch --show-current)
    log "Current branch: $current_branch"
    
    if [[ "$current_branch" == "$FEATURE_BRANCH" ]]; then
        # Switch back to main branch
        log "Switching to main branch: $MAIN_BRANCH"
        git checkout "$MAIN_BRANCH"
        
        # Delete the feature branch
        log "Deleting feature branch: $FEATURE_BRANCH"
        git branch -D "$FEATURE_BRANCH" || log_warning "Failed to delete feature branch"
    else
        log "Already on main branch or different branch: $current_branch"
    fi
}

# Function to run rollback verification
verify_rollback() {
    log "Verifying rollback success"
    
    # Check StorageManager doesn't have enhanced methods
    if grep -q "validateSession\|sanitizeSessionData\|getAllActiveSessions" "extension/models/StorageManager.js"; then
        log_error "Rollback verification failed - enhanced methods still present"
        return 1
    fi
    
    # Check background.js message handlers count
    local message_count=$(grep -o "deepFocusMessages.*\[" "extension/background.js" -A 10 | grep -c "'" || echo "0")
    if (( message_count > 8 )); then
        log_error "Rollback verification failed - too many message handlers present ($message_count)"
        return 1
    fi
    
    log "Rollback verification passed"
    return 0
}

# Function to test basic functionality
test_basic_functionality() {
    log "Testing basic extension functionality"
    
    # Build extension
    log "Building extension"
    npm run build-extension-firebase >> "$ROLLBACK_LOG" 2>&1
    
    if [[ $? -eq 0 ]]; then
        log "Extension build successful"
        return 0
    else
        log_error "Extension build failed"
        return 1
    fi
}

# Main rollback function
main() {
    log "=== Deep Focus Sync Fix Rollback Started ==="
    log "Rollback initiated at: $(date)"
    log "Working directory: $(pwd)"
    
    # Step 1: Create emergency backup
    create_emergency_backup
    if [[ $? -ne 0 ]]; then
        log_error "Failed to create emergency backup - aborting rollback"
        exit 1
    fi
    
    # Step 2: Find latest backup
    local backup_dir
    backup_dir=$(find_latest_backup)
    
    if [[ -z "$backup_dir" ]]; then
        log_error "No backup directory found with pattern ${BACKUP_PREFIX}*"
        log_error "Available directories:"
        ls -la | grep "$BACKUP_PREFIX" || log "No backup directories found"
        exit 1
    fi
    
    log "Found backup directory: $backup_dir"
    
    # Step 3: Verify backup integrity
    if ! verify_backup "$backup_dir"; then
        log_error "Backup verification failed - rollback aborted"
        exit 1
    fi
    
    # Step 4: Restore from backup
    if ! restore_from_backup "$backup_dir"; then
        log_error "Restoration failed - manual intervention required"
        exit 1
    fi
    
    # Step 5: Reset git state
    reset_git_state
    
    # Step 6: Verify rollback
    if ! verify_rollback; then
        log_error "Rollback verification failed - manual verification required"
        exit 1
    fi
    
    # Step 7: Test basic functionality
    if ! test_basic_functionality; then
        log_error "Basic functionality test failed - manual verification required"
        exit 1
    fi
    
    log "=== Deep Focus Sync Fix Rollback Completed Successfully ==="
    log "Original backup used: $backup_dir"
    log "Emergency backup created at: emergency_backup_*"
    log "Full rollback log: $ROLLBACK_LOG"
    
    echo -e "${GREEN}"
    echo "🔄 ROLLBACK COMPLETED SUCCESSFULLY"
    echo "✅ Extension restored to pre-enhancement state"
    echo "✅ Git state reset to main branch"
    echo "✅ Basic functionality verified"
    echo "📋 Review the rollback log: $ROLLBACK_LOG"
    echo -e "${NC}"
}

# Usage instructions
usage() {
    echo "Deep Focus Sync Fix Rollback Script"
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --help, -h    Show this help message"
    echo "  --dry-run     Show what would be done without making changes"
    echo "  --force       Skip confirmation prompts"
    echo ""
    echo "This script will:"
    echo "1. Create emergency backup of current state"
    echo "2. Find the most recent pre-enhancement backup"
    echo "3. Restore extension files from backup"
    echo "4. Reset git branch to main"
    echo "5. Verify rollback success"
    echo "6. Test basic functionality"
}

# Handle command line arguments
case "${1:-}" in
    --help|-h)
        usage
        exit 0
        ;;
    --dry-run)
        log "DRY RUN MODE - No changes will be made"
        backup_dir=$(find_latest_backup)
        if [[ -n "$backup_dir" ]]; then
            log "Would restore from backup: $backup_dir"
            verify_backup "$backup_dir"
        else
            log "No backup found - rollback would fail"
        fi
        exit 0
        ;;
    --force)
        log "Force mode enabled - skipping confirmation"
        ;;
    "")
        # Interactive mode
        echo -e "${YELLOW}This will rollback the Deep Focus Sync Fix changes.${NC}"
        echo "Are you sure you want to continue? (y/N)"
        read -r response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            echo "Rollback cancelled"
            exit 0
        fi
        ;;
    *)
        log_error "Unknown option: $1"
        usage
        exit 1
        ;;
esac

# Run main function
main