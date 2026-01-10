import { redirect } from "next/navigation";

/**
 * Redirect /operations/people to /people with vendor filter
 *
 * The unified People module now handles all person types including
 * vendors and contractors. This redirect maintains backwards compatibility.
 */
export default function OperationsPeoplePage() {
  redirect("/people?type=supplier_contact");
}
