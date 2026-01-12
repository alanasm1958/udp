"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import {
  GlassCard,
  GlassButton,
  GlassBadge,
  SlideOver,
  PageHeader,
  Spinner,
  useToast,
} from "@/components/ui/glass";
import { apiGet, formatDate } from "@/lib/http";

/* =============================================================================
   TYPES
   ============================================================================= */

interface OperationsMetrics {
  productsInStock: number;
  lowStockCount: number;
  outOfStockCount: number;
  expiringSoonCount: number;
  pendingReceiptsCount: number;
  activeServiceJobsCount: number;
  overdueServiceJobsCount: number;
  warehousesCount: number;
  operationsTasksCount: number;
  operationsAlertsCount: number;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  domain: string | null;
  assigneeName: string | null;
  dueAt: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  createdAt: string;
}

interface Alert {
  id: string;
  type: string;
  severity: string;
  message: string;
  status: string;
  domain: string | null;
  source: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  createdAt: string;
}

/* =============================================================================
   ICONS - Heroicons style
   ============================================================================= */

const Icons = {
  plus: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  ),
  bolt: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  ),
  cube: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
    </svg>
  ),
  warehouse: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
    </svg>
  ),
  users: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  asset: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
    </svg>
  ),
  inventory: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  ),
  cart: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121 0 2.05-.935 2.05-2.08 0-.3-.047-.594-.138-.873L19.5 6H7.5" />
    </svg>
  ),
  receive: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  payment: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  ),
  adjust: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  ),
  transfer: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  ),
  return: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
    </svg>
  ),
  service: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63" />
    </svg>
  ),
  check: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  clock: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  warning: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ),
  chevronRight: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  ),
};

/* =============================================================================
   RECORD ACTIVITY DRAWER
   ============================================================================= */

interface RecordActivityDrawerProps {
  open: boolean;
  onClose: () => void;
}

type DrawerStep =
  | "menu"
  | "add-item" | "add-product" | "add-service" | "add-consumable" | "add-asset"
  | "record-purchase" | "receive-items" | "record-payment"
  | "adjust-inventory" | "move-inventory" | "return-items";

interface Warehouse {
  id: string;
  code: string;
  name: string;
}

interface Person {
  id: string;
  fullName: string;
  types: string[];
}

interface Item {
  id: string;
  name: string;
  type: string;
  sku: string | null;
  trackInventory: boolean;
}

// Product category options per plan
type ProductCategory = "standard" | "food" | "hazardous" | "non_expiring";
type AdjustmentReason = "correction" | "shrinkage" | "expired" | "damaged" | "other";
type ReturnType = "customer" | "supplier";

function RecordActivityDrawer({ open, onClose }: RecordActivityDrawerProps) {
  const [step, setStep] = React.useState<DrawerStep>("menu");
  const [loading, setLoading] = React.useState(false);
  const [warehouses, setWarehouses] = React.useState<Warehouse[]>([]);
  const [vendors, setVendors] = React.useState<Person[]>([]);
  const [items, setItems] = React.useState<Item[]>([]);
  const { addToast } = useToast();

  // Fetch warehouses, vendors, and items when drawer opens
  React.useEffect(() => {
    if (open) {
      Promise.all([
        fetch("/api/master/warehouses?limit=50").then((r) => r.ok ? r.json() : { items: [] }),
        fetch("/api/people?type=supplier_contact&limit=50").then((r) => r.ok ? r.json() : { people: [] }),
        fetch("/api/master/items?trackInventory=true&limit=100").then((r) => r.ok ? r.json() : { items: [] }),
      ]).then(([whRes, vendorRes, itemsRes]) => {
        setWarehouses(whRes.items || []);
        setVendors(vendorRes.people || []);
        setItems(itemsRes.items || []);
      });
    }
  }, [open]);

  // Form states
  const [productForm, setProductForm] = React.useState({
    name: "",
    category: "standard" as ProductCategory,
    description: "",
    quantity: "",
    unit: "pcs",
    warehouseId: "",
    defaultCost: "",
    defaultPrice: "",
    expiryDate: "",
    vendorId: "",
  });

  const [serviceForm, setServiceForm] = React.useState({
    name: "",
    description: "",
    estimatedCost: "",
    estimatedPrice: "",
    availability: true,
  });

  const [consumableForm, setConsumableForm] = React.useState({
    name: "",
    description: "",
    quantity: "",
    unit: "pcs",
    warehouseId: "",
    defaultCost: "",
    expenseCategoryCode: "consumables",
  });

  const [assetForm, setAssetForm] = React.useState({
    name: "",
    description: "",
    purchasePrice: "",
    quantity: "1",
    vendorId: "",
    availability: true,
  });

  // Purchase form - for "Bought something"
  const [purchaseForm, setPurchaseForm] = React.useState({
    vendorId: "",
    purchaseDate: new Date().toISOString().split("T")[0],
    notes: "",
    lines: [{ itemId: "", freeTextName: "", quantity: "1", unit: "pcs", unitCost: "", warehouseId: "" }],
    receivedNow: false,
    paidNow: false,
  });

  // Receive form - for "Received items"
  const [receiveForm, setReceiveForm] = React.useState({
    receivedDate: new Date().toISOString().split("T")[0],
    warehouseId: "",
    notes: "",
    lines: [{ itemId: "", quantityReceived: "", quantityDamaged: "0", expiryDate: "", batch: "" }],
  });

  // Payment form - for "Paid or owe money"
  const [paymentForm, setPaymentForm] = React.useState({
    payeeId: "",
    paymentDate: new Date().toISOString().split("T")[0],
    amount: "",
    status: "paid" as "paid" | "unpaid",
    method: "cash" as "cash" | "bank",
    notes: "",
  });

  // Adjustment form - for "Corrected, damaged, or wrote off stock"
  const [adjustmentForm, setAdjustmentForm] = React.useState({
    itemId: "",
    warehouseId: "",
    adjustmentDate: new Date().toISOString().split("T")[0],
    quantityDelta: "",
    reason: "correction" as AdjustmentReason,
    notes: "",
  });

  // Transfer form - for "Moved stock between warehouses"
  const [transferForm, setTransferForm] = React.useState({
    itemId: "",
    fromWarehouseId: "",
    toWarehouseId: "",
    transferDate: new Date().toISOString().split("T")[0],
    quantity: "",
    notes: "",
  });

  // Return form - for "Returned items"
  const [returnForm, setReturnForm] = React.useState({
    returnType: "customer" as ReturnType,
    itemId: "",
    warehouseId: "",
    returnDate: new Date().toISOString().split("T")[0],
    quantity: "",
    reason: "",
  });

  const handleOptionClick = (option: string) => {
    if (option === "add-item") {
      setStep("add-item");
    } else if (option === "record-purchase") {
      setStep("record-purchase");
    } else if (option === "receive-items") {
      setStep("receive-items");
    } else if (option === "record-payment") {
      setStep("record-payment");
    } else if (option === "adjust-inventory") {
      setStep("adjust-inventory");
    } else if (option === "move-inventory") {
      setStep("move-inventory");
    } else if (option === "return-items") {
      setStep("return-items");
    }
  };

  const handleClose = () => {
    setStep("menu");
    // Reset all forms
    setProductForm({ name: "", category: "standard", description: "", quantity: "", unit: "pcs", warehouseId: "", defaultCost: "", defaultPrice: "", expiryDate: "", vendorId: "" });
    setServiceForm({ name: "", description: "", estimatedCost: "", estimatedPrice: "", availability: true });
    setConsumableForm({ name: "", description: "", quantity: "", unit: "pcs", warehouseId: "", defaultCost: "", expenseCategoryCode: "consumables" });
    setAssetForm({ name: "", description: "", purchasePrice: "", quantity: "1", vendorId: "", availability: true });
    setPurchaseForm({ vendorId: "", purchaseDate: new Date().toISOString().split("T")[0], notes: "", lines: [{ itemId: "", freeTextName: "", quantity: "1", unit: "pcs", unitCost: "", warehouseId: "" }], receivedNow: false, paidNow: false });
    setReceiveForm({ receivedDate: new Date().toISOString().split("T")[0], warehouseId: "", notes: "", lines: [{ itemId: "", quantityReceived: "", quantityDamaged: "0", expiryDate: "", batch: "" }] });
    setPaymentForm({ payeeId: "", paymentDate: new Date().toISOString().split("T")[0], amount: "", status: "paid", method: "cash", notes: "" });
    setAdjustmentForm({ itemId: "", warehouseId: "", adjustmentDate: new Date().toISOString().split("T")[0], quantityDelta: "", reason: "correction", notes: "" });
    setTransferForm({ itemId: "", fromWarehouseId: "", toWarehouseId: "", transferDate: new Date().toISOString().split("T")[0], quantity: "", notes: "" });
    setReturnForm({ returnType: "customer", itemId: "", warehouseId: "", returnDate: new Date().toISOString().split("T")[0], quantity: "", reason: "" });
    onClose();
  };

  const handleBack = () => {
    if (["add-product", "add-service", "add-consumable", "add-asset"].includes(step)) {
      setStep("add-item");
    } else {
      setStep("menu");
    }
  };

  // Submit handlers
  const submitProduct = async () => {
    if (!productForm.name) {
      addToast("error", "Product name is required");
      return;
    }
    if (!productForm.quantity || !productForm.unit) {
      addToast("error", "Quantity and unit are required for products");
      return;
    }
    // Food and hazardous require expiry date
    if ((productForm.category === "food" || productForm.category === "hazardous") && !productForm.expiryDate) {
      addToast("error", "Expiry date is required for food and hazardous products");
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        name: productForm.name,
        type: "product",
        description: productForm.description || undefined,
        defaultUomCode: productForm.unit,
        defaultPurchaseCost: productForm.defaultCost || undefined,
        defaultSalesPrice: productForm.defaultPrice || undefined,
        trackInventory: true,
        metadata: {
          category: productForm.category,
          expiryDate: productForm.expiryDate || undefined,
        },
      };

      if (productForm.warehouseId && productForm.quantity) {
        body.initialWarehouseId = productForm.warehouseId;
        body.initialQuantity = parseFloat(productForm.quantity);
      }

      if (productForm.vendorId) {
        // For now, store vendor in metadata until party linking is set up
        body.metadata = { ...(body.metadata as object), vendorPersonId: productForm.vendorId };
      }

      const res = await fetch("/api/master/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        addToast("success", `Product "${productForm.name}" created`);
        handleClose();
      } else {
        const data = await res.json();
        addToast("error", data.error || "Failed to create product");
      }
    } catch (error) {
      console.error("Create product error:", error);
      addToast("error", "Failed to create product");
    } finally {
      setLoading(false);
    }
  };

  const submitService = async () => {
    if (!serviceForm.name) {
      addToast("error", "Service name is required");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/master/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: serviceForm.name,
          type: "service",
          description: serviceForm.description || undefined,
          defaultPurchaseCost: serviceForm.estimatedCost || undefined,
          defaultSalesPrice: serviceForm.estimatedPrice || undefined,
          serviceAvailable: serviceForm.availability,
        }),
      });

      if (res.ok) {
        addToast("success", `Service "${serviceForm.name}" created`);
        handleClose();
      } else {
        const data = await res.json();
        addToast("error", data.error || "Failed to create service");
      }
    } catch (error) {
      console.error("Create service error:", error);
      addToast("error", "Failed to create service");
    } finally {
      setLoading(false);
    }
  };

  const submitConsumable = async () => {
    if (!consumableForm.name) {
      addToast("error", "Consumable name is required");
      return;
    }
    if (!consumableForm.quantity || !consumableForm.unit) {
      addToast("error", "Quantity and unit are required");
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        name: consumableForm.name,
        type: "consumable",
        description: consumableForm.description || undefined,
        defaultUomCode: consumableForm.unit,
        defaultPurchaseCost: consumableForm.defaultCost || undefined,
        expenseCategoryCode: consumableForm.expenseCategoryCode,
        trackInventory: true,
      };

      if (consumableForm.warehouseId && consumableForm.quantity) {
        body.initialWarehouseId = consumableForm.warehouseId;
        body.initialQuantity = parseFloat(consumableForm.quantity);
      }

      const res = await fetch("/api/master/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        addToast("success", `Consumable "${consumableForm.name}" created`);
        handleClose();
      } else {
        const data = await res.json();
        addToast("error", data.error || "Failed to create consumable");
      }
    } catch (error) {
      console.error("Create consumable error:", error);
      addToast("error", "Failed to create consumable");
    } finally {
      setLoading(false);
    }
  };

  const submitAsset = async () => {
    if (!assetForm.name) {
      addToast("error", "Asset name is required");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/master/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: assetForm.name,
          type: "asset",
          description: assetForm.description || undefined,
          defaultPurchaseCost: assetForm.purchasePrice || "0",
          metadata: {
            quantity: parseInt(assetForm.quantity) || 1,
            vendorPersonId: assetForm.vendorId || undefined,
            availability: assetForm.availability,
          },
        }),
      });

      if (res.ok) {
        addToast("success", `Asset "${assetForm.name}" created`);
        handleClose();
      } else {
        const data = await res.json();
        addToast("error", data.error || "Failed to create asset");
      }
    } catch (error) {
      console.error("Create asset error:", error);
      addToast("error", "Failed to create asset");
    } finally {
      setLoading(false);
    }
  };

  // Submit Purchase
  const submitPurchase = async () => {
    if (!purchaseForm.purchaseDate) {
      addToast("error", "Purchase date is required");
      return;
    }
    const validLines = purchaseForm.lines.filter(l => l.itemId || l.freeTextName);
    if (validLines.length === 0) {
      addToast("error", "At least one line item is required");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/operations/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorPersonId: purchaseForm.vendorId || undefined,
          purchaseDate: purchaseForm.purchaseDate,
          notes: purchaseForm.notes || undefined,
          lines: validLines.map(l => ({
            itemId: l.itemId || undefined,
            freeTextName: l.freeTextName || undefined,
            quantity: parseFloat(l.quantity) || 1,
            unit: l.unit,
            unitCost: l.unitCost ? parseFloat(l.unitCost) : undefined,
            warehouseId: l.warehouseId || undefined,
          })),
          receivedNow: purchaseForm.receivedNow,
          paidNow: purchaseForm.paidNow,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        addToast("success", `Purchase recorded${data.taskCreated ? " (task created for follow-up)" : ""}`);
        handleClose();
      } else {
        const data = await res.json();
        addToast("error", data.error || "Failed to record purchase");
      }
    } catch (error) {
      console.error("Record purchase error:", error);
      addToast("error", "Failed to record purchase");
    } finally {
      setLoading(false);
    }
  };

  // Submit Receive Items
  const submitReceive = async () => {
    if (!receiveForm.receivedDate) {
      addToast("error", "Received date is required");
      return;
    }
    const validLines = receiveForm.lines.filter(l => l.itemId && l.quantityReceived);
    if (validLines.length === 0) {
      addToast("error", "At least one line with item and quantity is required");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/operations/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receivedDate: receiveForm.receivedDate,
          warehouseId: receiveForm.warehouseId || undefined,
          notes: receiveForm.notes || undefined,
          lines: validLines.map(l => ({
            itemId: l.itemId,
            quantityReceived: parseFloat(l.quantityReceived),
            quantityDamaged: parseFloat(l.quantityDamaged) || 0,
            expiryDate: l.expiryDate || undefined,
            batch: l.batch || undefined,
          })),
        }),
      });

      if (res.ok) {
        addToast("success", "Items received into inventory");
        handleClose();
      } else {
        const data = await res.json();
        addToast("error", data.error || "Failed to receive items");
      }
    } catch (error) {
      console.error("Receive items error:", error);
      addToast("error", "Failed to receive items");
    } finally {
      setLoading(false);
    }
  };

  // Submit Payment
  const submitPayment = async () => {
    if (!paymentForm.paymentDate || !paymentForm.amount) {
      addToast("error", "Payment date and amount are required");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/operations/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payeePersonId: paymentForm.payeeId || undefined,
          paymentDate: paymentForm.paymentDate,
          amount: parseFloat(paymentForm.amount),
          status: paymentForm.status,
          method: paymentForm.status === "paid" ? paymentForm.method : undefined,
          domain: "Operations",
          notes: paymentForm.notes || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const message = paymentForm.status === "unpaid"
          ? "Payment recorded as unpaid (task created for follow-up)"
          : "Payment recorded";
        addToast("success", data.pendingEvidence ? `${message} - attachment needed` : message);
        handleClose();
      } else {
        const data = await res.json();
        addToast("error", data.error || "Failed to record payment");
      }
    } catch (error) {
      console.error("Record payment error:", error);
      addToast("error", "Failed to record payment");
    } finally {
      setLoading(false);
    }
  };

  // Submit Inventory Adjustment
  const submitAdjustment = async () => {
    if (!adjustmentForm.itemId || !adjustmentForm.adjustmentDate || !adjustmentForm.quantityDelta || !adjustmentForm.reason) {
      addToast("error", "Item, date, quantity, and reason are required");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/operations/inventory-adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: adjustmentForm.itemId,
          warehouseId: adjustmentForm.warehouseId || undefined,
          adjustmentDate: adjustmentForm.adjustmentDate,
          quantityDelta: parseFloat(adjustmentForm.quantityDelta),
          reason: adjustmentForm.reason,
          notes: adjustmentForm.notes || undefined,
        }),
      });

      if (res.ok) {
        addToast("success", "Inventory adjusted");
        handleClose();
      } else {
        const data = await res.json();
        addToast("error", data.error || "Failed to adjust inventory");
      }
    } catch (error) {
      console.error("Adjust inventory error:", error);
      addToast("error", "Failed to adjust inventory");
    } finally {
      setLoading(false);
    }
  };

  // Submit Inventory Transfer
  const submitTransfer = async () => {
    if (!transferForm.itemId || !transferForm.fromWarehouseId || !transferForm.toWarehouseId || !transferForm.quantity) {
      addToast("error", "Item, source warehouse, destination warehouse, and quantity are required");
      return;
    }
    if (transferForm.fromWarehouseId === transferForm.toWarehouseId) {
      addToast("error", "Source and destination warehouses must be different");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/operations/inventory-transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: transferForm.itemId,
          fromWarehouseId: transferForm.fromWarehouseId,
          toWarehouseId: transferForm.toWarehouseId,
          transferDate: transferForm.transferDate,
          quantity: parseFloat(transferForm.quantity),
          notes: transferForm.notes || undefined,
        }),
      });

      if (res.ok) {
        addToast("success", "Stock transferred between warehouses");
        handleClose();
      } else {
        const data = await res.json();
        addToast("error", data.error || "Failed to transfer stock");
      }
    } catch (error) {
      console.error("Transfer inventory error:", error);
      addToast("error", "Failed to transfer stock");
    } finally {
      setLoading(false);
    }
  };

  // Submit Return
  const submitReturn = async () => {
    if (!returnForm.itemId || !returnForm.returnDate || !returnForm.quantity) {
      addToast("error", "Item, date, and quantity are required");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/operations/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: returnForm.returnType,
          itemId: returnForm.itemId,
          warehouseId: returnForm.warehouseId || undefined,
          returnDate: returnForm.returnDate,
          quantity: parseFloat(returnForm.quantity),
          reason: returnForm.reason || undefined,
        }),
      });

      if (res.ok) {
        const label = returnForm.returnType === "customer" ? "Customer return recorded (stock added)" : "Supplier return recorded (stock reduced)";
        addToast("success", label);
        handleClose();
      } else {
        const data = await res.json();
        addToast("error", data.error || "Failed to record return");
      }
    } catch (error) {
      console.error("Record return error:", error);
      addToast("error", "Failed to record return");
    } finally {
      setLoading(false);
    }
  };

  const activityOptions = [
    { id: "add-item", label: "Add item", description: "Product, Service, Consumable, or Asset", icon: Icons.plus, color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
    { id: "record-purchase", label: "Bought something", description: "Record a purchase from a vendor", icon: Icons.cart, color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    { id: "receive-items", label: "Received items", description: "Mark items as received into inventory", icon: Icons.receive, color: "bg-teal-500/20 text-teal-400 border-teal-500/30" },
    { id: "record-payment", label: "Paid or owe money", description: "Record a payment or amount owed", icon: Icons.payment, color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
    { id: "adjust-inventory", label: "Corrected, damaged, or wrote off stock", description: "Adjust inventory quantities", icon: Icons.adjust, color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
    { id: "move-inventory", label: "Moved stock between warehouses", description: "Transfer inventory between locations", icon: Icons.transfer, color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
    { id: "return-items", label: "Returned items", description: "Customer return or return to supplier", icon: Icons.return, color: "bg-rose-500/20 text-rose-400 border-rose-500/30" },
  ];

  const itemTypes = [
    { id: "add-product", label: "Product", description: "Items you sell or use and track in stock", icon: Icons.cube },
    { id: "add-service", label: "Service", description: "Work you deliver, like maintenance or repairs", icon: Icons.service },
    { id: "add-consumable", label: "Consumable", description: "Stock items used up over time, like food or stationery", icon: Icons.inventory },
    { id: "add-asset", label: "Asset", description: "Long-term items like cars, equipment, or buildings", icon: Icons.asset },
  ];

  const unitOptions = [
    { value: "pcs", label: "Pieces (pcs)" },
    { value: "kg", label: "Kilograms (kg)" },
    { value: "g", label: "Grams (g)" },
    { value: "l", label: "Liters (l)" },
    { value: "ml", label: "Milliliters (ml)" },
    { value: "m", label: "Meters (m)" },
    { value: "hr", label: "Hours (hr)" },
    { value: "unit", label: "Unit" },
  ];

  const categoryOptions = [
    { value: "standard", label: "Standard product" },
    { value: "food", label: "Food (requires expiry date)" },
    { value: "hazardous", label: "Hazardous (requires expiry date)" },
    { value: "non_expiring", label: "Non-expiring" },
  ];

  const reasonOptions = [
    { value: "correction", label: "Correction (count was wrong)" },
    { value: "shrinkage", label: "Shrinkage (theft/loss)" },
    { value: "expired", label: "Expired" },
    { value: "damaged", label: "Damaged" },
    { value: "other", label: "Other" },
  ];

  const getTitle = () => {
    switch (step) {
      case "add-product": return "Add Product";
      case "add-service": return "Add Service";
      case "add-consumable": return "Add Consumable";
      case "add-asset": return "Add Asset";
      case "add-item": return "Add Item";
      case "record-purchase": return "Record Purchase";
      case "receive-items": return "Receive Items";
      case "record-payment": return "Record Payment";
      case "adjust-inventory": return "Adjust Inventory";
      case "move-inventory": return "Move Stock";
      case "return-items": return "Record Return";
      default: return "Record Activity";
    }
  };

  return (
    <SlideOver open={open} onClose={handleClose} title={getTitle()} width="lg">
      {step === "menu" ? (
        <div className="space-y-2">
          <p className="text-sm text-white/60 mb-6">What happened?</p>
          {activityOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => handleOptionClick(option.id)}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all duration-150 hover:scale-[1.01] hover:shadow-lg ${option.color}`}
            >
              <div className="flex-shrink-0">{option.icon}</div>
              <div className="flex-1 text-left">
                <div className="font-medium text-white">{option.label}</div>
                <div className="text-sm text-white/50">{option.description}</div>
              </div>
              {Icons.chevronRight}
            </button>
          ))}
        </div>
      ) : step === "add-item" ? (
        <div className="space-y-2">
          <button onClick={handleBack} className="flex items-center gap-2 text-sm text-white/60 hover:text-white mb-6 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back
          </button>
          <p className="text-sm text-white/60 mb-4">What type of item?</p>
          {itemTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setStep(type.id as DrawerStep)}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-150"
            >
              <div className="flex-shrink-0 text-white/70">{type.icon}</div>
              <div className="flex-1 text-left">
                <div className="font-medium text-white">{type.label}</div>
                <div className="text-sm text-white/50">{type.description}</div>
              </div>
              {Icons.chevronRight}
            </button>
          ))}
        </div>
      ) : step === "add-product" ? (
        <div className="space-y-5">
          <button onClick={handleBack} className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back
          </button>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Product Name *</label>
            <input
              type="text"
              value={productForm.name}
              onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/25"
              placeholder="e.g., Office Chair"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Category</label>
            <select
              value={productForm.category}
              onChange={(e) => setProductForm({ ...productForm, category: e.target.value as ProductCategory })}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
            >
              {categoryOptions.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-zinc-900">{opt.label}</option>
              ))}
            </select>
            {productForm.category === "food" && <p className="mt-1.5 text-xs text-amber-400">Food products require an expiry date</p>}
            {productForm.category === "hazardous" && <p className="mt-1.5 text-xs text-orange-400">Hazardous products require an expiry date</p>}
          </div>

          {(productForm.category === "food" || productForm.category === "hazardous") && (
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Expiry Date *</label>
              <input
                type="date"
                value={productForm.expiryDate}
                onChange={(e) => setProductForm({ ...productForm, expiryDate: e.target.value })}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Quantity *</label>
              <input
                type="number"
                value={productForm.quantity}
                onChange={(e) => setProductForm({ ...productForm, quantity: e.target.value })}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/25"
                placeholder="0"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Unit *</label>
              <select
                value={productForm.unit}
                onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
              >
                {unitOptions.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-zinc-900">{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Warehouse</label>
            <select
              value={productForm.warehouseId}
              onChange={(e) => setProductForm({ ...productForm, warehouseId: e.target.value })}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
            >
              <option value="" className="bg-zinc-900">Assign later</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id} className="bg-zinc-900">{wh.name} ({wh.code})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Default Cost</label>
              <input
                type="number"
                value={productForm.defaultCost}
                onChange={(e) => setProductForm({ ...productForm, defaultCost: e.target.value })}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/25"
                placeholder="0.00"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Default Price</label>
              <input
                type="number"
                value={productForm.defaultPrice}
                onChange={(e) => setProductForm({ ...productForm, defaultPrice: e.target.value })}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/25"
                placeholder="0.00"
                step="0.01"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Vendor</label>
            <select
              value={productForm.vendorId}
              onChange={(e) => setProductForm({ ...productForm, vendorId: e.target.value })}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
            >
              <option value="" className="bg-zinc-900">Select vendor (optional)</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id} className="bg-zinc-900">{v.fullName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Description</label>
            <textarea
              value={productForm.description}
              onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/25"
              placeholder="Optional description..."
              rows={2}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <GlassButton type="button" variant="ghost" onClick={handleClose} className="flex-1">Cancel</GlassButton>
            <GlassButton type="button" variant="primary" onClick={submitProduct} disabled={loading} className="flex-1">
              {loading ? <Spinner size="sm" /> : "Create Product"}
            </GlassButton>
          </div>
        </div>
      ) : step === "add-service" ? (
        <div className="space-y-5">
          <button onClick={handleBack} className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back
          </button>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Service Name *</label>
            <input
              type="text"
              value={serviceForm.name}
              onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/25"
              placeholder="e.g., Equipment Maintenance"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Description</label>
            <textarea
              value={serviceForm.description}
              onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/25"
              placeholder="Describe the service..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Estimated Cost</label>
              <input
                type="number"
                value={serviceForm.estimatedCost}
                onChange={(e) => setServiceForm({ ...serviceForm, estimatedCost: e.target.value })}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/25"
                placeholder="0.00"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Estimated Price</label>
              <input
                type="number"
                value={serviceForm.estimatedPrice}
                onChange={(e) => setServiceForm({ ...serviceForm, estimatedPrice: e.target.value })}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/25"
                placeholder="0.00"
                step="0.01"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl">
            <label className="flex items-center gap-3 cursor-pointer flex-1">
              <input
                type="checkbox"
                checked={serviceForm.availability}
                onChange={(e) => setServiceForm({ ...serviceForm, availability: e.target.checked })}
                className="w-5 h-5 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500/50"
              />
              <div>
                <p className="text-sm font-medium text-white">Available</p>
                <p className="text-xs text-white/50">This service is currently available for booking</p>
              </div>
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <GlassButton type="button" variant="ghost" onClick={handleClose} className="flex-1">Cancel</GlassButton>
            <GlassButton type="button" variant="primary" onClick={submitService} disabled={loading} className="flex-1">
              {loading ? <Spinner size="sm" /> : "Create Service"}
            </GlassButton>
          </div>
        </div>
      ) : step === "add-consumable" ? (
        <div className="space-y-5">
          <button onClick={handleBack} className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back
          </button>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Consumable Name *</label>
            <input
              type="text"
              value={consumableForm.name}
              onChange={(e) => setConsumableForm({ ...consumableForm, name: e.target.value })}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/25"
              placeholder="e.g., Printer Paper, Coffee Beans"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Quantity *</label>
              <input
                type="number"
                value={consumableForm.quantity}
                onChange={(e) => setConsumableForm({ ...consumableForm, quantity: e.target.value })}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/25"
                placeholder="0"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Unit *</label>
              <select
                value={consumableForm.unit}
                onChange={(e) => setConsumableForm({ ...consumableForm, unit: e.target.value })}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
              >
                {unitOptions.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-zinc-900">{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Warehouse</label>
            <select
              value={consumableForm.warehouseId}
              onChange={(e) => setConsumableForm({ ...consumableForm, warehouseId: e.target.value })}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
            >
              <option value="" className="bg-zinc-900">Assign later</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id} className="bg-zinc-900">{wh.name} ({wh.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Default Cost</label>
            <input
              type="number"
              value={consumableForm.defaultCost}
              onChange={(e) => setConsumableForm({ ...consumableForm, defaultCost: e.target.value })}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/25"
              placeholder="0.00"
              step="0.01"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Description</label>
            <textarea
              value={consumableForm.description}
              onChange={(e) => setConsumableForm({ ...consumableForm, description: e.target.value })}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/25"
              placeholder="Optional description..."
              rows={2}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <GlassButton type="button" variant="ghost" onClick={handleClose} className="flex-1">Cancel</GlassButton>
            <GlassButton type="button" variant="primary" onClick={submitConsumable} disabled={loading} className="flex-1">
              {loading ? <Spinner size="sm" /> : "Create Consumable"}
            </GlassButton>
          </div>
        </div>
      ) : step === "add-asset" ? (
        <div className="space-y-5">
          <button onClick={handleBack} className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back
          </button>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Asset Name *</label>
            <input
              type="text"
              value={assetForm.name}
              onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/25"
              placeholder="e.g., Delivery Van, CNC Machine"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Description</label>
            <textarea
              value={assetForm.description}
              onChange={(e) => setAssetForm({ ...assetForm, description: e.target.value })}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/25"
              placeholder="Describe the asset..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Purchase Price</label>
              <input
                type="number"
                value={assetForm.purchasePrice}
                onChange={(e) => setAssetForm({ ...assetForm, purchasePrice: e.target.value })}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/25"
                placeholder="0.00"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Quantity</label>
              <input
                type="number"
                value={assetForm.quantity}
                onChange={(e) => setAssetForm({ ...assetForm, quantity: e.target.value })}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/25"
                placeholder="1"
                min="1"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Vendor</label>
            <select
              value={assetForm.vendorId}
              onChange={(e) => setAssetForm({ ...assetForm, vendorId: e.target.value })}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
            >
              <option value="" className="bg-zinc-900">Select vendor (optional)</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id} className="bg-zinc-900">{v.fullName}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl">
            <label className="flex items-center gap-3 cursor-pointer flex-1">
              <input
                type="checkbox"
                checked={assetForm.availability}
                onChange={(e) => setAssetForm({ ...assetForm, availability: e.target.checked })}
                className="w-5 h-5 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500/50"
              />
              <div>
                <p className="text-sm font-medium text-white">Available</p>
                <p className="text-xs text-white/50">This asset is currently available for use</p>
              </div>
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <GlassButton type="button" variant="ghost" onClick={handleClose} className="flex-1">Cancel</GlassButton>
            <GlassButton type="button" variant="primary" onClick={submitAsset} disabled={loading} className="flex-1">
              {loading ? <Spinner size="sm" /> : "Create Asset"}
            </GlassButton>
          </div>
        </div>
      ) : step === "record-purchase" ? (
        <div className="space-y-5">
          <button onClick={handleBack} className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back
          </button>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Vendor</label>
            <select
              value={purchaseForm.vendorId}
              onChange={(e) => setPurchaseForm({ ...purchaseForm, vendorId: e.target.value })}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
            >
              <option value="" className="bg-zinc-900">Select vendor (optional)</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id} className="bg-zinc-900">{v.fullName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Purchase Date *</label>
            <input
              type="date"
              value={purchaseForm.purchaseDate}
              onChange={(e) => setPurchaseForm({ ...purchaseForm, purchaseDate: e.target.value })}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Line Items *</label>
            {purchaseForm.lines.map((line, idx) => (
              <div key={idx} className="p-3 bg-white/5 rounded-xl mb-2 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={line.itemId}
                    onChange={(e) => {
                      const newLines = [...purchaseForm.lines];
                      newLines[idx].itemId = e.target.value;
                      if (e.target.value) newLines[idx].freeTextName = "";
                      setPurchaseForm({ ...purchaseForm, lines: newLines });
                    }}
                    className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none"
                  >
                    <option value="" className="bg-zinc-900">Select item or type below</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id} className="bg-zinc-900">{item.name}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Or free-text name"
                    value={line.freeTextName}
                    onChange={(e) => {
                      const newLines = [...purchaseForm.lines];
                      newLines[idx].freeTextName = e.target.value;
                      if (e.target.value) newLines[idx].itemId = "";
                      setPurchaseForm({ ...purchaseForm, lines: newLines });
                    }}
                    disabled={!!line.itemId}
                    className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/40 focus:outline-none disabled:opacity-50"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <input
                    type="number"
                    placeholder="Qty"
                    value={line.quantity}
                    onChange={(e) => {
                      const newLines = [...purchaseForm.lines];
                      newLines[idx].quantity = e.target.value;
                      setPurchaseForm({ ...purchaseForm, lines: newLines });
                    }}
                    className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/40 focus:outline-none"
                  />
                  <select
                    value={line.unit}
                    onChange={(e) => {
                      const newLines = [...purchaseForm.lines];
                      newLines[idx].unit = e.target.value;
                      setPurchaseForm({ ...purchaseForm, lines: newLines });
                    }}
                    className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none"
                  >
                    {unitOptions.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-zinc-900">{opt.label}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="Unit cost"
                    value={line.unitCost}
                    onChange={(e) => {
                      const newLines = [...purchaseForm.lines];
                      newLines[idx].unitCost = e.target.value;
                      setPurchaseForm({ ...purchaseForm, lines: newLines });
                    }}
                    step="0.01"
                    className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/40 focus:outline-none"
                  />
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setPurchaseForm({ ...purchaseForm, lines: [...purchaseForm.lines, { itemId: "", freeTextName: "", quantity: "1", unit: "pcs", unitCost: "", warehouseId: "" }] })}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              + Add another line
            </button>
          </div>

          <div className="space-y-3 p-4 bg-white/5 rounded-xl">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={purchaseForm.receivedNow}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, receivedNow: e.target.checked })}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-500"
              />
              <span className="text-sm text-white">Already received these items</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={purchaseForm.paidNow}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, paidNow: e.target.checked })}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-500"
              />
              <span className="text-sm text-white">Already paid for this purchase</span>
            </label>
          </div>

          <textarea
            placeholder="Notes (optional)"
            value={purchaseForm.notes}
            onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })}
            rows={2}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/25"
          />

          <div className="flex gap-3 pt-4">
            <GlassButton type="button" variant="ghost" onClick={handleClose} className="flex-1">Cancel</GlassButton>
            <GlassButton type="button" variant="primary" onClick={submitPurchase} disabled={loading} className="flex-1">
              {loading ? <Spinner size="sm" /> : "Record Purchase"}
            </GlassButton>
          </div>
        </div>
      ) : step === "receive-items" ? (
        <div className="space-y-5">
          <button onClick={handleBack} className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back
          </button>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Received Date *</label>
            <input
              type="date"
              value={receiveForm.receivedDate}
              onChange={(e) => setReceiveForm({ ...receiveForm, receivedDate: e.target.value })}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Warehouse</label>
            <select
              value={receiveForm.warehouseId}
              onChange={(e) => setReceiveForm({ ...receiveForm, warehouseId: e.target.value })}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
            >
              <option value="" className="bg-zinc-900">Assign later</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id} className="bg-zinc-900">{wh.name} ({wh.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">Items Received *</label>
            {receiveForm.lines.map((line, idx) => (
              <div key={idx} className="p-3 bg-white/5 rounded-xl mb-2 space-y-3">
                <select
                  value={line.itemId}
                  onChange={(e) => {
                    const newLines = [...receiveForm.lines];
                    newLines[idx].itemId = e.target.value;
                    setReceiveForm({ ...receiveForm, lines: newLines });
                  }}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none"
                >
                  <option value="" className="bg-zinc-900">Select item *</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id} className="bg-zinc-900">{item.name}</option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    placeholder="Qty received *"
                    value={line.quantityReceived}
                    onChange={(e) => {
                      const newLines = [...receiveForm.lines];
                      newLines[idx].quantityReceived = e.target.value;
                      setReceiveForm({ ...receiveForm, lines: newLines });
                    }}
                    className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/40 focus:outline-none"
                  />
                  <input
                    type="number"
                    placeholder="Qty damaged"
                    value={line.quantityDamaged}
                    onChange={(e) => {
                      const newLines = [...receiveForm.lines];
                      newLines[idx].quantityDamaged = e.target.value;
                      setReceiveForm({ ...receiveForm, lines: newLines });
                    }}
                    className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/40 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="date"
                    placeholder="Expiry date"
                    value={line.expiryDate}
                    onChange={(e) => {
                      const newLines = [...receiveForm.lines];
                      newLines[idx].expiryDate = e.target.value;
                      setReceiveForm({ ...receiveForm, lines: newLines });
                    }}
                    className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Batch/Lot (optional)"
                    value={line.batch}
                    onChange={(e) => {
                      const newLines = [...receiveForm.lines];
                      newLines[idx].batch = e.target.value;
                      setReceiveForm({ ...receiveForm, lines: newLines });
                    }}
                    className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/40 focus:outline-none"
                  />
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setReceiveForm({ ...receiveForm, lines: [...receiveForm.lines, { itemId: "", quantityReceived: "", quantityDamaged: "0", expiryDate: "", batch: "" }] })}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              + Add another line
            </button>
          </div>

          <textarea
            placeholder="Notes (optional)"
            value={receiveForm.notes}
            onChange={(e) => setReceiveForm({ ...receiveForm, notes: e.target.value })}
            rows={2}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/25"
          />

          <div className="flex gap-3 pt-4">
            <GlassButton type="button" variant="ghost" onClick={handleClose} className="flex-1">Cancel</GlassButton>
            <GlassButton type="button" variant="primary" onClick={submitReceive} disabled={loading} className="flex-1">
              {loading ? <Spinner size="sm" /> : "Receive Items"}
            </GlassButton>
          </div>
        </div>
      ) : step === "record-payment" ? (
        <div className="space-y-5">
          <button onClick={handleBack} className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back
          </button>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Payee</label>
            <select
              value={paymentForm.payeeId}
              onChange={(e) => setPaymentForm({ ...paymentForm, payeeId: e.target.value })}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
            >
              <option value="" className="bg-zinc-900">Select payee (optional)</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id} className="bg-zinc-900">{v.fullName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Payment Date *</label>
            <input
              type="date"
              value={paymentForm.paymentDate}
              onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Amount *</label>
            <input
              type="number"
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/25"
              placeholder="0.00"
              step="0.01"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Status</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPaymentForm({ ...paymentForm, status: "paid" })}
                className={`flex-1 py-2.5 px-4 rounded-xl border text-sm font-medium transition-colors ${paymentForm.status === "paid" ? "bg-green-500/20 border-green-500/30 text-green-400" : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"}`}
              >
                Paid
              </button>
              <button
                type="button"
                onClick={() => setPaymentForm({ ...paymentForm, status: "unpaid" })}
                className={`flex-1 py-2.5 px-4 rounded-xl border text-sm font-medium transition-colors ${paymentForm.status === "unpaid" ? "bg-amber-500/20 border-amber-500/30 text-amber-400" : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"}`}
              >
                Unpaid (Owes)
              </button>
            </div>
          </div>

          {paymentForm.status === "paid" && (
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Payment Method</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentForm({ ...paymentForm, method: "cash" })}
                  className={`flex-1 py-2.5 px-4 rounded-xl border text-sm font-medium transition-colors ${paymentForm.method === "cash" ? "bg-blue-500/20 border-blue-500/30 text-blue-400" : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"}`}
                >
                  Cash
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentForm({ ...paymentForm, method: "bank" })}
                  className={`flex-1 py-2.5 px-4 rounded-xl border text-sm font-medium transition-colors ${paymentForm.method === "bank" ? "bg-blue-500/20 border-blue-500/30 text-blue-400" : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"}`}
                >
                  Bank Transfer
                </button>
              </div>
            </div>
          )}

          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <p className="text-xs text-amber-400">Payments require an attachment (receipt/invoice). You can add it after saving.</p>
          </div>

          <textarea
            placeholder="Notes (optional)"
            value={paymentForm.notes}
            onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
            rows={2}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/25"
          />

          <div className="flex gap-3 pt-4">
            <GlassButton type="button" variant="ghost" onClick={handleClose} className="flex-1">Cancel</GlassButton>
            <GlassButton type="button" variant="primary" onClick={submitPayment} disabled={loading} className="flex-1">
              {loading ? <Spinner size="sm" /> : "Record Payment"}
            </GlassButton>
          </div>
        </div>
      ) : step === "adjust-inventory" ? (
        <div className="space-y-5">
          <button onClick={handleBack} className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back
          </button>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Item *</label>
            <select
              value={adjustmentForm.itemId}
              onChange={(e) => setAdjustmentForm({ ...adjustmentForm, itemId: e.target.value })}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
            >
              <option value="" className="bg-zinc-900">Select item</option>
              {items.map((item) => (
                <option key={item.id} value={item.id} className="bg-zinc-900">{item.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Warehouse</label>
            <select
              value={adjustmentForm.warehouseId}
              onChange={(e) => setAdjustmentForm({ ...adjustmentForm, warehouseId: e.target.value })}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
            >
              <option value="" className="bg-zinc-900">All warehouses</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id} className="bg-zinc-900">{wh.name} ({wh.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Adjustment Date *</label>
            <input
              type="date"
              value={adjustmentForm.adjustmentDate}
              onChange={(e) => setAdjustmentForm({ ...adjustmentForm, adjustmentDate: e.target.value })}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Quantity Change *</label>
            <input
              type="number"
              value={adjustmentForm.quantityDelta}
              onChange={(e) => setAdjustmentForm({ ...adjustmentForm, quantityDelta: e.target.value })}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/25"
              placeholder="e.g., -5 to reduce, +3 to add"
            />
            <p className="text-xs text-white/50 mt-1">Use negative numbers to reduce stock, positive to add</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Reason *</label>
            <select
              value={adjustmentForm.reason}
              onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value as AdjustmentReason })}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
            >
              {reasonOptions.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-zinc-900">{opt.label}</option>
              ))}
            </select>
          </div>

          <textarea
            placeholder="Additional notes (optional)"
            value={adjustmentForm.notes}
            onChange={(e) => setAdjustmentForm({ ...adjustmentForm, notes: e.target.value })}
            rows={2}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/25"
          />

          <div className="flex gap-3 pt-4">
            <GlassButton type="button" variant="ghost" onClick={handleClose} className="flex-1">Cancel</GlassButton>
            <GlassButton type="button" variant="primary" onClick={submitAdjustment} disabled={loading} className="flex-1">
              {loading ? <Spinner size="sm" /> : "Adjust Inventory"}
            </GlassButton>
          </div>
        </div>
      ) : step === "move-inventory" ? (
        <div className="space-y-5">
          <button onClick={handleBack} className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back
          </button>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Item *</label>
            <select
              value={transferForm.itemId}
              onChange={(e) => setTransferForm({ ...transferForm, itemId: e.target.value })}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
            >
              <option value="" className="bg-zinc-900">Select item</option>
              {items.map((item) => (
                <option key={item.id} value={item.id} className="bg-zinc-900">{item.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">From Warehouse *</label>
              <select
                value={transferForm.fromWarehouseId}
                onChange={(e) => setTransferForm({ ...transferForm, fromWarehouseId: e.target.value })}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
              >
                <option value="" className="bg-zinc-900">Select source</option>
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id} className="bg-zinc-900">{wh.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">To Warehouse *</label>
              <select
                value={transferForm.toWarehouseId}
                onChange={(e) => setTransferForm({ ...transferForm, toWarehouseId: e.target.value })}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
              >
                <option value="" className="bg-zinc-900">Select destination</option>
                {warehouses.filter(wh => wh.id !== transferForm.fromWarehouseId).map((wh) => (
                  <option key={wh.id} value={wh.id} className="bg-zinc-900">{wh.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Transfer Date *</label>
            <input
              type="date"
              value={transferForm.transferDate}
              onChange={(e) => setTransferForm({ ...transferForm, transferDate: e.target.value })}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Quantity *</label>
            <input
              type="number"
              value={transferForm.quantity}
              onChange={(e) => setTransferForm({ ...transferForm, quantity: e.target.value })}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/25"
              placeholder="0"
              min="1"
            />
          </div>

          <textarea
            placeholder="Notes (optional)"
            value={transferForm.notes}
            onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
            rows={2}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/25"
          />

          <div className="flex gap-3 pt-4">
            <GlassButton type="button" variant="ghost" onClick={handleClose} className="flex-1">Cancel</GlassButton>
            <GlassButton type="button" variant="primary" onClick={submitTransfer} disabled={loading} className="flex-1">
              {loading ? <Spinner size="sm" /> : "Transfer Stock"}
            </GlassButton>
          </div>
        </div>
      ) : step === "return-items" ? (
        <div className="space-y-5">
          <button onClick={handleBack} className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back
          </button>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Return Type *</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setReturnForm({ ...returnForm, returnType: "customer" })}
                className={`flex-1 py-2.5 px-4 rounded-xl border text-sm font-medium transition-colors ${returnForm.returnType === "customer" ? "bg-green-500/20 border-green-500/30 text-green-400" : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"}`}
              >
                Customer Return
              </button>
              <button
                type="button"
                onClick={() => setReturnForm({ ...returnForm, returnType: "supplier" })}
                className={`flex-1 py-2.5 px-4 rounded-xl border text-sm font-medium transition-colors ${returnForm.returnType === "supplier" ? "bg-rose-500/20 border-rose-500/30 text-rose-400" : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"}`}
              >
                Supplier Return
              </button>
            </div>
            <p className="text-xs text-white/50 mt-1.5">
              {returnForm.returnType === "customer" ? "Customer return adds stock back to inventory" : "Supplier return removes stock from inventory"}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Item *</label>
            <select
              value={returnForm.itemId}
              onChange={(e) => setReturnForm({ ...returnForm, itemId: e.target.value })}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
            >
              <option value="" className="bg-zinc-900">Select item</option>
              {items.map((item) => (
                <option key={item.id} value={item.id} className="bg-zinc-900">{item.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Warehouse</label>
            <select
              value={returnForm.warehouseId}
              onChange={(e) => setReturnForm({ ...returnForm, warehouseId: e.target.value })}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
            >
              <option value="" className="bg-zinc-900">Assign later</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id} className="bg-zinc-900">{wh.name} ({wh.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Return Date *</label>
            <input
              type="date"
              value={returnForm.returnDate}
              onChange={(e) => setReturnForm({ ...returnForm, returnDate: e.target.value })}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-white/25"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">Quantity *</label>
            <input
              type="number"
              value={returnForm.quantity}
              onChange={(e) => setReturnForm({ ...returnForm, quantity: e.target.value })}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/25"
              placeholder="0"
              min="1"
            />
          </div>

          <textarea
            placeholder="Reason for return (optional)"
            value={returnForm.reason}
            onChange={(e) => setReturnForm({ ...returnForm, reason: e.target.value })}
            rows={2}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-white/25"
          />

          <div className="flex gap-3 pt-4">
            <GlassButton type="button" variant="ghost" onClick={handleClose} className="flex-1">Cancel</GlassButton>
            <GlassButton type="button" variant="primary" onClick={submitReturn} disabled={loading} className="flex-1">
              {loading ? <Spinner size="sm" /> : "Record Return"}
            </GlassButton>
          </div>
        </div>
      ) : null}
    </SlideOver>
  );
}

/* =============================================================================
   ANALYTICS CARDS
   ============================================================================= */

interface MetricCardProps {
  label: string;
  value: number;
  variant?: "default" | "success" | "warning" | "danger";
  icon?: React.ReactNode;
}

function MetricCard({ label, value, variant = "default", icon }: MetricCardProps) {
  const variantStyles = {
    default: "text-white",
    success: "text-emerald-400",
    warning: "text-amber-400",
    danger: "text-red-400",
  };

  const bgStyles = {
    default: "bg-white/5",
    success: "bg-emerald-500/10",
    warning: "bg-amber-500/10",
    danger: "bg-red-500/10",
  };

  return (
    <div
      className={`
        relative overflow-hidden
        rounded-2xl border border-white/10
        p-4 backdrop-blur-sm
        ${bgStyles[variant]}
        group hover:border-white/20 transition-all duration-200
      `}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-white/50 uppercase tracking-wider mb-1">
            {label}
          </p>
          <p className={`text-2xl font-bold tabular-nums ${variantStyles[variant]}`}>
            {value.toLocaleString()}
          </p>
        </div>
        {icon && (
          <div className="text-white/20 group-hover:text-white/30 transition-colors">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

function AnalyticsSection({ metrics }: { metrics: OperationsMetrics | null }) {
  if (!metrics) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 bg-white/5 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <MetricCard
        label="In Stock"
        value={metrics.productsInStock}
        variant="success"
        icon={Icons.cube}
      />
      <MetricCard
        label="Low Stock"
        value={metrics.lowStockCount}
        variant={metrics.lowStockCount > 0 ? "warning" : "default"}
        icon={Icons.inventory}
      />
      <MetricCard
        label="Out of Stock"
        value={metrics.outOfStockCount}
        variant={metrics.outOfStockCount > 0 ? "danger" : "default"}
        icon={Icons.inventory}
      />
      <MetricCard
        label="Expiring Soon"
        value={metrics.expiringSoonCount}
        variant={metrics.expiringSoonCount > 0 ? "warning" : "default"}
        icon={Icons.clock}
      />
      <MetricCard
        label="Pending Receipts"
        value={metrics.pendingReceiptsCount}
        icon={Icons.receive}
      />
      <MetricCard
        label="Active Jobs"
        value={metrics.activeServiceJobsCount}
        icon={Icons.service}
      />
      <MetricCard
        label="Overdue Jobs"
        value={metrics.overdueServiceJobsCount}
        variant={metrics.overdueServiceJobsCount > 0 ? "danger" : "default"}
        icon={Icons.warning}
      />
      <MetricCard
        label="Warehouses"
        value={metrics.warehousesCount}
        icon={Icons.warehouse}
      />
    </div>
  );
}

/* =============================================================================
   TASKS & ALERTS SECTION
   ============================================================================= */

function TasksSection({ tasks }: { tasks: Task[] }) {
  const priorityColors: Record<string, string> = {
    critical: "bg-red-500",
    high: "bg-orange-500",
    medium: "bg-amber-500",
    normal: "bg-blue-500",
    low: "bg-gray-500",
  };

  const priorityBadge: Record<string, "danger" | "warning" | "info" | "default"> = {
    critical: "danger",
    high: "warning",
    medium: "warning",
    normal: "info",
    low: "default",
  };

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-emerald-500/20 flex items-center justify-center">
          {Icons.check}
        </div>
        <p className="text-sm text-white/50">All caught up!</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.slice(0, 5).map((task) => (
        <div
          key={task.id}
          className="flex items-start gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/8 transition-colors cursor-pointer"
        >
          <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${priorityColors[task.priority] || "bg-gray-500"}`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{task.title}</p>
            <div className="flex items-center gap-2 mt-1">
              <GlassBadge variant={priorityBadge[task.priority] || "default"}>
                {task.priority}
              </GlassBadge>
              {task.dueAt && (
                <span className="text-xs text-white/40">
                  Due {formatDate(task.dueAt)}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
      {tasks.length > 5 && (
        <p className="text-xs text-white/40 text-center pt-2">
          +{tasks.length - 5} more tasks
        </p>
      )}
    </div>
  );
}

function AlertsSection({ alerts }: { alerts: Alert[] }) {
  const severityStyles: Record<string, { bg: string; border: string; dot: string }> = {
    critical: { bg: "bg-red-500/10", border: "border-red-500/30", dot: "bg-red-500" },
    warning: { bg: "bg-amber-500/10", border: "border-amber-500/30", dot: "bg-amber-500" },
    info: { bg: "bg-blue-500/10", border: "border-blue-500/30", dot: "bg-blue-500" },
  };

  if (alerts.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-emerald-500/20 flex items-center justify-center">
          {Icons.check}
        </div>
        <p className="text-sm text-white/50">No active alerts</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.slice(0, 5).map((alert) => {
        const styles = severityStyles[alert.severity] || severityStyles.info;
        return (
          <div
            key={alert.id}
            className={`flex items-start gap-3 p-3 rounded-xl border ${styles.bg} ${styles.border}`}
          >
            <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${styles.dot}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">{alert.message}</p>
              <p className="text-xs text-white/40 mt-1 capitalize">{alert.type.replace(/_/g, " ")}</p>
            </div>
          </div>
        );
      })}
      {alerts.length > 5 && (
        <p className="text-xs text-white/40 text-center pt-2">
          +{alerts.length - 5} more alerts
        </p>
      )}
    </div>
  );
}

/* =============================================================================
   ENTRY CARDS
   ============================================================================= */

interface EntryCardProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  color: string;
}

function EntryCard({ href, icon, label, description, color }: EntryCardProps) {
  return (
    <Link
      href={href}
      className={`
        group relative overflow-hidden
        flex items-center gap-4 p-5
        rounded-2xl border border-white/10
        bg-gradient-to-br from-white/5 to-transparent
        hover:border-white/20 hover:from-white/8
        transition-all duration-200
      `}
    >
      <div className={`flex-shrink-0 p-3 rounded-xl ${color}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-white group-hover:text-white transition-colors">
          {label}
        </p>
        <p className="text-sm text-white/50 truncate">{description}</p>
      </div>
      <div className="text-white/30 group-hover:text-white/60 group-hover:translate-x-1 transition-all">
        {Icons.chevronRight}
      </div>
    </Link>
  );
}

function EntryCardsSection() {
  const entries: EntryCardProps[] = [
    {
      href: "/operations/catalog?type=product,service,consumable",
      icon: Icons.cube,
      label: "Products, Services, Consumables",
      description: "View and manage your item catalog",
      color: "bg-blue-500/20 text-blue-400",
    },
    {
      href: "/operations/catalog?type=asset",
      icon: Icons.asset,
      label: "Assets",
      description: "Equipment, vehicles, and long-term items",
      color: "bg-purple-500/20 text-purple-400",
    },
    {
      href: "/operations/catalog?view=inventory",
      icon: Icons.inventory,
      label: "Inventory",
      description: "Stock levels and warehouse balances",
      color: "bg-emerald-500/20 text-emerald-400",
    },
    {
      href: "/operations/warehouses",
      icon: Icons.warehouse,
      label: "Warehouses",
      description: "Storage locations and capacity",
      color: "bg-amber-500/20 text-amber-400",
    },
    {
      href: "/operations/people?roles=vendor,contractor",
      icon: Icons.users,
      label: "Vendors and Contractors",
      description: "Suppliers and service providers",
      color: "bg-rose-500/20 text-rose-400",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {entries.map((entry) => (
        <EntryCard key={entry.href} {...entry} />
      ))}
    </div>
  );
}

/* =============================================================================
   MAIN PAGE
   ============================================================================= */

function OperationsPageContent() {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [metrics, setMetrics] = React.useState<OperationsMetrics | null>(null);
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [alerts, setAlerts] = React.useState<Alert[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    Promise.all([
      apiGet<{ metrics: OperationsMetrics }>("/api/operations/metrics").catch(() => ({ metrics: null })),
      apiGet<{ tasks: Task[] }>("/api/operations/tasks?status=open&limit=10").catch(() => ({ tasks: [] })),
      apiGet<{ alerts: Alert[] }>("/api/operations/alerts?status=active&limit=10").catch(() => ({ alerts: [] })),
    ]).then(([metricsRes, tasksRes, alertsRes]) => {
      setMetrics(metricsRes.metrics);
      setTasks(tasksRes.tasks || []);
      setAlerts(alertsRes.alerts || []);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-8 pb-12">
      {/* Header with Record Activity CTA */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Operations</h1>
          <p className="text-sm text-white/50 mt-1">
            Unified hub for inventory, procurement, and service fulfillment
          </p>
        </div>
        <GlassButton
          variant="primary"
          size="lg"
          onClick={() => setDrawerOpen(true)}
          className="group"
        >
          <span className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-white/20 group-hover:bg-white/30 transition-colors">
              {Icons.bolt}
            </span>
            Record activity
          </span>
        </GlassButton>
      </div>

      {/* Analytics Cards */}
      <section>
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">
          Overview
        </h2>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-24 bg-white/5 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <AnalyticsSection metrics={metrics} />
        )}
      </section>

      {/* Tasks & Alerts Two-Column */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wide">
              To-Do
            </h3>
            <GlassBadge variant={tasks.length > 0 ? "warning" : "success"}>
              {tasks.length}
            </GlassBadge>
          </div>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <TasksSection tasks={tasks} />
          )}
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wide">
              Alerts
            </h3>
            <GlassBadge variant={alerts.length > 0 ? "danger" : "success"}>
              {alerts.length}
            </GlassBadge>
          </div>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <AlertsSection alerts={alerts} />
          )}
        </GlassCard>
      </section>

      {/* Entry Cards */}
      <section>
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">
          Quick Access
        </h2>
        <EntryCardsSection />
      </section>

      {/* Record Activity Drawer */}
      <RecordActivityDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}

export default function OperationsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      }
    >
      <OperationsPageContent />
    </Suspense>
  );
}
