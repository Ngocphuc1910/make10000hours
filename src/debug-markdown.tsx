// Debug component to test ReactMarkdown behavior
import React from 'react';
import ReactMarkdown from 'react-markdown';

export const DebugMarkdown: React.FC = () => {
  // Sample AI response with single line breaks (exactly as it comes from the API)
  const sampleAIResponse = `🎯 **Key Insights**

**Priority Tasks**
• **Make10000hours** project needs \`2h 15m\` more work
• Calendar improvements \`66%\` complete

**Progress**
• \`20 tasks\` completed this week
• Strong productivity momentum

**Next Action**
• Focus on morning sessions`;

  // Test cases to understand the issue
  const testCases = [
    {
      name: "Single line break (\\n)",
      content: "Line 1\nLine 2\nLine 3",
      description: "Three lines with single line breaks"
    },
    {
      name: "Double line break (\\n\\n)",  
      content: "Line 1\n\nLine 2\n\nLine 3",
      description: "Three lines with double line breaks"
    },
    {
      name: "Mixed single and double",
      content: "Title\n\nParagraph 1\nContinuation of paragraph 1\n\nParagraph 2",
      description: "Mix of single and double line breaks"
    },
    {
      name: "Actual AI Response",
      content: sampleAIResponse,
      description: "Real AI response with formatting"
    }
  ];

  return (
    <div className="p-8 bg-white">
      <h1 className="text-2xl font-bold mb-6">ReactMarkdown Line Break Debug</h1>
      
      {testCases.map((test, index) => (
        <div key={index} className="mb-8 border-b pb-6">
          <h2 className="text-lg font-semibold mb-2">{test.name}</h2>
          <p className="text-sm text-gray-600 mb-4">{test.description}</p>
          
          <div className="grid grid-cols-3 gap-4">
            {/* Raw input */}
            <div>
              <h3 className="text-sm font-medium mb-2">Raw Input:</h3>
              <pre className="bg-gray-100 p-2 text-xs whitespace-pre-wrap rounded">
                {test.content}
              </pre>
            </div>
            
            {/* Default ReactMarkdown */}
            <div>
              <h3 className="text-sm font-medium mb-2">Default ReactMarkdown:</h3>
              <div className="bg-blue-50 p-2 rounded" style={{ border: '1px solid blue' }}>
                <ReactMarkdown>{test.content}</ReactMarkdown>
              </div>
              <details className="mt-2">
                <summary className="text-xs cursor-pointer">View HTML</summary>
                <pre className="bg-gray-100 p-1 text-xs mt-1 overflow-x-auto">
                  {/* This will show in dev tools */}
                </pre>
              </details>
            </div>
            
            {/* With custom paragraph component (current implementation) */}
            <div>
              <h3 className="text-sm font-medium mb-2">With Custom p Component:</h3>
              <div className="bg-green-50 p-2 rounded" style={{ border: '1px solid green' }}>
                <ReactMarkdown 
                  components={{
                    p: ({children}) => {
                      const hasOnlyWhitespace = React.Children.toArray(children).every(
                        child => typeof child === 'string' && !child.trim()
                      );
                      if (hasOnlyWhitespace) return null;
                      
                      const childArray = React.Children.toArray(children);
                      const isSimpleLine = childArray.length === 1 && typeof childArray[0] === 'string';
                      
                      return isSimpleLine ? 
                        <span className="block mb-1">{children}</span> : 
                        <p className="mb-3">{children}</p>;
                    },
                  }}
                >
                  {test.content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
          
          {/* Show what's happening */}
          <div className="mt-4 bg-yellow-50 p-3 rounded">
            <h4 className="text-sm font-medium mb-1">Analysis:</h4>
            <ul className="text-xs space-y-1">
              <li>• Lines with single \\n: {test.content.split('\n').length}</li>
              <li>• Paragraphs (split by \\n\\n): {test.content.split('\n\n').length}</li>
              <li>• Contains bullet points: {test.content.includes('•') ? 'Yes' : 'No'}</li>
              <li>• Contains bold text: {test.content.includes('**') ? 'Yes' : 'No'}</li>
            </ul>
          </div>
        </div>
      ))}
      
      {/* Diagnosis */}
      <div className="mt-8 p-4 bg-red-50 rounded">
        <h2 className="text-lg font-bold mb-2">Diagnosis:</h2>
        <p className="text-sm mb-2">
          ReactMarkdown v9 is treating every single line break (\\n) as a paragraph break by default.
          This creates a new &lt;p&gt; tag for each line, causing excessive spacing.
        </p>
        <p className="text-sm font-semibold">
          The issue: Each line like "• Calendar improvements 66% complete" becomes its own paragraph
          instead of being part of a list or continuous text.
        </p>
      </div>
    </div>
  );
};