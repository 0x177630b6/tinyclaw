"use client"

import * as React from "react"
import { Dialog as SheetPrimitive } from "radix-ui"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const Sheet = SheetPrimitive.Root
const SheetTrigger = SheetPrimitive.Trigger
const SheetClose = SheetPrimitive.Close
const SheetPortal = SheetPrimitive.Portal

function SheetOverlay({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-50 bg-black/50 transition-opacity duration-300 data-[state=open]:opacity-100 data-[state=closed]:opacity-0",
        className
      )}
      {...props}
    />
  )
}

const sheetVariants = cva(
  "fixed z-50 bg-card shadow-lg transition-transform duration-300 ease-in-out",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=open]:translate-y-0 data-[state=closed]:-translate-y-full",
        bottom: "inset-x-0 bottom-0 border-t data-[state=open]:translate-y-0 data-[state=closed]:translate-y-full",
        left: "inset-y-0 left-0 h-full w-3/4 max-w-[280px] border-r data-[state=open]:translate-x-0 data-[state=closed]:-translate-x-full",
        right: "inset-y-0 right-0 h-full w-3/4 max-w-sm border-l data-[state=open]:translate-x-0 data-[state=closed]:translate-x-full",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
)

interface SheetContentProps
  extends React.ComponentProps<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {}

function SheetContent({ side = "left", className, children, ...props }: SheetContentProps) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        className={cn(sheetVariants({ side }), className)}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetOverlay, SheetPortal }
