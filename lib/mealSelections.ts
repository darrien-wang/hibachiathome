// 蛋白质和配菜选择相关操作函数迁移自 package-selection.tsx

export function handleProteinChange({
  protein,
  isChecked,
  proteinSelections,
  setProteinSelections,
  participants,
  setParticipants,
  sideSelections,
}: {
  protein: string
  isChecked: boolean
  proteinSelections: any
  setProteinSelections: (s: any) => void
  participants: any[]
  setParticipants: (p: any[]) => void
  sideSelections: any
}) {
  const newProteinSelections = {
    ...proteinSelections,
    [protein]: { ...proteinSelections[protein], selected: isChecked, quantity: isChecked ? 1 : 0 },
  }
  setProteinSelections(newProteinSelections)
  const selectedParticipant = participants.find((p: any) => p.isSelected)
  if (selectedParticipant) {
    setParticipants(
      participants.map((p: any) => {
        if (p.id === selectedParticipant.id) {
          return {
            ...p,
            status: "submitted",
            proteinSelections: newProteinSelections,
            sideSelections: sideSelections,
          }
        }
        return p
      }),
    )
  }
}

export function handleProteinQuantityChange({
  protein,
  delta,
  proteinSelections,
  setProteinSelections,
  participants,
  setParticipants,
  sideSelections,
}: {
  protein: string
  delta: number
  proteinSelections: any
  setProteinSelections: (s: any) => void
  participants: any[]
  setParticipants: (p: any[]) => void
  sideSelections: any
}) {
  const newQuantity = Math.max(0, proteinSelections[protein].quantity + delta)
  const newProteinSelections = {
    ...proteinSelections,
    [protein]: {
      ...proteinSelections[protein],
      selected: newQuantity > 0,
      quantity: newQuantity,
    },
  }
  setProteinSelections(newProteinSelections)
  const selectedParticipant = participants.find((p: any) => p.isSelected)
  if (selectedParticipant) {
    setParticipants(
      participants.map((p: any) => {
        if (p.id === selectedParticipant.id) {
          return {
            ...p,
            status: "submitted",
            proteinSelections: newProteinSelections,
            sideSelections: sideSelections,
          }
        }
        return p
      }),
    )
  }
}

export function handleSideChange({
  side,
  isChecked,
  sideSelections,
  setSideSelections,
  participants,
  setParticipants,
  proteinSelections,
}: {
  side: string
  isChecked: boolean
  sideSelections: any
  setSideSelections: (s: any) => void
  participants: any[]
  setParticipants: (p: any[]) => void
  proteinSelections: any
}) {
  const newSideSelections = {
    ...sideSelections,
    [side]: { ...sideSelections[side], selected: isChecked, quantity: isChecked ? 1 : 0 },
  }
  setSideSelections(newSideSelections)
  const selectedParticipant = participants.find((p: any) => p.isSelected)
  if (selectedParticipant) {
    setParticipants(
      participants.map((p: any) => {
        if (p.id === selectedParticipant.id) {
          return {
            ...p,
            status: "submitted",
            proteinSelections: proteinSelections,
            sideSelections: newSideSelections,
          }
        }
        return p
      }),
    )
  }
}

export function handleSideQuantityChange({
  side,
  delta,
  sideSelections,
  setSideSelections,
  participants,
  setParticipants,
  proteinSelections,
}: {
  side: string
  delta: number
  sideSelections: any
  setSideSelections: (s: any) => void
  participants: any[]
  setParticipants: (p: any[]) => void
  proteinSelections: any
}) {
  const newQuantity = Math.max(0, sideSelections[side].quantity + delta)
  const newSideSelections = {
    ...sideSelections,
    [side]: {
      ...sideSelections[side],
      selected: newQuantity > 0,
      quantity: newQuantity,
    },
  }
  setSideSelections(newSideSelections)
  const selectedParticipant = participants.find((p: any) => p.isSelected)
  if (selectedParticipant) {
    setParticipants(
      participants.map((p: any) => {
        if (p.id === selectedParticipant.id) {
          return {
            ...p,
            status: "submitted",
            proteinSelections: proteinSelections,
            sideSelections: newSideSelections,
          }
        }
        return p
      }),
    )
  }
}
