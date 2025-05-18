// Utility for conditionally joining classNames
export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

// Shadcn-inspired colors
export const colors = {
  primary: '#0070f3',
  primaryDark: '#0059cc',
  secondary: '#6c757d',
  secondaryDark: '#575e64',
  border: '#e2e8f0',
  background: '#ffffff',
  foreground: '#11181c',
  muted: '#f1f5f9',
  mutedForeground: '#64748b',
  accent: '#f9fafb',
  accentForeground: '#1a202c',
  destructive: '#ef4444',
  destructiveForeground: '#f8fafc',
  success: '#10b981',
  successForeground: '#f8fafc',
  card: '#ffffff',
  cardForeground: '#1a202c',
  popover: '#ffffff',
  popoverForeground: '#1a202c',
  ring: '#e2e8f0',
};

// Style utilities
export const shadcnStyles = {
  // Typography
  h1: {
    fontSize: '2.25rem',
    fontWeight: '700',
    lineHeight: '1.2',
    marginBottom: '1.5rem',
    color: colors.foreground,
  },
  
  h2: {
    fontSize: '1.875rem',
    fontWeight: '600',
    lineHeight: '1.2',
    marginBottom: '1rem',
    color: colors.foreground,
  },
  
  h3: {
    fontSize: '1.5rem',
    fontWeight: '600',
    lineHeight: '1.2',
    marginBottom: '0.75rem',
    color: colors.foreground,
  },
  
  h4: {
    fontSize: '1.25rem',
    fontWeight: '600',
    lineHeight: '1.2',
    marginBottom: '0.5rem',
    color: colors.foreground,
  },
  
  p: {
    fontSize: '1rem',
    lineHeight: '1.5',
    color: colors.foreground,
    marginBottom: '1rem',
  },
  
  small: {
    fontSize: '0.875rem',
    lineHeight: '1.5',
    color: colors.mutedForeground,
  },
  
  // Button variants
  button: {
    base: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '0.375rem',
      fontSize: '0.875rem',
      fontWeight: '500',
      transition: 'all 150ms',
      cursor: 'pointer',
      padding: '0.5rem 1rem',
    },
    
    primary: {
      backgroundColor: colors.primary,
      color: '#ffffff',
      border: 'none',
    },
    
    primaryHover: {
      backgroundColor: colors.primaryDark,
    },
    
    secondary: {
      backgroundColor: colors.secondary,
      color: '#ffffff',
      border: 'none',
    },
    
    secondaryHover: {
      backgroundColor: colors.secondaryDark,
    },
    
    outline: {
      backgroundColor: 'transparent',
      color: colors.foreground,
      border: `1px solid ${colors.border}`,
    },
    
    outlineHover: {
      backgroundColor: colors.accent,
    },
    
    ghost: {
      backgroundColor: 'transparent',
      color: colors.foreground,
      border: 'none',
    },
    
    ghostHover: {
      backgroundColor: colors.accent,
    },
    
    destructive: {
      backgroundColor: colors.destructive,
      color: colors.destructiveForeground,
      border: 'none',
    },
    
    destructiveHover: {
      backgroundColor: '#b91c1c',
    },
  },
  
  // Card styles
  card: {
    base: {
      backgroundColor: colors.card,
      borderRadius: '0.5rem',
      border: `1px solid ${colors.border}`,
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      padding: '1.5rem',
    },
    
    title: {
      fontSize: '1.25rem',
      fontWeight: '600',
      marginBottom: '0.75rem',
      color: colors.cardForeground,
    },
    
    description: {
      fontSize: '0.875rem',
      color: colors.mutedForeground,
      marginBottom: '1.5rem',
    },
    
    content: {
      color: colors.cardForeground,
    },
    
    footer: {
      marginTop: '1.5rem',
      paddingTop: '1rem',
      borderTop: `1px solid ${colors.border}`,
    },
  },
  
  // Input styles
  input: {
    base: {
      display: 'flex',
      width: '100%',
      borderRadius: '0.375rem',
      border: `1px solid ${colors.border}`,
      backgroundColor: colors.background,
      padding: '0.5rem',
      fontSize: '0.875rem',
      transition: 'all 150ms',
    },
    
    focus: {
      outline: 'none',
      borderColor: colors.ring,
      boxShadow: `0 0 0 2px rgba(99, 102, 241, 0.3)`,
    },
  },
  
  // Layout components
  layout: {
    container: {
      width: '100%',
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '0 1rem',
    },
    
    section: {
      marginBottom: '2rem',
    },
  },
  
  // Navigation
  nav: {
    base: {
      display: 'flex',
      backgroundColor: colors.background,
      borderBottom: `1px solid ${colors.border}`,
      padding: '1rem 0',
    },
    
    item: {
      color: colors.mutedForeground,
      fontSize: '0.875rem',
      fontWeight: '500',
      padding: '0.5rem 0.75rem',
      borderRadius: '0.375rem',
      textDecoration: 'none',
      transition: 'all 150ms',
    },
    
    itemHover: {
      backgroundColor: colors.accent,
      color: colors.accentForeground,
    },
    
    itemActive: {
      backgroundColor: colors.accent,
      color: colors.primary,
      fontWeight: '600',
    },
  },
  
  // Tab styles
  tabs: {
    list: {
      display: 'flex',
      borderBottom: `1px solid ${colors.border}`,
    },
    
    trigger: {
      padding: '0.75rem 1rem',
      border: 'none',
      borderBottom: '2px solid transparent',
      background: 'transparent',
      fontWeight: '500',
      fontSize: '0.875rem',
      color: colors.mutedForeground,
      cursor: 'pointer',
    },
    
    triggerActive: {
      color: colors.primary,
      borderBottomColor: colors.primary,
    },
    
    content: {
      padding: '1.5rem 0',
    },
  },
};

// Export ready-to-use styles for ease of use
export const styles = {
  container: {
    width: '100%',
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 1rem',
  },
  
  mainContent: {
    padding: '2rem 0',
  },
  
  card: {
    border: `1px solid ${colors.border}`,
    borderRadius: '0.5rem',
    padding: '1.5rem',
    backgroundColor: colors.card,
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  
  cardHeader: {
    marginBottom: '1.5rem',
    borderBottom: `1px solid ${colors.border}`,
    paddingBottom: '0.75rem',
  },
  
  cardTitle: {
    fontSize: '1.25rem',
    fontWeight: '600',
    color: colors.cardForeground,
    margin: 0,
  },
  
  cardContent: {
    color: colors.cardForeground,
  },
  
  cardFooter: {
    marginTop: '1.5rem',
    paddingTop: '0.75rem',
    borderTop: `1px solid ${colors.border}`,
  },
  
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '0.375rem',
    fontWeight: '500',
    fontSize: '0.875rem',
    padding: '0.5rem 1rem',
    cursor: 'pointer',
    transition: 'all 150ms',
  },
  
  primaryButton: {
    backgroundColor: colors.primary,
    color: '#ffffff',
    border: 'none',
  },
  
  secondaryButton: {
    backgroundColor: colors.secondary,
    color: '#ffffff',
    border: 'none',
  },
  
  outlineButton: {
    backgroundColor: 'transparent',
    color: colors.foreground,
    border: `1px solid ${colors.border}`,
  },
  
  input: {
    width: '100%',
    padding: '0.5rem',
    borderRadius: '0.375rem',
    border: `1px solid ${colors.border}`,
    fontSize: '0.875rem',
  },
  
  label: {
    display: 'block',
    fontSize: '0.875rem',
    fontWeight: '500',
    marginBottom: '0.5rem',
    color: colors.foreground,
  },
  
  select: {
    width: '100%',
    padding: '0.5rem',
    borderRadius: '0.375rem',
    border: `1px solid ${colors.border}`,
    backgroundColor: colors.background,
    fontSize: '0.875rem',
  },
  
  tabsList: {
    display: 'flex',
    borderBottom: `1px solid ${colors.border}`,
  },
  
  tabTrigger: {
    padding: '0.75rem 1rem',
    border: 'none',
    borderBottom: '2px solid transparent',
    background: 'transparent',
    fontWeight: '500',
    fontSize: '0.875rem',
    color: colors.mutedForeground,
    cursor: 'pointer',
  },
  
  tabTriggerActive: {
    color: colors.primary,
    borderBottomColor: colors.primary,
  },
  
  error: {
    backgroundColor: '#fee2e2',
    color: '#b91c1c',
    padding: '0.75rem',
    borderRadius: '0.375rem',
    marginBottom: '1rem',
    fontSize: '0.875rem',
  },
  
  success: {
    backgroundColor: '#dcfce7',
    color: '#15803d',
    padding: '0.75rem',
    borderRadius: '0.375rem',
    marginBottom: '1rem',
    fontSize: '0.875rem',
  },
}; 