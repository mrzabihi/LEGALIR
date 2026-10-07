import { redirect } from "next/navigation";

// Legacy alias — «بازبینی محتوا» was consolidated into the knowledge surface,
// which owns the real library review/verification workflow (review states,
// publish-to-library, eval scores). This route is kept only as a stable
// redirect for any deep link; it is hidden and unlinked from the nav. It must
// NOT dead-end on the user dashboard, which is not a content-review surface.
export default function AdminReviewPage() {
  redirect("/admin/knowledge");
}
