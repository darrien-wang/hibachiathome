"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { Reservation } from "@/types/booking"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"

export default function AdminPage() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedReservation, setSelectedReservation] = useState<string | null>(null)
  const [orderDetails, setOrderDetails] = useState<any | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  // Calculate date 10 days from now
  const tenDaysFromNow = new Date()
  tenDaysFromNow.setDate(tenDaysFromNow.getDate() + 10)

  // Generate fake data
  useEffect(() => {
    // Fake reservation data
    const fakeReservations: Reservation[] = [
      {
        id: "res-001",
        name: "Jennifer Thompson",
        email: "jennifer.t@gmail.com",
        phone: "555-123-4567",
        event_date: new Date(tenDaysFromNow).toISOString(),
        event_time: "6:00 PM",
        headcount: 8,
        location: "1234 Maple Avenue, Boston, MA",
        status: "confirmed",
        created_at: new Date().toISOString(),
        package_id: "premium",
      },
      {
        id: "res-002",
        name: "Michael Rodriguez",
        email: "mrodriguez@gmail.com",
        phone: "555-987-6543",
        event_date: new Date(tenDaysFromNow).toISOString(),
        event_time: "7:30 PM",
        headcount: 12,
        location: "42 Oak Street, Cambridge, MA",
        status: "pending",
        created_at: new Date().toISOString(),
        package_id: "buffet",
      },
      {
        id: "res-003",
        name: "Sarah Johnson",
        email: "sjohnson@gmail.com",
        phone: "555-222-3333",
        event_date: new Date(tenDaysFromNow).toISOString(),
        event_time: "5:00 PM",
        headcount: 6,
        location: "789 Pine Road, Somerville, MA",
        status: "confirmed",
        created_at: new Date().toISOString(),
        package_id: "basic",
      },
      {
        id: "res-004",
        name: "David Williams",
        email: "dwilliams@gmail.com",
        phone: "555-444-5555",
        event_date: new Date(tenDaysFromNow).toISOString(),
        event_time: "6:30 PM",
        headcount: 10,
        location: "567 Cherry Lane, Brookline, MA",
        status: "pending",
        created_at: new Date().toISOString(),
        package_id: "premium",
      },
      {
        id: "res-005",
        name: "Emily Chen",
        email: "echen@gmail.com",
        phone: "555-777-8888",
        event_date: new Date(tenDaysFromNow).toISOString(),
        event_time: "7:00 PM",
        headcount: 15,
        location: "123 Birch Street, Newton, MA",
        status: "confirmed",
        created_at: new Date().toISOString(),
        package_id: "buffet",
      },
      {
        id: "res-006",
        name: "Robert Garcia",
        email: "rgarcia@gmail.com",
        phone: "555-333-2222",
        event_date: new Date(tenDaysFromNow).toISOString(),
        event_time: "5:30 PM",
        headcount: 9,
        location: "456 Elm Court, Watertown, MA",
        status: "cancelled",
        created_at: new Date().toISOString(),
        package_id: "basic",
      },
      {
        id: "res-007",
        name: "Amanda Miller",
        email: "amiller@gmail.com",
        phone: "555-666-7777",
        event_date: new Date(tenDaysFromNow).toISOString(),
        event_time: "6:00 PM",
        headcount: 7,
        location: "890 Walnut Drive, Arlington, MA",
        status: "confirmed",
        created_at: new Date().toISOString(),
        package_id: "premium",
      },
      {
        id: "res-008",
        name: "James Wilson",
        email: "jwilson@gmail.com",
        phone: "555-111-9999",
        event_date: new Date(tenDaysFromNow).toISOString(),
        event_time: "8:00 PM",
        headcount: 14,
        location: "234 Cedar Avenue, Medford, MA",
        status: "pending",
        created_at: new Date().toISOString(),
        package_id: "buffet",
      },
      {
        id: "res-009",
        name: "Sophia Lee",
        email: "slee@gmail.com",
        phone: "555-888-1111",
        event_date: new Date(tenDaysFromNow).toISOString(),
        event_time: "6:30 PM",
        headcount: 11,
        location: "678 Spruce Street, Belmont, MA",
        status: "confirmed",
        created_at: new Date().toISOString(),
        package_id: "basic",
      },
      {
        id: "res-010",
        name: "Daniel Brown",
        email: "dbrown@gmail.com",
        phone: "555-222-4444",
        event_date: new Date(tenDaysFromNow).toISOString(),
        event_time: "7:00 PM",
        headcount: 16,
        location: "345 Aspen Road, Waltham, MA",
        status: "pending",
        created_at: new Date().toISOString(),
        package_id: "premium",
      },
    ]

    // Set the fake reservations and turn off loading
    setReservations(fakeReservations)
    setLoading(false)
  }, [])

  const handleViewDetails = async (reservationId: string) => {
    setSelectedReservation(reservationId)
    setLoadingDetails(true)

    try {
      // Find the selected reservation
      const reservation = reservations.find((r) => r.id === reservationId)
      if (!reservation) {
        throw new Error("Reservation not found")
      }

      // Generate fake order details based on the reservation
      const fakeOrderDetails = {
        order: {
          id: `order-${reservationId.split("-")[1]}`,
          reservation_id: reservationId,
          package_id: reservation.package_id,
          total_price:
            reservation.package_id === "basic"
              ? (reservation.headcount * 45).toFixed(2)
              : reservation.package_id === "buffet"
                ? (reservation.headcount * 55).toFixed(2)
                : (reservation.headcount * 65).toFixed(2),
          status: reservation.status,
          created_at: reservation.created_at,
          reservation: reservation,
        },
        orderItems: [
          {
            id: `item-${Math.floor(Math.random() * 1000)}`,
            order_id: `order-${reservationId.split("-")[1]}`,
            item_id: "Hibachi Steak",
            item_type: "main",
            quantity: Math.ceil(reservation.headcount * 0.4),
            price: "18.99",
          },
          {
            id: `item-${Math.floor(Math.random() * 1000)}`,
            order_id: `order-${reservationId.split("-")[1]}`,
            item_id: "Hibachi Chicken",
            item_type: "main",
            quantity: Math.ceil(reservation.headcount * 0.3),
            price: "16.99",
          },
          {
            id: `item-${Math.floor(Math.random() * 1000)}`,
            order_id: `order-${reservationId.split("-")[1]}`,
            item_id: "Hibachi Shrimp",
            item_type: "main",
            quantity: Math.ceil(reservation.headcount * 0.3),
            price: "19.99",
          },
          {
            id: `item-${Math.floor(Math.random() * 1000)}`,
            order_id: `order-${reservationId.split("-")[1]}`,
            item_id: "Fried Rice",
            item_type: "side",
            quantity: reservation.headcount,
            price: "4.99",
          },
          {
            id: `item-${Math.floor(Math.random() * 1000)}`,
            order_id: `order-${reservationId.split("-")[1]}`,
            item_id: "Vegetable Medley",
            item_type: "side",
            quantity: reservation.headcount,
            price: "3.99",
          },
        ],
        participants: generateParticipants(reservation),
        participantSelections: generateParticipantSelections(reservation),
      }

      setOrderDetails(fakeOrderDetails)
    } catch (error: any) {
      setError(error.message || "An unexpected error occurred")
    } finally {
      setLoadingDetails(false)
    }
  }

  // Helper function to generate fake participants
  const generateParticipants = (reservation: Reservation) => {
    const participants = []
    const firstNames = [
      "John",
      "Mary",
      "James",
      "Patricia",
      "Robert",
      "Jennifer",
      "Michael",
      "Linda",
      "William",
      "Elizabeth",
    ]
    const lastNames = ["Smith", "Johnson", "Williams", "Jones", "Brown", "Davis", "Miller", "Wilson", "Moore", "Taylor"]

    // Add the reservation owner as a host
    participants.push({
      id: `part-${Math.floor(Math.random() * 1000)}`,
      reservation_id: reservation.id,
      name: reservation.name,
      email: reservation.email,
      is_host: true,
      is_proxy_selection: false,
      status: "confirmed",
    })

    // Generate additional participants
    for (let i = 1; i < reservation.headcount && i < 8; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)]
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)]

      participants.push({
        id: `part-${Math.floor(Math.random() * 1000)}`,
        reservation_id: reservation.id,
        name: `${firstName} ${lastName}`,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@gmail.com`,
        is_host: false,
        is_proxy_selection: Math.random() > 0.7, // Some participants have proxy selection
        status: Math.random() > 0.3 ? "confirmed" : "pending",
      })
    }

    return participants
  }

  // Helper function to generate fake participant selections
  const generateParticipantSelections = (reservation: Reservation) => {
    const selections = []
    const mainOptions = ["Hibachi Steak", "Hibachi Chicken", "Hibachi Shrimp", "Hibachi Scallops", "Vegetable Hibachi"]
    const sideOptions = ["Fried Rice", "White Rice", "Vegetable Medley", "Noodles"]
    const appetizerOptions = ["Gyoza", "Spring Rolls", "Edamame", "Miso Soup"]

    // Generate selections for each participant
    const participantCount = Math.min(reservation.headcount, 8)

    for (let i = 0; i < participantCount; i++) {
      const participantId = `part-${Math.floor(Math.random() * 1000)}`

      // Each participant gets a main dish
      selections.push({
        id: `sel-${Math.floor(Math.random() * 1000)}`,
        participant_id: participantId,
        item_id: mainOptions[Math.floor(Math.random() * mainOptions.length)],
        item_type: "main",
        quantity: 1,
      })

      // Each participant gets a side
      selections.push({
        id: `sel-${Math.floor(Math.random() * 1000)}`,
        participant_id: participantId,
        item_id: sideOptions[Math.floor(Math.random() * sideOptions.length)],
        item_type: "side",
        quantity: 1,
      })

      // Some participants get appetizers
      if (Math.random() > 0.5) {
        selections.push({
          id: `sel-${Math.floor(Math.random() * 1000)}`,
          participant_id: participantId,
          item_id: appetizerOptions[Math.floor(Math.random() * appetizerOptions.length)],
          item_type: "appetizer",
          quantity: 1,
        })
      }
    }

    return selections
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pending</Badge>
      case "confirmed":
        return <Badge className="bg-green-100 text-green-800 border-green-200">Confirmed</Badge>
      case "cancelled":
        return <Badge className="bg-red-100 text-red-800 border-red-200">Cancelled</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">{status}</Badge>
    }
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-4">Admin Dashboard</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">Manage reservations and orders</p>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Reservations</CardTitle>
                <CardDescription>Recent booking requests</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-4">Loading reservations...</div>
                ) : reservations.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">No reservations found</div>
                ) : (
                  <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                    {reservations.map((reservation) => (
                      <div
                        key={reservation.id}
                        className={`border rounded-lg p-3 cursor-pointer transition-colors hover:bg-gray-50 ${
                          selectedReservation === reservation.id ? "border-primary bg-primary/5" : ""
                        }`}
                        onClick={() => handleViewDetails(reservation.id!)}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="font-medium">{reservation.name}</div>
                          {getStatusBadge(reservation.status || "pending")}
                        </div>
                        <div className="text-sm text-gray-600">
                          <div>Date: {format(new Date(reservation.event_date), "MMM d, yyyy")}</div>
                          <div>Time: {reservation.event_time}</div>
                          <div>Guests: {reservation.headcount}</div>
                          <div className="mt-1 text-xs text-gray-500">
                            Booked on: {format(new Date(reservation.created_at!), "MMM d, yyyy")}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Reservation Details</CardTitle>
                <CardDescription>
                  {selectedReservation
                    ? `Details for reservation ${selectedReservation}`
                    : "Select a reservation to view details"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!selectedReservation ? (
                  <div className="text-center py-12 text-gray-500">No reservation selected</div>
                ) : loadingDetails ? (
                  <div className="text-center py-12">Loading details...</div>
                ) : !orderDetails ? (
                  <div className="text-center py-12 text-gray-500">No order details found for this reservation</div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h3 className="text-lg font-medium mb-2">Customer Information</h3>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="grid grid-cols-1 gap-2">
                            <div className="flex justify-between">
                              <span className="font-medium">Name:</span>
                              <span>{orderDetails.order.reservation.name}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-medium">Phone:</span>
                              <span>{orderDetails.order.reservation.phone}</span>
                            </div>
                            {orderDetails.order.reservation.email && (
                              <div className="flex justify-between">
                                <span className="font-medium">Email:</span>
                                <span>{orderDetails.order.reservation.email}</span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="font-medium">Event Date:</span>
                              <span>{format(new Date(orderDetails.order.reservation.event_date), "MMM d, yyyy")}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-medium">Event Time:</span>
                              <span>{orderDetails.order.reservation.event_time}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-medium">Headcount:</span>
                              <span>{orderDetails.order.reservation.headcount} guests</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-lg font-medium mb-2">Order Information</h3>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="grid grid-cols-1 gap-2">
                            <div className="flex justify-between">
                              <span className="font-medium">Package:</span>
                              <span>
                                {orderDetails.order.package_id === "buffet"
                                  ? "Buffet Package"
                                  : orderDetails.order.package_id === "basic"
                                    ? "Basic Package"
                                    : "Premium Package"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-medium">Total Price:</span>
                              <span>${orderDetails.order.total_price}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-medium">Status:</span>
                              <span>{getStatusBadge(orderDetails.order.status || "pending")}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="font-medium">Order Date:</span>
                              <span>{format(new Date(orderDetails.order.created_at), "MMM d, yyyy")}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {orderDetails.orderItems.length > 0 && (
                      <div>
                        <h3 className="text-lg font-medium mb-2">Order Items</h3>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <table className="w-full">
                            <thead>
                              <tr className="text-left text-sm text-gray-500">
                                <th className="pb-2">Item</th>
                                <th className="pb-2">Type</th>
                                <th className="pb-2 text-right">Quantity</th>
                                <th className="pb-2 text-right">Price</th>
                              </tr>
                            </thead>
                            <tbody>
                              {orderDetails.orderItems.map((item: any) => (
                                <tr key={item.id} className="border-t">
                                  <td className="py-2">{item.item_id}</td>
                                  <td className="py-2">{item.item_type}</td>
                                  <td className="py-2 text-right">{item.quantity}</td>
                                  <td className="py-2 text-right">${item.price}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {orderDetails.participants.length > 0 && (
                      <div>
                        <h3 className="text-lg font-medium mb-2">Participants</h3>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="space-y-3">
                            {orderDetails.participants.map((participant: any) => (
                              <div key={participant.id} className="border-b pb-2 last:border-0 last:pb-0">
                                <div className="flex justify-between items-center mb-1">
                                  <div className="font-medium">{participant.name}</div>
                                  <div className="flex items-center gap-2">
                                    {participant.is_host && (
                                      <Badge variant="outline" className="text-xs">
                                        Host
                                      </Badge>
                                    )}
                                    {participant.is_proxy_selection && (
                                      <Badge className="bg-blue-100 text-blue-800 text-xs">Proxy Selection</Badge>
                                    )}
                                    {getStatusBadge(participant.status || "pending")}
                                  </div>
                                </div>

                                {/* 参与者选择 */}
                                {orderDetails.participantSelections.filter(
                                  (s: any) => s.participant_id === participant.id,
                                ).length > 0 && (
                                  <div className="mt-2 pl-4 text-sm">
                                    <div className="text-xs text-gray-500 mb-1">Selections:</div>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                      {orderDetails.participantSelections
                                        .filter((s: any) => s.participant_id === participant.id)
                                        .map((selection: any) => (
                                          <div key={selection.id} className="flex justify-between">
                                            <span>
                                              {selection.item_id} ({selection.item_type})
                                            </span>
                                            <span>× {selection.quantity}</span>
                                          </div>
                                        ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-3 mt-6">
                      <Button variant="outline">Edit Reservation</Button>
                      <Button>Confirm Reservation</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
