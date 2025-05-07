"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getReservations, getOrderDetails } from "../actions/booking"
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

  useEffect(() => {
    async function fetchReservations() {
      try {
        const result = await getReservations()
        if (result.success && result.data) {
          setReservations(result.data)
        } else {
          setError(result.error || "Failed to fetch reservations")
        }
      } catch (error: any) {
        setError(error.message || "An unexpected error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchReservations()
  }, [])

  const handleViewDetails = async (reservationId: string) => {
    setSelectedReservation(reservationId)
    setLoadingDetails(true)

    try {
      // 这里假设我们可以通过预订ID获取关联的订单ID
      // 在实际应用中，您可能需要先获取订单ID
      const reservation = reservations.find((r) => r.id === reservationId)
      if (!reservation) {
        throw new Error("Reservation not found")
      }

      // 假设我们有一个方法来获取与预订关联的订单
      // 在实际应用中，您需要实现这个逻辑
      const result = await getOrderDetails(reservationId)

      if (result.success && result.data) {
        setOrderDetails(result.data)
      } else {
        setError(result.error || "Failed to fetch order details")
      }
    } catch (error: any) {
      setError(error.message || "An unexpected error occurred")
    } finally {
      setLoadingDetails(false)
    }
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
