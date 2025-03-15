"use client"

import { useState } from "react"
import { Check, MoreVertical, Clock, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"

interface Task {
  id: string
  title: string
  completed: boolean
  estimatedPomodoros: number
  completedPomodoros: number
  priority: "low" | "medium" | "high"
  tags: string[]
  project?: string
}

interface TaskListProps {
  onTaskSelect: (taskTitle: string) => void
  currentTask: string | null
}

export default function TaskList({ onTaskSelect, currentTask }: TaskListProps) {
  // Sample tasks data
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: "1",
      title: "Read the rest of Do things that dont scale",
      completed: false,
      estimatedPomodoros: 1,
      completedPomodoros: 1,
      priority: "medium",
      tags: ["reading"],
    },
    {
      id: "2",
      title: "Organize the plan",
      completed: false,
      estimatedPomodoros: 3,
      completedPomodoros: 8,
      priority: "high",
      tags: ["planning"],
      project: "Product Launch",
    },
    {
      id: "3",
      title: "Learn how people use AI coder to code thing up",
      completed: false,
      estimatedPomodoros: 3,
      completedPomodoros: 0,
      priority: "low",
      tags: ["learning", "AI"],
    },
  ])

  const toggleTaskCompletion = (taskId: string) => {
    setTasks(tasks.map((task) => (task.id === taskId ? { ...task, completed: !task.completed } : task)))
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "text-red-500"
      case "medium":
        return "text-yellow-500"
      case "low":
        return "text-green-500"
      default:
        return ""
    }
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <div
          key={task.id}
          className={`bg-white/10 dark:bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 transition-all ${
            currentTask === task.title ? "border-l-4 border-white" : ""
          }`}
        >
          <div className="flex items-start gap-3">
            <Button
              variant="ghost"
              size="icon"
              className={`rounded-full h-6 w-6 p-1 ${
                task.completed ? "bg-teal-500 text-white hover:bg-teal-600" : "bg-white/20 text-white hover:bg-white/30"
              }`}
              onClick={() => toggleTaskCompletion(task.id)}
            >
              {task.completed && <Check className="h-4 w-4" />}
            </Button>

            <div className="flex-1">
              <div
                className="text-white font-medium cursor-pointer hover:underline"
                onClick={() => onTaskSelect(task.title)}
              >
                {task.title}
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-2 text-white/70 text-sm">
                <div className="flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  <span>
                    {task.completedPomodoros}/{task.estimatedPomodoros}
                  </span>
                </div>

                {task.project && (
                  <Badge variant="outline" className="text-xs border-white/30 text-white/70">
                    {task.project}
                  </Badge>
                )}

                {task.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs bg-white/10 hover:bg-white/20 text-white/70">
                    #{tag}
                  </Badge>
                ))}

                <AlertCircle className={`h-3 w-3 ${getPriorityColor(task.priority)}`} />
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-white/70 hover:bg-white/10 h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-white/90 dark:bg-slate-800">
                <DropdownMenuItem>Edit</DropdownMenuItem>
                <DropdownMenuItem>Duplicate</DropdownMenuItem>
                <DropdownMenuItem className="text-red-500">Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ))}
    </div>
  )
}

