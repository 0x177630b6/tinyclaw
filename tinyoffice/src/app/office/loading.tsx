export default function OfficeLoading() {
  return (
    <div className="flex h-full items-center justify-center bg-[#3b3a37]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        <p className="text-sm text-white/60">Loading office...</p>
      </div>
    </div>
  )
}
