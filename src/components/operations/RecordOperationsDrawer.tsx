"use client";

import { useState } from "react";
import { SlideOver, GlassCard, GlassButton, useToast } from "@/components/ui/glass";
import {
  PlusCircle,
  PackageCheck,
  PackageMinus,
  Repeat,
  Edit,
  Wrench,
  ArrowRightLeft,
  UserPlus,
  Briefcase,
  ShoppingCart,
  ArrowLeft,
  Package,
  Server,
  Box,
  HardDrive,
} from "lucide-react";
import AddProductForm from "./forms/AddProductForm";
import AddServiceForm from "./forms/AddServiceForm";
import AddAssetForm from "./forms/AddAssetForm";
import AddVendorForm from "./forms/AddVendorForm";
import AddOfficeForm from "./forms/AddOfficeForm";
import ReceiveStockForm from "./forms/ReceiveStockForm";
import TransferStockForm from "./forms/TransferStockForm";
import ScheduleMaintenanceForm from "./forms/ScheduleMaintenanceForm";

interface RecordOperationsDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type ViewType =
  | "menu"
  | "add-item"
  | "add-product"
  | "add-service"
  | "add-consumable"
  | "add-asset"
  | "receive-stock"
  | "issue-stock"
  | "transfer-stock"
  | "adjust-inventory"
  | "schedule-maintenance"
  | "asset-transfer"
  | "add-vendor"
  | "add-contractor"
  | "add-office"
  | "create-po";

const ACTIVITY_CARDS = [
  {
    id: "add-item",
    icon: PlusCircle,
    title: "Add Item",
    description: "Add new product, service, consumable, or asset",
    color: "text-blue-400",
  },
  {
    id: "receive-stock",
    icon: PackageCheck,
    title: "Receive Stock",
    description: "Receive items from purchase orders",
    color: "text-green-400",
  },
  {
    id: "issue-stock",
    icon: PackageMinus,
    title: "Issue Stock",
    description: "Issue items from inventory",
    color: "text-orange-400",
  },
  {
    id: "transfer-stock",
    icon: Repeat,
    title: "Transfer Stock",
    description: "Transfer items between locations",
    color: "text-purple-400",
  },
  {
    id: "adjust-inventory",
    icon: Edit,
    title: "Adjust Inventory",
    description: "Correct inventory discrepancies",
    color: "text-yellow-400",
  },
  {
    id: "schedule-maintenance",
    icon: Wrench,
    title: "Schedule Maintenance",
    description: "Schedule asset maintenance",
    color: "text-red-400",
  },
  {
    id: "asset-transfer",
    icon: ArrowRightLeft,
    title: "Record Asset Transfer",
    description: "Transfer asset to new location or person",
    color: "text-cyan-400",
  },
  {
    id: "add-vendor",
    icon: UserPlus,
    title: "Add Vendor",
    description: "Add new vendor or supplier",
    color: "text-emerald-400",
  },
  {
    id: "add-contractor",
    icon: Briefcase,
    title: "Add Contractor",
    description: "Add new contractor or freelancer",
    color: "text-pink-400",
  },
  {
    id: "create-po",
    icon: ShoppingCart,
    title: "Create Purchase Order",
    description: "Create new purchase order",
    color: "text-indigo-400",
  },
];

const ADD_ITEM_SUBMENU = [
  {
    id: "add-product",
    icon: Package,
    title: "Add Product",
    description: "Finished goods, raw materials, or components",
    color: "text-blue-400",
  },
  {
    id: "add-service",
    icon: Server,
    title: "Add Service",
    description: "Consulting, maintenance, or installation services",
    color: "text-purple-400",
  },
  {
    id: "add-consumable",
    icon: Box,
    title: "Add Consumable",
    description: "Office supplies, cleaning, or safety items",
    color: "text-amber-400",
  },
  {
    id: "add-asset",
    icon: HardDrive,
    title: "Add Asset",
    description: "Equipment, furniture, vehicles, or IT assets",
    color: "text-emerald-400",
  },
];

export default function RecordOperationsDrawer({
  open,
  onClose,
  onSuccess,
}: RecordOperationsDrawerProps) {
  const [view, setView] = useState<ViewType>("menu");
  const { addToast } = useToast();

  const handleClose = () => {
    setView("menu");
    onClose();
  };

  const handleSuccess = () => {
    addToast("success", "Activity recorded successfully");
    setView("menu");
    onSuccess();
  };

  const handleBack = () => {
    if (view.startsWith("add-") && view !== "add-item") {
      setView("add-item");
    } else {
      setView("menu");
    }
  };

  const getTitle = () => {
    switch (view) {
      case "menu":
        return "Record Operations Activity";
      case "add-item":
        return "Add Item";
      case "add-product":
        return "Add Product";
      case "add-service":
        return "Add Service";
      case "add-consumable":
        return "Add Consumable";
      case "add-asset":
        return "Add Asset";
      case "receive-stock":
        return "Receive Stock";
      case "issue-stock":
        return "Issue Stock";
      case "transfer-stock":
        return "Transfer Stock";
      case "adjust-inventory":
        return "Adjust Inventory";
      case "schedule-maintenance":
        return "Schedule Maintenance";
      case "asset-transfer":
        return "Record Asset Transfer";
      case "add-vendor":
        return "Add Vendor";
      case "add-contractor":
        return "Add Contractor";
      case "add-office":
        return "Add Office";
      case "create-po":
        return "Create Purchase Order";
      default:
        return "Record Operations Activity";
    }
  };

  const renderContent = () => {
    switch (view) {
      case "menu":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ACTIVITY_CARDS.map((card) => (
              <GlassCard
                key={card.id}
                className="p-4 cursor-pointer hover:bg-white/10 transition-colors"
                onClick={() => setView(card.id as ViewType)}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg bg-white/5 ${card.color}`}>
                    <card.icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">{card.title}</h3>
                    <p className="text-sm text-white/60 mt-1">{card.description}</p>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        );

      case "add-item":
        return (
          <div className="space-y-4">
            <GlassButton onClick={handleBack} variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to menu
            </GlassButton>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ADD_ITEM_SUBMENU.map((card) => (
                <GlassCard
                  key={card.id}
                  className="p-4 cursor-pointer hover:bg-white/10 transition-colors"
                  onClick={() => setView(card.id as ViewType)}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg bg-white/5 ${card.color}`}>
                      <card.icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-white">{card.title}</h3>
                      <p className="text-sm text-white/60 mt-1">{card.description}</p>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          </div>
        );

      case "add-product":
      case "add-consumable":
        return (
          <AddProductForm
            onBack={handleBack}
            onSuccess={handleSuccess}
            itemType={view === "add-product" ? "product" : "consumable"}
          />
        );

      case "add-service":
        return <AddServiceForm onBack={handleBack} onSuccess={handleSuccess} />;

      case "add-asset":
        return <AddAssetForm onBack={handleBack} onSuccess={handleSuccess} />;

      case "receive-stock":
        return <ReceiveStockForm onBack={handleBack} onSuccess={handleSuccess} />;

      case "transfer-stock":
        return <TransferStockForm onBack={handleBack} onSuccess={handleSuccess} />;

      case "schedule-maintenance":
        return <ScheduleMaintenanceForm onBack={handleBack} onSuccess={handleSuccess} />;

      case "add-vendor":
        return <AddVendorForm onBack={handleBack} onSuccess={handleSuccess} />;

      case "add-office":
        return <AddOfficeForm onBack={handleBack} onSuccess={handleSuccess} />;

      // Placeholder views for forms not yet implemented
      case "issue-stock":
      case "adjust-inventory":
      case "asset-transfer":
      case "add-contractor":
      case "create-po":
        return (
          <div className="space-y-4">
            <GlassButton onClick={handleBack} variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to menu
            </GlassButton>
            <GlassCard className="p-8 text-center">
              <p className="text-white/60">This form is coming soon...</p>
            </GlassCard>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <SlideOver open={open} onClose={handleClose} title={getTitle()} width="lg">
      <div className="p-6">{renderContent()}</div>
    </SlideOver>
  );
}
