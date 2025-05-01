"use client"
import type React from "react"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

interface GroupOrderParticipant {
  id: number
  name: string
  status: "pending" | "completed"
  isHost?: boolean
  isProxySelection?: boolean
}

interface GroupOrderChat {
  id: number
  name: string
  message: string
  time: string
}

interface GroupOrderModalProps {
  isOpen: boolean
  onClose: () => void
  maxParticipants: number
  setMaxParticipants: (value: number) => void
  groupOrderParticipants: GroupOrderParticipant[]
  groupOrderChat: GroupOrderChat[]
  newChatMessage: string
  setNewChatMessage: (value: string) => void
  hostPaysAll: boolean
  setHostPaysAll: (value: boolean) => void
  onSendChatMessage: () => void
}

function ModalBody({ children }: { children: React.ReactNode }) {
  return <div className="p-6">{children}</div>
}

export default function GroupOrderModal({
  isOpen,
  onClose,
  maxParticipants,
  setMaxParticipants,
  groupOrderParticipants,
  groupOrderChat,
  newChatMessage,
  setNewChatMessage,
  hostPaysAll,
  setHostPaysAll,
  onSendChatMessage,
}: GroupOrderModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Start a Group Order</DialogTitle>
        </DialogHeader>
        <ModalBody>
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Maximum Participants</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    value={maxParticipants}
                    onChange={(e) => setMaxParticipants(Number(e.target.value))}
                    className="w-24"
                  />
                  <span className="text-sm text-gray-500">people</span>
                </div>
              </div>

              <div className="flex flex-col gap-2 items-end">
                <Button variant="outline" size="sm" className="flex items-center gap-1">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="lucide lucide-copy"
                  >
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                    <path d="M4 16c0-1.1.9-2 2-2h2" />
                    <path d="M4 12c0-1.1.9-2 2-2h2" />
                    <path d="M4 8c0-1.1.9-2 2-2h2" />
                  </svg>
                  Copy invite link
                </Button>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-green-100 text-green-700">
                    <span className="sr-only">Share via WhatsApp</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="lucide lucide-message-circle"
                    >
                      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
                    </svg>
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-blue-100 text-blue-700">
                    <span className="sr-only">Share via WeChat</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="lucide lucide-message-square"
                    >
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-gray-100 text-gray-700">
                    <span className="sr-only">Share via SMS</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="lucide lucide-smartphone"
                    >
                      <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
                      <path d="M12 18h.01" />
                    </svg>
                  </Button>
                </div>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium text-gray-700">Participants</label>
                <Button variant="outline" size="sm" className="h-8 text-xs">
                  <span className="mr-1">+</span> Add Member
                </Button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {groupOrderParticipants.map((participant) => (
                  <div
                    key={participant.id}
                    className={`border rounded-lg p-3 ${
                      participant.isProxySelection ? "bg-secondary/5 border-secondary/20" : "bg-background"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{participant.name}</span>
                        {participant.isHost && (
                          <Badge variant="outline" className="text-xs px-1 h-5">
                            Host
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {participant.isProxySelection ? (
                          <Badge className="bg-blue-100 text-blue-800 text-xs px-2">
                            <span className="mr-1">🤝</span> Proxy-select
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs px-2">
                            Self-select
                          </Badge>
                        )}

                        {!participant.isHost && (
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-full">
                            <span className="sr-only">Toggle selection mode</span>
                            {participant.isProxySelection ? "👤" : "🤝"}
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-gray-500 flex justify-between items-center">
                      {participant.isProxySelection ? (
                        <>
                          <p>
                            This member has no device, selections managed by{" "}
                            {groupOrderParticipants.find((p) => p.isHost)?.name}
                          </p>
                          <Button variant="outline" size="sm" className="h-7 text-xs">
                            Edit Selections
                          </Button>
                        </>
                      ) : (
                        <>
                          <p>
                            {participant.status === "completed" ? (
                              <span className="flex items-center">
                                Selections completed <span className="text-green-500 ml-1">✓</span>
                              </span>
                            ) : (
                              <span className="flex items-center">
                                Pending selection{" "}
                                <Badge variant="outline" className="ml-1 h-4 text-[10px]">
                                  Pending
                                </Badge>
                              </span>
                            )}
                          </p>
                          {participant.status !== "completed" && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-600">
                              Remind
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Order Summary</span>
                  <div className="flex items-center">
                    <span className="text-xs text-gray-500 mr-2">Host covers all</span>
                    <div
                      className="relative inline-flex h-4 w-8 items-center rounded-full bg-gray-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer"
                      role="checkbox"
                      aria-checked={hostPaysAll}
                      onClick={() => setHostPaysAll(!hostPaysAll)}
                    >
                      <span
                        className={`${hostPaysAll ? "translate-x-4 bg-primary" : "translate-x-0 bg-white"} pointer-events-none block h-3 w-3 rounded-full shadow-lg ring-0 transition-transform`}
                      ></span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 p-0 ml-1"
                      title="When enabled, the host will pay for all participants"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="lucide lucide-help-circle"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                        <path d="M12 17h.01" />
                      </svg>
                    </Button>
                  </div>
                </div>

                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Self-select members (3)</span>
                    <span>$180.00</span>
                  </div>
                  <div className="flex justify-between text-blue-700">
                    <span className="flex items-center">
                      <span className="mr-1">🤝</span> Proxy-select members (2)
                    </span>
                    <span>$120.00</span>
                  </div>
                  <div className="border-t pt-1 mt-1 font-medium flex justify-between">
                    <span>Total</span>
                    <span>$300.00</span>
                  </div>
                  <div className="text-xs text-gray-500 flex justify-between">
                    <span>Per person average</span>
                    <span>$60.00</span>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-2 text-xs flex items-center justify-center gap-1 text-gray-600"
                >
                  Show detailed breakdown
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="lucide lucide-chevron-down"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </Button>
              </div>
            </div>

            <div className="mt-2">
              <details className="group">
                <summary className="flex cursor-pointer items-center justify-between rounded-lg bg-gray-50 p-2 text-sm font-medium">
                  <span>Group Chat</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="lucide lucide-chevron-down group-open:rotate-180 transition-transform"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </summary>
                <div className="mt-2">
                  <div className="h-48 overflow-y-auto border rounded-lg p-3 bg-gray-50 mb-2">
                    {groupOrderChat.map((chat) => (
                      <div key={chat.id} className="mb-2">
                        <div className="flex items-baseline">
                          <span className="font-medium text-sm">{chat.name}</span>
                          <span className="text-xs text-gray-500 ml-2">{chat.time}</span>
                        </div>
                        <p className="text-sm">{chat.message}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type your message..."
                      value={newChatMessage}
                      onChange={(e) => setNewChatMessage(e.target.value)}
                      className="flex-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          onSendChatMessage()
                        }
                      }}
                    />
                    <Button onClick={onSendChatMessage}>Send</Button>
                  </div>
                </div>
              </details>
            </div>
          </div>
        </ModalBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onClose}>Send Invites</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
