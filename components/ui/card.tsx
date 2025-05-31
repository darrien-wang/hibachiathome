"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)} {...props} />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  ),
)
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />
  ),
)
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
)
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />,
)
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  ),
)
CardFooter.displayName = "CardFooter"

// CardAction component
const CardAction = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center justify-end p-6 pt-0", className)} {...props} />
  ),
)
CardAction.displayName = "CardAction"

// BottomSheet component
const BottomSheet = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { isOpen?: boolean; onClose?: () => void }
>(({ className, children, isOpen = false, onClose, ...props }, ref) => (
  <>
    {isOpen && <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />}
    <div
      ref={ref}
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-xl shadow-lg transform transition-transform duration-300 ease-in-out",
        isOpen ? "translate-y-0" : "translate-y-full",
        className,
      )}
      {...props}
    >
      <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto my-3" />
      {children}
    </div>
  </>
))
BottomSheet.displayName = "BottomSheet"

// SegmentedControl component
const SegmentedControl = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    segments: { label: string; value: string }[]
    value: string
    onValueChange: (value: string) => void
  }
>(({ className, segments, value, onValueChange, ...props }, ref) => (
  <div ref={ref} className={cn("flex p-1 bg-gray-100 rounded-lg", className)} {...props}>
    {segments.map((segment) => (
      <button
        key={segment.value}
        className={cn(
          "flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all",
          value === segment.value ? "bg-white shadow-sm text-primary" : "text-gray-500 hover:text-gray-900",
        )}
        onClick={() => onValueChange(segment.value)}
      >
        {segment.label}
      </button>
    ))}
  </div>
))
SegmentedControl.displayName = "SegmentedControl"

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
  BottomSheet,
  SegmentedControl,
}
