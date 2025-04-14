import React from 'react';

/**
 * Debug component to visualize task layout structure
 */
const TaskItemDebug = () => {
  return (
    <div className="p-6 bg-gray-900 text-white">
      <h1 className="text-xl font-bold mb-4">Task Item Layout Debug</h1>
      
      <div className="border border-dashed border-white/30 p-2 rounded-md mb-4">
        <h2 className="text-sm text-white/50 mb-2">Wireframe Structure</h2>
        <pre className="text-xs font-mono bg-black/30 p-2 rounded">
{`┌─────────────────────────────────────────────────────────────┐
│ TASK ITEM                                                    │
│ ┌─────┐                                                      │
│ │  ○  │  ┌────────────────────────────────────────────────┐ │
│ └─────┘  │ Task Title                                     │ │
│           └────────────────────────────────────────────────┘ │
│           ┌────────────────────────────────────────────────┐ │
│           │ Description text (if available)                │ │
│           └────────────────────────────────────────────────┘ │
│           ┌────────────────────────────────────────────────┐ │
│           │ ⏱️ 0/1 pomodoros                 [Project Tag] │ │
│           └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘`}
        </pre>
      </div>
      
      <div className="border border-white/30 mb-4 rounded-md">
        <div className="bg-blue-800/20 p-2">
          <div className="flex items-start gap-2">
            <div className="bg-red-500/20 p-1 rounded">
              {/* Checkbox */}
              <div className="w-6 h-6 rounded-full border-2 border-white/50"></div>
            </div>
            
            <div className="flex-1 bg-green-500/20 p-1 rounded">
              {/* Content */}
              <div className="bg-yellow-500/20 p-1 rounded mb-2">
                <div className="font-medium">Task Title</div>
              </div>
              
              <div className="bg-purple-500/20 p-1 rounded mb-2">
                <div className="text-sm">This is the task description area</div>
              </div>
              
              <div className="bg-pink-500/20 p-1 rounded flex justify-between">
                <div className="text-xs">⏱️ 0/1 pomodoros</div>
                <div className="text-xs bg-cyan-500/40 px-2 py-0.5 rounded">Project</div>
              </div>
            </div>
            
            <div className="bg-orange-500/20 p-1 rounded">
              {/* Actions */}
              <div className="flex flex-col gap-1">
                <div className="w-5 h-5 rounded bg-white/20"></div>
                <div className="w-5 h-5 rounded bg-white/20"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="border border-white/30 p-2 rounded-md">
        <h2 className="text-sm text-white/50 mb-2">Color Legend</h2>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-800/20"></div>
            <span>Task container</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-500/20"></div>
            <span>Checkbox area</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500/20"></div>
            <span>Content container</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-yellow-500/20"></div>
            <span>Title area</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-purple-500/20"></div>
            <span>Description area</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-pink-500/20"></div>
            <span>Metadata row</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-cyan-500/40"></div>
            <span>Project tag</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-orange-500/20"></div>
            <span>Actions area</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskItemDebug; 