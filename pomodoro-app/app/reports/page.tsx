"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Calendar, Clock, BarChart2, PieChart } from "lucide-react"
import { useRouter } from "next/navigation"

export default function ReportsPage() {
  const router = useRouter()
  const [dateRange, setDateRange] = useState("week")

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

        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-medium">Reports & Analytics</h1>

            <div className="flex items-center gap-2">
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="year">This Year</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" size="icon" className="border-gray-200">
                <Calendar className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-gray-500 text-sm">Total Focus Time</div>
              <div className="text-2xl font-medium mt-1 flex items-center">42h 15m</div>
              <div className="text-green-500 text-sm mt-1">+12% from last {dateRange}</div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-gray-500 text-sm">Completed Pomodoros</div>
              <div className="text-2xl font-medium mt-1">87</div>
              <div className="text-green-500 text-sm mt-1">+8% from last {dateRange}</div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-gray-500 text-sm">Completed Tasks</div>
              <div className="text-2xl font-medium mt-1">23</div>
              <div className="text-green-500 text-sm mt-1">+15% from last {dateRange}</div>
            </div>
          </div>

          <Tabs defaultValue="time">
            <TabsList className="mb-6">
              <TabsTrigger value="time" className="data-[state=active]:bg-gray-100">
                <BarChart2 className="mr-2 h-4 w-4" />
                Time Distribution
              </TabsTrigger>
              <TabsTrigger value="projects" className="data-[state=active]:bg-gray-100">
                <PieChart className="mr-2 h-4 w-4" />
                Projects
              </TabsTrigger>
            </TabsList>

            <TabsContent value="time" className="space-y-4">
              <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <BarChart2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Time distribution chart would appear here</p>
                  <p className="text-sm">
                    Showing data for:{" "}
                    {dateRange === "day"
                      ? "Today"
                      : dateRange === "week"
                        ? "This Week"
                        : dateRange === "month"
                          ? "This Month"
                          : "This Year"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-gray-500 text-sm">Daily Average</div>
                  <div className="text-2xl font-medium mt-1">3h 45m</div>
                  <div className="text-gray-500 text-sm mt-1">Across 6 active days</div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-gray-500 text-sm">Most Productive Time</div>
                  <div className="text-2xl font-medium mt-1">9:00 AM - 11:00 AM</div>
                  <div className="text-gray-500 text-sm mt-1">Based on completed pomodoros</div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="projects" className="space-y-4">
              <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <PieChart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Project distribution chart would appear here</p>
                  <p className="text-sm">
                    Showing data for:{" "}
                    {dateRange === "day"
                      ? "Today"
                      : dateRange === "week"
                        ? "This Week"
                        : dateRange === "month"
                          ? "This Month"
                          : "This Year"}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-medium">Top Projects</h3>

                <div className="space-y-3">
                  {[
                    { name: "Work", time: "12h 30m", percentage: 30 },
                    { name: "Study", time: "8h 45m", percentage: 20 },
                    { name: "Personal", time: "6h 15m", percentage: 15 },
                  ].map((project) => (
                    <div key={project.name} className="flex items-center">
                      <div className="w-1/2">
                        <div className="font-medium">{project.name}</div>
                        <div className="text-sm text-gray-500">{project.time}</div>
                      </div>
                      <div className="w-1/2">
                        <div className="h-2 bg-gray-200 rounded-full">
                          <div className="h-2 bg-gray-900 rounded-full" style={{ width: `${project.percentage}%` }} />
                        </div>
                        <div className="text-right text-sm text-gray-500 mt-1">{project.percentage}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

