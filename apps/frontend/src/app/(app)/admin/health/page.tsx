export default function AdminHealthPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-h2 text-onSurface font-bold mb-6">سلامت سیستم</h1>
      <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-surface border border-divider/60 p-5">
          <p className="text-body-2 text-onSurface font-medium mb-2">سرور API</p>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-body-2 text-emerald-600">در حال اجرا</span>
          </div>
        </div>
        <div className="rounded-2xl bg-surface border border-divider/60 p-5">
          <p className="text-body-2 text-onSurface font-medium mb-2">پایگاه داده</p>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-body-2 text-emerald-600">متصل</span>
          </div>
        </div>
        <div className="rounded-2xl bg-surface border border-divider/60 p-5">
          <p className="text-body-2 text-onSurface font-medium mb-2">تعداد کاربران فعال</p>
          <p className="text-h3 text-onSurface font-bold">۱۲۴</p>
        </div>
        <div className="rounded-2xl bg-surface border border-divider/60 p-5">
          <p className="text-body-2 text-onSurface font-medium mb-2">نسخه</p>
          <p className="text-h3 text-onSurface font-bold">v0.0.0-demo</p>
        </div>
      </div>
    </div>
  );
}
