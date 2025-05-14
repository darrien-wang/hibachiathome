"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { cardConfig } from "@/config/ui"
import { DollarSign } from "lucide-react"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: keyof typeof cardConfig.variants
    elevation?: "none" | "low" | "medium" | "high"
  }
>(({ className, variant = "default", elevation = "low", ...props }, ref) => {
  // 添加苹果风格的阴影和圆角
  const elevationClasses = {
    none: "",
    low: "shadow-sm",
    medium: "shadow-md",
    high: "shadow-lg",
  }

  return (
    <div
      ref={ref}
      className={cn(
        cardConfig.variants[variant],
        elevationClasses[elevation],
        "rounded-xl border-[0.5px] border-gray-200/60 bg-white/95 backdrop-blur-sm transition-all duration-200",
        className,
      )}
      {...props}
    />
  )
})
Card.displayName = "Card"

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col space-y-1.5 p-6", "border-b border-gray-100/50", className)}
      {...props}
    />
  ),
)
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("text-lg font-semibold leading-none tracking-tight", "text-gray-900", className)}
      {...props}
    />
  ),
)
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", "text-gray-500 mt-1", className)} {...props} />
  ),
)
CardDescription.displayName = "CardDescription"

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  spacing?: keyof typeof cardConfig.content.spacing
  step?: number
  stepTitle?: string
  promotionText?: string
  depositAmount?: number
}

const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, spacing = "default", step, stepTitle, promotionText, depositAmount, ...props }, ref) => {
    return (
      <div ref={ref} className={cn(cardConfig.content.spacing[spacing], "flex flex-col gap-4", className)}>
        {promotionText && (
          <div className="bg-green-50 border border-green-100 rounded-lg p-3 mb-2">
            <div className="flex items-start">
              <div className="flex-shrink-0 mt-0.5">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-green-500"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm-3.707-9.293a1 1 0 011.414 0L9 10l4.293-4.293a1 1 0 111.414 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <p className="ml-2 text-sm text-green-700">{promotionText}</p>
            </div>
          </div>
        )}
        {depositAmount && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-2">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <DollarSign className="h-5 w-5 text-blue-500" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">Fixed Deposit Amount</h3>
                <div className="mt-1 text-sm text-blue-700">
                  A fixed deposit of ${depositAmount.toFixed(2)} is required to confirm your booking.
                </div>
              </div>
            </div>
          </div>
        )}
        {step !== undefined && stepTitle && (
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-sm font-medium">
              {step}
            </div>
            <h4 className="text-base font-semibold text-gray-800">{stepTitle}</h4>
          </div>
        )}
        {props.children && props.children.type === "button" && (
          <p className="text-xs text-gray-500 italic mb-2">
            Payment of deposit secures your reservation. Bookings without deposit payment within 3 days of the event
            will be automatically cancelled.
          </p>
        )}
        <div {...props} />
      </div>
    )
  },
)
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center p-6 pt-0", "mt-auto border-t border-gray-100/50 pt-4", className)}
      {...props}
    />
  ),
)
CardFooter.displayName = "CardFooter"

// 新增的苹果风格组件
const CardAction = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "w-full py-3 px-4 bg-blue-500 text-white font-medium rounded-xl",
        "hover:bg-blue-600 active:bg-blue-700 transition-colors duration-200",
        "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50",
        className,
      )}
      {...props}
    >
      <div className="flex items-center justify-center gap-2">{children}</div>
    </button>
  ),
)
CardAction.displayName = "CardAction"

// 新增的底部弹出卡片组件
const BottomSheet = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    isOpen: boolean
    onClose: () => void
    title?: string
  }
>(({ className, isOpen, onClose, title, children, ...props }, ref) => {
  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 transition-opacity duration-300">
          <div
            className={cn(
              "fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl",
              "transform transition-transform duration-300 ease-out",
              "max-h-[90vh] overflow-auto",
              isOpen ? "translate-y-0" : "translate-y-full",
              className,
            )}
            ref={ref}
            {...props}
          >
            <div className="flex justify-center pt-2 pb-1" onClick={onClose} role="button" aria-label="Close sheet">
              <div className="w-12 h-1 bg-gray-300 rounded-full cursor-pointer hover:bg-gray-400 transition-colors"></div>
            </div>
            {title && (
              <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between">
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M15 9L9 15M9 9L15 15"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <h3 className="text-lg font-semibold text-center flex-1">{title}</h3>
                <div className="w-8"></div> {/* Spacer for balance */}
              </div>
            )}
            <div className="p-6">{children}</div>
          </div>
        </div>
      )}
    </>
  )
})
BottomSheet.displayName = "BottomSheet"

// 新增的分段控制组件
const SegmentedControl = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    options: { value: string; label: string; icon?: React.ReactNode }[]
    value: string
    onChange: (value: string) => void
  }
>(({ className, options, value, onChange, ...props }, ref) => {
  return (
    <div ref={ref} className={cn("flex p-1 bg-gray-100 rounded-lg", className)} {...props}>
      {options.map((option) => (
        <button
          key={option.value}
          className={cn(
            "flex items-center justify-center gap-1.5 py-2 px-3 flex-1 text-sm font-medium rounded-md transition-all duration-200",
            value === option.value ? "bg-white text-blue-500 shadow-sm" : "text-gray-600 hover:text-gray-900",
          )}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          {option.label}
          {value === option.value && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-blue-500"></span>}
        </button>
      ))}
    </div>
  )
})
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
