"use client"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ArrowLeft, Clock, Medal, Flame, Sunrise, Trophy, Award } from "lucide-react"
import { useRouter } from "next/navigation"

export default function AchievementsPage() {
  const router = useRouter()

  const achievements = [
    {
      id: "first-pomodoro",
      title: "First Mile",
      description: "Complete your first hour of focused work",
      icon: <Medal className="h-6 w-6" />,
      completed: true,
      date: "Mar 10, 2023",
    },
    {
      id: "streak",
      title: "7 Day Streak",
      description: "Use the app for 7 consecutive days",
      icon: <Flame className="h-6 w-6" />,
      completed: true,
      date: "Mar 15, 2023",
    },
    {
      id: "early-bird",
      title: "Early Bird",
      description: "Complete 5 Pomodoros before 10 AM",
      icon: <Sunrise className="h-6 w-6" />,
      completed: true,
      date: "Mar 18, 2023",
    },
    {
      id: "focus-master",
      title: "Focus Master",
      description: "Complete 10 Pomodoros in a single day",
      icon: <Trophy className="h-6 w-6" />,
      completed: false,
      progress: 70,
    },
  ]

  const milestones = [
    {
      id: "100-pomodoros",
      title: "100 Pomodoros",
      description: "Complete 100 Pomodoro sessions",
      icon: <Award className="h-6 w-6" />,
      progress: 87,
      total: 100,
    },
    {
      id: "50-hours",
      title: "50 Hours of Focus",
      description: "Accumulate 50 hours of focus time",
      icon: <Clock className="h-6 w-6" />,
      progress: 42,
      total: 50,
    },
    {
      id: "master-journey",
      title: "Master's Journey",
      description: "On your way to 10,000 hours of mastery",
      icon: <Trophy className="h-6 w-6" />,
      progress: 2500,
      total: 10000,
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center">
            <Clock className="h-5 w-5 mr-2" />
            <span className="font-medium">PomoPro</span>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" className="mb-6 flex items-center text-gray-600" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-medium mb-6">Achievements & Milestones</h1>

          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-medium mb-4">Achievements</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {achievements.map((achievement) => (
                <div
                  key={achievement.id}
                  className={`bg-gray-50 rounded-lg p-4 ${achievement.completed ? "border-l-4 border-l-gray-900" : ""}`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-full ${achievement.completed ? "bg-gray-200" : "bg-gray-100"}`}>
                      {achievement.icon}
                    </div>

                    <div className="flex-1">
                      <h3 className="text-lg font-medium">{achievement.title}</h3>
                      <p className="text-gray-500 text-sm">{achievement.description}</p>

                      {achievement.completed ? (
                        <div className="mt-2 text-sm text-gray-600">Completed on {achievement.date}</div>
                      ) : (
                        <div className="mt-2 space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>Progress</span>
                            <span>{achievement.progress}%</span>
                          </div>
                          <Progress value={achievement.progress} className="h-2" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-medium mb-4">Milestones</h2>
            <div className="space-y-6">
              {milestones.map((milestone) => (
                <div key={milestone.id} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 rounded-full bg-gray-200">{milestone.icon}</div>

                    <div>
                      <h3 className="text-lg font-medium">{milestone.title}</h3>
                      <p className="text-gray-500 text-sm">{milestone.description}</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>
                        {milestone.progress} / {milestone.total} {milestone.id === "master-journey" ? "hours" : ""}
                      </span>
                      <span>{Math.round((milestone.progress / milestone.total) * 100)}%</span>
                    </div>
                    <Progress value={(milestone.progress / milestone.total) * 100} className="h-2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

