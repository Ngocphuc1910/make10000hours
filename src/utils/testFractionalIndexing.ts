import { FractionalOrderingService } from '../services/FractionalOrderingService';

/**
 * Quick test to verify fractional indexing implementation
 * Run this in the browser console to validate the algorithm
 */
export const testFractionalIndexing = () => {
  console.log('🧪 Testing Fractional Indexing Implementation...');
  
  const tests = [
    // Test 1: First item in empty list
    {
      name: 'First item (empty list)',
      before: null,
      after: null,
      expected: 'Should generate middle position'
    },
    
    // Test 2: Insert at beginning
    {
      name: 'Insert at beginning',
      before: null,
      after: 'V',
      expected: 'Should generate position before V'
    },
    
    // Test 3: Insert at end
    {
      name: 'Insert at end',
      before: 'V',
      after: null,
      expected: 'Should generate position after V'
    },
    
    // Test 4: Insert between two items
    {
      name: 'Insert between items',
      before: 'V',
      after: 'W',
      expected: 'Should generate position between V and W'
    },
    
    // Test 5: Multiple insertions to test ordering
    {
      name: 'Sequential insertions',
      before: null,
      after: null,
      expected: 'Test multiple items maintain order'
    }
  ];
  
  const results: string[] = [];
  
  tests.forEach((test, index) => {
    if (index < 4) {
      const result = FractionalOrderingService.generatePosition(test.before, test.after);
      results.push(result);
      console.log(`✅ ${test.name}: "${result}"`);
      
      // Validate ordering
      if (test.before && result <= test.before) {
        console.error(`❌ ${test.name}: Result "${result}" should be > "${test.before}"`);
      }
      if (test.after && result >= test.after) {
        console.error(`❌ ${test.name}: Result "${result}" should be < "${test.after}"`);
      }
    }
  });
  
  // Test 5: Sequential insertions
  console.log('\n🔄 Testing sequential insertions...');
  const sequence: string[] = [];
  
  // Start with first item
  sequence.push(FractionalOrderingService.generatePosition(null, null));
  console.log(`Item 1: "${sequence[0]}"`);
  
  // Insert at beginning
  const atBeginning = FractionalOrderingService.generatePosition(null, sequence[0]);
  sequence.unshift(atBeginning);
  console.log(`Item at beginning: "${atBeginning}"`);
  
  // Insert at end
  const atEnd = FractionalOrderingService.generatePosition(sequence[sequence.length - 1], null);
  sequence.push(atEnd);
  console.log(`Item at end: "${atEnd}"`);
  
  // Insert in middle
  const inMiddle = FractionalOrderingService.generatePosition(sequence[0], sequence[1]);
  sequence.splice(1, 0, inMiddle);
  console.log(`Item in middle: "${inMiddle}"`);
  
  // Test final ordering
  const sorted = [...sequence].sort((a, b) => a.localeCompare(b));
  const isCorrectOrder = JSON.stringify(sequence) === JSON.stringify(sorted);
  
  console.log('\n📊 Final Results:');
  console.log('Generated sequence:', sequence);
  console.log('Sorted sequence:  ', sorted);
  console.log('Correct ordering: ', isCorrectOrder ? '✅ YES' : '❌ NO');
  
  // Test sequence generation for migration
  console.log('\n🔄 Testing sequence generation for migration...');
  const migrationSequence = FractionalOrderingService.generateSequence(10);
  console.log('Migration sequence:', migrationSequence);
  console.log('Migration sorted correctly:', 
    JSON.stringify(migrationSequence) === 
    JSON.stringify([...migrationSequence].sort((a, b) => a.localeCompare(b))) ? '✅ YES' : '❌ NO'
  );
  
  console.log('\n🎉 Fractional indexing test complete!');
  
  return {
    success: isCorrectOrder,
    sequence,
    migrationSequence
  };
};

// Auto-run in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // Expose to window for manual testing
  (window as any).testFractionalIndexing = testFractionalIndexing;
}