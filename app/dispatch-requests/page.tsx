import { redirect } from "next/navigation";

export default function DispatchRequestsIndexPage() {
  redirect("/dispatcher/history");
}
