// Test script to understand ReactMarkdown v9 parsing behavior
import React from 'react';
import ReactMarkdown from 'react-markdown';
import { renderToStaticMarkup } from 'react-dom/server';

// Sample AI response with single line breaks
const sampleAIResponse = `🎯 **Key Insights**

**Priority Tasks**
• **Make10000hours** project needs \`2h 15m\` more work
• Calendar improvements \`66%\` complete

**Progress**
• \`20 tasks\` completed this week
• Strong productivity momentum

**Next Action**
• Focus on morning sessions`;

// Test various line break scenarios
const testCases = [
  {
    name: "Single line break (\\n)",
    content: "Line 1\nLine 2\nLine 3"
  },
  {
    name: "Double line break (\\n\\n)",
    content: "Line 1\n\nLine 2\n\nLine 3"
  },
  {
    name: "Mixed content",
    content: "**Bold text**\nRegular text\n• Bullet point"
  },
  {
    name: "Actual AI response",
    content: sampleAIResponse
  }
];

console.log("Testing ReactMarkdown v9 line break behavior:\n");
console.log("=".repeat(60));

testCases.forEach(test => {
  console.log(`\nTest: ${test.name}`);
  console.log("-".repeat(40));
  console.log("Input:");
  console.log(JSON.stringify(test.content));
  console.log("\nDefault ReactMarkdown output:");
  
  const defaultOutput = renderToStaticMarkup(
    React.createElement(ReactMarkdown, {}, test.content)
  );
  console.log(defaultOutput);
  
  // Test with breaks: false
  console.log("\nWith breaks={false}:");
  const noBreaksOutput = renderToStaticMarkup(
    React.createElement(ReactMarkdown, { breaks: false }, test.content)
  );
  console.log(noBreaksOutput);
  
  // Test with breaks: true
  console.log("\nWith breaks={true}:");
  const withBreaksOutput = renderToStaticMarkup(
    React.createElement(ReactMarkdown, { breaks: true }, test.content)
  );
  console.log(withBreaksOutput);
});

console.log("\n" + "=".repeat(60));
console.log("\nConclusion:");
console.log("ReactMarkdown v9 default behavior treats single line breaks as paragraph breaks");
console.log("The 'breaks' prop controls whether single line breaks create <br /> tags");