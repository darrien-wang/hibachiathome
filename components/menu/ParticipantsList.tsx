import * as React from "react"

interface Participant {
  id: number
  name: string
  status: string
  isSelected: boolean
  proteinSelections: any
  sideSelections: any
}

interface ParticipantsListProps {
  participants: Participant[]
  setParticipants: (p: Participant[]) => void
  showAddForm: boolean
  setShowAddForm: (show: boolean) => void
  newParticipantName: string
  setNewParticipantName: (name: string) => void
  editingParticipantId: number | null
  setEditingParticipantId: (id: number | null) => void
  editingName: string
  setEditingName: (name: string) => void
  handleAddOrder: () => void
  handleAddParticipant: () => void
  handleSelectParticipant: (id: number) => void
  handleStartEditName: (id: number, name: string, e: React.MouseEvent) => void
  handleSaveName: (id: number, e: React.MouseEvent | React.KeyboardEvent) => void
  handleCancelEdit: (e: React.MouseEvent) => void
}

const ParticipantsList: React.FC<ParticipantsListProps> = ({
  participants,
  setParticipants,
  showAddForm,
  setShowAddForm,
  newParticipantName,
  setNewParticipantName,
  editingParticipantId,
  setEditingParticipantId,
  editingName,
  setEditingName,
  handleAddOrder,
  handleAddParticipant,
  handleSelectParticipant,
  handleStartEditName,
  handleSaveName,
  handleCancelEdit,
}) => {
  return (
    <div className="p-4">
      <h4 className="font-medium mb-3">Participants ({participants.length})</h4>
      {showAddForm ? (
        <div className="mb-4 border rounded-md p-3">
          <h5 className="text-sm font-medium mb-2">Add New Participant</h5>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              className="flex-1 p-2 border rounded-md text-sm min-w-[200px]"
              placeholder="Enter participant name"
              value={newParticipantName}
              onChange={(e) => setNewParticipantName(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleAddParticipant()
                } else if (e.key === "Escape") {
                  setShowAddForm(false)
                }
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddParticipant}
                className="py-2 px-3 bg-primary text-white rounded-md text-sm hover:bg-primary/90"
              >
                Add
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="py-2 px-3 border rounded-md text-sm hover:bg-gray-50 bg-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={handleAddOrder}
          className="w-full py-2 px-3 border border-dashed rounded-md text-sm flex items-center justify-center hover:bg-gray-50 mb-4 cursor-pointer active:bg-gray-100"
        >
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
            className="mr-1"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Order
        </button>
      )}

      {/* Participants List */}
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 relative">
        {participants.map((participant) => (
          <div
            key={participant.id}
            className={`border rounded-md p-3 transition-all duration-200 ${
              participant.isSelected
                ? "bg-primary/10 border-primary shadow-sm"
                : "hover:border-gray-400 hover:bg-gray-50"
            } cursor-pointer`}
            onClick={() => handleSelectParticipant(participant.id)}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center min-w-0 flex-grow">
                {editingParticipantId === participant.id ? (
                  <div className="flex items-center gap-1 mr-2 w-full">
                    <input
                      type="text"
                      className="border rounded px-1 py-0.5 text-sm flex-grow"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleSaveName(participant.id, e)
                        } else if (e.key === "Escape") {
                          handleCancelEdit(e as any)
                        }
                      }}
                    />
                    <button
                      className="text-xs py-0.5 px-1 border rounded bg-green-50 hover:bg-green-100"
                      onClick={(e) => handleSaveName(participant.id, e)}
                    >
                      ✓
                    </button>
                    <button
                      className="text-xs py-0.5 px-1 border rounded bg-gray-50 hover:bg-gray-100"
                      onClick={handleCancelEdit}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="font-medium truncate mr-2">{participant.name}</span>
                    <span
                      className={`flex-shrink-0 text-xs whitespace-nowrap ${
                        participant.status === "submitted"
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      } py-0.5 px-1.5 rounded-full`}
                    >
                      {participant.status === "submitted" ? "Submitted" : "In Progress"}
                    </span>
                  </>
                )}
              </div>
              {editingParticipantId === participant.id ? (
                // 编辑模式下不显示其他按钮
                <div></div>
              ) : (
                // 非编辑模式下显示操作按钮
                <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                  <button
                    className="text-xs py-0.5 px-1.5 border rounded hover:bg-gray-100 hidden sm:block"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSelectParticipant(participant.id)
                      handleStartEditName(participant.id, participant.name, e)
                    }}
                  >
                    Edit
                  </button>
                  <div className="relative inline-block">
                    <button
                      className="text-xs py-0.5 px-1 border rounded hover:bg-gray-100 flex items-center"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSelectParticipant(participant.id)
                        const menu = document.getElementById(`menu-${participant.id}`)
                        if (menu) {
                          menu.classList.toggle("hidden")
                        }
                      }}
                    >
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
                      >
                        <circle cx="12" cy="12" r="1"></circle>
                        <circle cx="12" cy="5" r="1"></circle>
                        <circle cx="12" cy="19" r="1"></circle>
                      </svg>
                      <span className="sm:hidden ml-1">Edit</span>
                    </button>
                    <div
                      id={`menu-${participant.id}`}
                      className="absolute right-0 mt-1 w-32 bg-white border rounded-md shadow-lg z-10 hidden"
                      style={{ maxHeight: "150px", overflowY: "auto" }}
                    >
                      <button
                        className="w-full text-left text-xs py-1.5 px-2 hover:bg-gray-100 block sm:hidden"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSelectParticipant(participant.id)
                          handleStartEditName(participant.id, participant.name, e)
                          document.getElementById(`menu-${participant.id}`)?.classList.add("hidden")
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="w-full text-left text-xs py-1.5 px-2 hover:bg-gray-100"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSelectParticipant(participant.id)
                          // 复制当前参与者的选择到新参与者
                          const selectedParticipant = participants.find((p) => p.id === participant.id)
                          if (selectedParticipant) {
                            const newId =
                              participants.length > 0
                                ? Math.max(...participants.map((p) => p.id)) + 1
                                : 1
                            const newParticipant = {
                              id: newId,
                              name: `${selectedParticipant.name} (Copy)`,
                              status: "in-progress",
                              isSelected: false,
                              proteinSelections: { ...selectedParticipant.proteinSelections },
                              sideSelections: { ...selectedParticipant.sideSelections },
                            }
                            setParticipants([...participants, newParticipant])
                            // 复制后立即开始编辑新参与者的名称
                            setTimeout(() => {
                              setEditingParticipantId(newId)
                              setEditingName(newParticipant.name)
                            }, 100)
                          }
                          document.getElementById(`menu-${participant.id}`)?.classList.add("hidden")
                        }}
                      >
                        Copy
                      </button>
                      <button
                        className="w-full text-left text-xs py-1.5 px-2 hover:bg-gray-100 text-red-600"
                        onClick={(e) => {
                          e.stopPropagation()
                          // 删除当前参与者
                          setParticipants(participants.filter((p) => p.id !== participant.id))
                          document.getElementById(`menu-${participant.id}`)?.classList.add("hidden")
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ParticipantsList 