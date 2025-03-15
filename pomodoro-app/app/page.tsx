"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Clock,
  Bell,
  Settings,
  Play,
  RotateCcw,
  Plus,
  FolderPlus,
  Twitter,
  Linkedin,
  Facebook,
  Medal,
  Flame,
  Sunrise,
  GripVertical,
} from "lucide-react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"

interface SessionItem {
  id: string
  title: string
  time: string
  duration: string
}

const SortableSessionItem = ({ session }: { session: SessionItem }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: session.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex justify-between items-center py-3 ${isDragging ? "bg-gray-50 rounded" : ""}`}
    >
      <div className="flex">
        <div className="w-1 bg-gray-900 rounded mr-3"></div>
        <div>
          <div className="font-medium">{session.title}</div>
          <div className="text-sm text-gray-500">{session.time}</div>
        </div>
      </div>
      <div className="flex items-center">
        <div className="text-gray-500 mr-3">{session.duration}</div>
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
        >
          <GripVertical className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

export default function HomePage() {
  const [time, setTime] = useState(25 * 60) // 25 minutes in seconds
  const [isActive, setIsActive] = useState(false)
  const [sessionsCompleted, setSessionsCompleted] = useState(0)
  const router = useRouter()
  const [newTaskPomodoros, setNewTaskPomodoros] = useState(1)
  const [sessions, setSessions] = useState<SessionItem[]>([
    {
      id: "1",
      title: "UI Design Research",
      time: "Completed at 10:30 AM",
      duration: "25min",
    },
    {
      id: "2",
      title: "Project Planning",
      time: "Completed at 11:00 AM",
      duration: "25min",
    },
    {
      id: "3",
      title: "Client Meeting",
      time: "Completed at 11:45 AM",
      duration: "25min",
    },
  ])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setSessions((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)

        const newItems = [...items]
        const [removed] = newItems.splice(oldIndex, 1)
        newItems.splice(newIndex, 0, removed)

        return newItems
      })
    }
  }

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (isActive && time > 0) {
      interval = setInterval(() => {
        setTime((prevTime) => prevTime - 1)
      }, 1000)
    } else if (isActive && time === 0) {
      setIsActive(false)
      setSessionsCompleted((prev) => prev + 1)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isActive, time])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const startTimer = () => {
    setIsActive(true)
  }

  const resetTimer = () => {
    setIsActive(false)
    setTime(25 * 60)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center">
            <Clock className="h-5 w-5 mr-2" />
            <span className="font-medium">PomoPro</span>
          </div>
          <div className="flex items-center gap-4">
            <Bell className="h-5 w-5 text-gray-500 cursor-pointer" />
            <Settings className="h-5 w-5 text-gray-500 cursor-pointer" />
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium">
                JD
              </div>
              <span>John Doe</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left Column */}
          <div className="md:col-span-3">
            <div className="bg-white rounded-lg shadow-sm p-5 mb-6">
              <h2 className="text-lg font-medium mb-4">Quick Actions</h2>
              <div className="space-y-3">
                <Button className="w-full bg-gray-900 hover:bg-gray-800 text-white" onClick={startTimer}>
                  <Play className="h-4 w-4 mr-2" />
                  Quick Start
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full border-gray-200">
                      <Plus className="h-4 w-4 mr-2" />
                      New Task
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-white sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Add New Task</DialogTitle>
                      <DialogDescription>Create a new task to track your progress</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <label htmlFor="title" className="text-sm font-medium">
                          Task Name
                        </label>
                        <Input id="title" placeholder="What are you working on?" />
                      </div>

                      <div className="grid gap-2">
                        <label htmlFor="description" className="text-sm font-medium">
                          Description (Optional)
                        </label>
                        <Textarea
                          id="description"
                          placeholder="Add notes or details about this task"
                          className="min-h-[80px]"
                        />
                      </div>

                      <div className="grid gap-2">
                        <label htmlFor="project" className="text-sm font-medium">
                          Project
                        </label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a project" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Project</SelectItem>
                            <SelectItem value="work">Work</SelectItem>
                            <SelectItem value="study">Study</SelectItem>
                            <SelectItem value="personal">Personal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <label htmlFor="priority" className="text-sm font-medium">
                          Priority
                        </label>
                        <Select defaultValue="medium">
                          <SelectTrigger>
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <label className="text-sm font-medium">Estimated Pomodoros</label>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="border-gray-200"
                            onClick={() => setNewTaskPomodoros(Math.max(1, newTaskPomodoros - 1))}
                          >
                            -
                          </Button>
                          <div className="flex items-center gap-2 px-4 py-2 rounded-md border border-gray-200">
                            <Clock className="h-4 w-4 text-gray-500" />
                            <span>{newTaskPomodoros}</span>
                          </div>
                          <Button
                            variant="outline"
                            size="icon"
                            className="border-gray-200"
                            onClick={() => setNewTaskPomodoros(newTaskPomodoros + 1)}
                          >
                            +
                          </Button>
                          <span className="text-gray-500 text-sm ml-2">Est. {newTaskPomodoros * 25} min</span>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button className="bg-gray-900 hover:bg-gray-800 text-white">Add Task</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Button
                  variant="outline"
                  className="w-full border-gray-200"
                  onClick={() => router.push("/projects/new")}
                >
                  <FolderPlus className="h-4 w-4 mr-2" />
                  New Project
                </Button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-5">
              <h2 className="text-lg font-medium mb-4">Projects</h2>
              <div className="space-y-4">
                {[
                  { name: "Work", hours: "12h" },
                  { name: "Study", hours: "8h" },
                  { name: "Personal", hours: "4h" },
                ].map((project) => (
                  <div
                    key={project.name}
                    className="flex justify-between items-center py-2 cursor-pointer hover:bg-gray-50 px-2 rounded"
                  >
                    <span>{project.name}</span>
                    <span className="text-gray-500 text-sm">{project.hours}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Middle Column */}
          <div className="md:col-span-6">
            <div className="bg-white rounded-lg shadow-sm p-8 mb-6 flex flex-col items-center">
              <div className="text-7xl font-light mb-8 tabular-nums">{formatTime(time)}</div>
              <div className="flex gap-3">
                <Button
                  className="bg-gray-900 hover:bg-gray-800 text-white px-8"
                  onClick={startTimer}
                  disabled={isActive}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start
                </Button>
                <Button variant="outline" className="border-gray-200" onClick={resetTimer}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
              </div>
            </div>

            <div className="bg-gray-100 rounded-lg p-4 mb-6">
              <div className="flex justify-between mb-1">
                <div>
                  <div className="text-sm text-gray-500">Current Task</div>
                  <div className="font-medium">Complete UI Design</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Project</div>
                  <div className="font-medium">Work</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-5">
              <h2 className="text-lg font-medium mb-4">Today's Sessions</h2>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
                modifiers={[restrictToVerticalAxis]}
              >
                <SortableContext items={sessions.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-3 divide-y divide-gray-100">
                    {sessions.map((session) => (
                      <SortableSessionItem key={session.id} session={session} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          </div>

          {/* Right Column */}
          <div className="md:col-span-3">
            <div className="bg-white rounded-lg shadow-sm p-5 mb-6">
              <h2 className="text-lg font-medium mb-3">Progress to 10,000 Hours</h2>
              <Progress value={25} className="h-2 mb-2" />
              <div className="flex justify-between text-sm text-gray-500">
                <span>2,500 hours</span>
                <span>10,000 hours</span>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-5 mb-6">
              <h2 className="text-lg font-medium mb-4">Achievements</h2>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="h-12 w-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-1">
                    <Medal className="h-6 w-6 text-gray-700" />
                  </div>
                  <div className="text-xs font-medium">First Mile</div>
                </div>
                <div>
                  <div className="h-12 w-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-1">
                    <Flame className="h-6 w-6 text-gray-700" />
                  </div>
                  <div className="text-xs font-medium">7 Day Streak</div>
                </div>
                <div>
                  <div className="h-12 w-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-1">
                    <Sunrise className="h-6 w-6 text-gray-700" />
                  </div>
                  <div className="text-xs font-medium">Early Bird</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-5">
              <h2 className="text-lg font-medium mb-4">Share Progress</h2>
              <div className="flex justify-center gap-6">
                <Twitter className="h-6 w-6 text-gray-700 cursor-pointer hover:text-blue-400" />
                <Linkedin className="h-6 w-6 text-gray-700 cursor-pointer hover:text-blue-600" />
                <Facebook className="h-6 w-6 text-gray-700 cursor-pointer hover:text-blue-800" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

