/**
 * Fractional Ordering Service - Based on Figma's approach to fractional indexing
 * Generates string-based positions that can be inserted between any two existing positions
 * without requiring updates to other items
 */
export class FractionalOrderingService {
  // Base62 characters for compact string generation
  private static readonly CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  private static readonly BASE = 62;

  /**
   * Generate a position between two existing positions
   * Based on Figma's fractional indexing: positions are fractions between 0 and 1 exclusive
   * @param before - Position of item before (null for start)
   * @param after - Position of item after (null for end)
   * @returns New position string that sorts between before and after
   */
  static generatePosition(before: string | null, after: string | null): string {
    let result: string;
    
    // First item in empty list
    if (!before && !after) {
      result = 'V'; // Middle of our character range
    }
    // Insert at beginning (before first item)
    else if (!before) {
      result = this.decrementPosition(after!);
    }
    // Insert at end (after last item)
    else if (!after) {
      result = this.incrementPosition(before!);
    }
    // Insert between two positions
    else {
      result = this.midpoint(before, after);
    }
    
    // Safety validation: ensure generated position maintains sort order
    if (before && result.localeCompare(before) <= 0) {
      console.error('🚨 Generated position would sort incorrectly, using fallback:', {
        before,
        generated: result,
        after,
        method: !before && !after ? 'empty' : !before ? 'decrement' : !after ? 'increment' : 'midpoint'
      });
      // Emergency fallback: use a safer strategy
      return before + 'Z';
    }
    
    if (after && result.localeCompare(after) >= 0) {
      console.error('🚨 Generated position would sort incorrectly, using fallback:', {
        before,
        generated: result,
        after,
        method: !before && !after ? 'empty' : !before ? 'decrement' : !after ? 'increment' : 'midpoint'
      });
      // Emergency fallback: append to before with a safe character
      return (before || '') + 'Z';
    }
    
    return result;
  }

  /**
   * Create a position that comes before the given position
   */
  private static decrementPosition(position: string): string {
    // Find the first character we can decrement
    for (let i = 0; i < position.length; i++) {
      const char = position[i];
      const charIndex = this.CHARS.indexOf(char);
      
      if (charIndex > 0) {
        // We can decrement this character
        const newChar = this.CHARS[charIndex - 1];
        return position.slice(0, i) + newChar + 'z'.repeat(Math.max(0, position.length - i - 1));
      }
    }
    
    // If we can't decrement, prepend with a character before '0'
    // Using 'Z' as it comes at the end of our charset and sorts before '0'
    return 'Z' + position;
  }

  /**
   * Create a position that comes after the given position
   */
  private static incrementPosition(position: string): string {
    // Try to increment the last character first
    const lastChar = position[position.length - 1];
    const lastCharIndex = this.CHARS.indexOf(lastChar);
    
    // If we can increment the last character safely within the same "group"
    // Only increment within numbers (0-9) or within uppercase (A-Z) or within lowercase (a-z)
    if (lastCharIndex >= 0 && lastCharIndex < this.CHARS.length - 1) {
      const nextChar = this.CHARS[lastCharIndex + 1];
      
      // Check if we're staying within the same character group
      const isInNumbers = lastChar >= '0' && lastChar <= '9' && nextChar >= '0' && nextChar <= '9';
      const isInUppercase = lastChar >= 'A' && lastChar <= 'Z' && nextChar >= 'A' && nextChar <= 'Z';
      const isInLowercase = lastChar >= 'a' && lastChar <= 'z' && nextChar >= 'a' && nextChar <= 'z';
      
      if (isInNumbers || isInUppercase || isInLowercase) {
        return position.slice(0, -1) + nextChar; // "OF" → "OG"
      }
    }
    
    // If we can't increment safely within the same group, append a small character
    return position + '1'; // "OZ" → "OZ1", "OFz" → "OFz1"
  }

  /**
   * Generate a position between two existing positions
   */
  private static midpoint(before: string, after: string): string {
    // Simple and reliable approach: extend the before string with a middle character
    // This ensures the result always sorts between before and after
    
    // Pad strings to same length for comparison
    const maxLength = Math.max(before.length, after.length);
    const beforePadded = before.padEnd(maxLength, '0');
    const afterPadded = after.padEnd(maxLength, '0');
    
    // Find the first differing position
    for (let i = 0; i < maxLength; i++) {
      const beforeChar = beforePadded[i];
      const afterChar = afterPadded[i];
      
      if (beforeChar !== afterChar) {
        const beforeIndex = this.CHARS.indexOf(beforeChar);
        const afterIndex = this.CHARS.indexOf(afterChar);
        
        // If there's space between characters, use the middle
        if (afterIndex - beforeIndex > 1) {
          const midIndex = Math.floor((beforeIndex + afterIndex) / 2);
          const midChar = this.CHARS[midIndex];
          return before.slice(0, i) + midChar;
        }
        
        // If characters are adjacent or overlapping, extend with safe character
        return before + 'M'; // 'M' is in the middle of our charset and safe
      }
    }
    
    // If all characters are the same (shouldn't happen), extend before
    return before + 'M';
  }

  /**
   * Validate that a position is well-formed
   */
  static isValidPosition(position: string): boolean {
    if (!position || position.length === 0) return false;
    
    // Invalid positions that should trigger migration
    if (position === "0" || position === "1") return false;
    
    // Reject pure numeric strings (these cause sorting issues with fractional positions)
    if (/^\d+$/.test(position)) {
      console.warn(`Invalid numeric position detected: "${position}" - this will cause sorting issues`);
      return false;
    }
    
    // Check all characters are in our valid range
    for (const char of position) {
      if (!this.CHARS.includes(char)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Generate a sequence of evenly spaced positions for initial setup
   * Useful for migrating existing integer-ordered items
   * 
   * CRITICAL FIX: Use consistent case to ensure proper localeCompare ordering
   */
  static generateSequence(count: number): string[] {
    const positions: string[] = [];
    
    // Use only uppercase letters for consistency in localeCompare
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const letterCount = letters.length;
    
    // For small counts, use simple letter spacing
    if (count <= letterCount) {
      const step = Math.floor(letterCount / (count + 1));
      for (let i = 1; i <= count; i++) {
        const index = Math.min(i * step, letterCount - 1);
        positions.push(letters[index]);
      }
    } else {
      // For larger counts, use double letters to maintain ordering
      const baseCount = Math.ceil(Math.sqrt(count));
      let posIndex = 0;
      
      for (let i = 0; i < baseCount && posIndex < count; i++) {
        for (let j = 0; j < baseCount && posIndex < count; j++) {
          const pos = letters[i] + letters[j];
          positions.push(pos);
          posIndex++;
        }
      }
    }
    
    return positions;
  }

  /**
   * Convert a position to a rough numeric value for debugging
   * Note: This is for debugging only, don't use for actual sorting
   */
  static positionToDebugNumber(position: string): number {
    let value = 0;
    let multiplier = 1;
    
    for (let i = position.length - 1; i >= 0; i--) {
      const charIndex = this.CHARS.indexOf(position[i]);
      value += charIndex * multiplier;
      multiplier *= this.BASE;
    }
    
    return value;
  }
}