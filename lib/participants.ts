import type React from "react"
// 参与者相关操作函数迁移自 package-selection.tsx

export function handleAddOrder(setShowAddForm: (show: boolean) => void, setNewParticipantName: (name: string) => void) {
  setShowAddForm(true)
  setNewParticipantName("")
}

export function handleAddParticipant({
  newParticipantName,
  participants,
  setParticipants,
  setShowAddForm,
  setNewParticipantName,
  setProteinSelections,
  setSideSelections,
  initialProteinSelections,
  initialSideSelections,
}: {
  newParticipantName: string
  participants: any[]
  setParticipants: (p: any[]) => void
  setShowAddForm: (show: boolean) => void
  setNewParticipantName: (name: string) => void
  setProteinSelections: (s: any) => void
  setSideSelections: (s: any) => void
  initialProteinSelections: () => any
  initialSideSelections: () => any
}) {
  if (newParticipantName.trim()) {
    const newId = participants.length > 0 ? Math.max(...participants.map((p: any) => p.id)) + 1 : 1
    const newParticipant = {
      id: newId,
      name: newParticipantName.trim(),
      status: "in-progress",
      isSelected: false,
      proteinSelections: initialProteinSelections(),
      sideSelections: initialSideSelections(),
    }
    // 取消选择所有其他参与者
    const updatedParticipants = participants.map((p: any) => ({ ...p, isSelected: false }))
    // 添加新参与者并设为选中状态
    setParticipants([...updatedParticipants, { ...newParticipant, isSelected: true }])
    setShowAddForm(false)
    setNewParticipantName("")
    // 更新当前选择状态为新参与者的状态
    setProteinSelections(initialProteinSelections())
    setSideSelections(initialSideSelections())
  }
}

export function handleSelectParticipant({
  id,
  participants,
  setParticipants,
  setProteinSelections,
  setSideSelections,
  initialProteinSelections,
  initialSideSelections,
}: {
  id: number
  participants: any[]
  setParticipants: (p: any[]) => void
  setProteinSelections: (s: any) => void
  setSideSelections: (s: any) => void
  initialProteinSelections: () => any
  initialSideSelections: () => any
}) {
  const selectedParticipant = participants.find((p: any) => p.id === id)
  if (selectedParticipant) {
    setProteinSelections(selectedParticipant.proteinSelections || initialProteinSelections())
    setSideSelections(selectedParticipant.sideSelections || initialSideSelections())
  }
  setParticipants(participants.map((p: any) => ({ ...p, isSelected: p.id === id })))
}

export function handleStartEditName({
  id,
  name,
  e,
  handleSelectParticipant,
  setEditingParticipantId,
  setEditingName,
}: {
  id: number
  name: string
  e: React.MouseEvent
  handleSelectParticipant: (id: number) => void
  setEditingParticipantId: (id: number | null) => void
  setEditingName: (name: string) => void
}) {
  e.stopPropagation()
  handleSelectParticipant(id)
  // 确保所有菜单都关闭
  const menus = document.querySelectorAll('[id^="menu-"]')
  menus.forEach((menu) => {
    menu.classList.add("hidden")
  })
  setEditingParticipantId(id)
  setEditingName(name)
}

export function handleSaveName({
  id,
  editingName,
  participants,
  setParticipants,
  setEditingParticipantId,
  e,
}: {
  id: number
  editingName: string
  participants: any[]
  setParticipants: (p: any[]) => void
  setEditingParticipantId: (id: number | null) => void
  e: React.MouseEvent | React.KeyboardEvent
}) {
  e.stopPropagation()
  if (editingName.trim()) {
    setParticipants(participants.map((p: any) => (p.id === id ? { ...p, name: editingName.trim() } : p)))
  }
  setEditingParticipantId(null)
}

export function handleCancelEdit(setEditingParticipantId: (id: number | null) => void, e: React.MouseEvent) {
  e.stopPropagation()
  setEditingParticipantId(null)
}
