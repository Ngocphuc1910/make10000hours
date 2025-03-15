"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Bell, Clock, Volume2, Smartphone, Moon, Palette, Sun } from "lucide-react"
import { useRouter } from "next/navigation"

export default function SettingsPage() {
  const router = useRouter()
  const [pomodoroMinutes, setPomodoroMinutes] = useState(25)
  const [shortBreakMinutes, setShortBreakMinutes] = useState(5)
  const [longBreakMinutes, setLongBreakMinutes] = useState(15)

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-600 to-teal-700 dark:from-teal-900 dark:to-teal-950">
      <div className="container mx-auto p-4">
        <Button variant="ghost" className="text-white mb-6" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <Card className="max-w-3xl mx-auto bg-white/10 dark:bg-slate-800/50 backdrop-blur-sm border-none text-white">
          <CardHeader>
            <CardTitle className="text-2xl">Settings</CardTitle>
            <CardDescription className="text-white/70">Customize your Pomodoro experience</CardDescription>
          </CardHeader>

          <CardContent>
            <Tabs defaultValue="timer">
              <TabsList className="bg-white/10 dark:bg-slate-700/50 mb-6">
                <TabsTrigger value="timer" className="data-[state=active]:bg-white/20 text-white">
                  <Clock className="mr-2 h-4 w-4" />
                  Timer
                </TabsTrigger>
                <TabsTrigger value="notifications" className="data-[state=active]:bg-white/20 text-white">
                  <Bell className="mr-2 h-4 w-4" />
                  Notifications
                </TabsTrigger>
                <TabsTrigger value="appearance" className="data-[state=active]:bg-white/20 text-white">
                  <Palette className="mr-2 h-4 w-4" />
                  Appearance
                </TabsTrigger>
              </TabsList>

              <TabsContent value="timer" className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Time Settings (minutes)</h3>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="pomodoro">Pomodoro</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="pomodoro"
                          type="number"
                          min="1"
                          max="60"
                          value={pomodoroMinutes}
                          onChange={(e) => setPomodoroMinutes(Number.parseInt(e.target.value))}
                          className="bg-white/10 border-white/20 text-white"
                        />
                        <span>min</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="shortBreak">Short Break</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="shortBreak"
                          type="number"
                          min="1"
                          max="30"
                          value={shortBreakMinutes}
                          onChange={(e) => setShortBreakMinutes(Number.parseInt(e.target.value))}
                          className="bg-white/10 border-white/20 text-white"
                        />
                        <span>min</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="longBreak">Long Break</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="longBreak"
                          type="number"
                          min="1"
                          max="60"
                          value={longBreakMinutes}
                          onChange={(e) => setLongBreakMinutes(Number.parseInt(e.target.value))}
                          className="bg-white/10 border-white/20 text-white"
                        />
                        <span>min</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Long Break Interval</Label>
                    <Select defaultValue="4">
                      <SelectTrigger className="bg-white/10 border-white/20 text-white w-full md:w-1/3">
                        <SelectValue placeholder="Select interval" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">Every 2 Pomodoros</SelectItem>
                        <SelectItem value="3">Every 3 Pomodoros</SelectItem>
                        <SelectItem value="4">Every 4 Pomodoros</SelectItem>
                        <SelectItem value="5">Every 5 Pomodoros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="autoStartBreaks">Auto-start Breaks</Label>
                      <p className="text-sm text-white/70">Automatically start breaks when a Pomodoro ends</p>
                    </div>
                    <Switch id="autoStartBreaks" />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="autoStartPomodoros">Auto-start Pomodoros</Label>
                      <p className="text-sm text-white/70">Automatically start Pomodoros when a break ends</p>
                    </div>
                    <Switch id="autoStartPomodoros" />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="notifications" className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Sound & Notifications</h3>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="alarmSound">Alarm Sound</Label>
                      <p className="text-sm text-white/70">Sound played when timer ends</p>
                    </div>
                    <Select defaultValue="bell">
                      <SelectTrigger className="bg-white/10 border-white/20 text-white w-[180px]">
                        <SelectValue placeholder="Select sound" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bell">Bell</SelectItem>
                        <SelectItem value="digital">Digital</SelectItem>
                        <SelectItem value="kitchen">Kitchen Timer</SelectItem>
                        <SelectItem value="wood">Wood Block</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="volume">Volume</Label>
                      <div className="flex items-center gap-2">
                        <Volume2 className="h-4 w-4" />
                        <span className="w-12 text-right">80%</span>
                      </div>
                    </div>
                    <Slider
                      defaultValue={[80]}
                      max={100}
                      step={1}
                      className="[&>span:first-child]:bg-white/30 [&>span:first-child_span]:bg-white"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="desktopNotifications">Desktop Notifications</Label>
                      <p className="text-sm text-white/70">Show notifications on your desktop</p>
                    </div>
                    <Switch id="desktopNotifications" defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="vibration">Vibration</Label>
                      <p className="text-sm text-white/70">Vibrate on mobile devices</p>
                    </div>
                    <Switch id="vibration" defaultChecked />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="appearance" className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Theme & Display</h3>

                  <div className="space-y-2">
                    <Label>Color Theme</Label>
                    <div className="grid grid-cols-5 gap-2">
                      {["#00b894", "#0984e3", "#6c5ce7", "#d63031", "#fdcb6e"].map((color) => (
                        <div
                          key={color}
                          className="h-10 rounded-md cursor-pointer ring-offset-2 ring-offset-black/10 hover:ring-2 ring-white"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Dark Mode</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <Button variant="outline" className="justify-start bg-white/10 border-white/20 text-white">
                        <Sun className="mr-2 h-4 w-4" />
                        Light
                      </Button>
                      <Button variant="outline" className="justify-start bg-white/10 border-white/20 text-white">
                        <Moon className="mr-2 h-4 w-4" />
                        Dark
                      </Button>
                      <Button variant="outline" className="justify-start bg-white/10 border-white/20 text-white">
                        <Smartphone className="mr-2 h-4 w-4" />
                        System
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="compactMode">Compact Mode</Label>
                      <p className="text-sm text-white/70">Use a more compact layout</p>
                    </div>
                    <Switch id="compactMode" />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="showSeconds">Show Seconds</Label>
                      <p className="text-sm text-white/70">Display seconds in the timer</p>
                    </div>
                    <Switch id="showSeconds" defaultChecked />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end mt-8">
              <Button className="bg-white text-teal-700 hover:bg-white/90" onClick={() => router.back()}>
                Save Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

