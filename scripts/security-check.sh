#!/bin/bash

# ===================================================================
# COMPREHENSIVE SECURITY CHECK SCRIPT
# ===================================================================
# This script performs a comprehensive security audit of the application
# It checks for vulnerabilities, exposed credentials, and security misconfigurations
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
LOG_FILE="$PROJECT_ROOT/security-check-$(date +%Y%m%d-%H%M%S).log"

# Check flags
COMPREHENSIVE=false
EMERGENCY=false
FIX_ISSUES=false
QUIET=false

# Counters
CRITICAL_ISSUES=0
HIGH_ISSUES=0
MEDIUM_ISSUES=0
LOW_ISSUES=0

# ===================================================================
# HELPER FUNCTIONS
# ===================================================================

log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    if [[ "$QUIET" != true || "$level" =~ ^(ERROR|CRITICAL)$ ]]; then
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
    else
        echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    fi
}

print_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Comprehensive security check for Make10000Hours application

OPTIONS:
    -c, --comprehensive     Run comprehensive security scan (includes deep analysis)
    -e, --emergency        Emergency security check (focuses on critical issues)
    -f, --fix              Attempt to fix issues automatically (where safe)
    -q, --quiet            Quiet mode (only show critical/error messages)
    -h, --help             Show this help message

EXAMPLES:
    $0                          # Basic security check
    $0 --comprehensive          # Full security audit
    $0 --emergency              # Quick check for critical issues
    $0 --comprehensive --fix    # Full check with auto-fixes

RETURN CODES:
    0 - No issues found
    1 - Low/medium issues found
    2 - High issues found
    3 - Critical issues found

EOF
}

record_issue() {
    local severity="$1"
    local title="$2"
    local description="$3"
    local fix_suggestion="$4"
    
    case "$severity" in
        "CRITICAL")
            ((CRITICAL_ISSUES++))
            log "CRITICAL" "🚨 $title"
            ;;
        "HIGH")
            ((HIGH_ISSUES++))
            log "ERROR" "❌ $title"
            ;;
        "MEDIUM")
            ((MEDIUM_ISSUES++))
            log "WARN" "⚠️  $title"
            ;;
        "LOW")
            ((LOW_ISSUES++))
            log "INFO" "ℹ️  $title"
            ;;
    esac
    
    log "INFO" "   Description: $description"
    if [[ -n "$fix_suggestion" ]]; then
        log "INFO" "   Fix: $fix_suggestion"
    fi
    echo
}

check_environment_files() {
    log "INFO" "🔍 Checking environment file security..."
    
    # Check for committed environment files
    if git ls-files | grep -E "\.env$|\.env\." | grep -v "\.env\.example$" | grep -v "\.env\.template$"; then
        record_issue "CRITICAL" "Environment files committed to git" \
            "Environment files containing credentials are committed to version control" \
            "Remove environment files from git and add to .gitignore"
    fi
    
    # Check for real credentials in example files
    for file in env.example .env.example .env.template .env.production.template; do
        if [[ -f "$PROJECT_ROOT/$file" ]]; then
            if grep -q "sk-[a-zA-Z0-9]" "$PROJECT_ROOT/$file" 2>/dev/null; then
                record_issue "HIGH" "Real API keys in example file: $file" \
                    "Example files should not contain real credentials" \
                    "Replace with placeholder values"
            fi
        fi
    done
    
    # Check for weak or default values
    for env_file in .env .env.local .env.production; do
        if [[ -f "$PROJECT_ROOT/$env_file" ]]; then
            # Check for empty values
            if grep -q "=$" "$PROJECT_ROOT/$env_file"; then
                record_issue "MEDIUM" "Empty environment variables in $env_file" \
                    "Environment variables with empty values can cause runtime errors" \
                    "Set proper values for all environment variables"
            fi
            
            # Check for placeholder values in production files
            if [[ "$env_file" == ".env.production" ]]; then
                if grep -q "your-.*-here\|placeholder\|example" "$PROJECT_ROOT/$env_file"; then
                    record_issue "CRITICAL" "Placeholder values in production environment" \
                        "Production environment file contains placeholder values" \
                        "Set real production credentials"
                fi
            fi
        fi
    done
    
    log "SUCCESS" "Environment files security check completed"
}

check_secrets_in_code() {
    log "INFO" "🔍 Scanning for hardcoded secrets in source code..."
    
    local patterns=(
        "sk-[a-zA-Z0-9]"                    # OpenAI API keys
        "pk_[a-zA-Z0-9]"                    # Stripe keys
        "AIza[a-zA-Z0-9]"                   # Google API keys
        "AKIA[a-zA-Z0-9]"                   # AWS access keys
        "eyJ[a-zA-Z0-9]"                    # JWT tokens
        "xoxb-[a-zA-Z0-9]"                  # Slack bot tokens
        "ghp_[a-zA-Z0-9]"                   # GitHub personal access tokens
        "gho_[a-zA-Z0-9]"                   # GitHub OAuth tokens
        "[a-zA-Z0-9]{32,}"                  # Generic long strings (potential keys)
    )
    
    local found_secrets=false
    
    # Scan source files
    for pattern in "${patterns[@]}"; do
        if grep -r "$pattern" src/ --exclude-dir=node_modules --exclude="*.test.*" --exclude="*.spec.*" 2>/dev/null; then
            record_issue "CRITICAL" "Potential secret found in source code" \
                "Pattern '$pattern' found in source code" \
                "Remove hardcoded secrets and use environment variables"
            found_secrets=true
        fi
    done
    
    # Check for Firebase config in code
    if grep -r "apiKey.*AIza" src/ 2>/dev/null; then
        # This is actually OK for Firebase client-side config, but warn anyway
        record_issue "LOW" "Firebase API key in source code" \
            "Firebase API keys are safe for client-side use but should be validated" \
            "Ensure Firebase security rules are properly configured"
    fi
    
    if [[ "$found_secrets" != true ]]; then
        log "SUCCESS" "No hardcoded secrets found in source code"
    fi
    
    log "SUCCESS" "Source code secret scan completed"
}

check_dependencies() {
    log "INFO" "🔍 Checking dependencies for vulnerabilities..."
    
    if ! command -v npm &> /dev/null; then
        record_issue "MEDIUM" "npm not available" \
            "Cannot check for dependency vulnerabilities" \
            "Install npm to enable dependency scanning"
        return
    fi
    
    cd "$PROJECT_ROOT"
    
    # Run npm audit
    if npm audit --audit-level high --json > audit_result.json 2>/dev/null; then
        log "SUCCESS" "No high-severity vulnerabilities found in dependencies"
    else
        local vulnerabilities=$(cat audit_result.json 2>/dev/null | jq -r '.metadata.vulnerabilities.total // 0' 2>/dev/null || echo "unknown")
        record_issue "HIGH" "Dependencies with vulnerabilities found" \
            "Found $vulnerabilities total vulnerabilities in dependencies" \
            "Run 'npm audit fix' to fix automatically fixable issues"
    fi
    
    # Clean up
    rm -f audit_result.json
    
    # Check for outdated dependencies if comprehensive mode
    if [[ "$COMPREHENSIVE" == true ]]; then
        log "INFO" "Checking for outdated dependencies..."
        if npm outdated --json > outdated.json 2>/dev/null; then
            local outdated_count=$(cat outdated.json 2>/dev/null | jq 'length' 2>/dev/null || echo "0")
            if [[ "$outdated_count" -gt 0 ]]; then
                record_issue "LOW" "Outdated dependencies found" \
                    "Found $outdated_count outdated dependencies" \
                    "Run 'npm update' to update dependencies"
            fi
        fi
        rm -f outdated.json
    fi
    
    log "SUCCESS" "Dependency security check completed"
}

check_git_security() {
    log "INFO" "🔍 Checking git repository security..."
    
    # Check for large files that might contain secrets
    if command -v git &> /dev/null; then
        # Check for files larger than 1MB
        large_files=$(git ls-files | xargs ls -la 2>/dev/null | awk '$5 > 1048576 {print $9}' || true)
        if [[ -n "$large_files" ]]; then
            record_issue "MEDIUM" "Large files in repository" \
                "Large files may contain sensitive data: $large_files" \
                "Review large files for sensitive content"
        fi
        
        # Check git history for potential secrets
        if [[ "$COMPREHENSIVE" == true ]]; then
            log "INFO" "Scanning git history for secrets (this may take a while)..."
            if git log --all --full-history -p | grep -E "sk-[a-zA-Z0-9]|pk_[a-zA-Z0-9]|AIza[a-zA-Z0-9]" > /dev/null 2>&1; then
                record_issue "CRITICAL" "Potential secrets in git history" \
                    "Git history may contain committed secrets" \
                    "Use git-filter-repo or BFG to clean git history"
            fi
        fi
        
        # Check for .git/config exposure
        if [[ -f ".git/config" ]]; then
            if grep -q "url.*://" .git/config 2>/dev/null; then
                # Check if URLs contain credentials
                if grep -q "://.*:.*@" .git/config 2>/dev/null; then
                    record_issue "HIGH" "Credentials in git remote URL" \
                        "Git remote URL contains embedded credentials" \
                        "Remove credentials from git remote URLs"
                fi
            fi
        fi
    fi
    
    log "SUCCESS" "Git security check completed"
}

check_file_permissions() {
    log "INFO" "🔍 Checking file permissions..."
    
    # Check environment file permissions
    for env_file in .env .env.local .env.production; do
        if [[ -f "$PROJECT_ROOT/$env_file" ]]; then
            local perms=$(stat -c "%a" "$PROJECT_ROOT/$env_file" 2>/dev/null || stat -f "%OLp" "$PROJECT_ROOT/$env_file" 2>/dev/null)
            if [[ "$perms" != "600" ]]; then
                record_issue "MEDIUM" "Insecure permissions on $env_file" \
                    "Environment file has permissions $perms (should be 600)" \
                    "Run: chmod 600 $env_file"
                
                if [[ "$FIX_ISSUES" == true ]]; then
                    chmod 600 "$PROJECT_ROOT/$env_file"
                    log "SUCCESS" "Fixed permissions for $env_file"
                fi
            fi
        fi
    done
    
    # Check for world-writable files
    if find . -type f -perm -002 2>/dev/null | grep -v node_modules | head -5; then
        record_issue "MEDIUM" "World-writable files found" \
            "Some files are writable by everyone" \
            "Review and fix file permissions"
    fi
    
    log "SUCCESS" "File permissions check completed"
}

check_firebase_security() {
    log "INFO" "🔍 Checking Firebase security configuration..."
    
    # Check if Firebase rules file exists
    if [[ -f "$PROJECT_ROOT/firestore.rules" ]]; then
        # Check for dangerous catch-all rules
        if grep -q "allow read, write" "$PROJECT_ROOT/firestore.rules"; then
            record_issue "CRITICAL" "Dangerous Firebase security rules" \
                "Found 'allow read, write' catch-all rules in firestore.rules" \
                "Implement specific security rules for each collection"
        fi
        
        # Check for missing authentication requirements
        if ! grep -q "request.auth" "$PROJECT_ROOT/firestore.rules"; then
            record_issue "HIGH" "Firebase rules don't check authentication" \
                "Firestore rules may not require authentication" \
                "Add authentication checks to Firebase security rules"
        fi
        
        log "SUCCESS" "Firebase security rules found and checked"
    else
        record_issue "HIGH" "No Firebase security rules found" \
            "firestore.rules file not found" \
            "Create proper Firebase security rules"
    fi
    
    # Check Firebase config
    if [[ -f "$PROJECT_ROOT/firebase.json" ]]; then
        # Check for proper hosting configuration
        if grep -q "public.*dist\|public.*build" "$PROJECT_ROOT/firebase.json"; then
            log "SUCCESS" "Firebase hosting configuration looks correct"
        else
            record_issue "MEDIUM" "Firebase hosting configuration may be incorrect" \
                "Public directory should point to build/dist folder" \
                "Review firebase.json hosting configuration"
        fi
    fi
    
    log "SUCCESS" "Firebase security check completed"
}

check_api_endpoints() {
    log "INFO" "🔍 Checking API endpoint security..."
    
    # Check for development endpoints in production
    if grep -r "localhost\|127.0.0.1\|dev-api\|test-api" src/ --exclude-dir=node_modules 2>/dev/null; then
        record_issue "MEDIUM" "Development endpoints in source code" \
            "Found references to development/local endpoints" \
            "Use environment variables for API endpoints"
    fi
    
    # Check for HTTP URLs in production code
    if grep -r "http://[^l]" src/ --exclude-dir=node_modules 2>/dev/null; then
        record_issue "MEDIUM" "HTTP URLs found in source code" \
            "Found HTTP (non-HTTPS) URLs in source code" \
            "Use HTTPS URLs for all external services"
    fi
    
    # Check for exposed internal APIs
    if grep -r "internal-api\|admin-api" src/ --exclude-dir=node_modules 2>/dev/null; then
        record_issue "HIGH" "Internal API endpoints exposed" \
            "Found references to internal/admin APIs" \
            "Ensure internal APIs have proper authentication"
    fi
    
    log "SUCCESS" "API endpoint security check completed"
}

check_browser_security() {
    log "INFO" "🔍 Checking browser security configuration..."
    
    # Check for CSP configuration
    if ! grep -r "Content-Security-Policy\|CSP" public/ src/ 2>/dev/null; then
        record_issue "MEDIUM" "No Content Security Policy found" \
            "Content Security Policy helps prevent XSS attacks" \
            "Implement CSP headers or meta tags"
    fi
    
    # Check for unsafe eval or innerHTML usage
    if grep -r "eval(\|innerHTML\|outerHTML" src/ --exclude-dir=node_modules 2>/dev/null; then
        record_issue "HIGH" "Potentially unsafe DOM manipulation" \
            "Found usage of eval(), innerHTML, or outerHTML" \
            "Use safer alternatives like textContent or proper sanitization"
    fi
    
    # Check for localStorage/sessionStorage of sensitive data
    if grep -r "localStorage\|sessionStorage" src/ --exclude-dir=node_modules 2>/dev/null; then
        record_issue "LOW" "Browser storage usage detected" \
            "Browser storage may contain sensitive data" \
            "Avoid storing sensitive data in browser storage"
    fi
    
    log "SUCCESS" "Browser security check completed"
}

check_extension_security() {
    log "INFO" "🔍 Checking Chrome extension security..."
    
    if [[ -d "$PROJECT_ROOT/extension" ]]; then
        # Check manifest permissions
        if [[ -f "$PROJECT_ROOT/extension/manifest.json" ]]; then
            # Check for broad permissions
            if grep -q '"<all_urls>"\|"*://*/*"' "$PROJECT_ROOT/extension/manifest.json"; then
                record_issue "HIGH" "Chrome extension has broad permissions" \
                    "Extension requests access to all websites" \
                    "Limit extension permissions to specific domains"
            fi
            
            # Check for dangerous permissions
            if grep -q '"tabs"\|"history"\|"bookmarks"' "$PROJECT_ROOT/extension/manifest.json"; then
                record_issue "MEDIUM" "Chrome extension requests sensitive permissions" \
                    "Extension requests access to tabs/history/bookmarks" \
                    "Only request necessary permissions"
            fi
        fi
        
        # Check for exposed credentials in extension
        if grep -r "sk-[a-zA-Z0-9]\|AIza[a-zA-Z0-9]" extension/ 2>/dev/null; then
            record_issue "CRITICAL" "Credentials in Chrome extension" \
                "Found potential API keys in extension files" \
                "Never embed credentials in browser extensions"
        fi
    fi
    
    log "SUCCESS" "Chrome extension security check completed"
}

run_comprehensive_checks() {
    if [[ "$COMPREHENSIVE" != true ]]; then
        return 0
    fi
    
    log "INFO" "🔍 Running comprehensive security analysis..."
    
    # Check for common security anti-patterns
    log "INFO" "Checking for security anti-patterns..."
    
    # Check for SQL injection patterns (even though we use Firestore)
    if grep -r "query.*+\|SELECT.*+\|WHERE.*+" src/ --exclude-dir=node_modules 2>/dev/null; then
        record_issue "MEDIUM" "Potential SQL injection patterns" \
            "Found string concatenation in query-like statements" \
            "Use parameterized queries or prepared statements"
    fi
    
    # Check for weak randomness
    if grep -r "Math.random()" src/ --exclude-dir=node_modules 2>/dev/null; then
        record_issue "LOW" "Weak random number generation" \
            "Math.random() is not cryptographically secure" \
            "Use crypto.getRandomValues() for security-sensitive randomness"
    fi
    
    # Check for debug/console statements in production build
    if grep -r "console\.\|debugger" src/ --exclude-dir=node_modules 2>/dev/null; then
        record_issue "LOW" "Debug statements in source code" \
            "Console/debugger statements may expose information" \
            "Remove debug statements from production code"
    fi
    
    log "SUCCESS" "Comprehensive security analysis completed"
}

generate_security_report() {
    log "INFO" "📊 Generating security report..."
    
    local total_issues=$((CRITICAL_ISSUES + HIGH_ISSUES + MEDIUM_ISSUES + LOW_ISSUES))
    
    echo
    echo -e "${BOLD}🛡️  SECURITY REPORT SUMMARY${NC}"
    echo "=============================="
    echo -e "Critical Issues: ${RED}$CRITICAL_ISSUES${NC}"
    echo -e "High Issues:     ${RED}$HIGH_ISSUES${NC}"
    echo -e "Medium Issues:   ${YELLOW}$MEDIUM_ISSUES${NC}"
    echo -e "Low Issues:      ${BLUE}$LOW_ISSUES${NC}"
    echo "Total Issues:    $total_issues"
    echo
    
    # Security score calculation
    local security_score=$((100 - (CRITICAL_ISSUES * 25) - (HIGH_ISSUES * 10) - (MEDIUM_ISSUES * 5) - (LOW_ISSUES * 1)))
    if [[ $security_score -lt 0 ]]; then
        security_score=0
    fi
    
    echo -e "Security Score:  ${BOLD}$security_score/100${NC}"
    
    if [[ $security_score -ge 90 ]]; then
        echo -e "Security Level:  ${GREEN}EXCELLENT${NC} 🟢"
    elif [[ $security_score -ge 75 ]]; then
        echo -e "Security Level:  ${GREEN}GOOD${NC} 🟡"
    elif [[ $security_score -ge 60 ]]; then
        echo -e "Security Level:  ${YELLOW}FAIR${NC} 🟠"
    else
        echo -e "Security Level:  ${RED}POOR${NC} 🔴"
    fi
    
    echo
    echo "Detailed log: $LOG_FILE"
    echo
    
    # Return appropriate exit code
    if [[ $CRITICAL_ISSUES -gt 0 ]]; then
        return 3
    elif [[ $HIGH_ISSUES -gt 0 ]]; then
        return 2
    elif [[ $((MEDIUM_ISSUES + LOW_ISSUES)) -gt 0 ]]; then
        return 1
    else
        return 0
    fi
}

# ===================================================================
# MAIN SCRIPT
# ===================================================================

main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -c|--comprehensive)
                COMPREHENSIVE=true
                shift
                ;;
            -e|--emergency)
                EMERGENCY=true
                shift
                ;;
            -f|--fix)
                FIX_ISSUES=true
                shift
                ;;
            -q|--quiet)
                QUIET=true
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
    
    # Start security check
    log "INFO" "🔒 Starting security check..."
    log "INFO" "Comprehensive mode: $COMPREHENSIVE"
    log "INFO" "Emergency mode: $EMERGENCY"
    log "INFO" "Auto-fix mode: $FIX_ISSUES"
    log "INFO" "Log file: $LOG_FILE"
    echo
    
    # Navigate to project root
    cd "$PROJECT_ROOT"
    
    # Run security checks
    check_environment_files
    check_secrets_in_code
    check_dependencies
    check_git_security
    check_file_permissions
    check_firebase_security
    check_api_endpoints
    check_browser_security
    check_extension_security
    
    # Run comprehensive checks if requested
    if [[ "$COMPREHENSIVE" == true ]]; then
        run_comprehensive_checks
    fi
    
    # Generate final report
    generate_security_report
    local exit_code=$?
    
    if [[ $exit_code -eq 0 ]]; then
        log "SUCCESS" "🎉 Security check completed - no issues found!"
    else
        log "WARN" "Security check completed with issues. See report above."
    fi
    
    exit $exit_code
}

# Run main function
main "$@"