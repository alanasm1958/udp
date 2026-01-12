import { redirect } from "next/navigation";

// Items page redirects to Operations Catalog per OPERATIONS_REMODEL_PLAN
// Operations is the primary hub for products, services, consumables, assets
export default function ItemsPage() {
  redirect("/operations/catalog");
}
