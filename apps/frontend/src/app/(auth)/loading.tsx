export default function AuthLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" role="status" />
        <p className="text-body-2 text-muted">در حال بارگذاری...</p>
      </div>
    </div>
  );
}
