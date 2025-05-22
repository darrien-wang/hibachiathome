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

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
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

// Add the missing CardAction component
const CardAction = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-center p-4 transition-colors hover:bg-muted/50 cursor-pointer",
        className,
      )}
      {...props}
    />
  ),
)
CardAction.displayName = "CardAction"

// Add the missing BottomSheet component
interface BottomSheetProps extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean
  onClose?: () => void
}

const BottomSheet = React.forwardRef<HTMLDivElement, BottomSheetProps>(
  ({ className, children, open = false, onClose, ...props }, ref) => {
    return (
      <>
        {open && <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />}
        <div
          ref={ref}
          className={cn(
            "fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-xl shadow-lg transform transition-transform duration-300 ease-in-out",
            open ? "translate-y-0" : "translate-y-full",
            className,
          )}
          {...props}
        >
          <div className="w-12 h-1.5 bg-muted mx-auto my-3 rounded-full" />
          {children}
        </div>
      </>
    )
  },
)
BottomSheet.displayName = "BottomSheet"

// Add the missing SegmentedControl component
interface SegmentedControlProps extends React.HTMLAttributes<HTMLDivElement> {
  items: { value: string; label: React.ReactNode }[]
  value: string
  onValueChange: (value: string) => void
}

const SegmentedControl = React.forwardRef<HTMLDivElement, SegmentedControlProps>(
  ({ className, items, value, onValueChange, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("flex p-1 bg-muted rounded-lg", className)} {...props}>
        {items.map((item) => (
          <button
            key={item.value}
            onClick={() => onValueChange(item.value)}
            className={cn(
              "flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all",
              value === item.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
    )
  },
)
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
