"use client";

import { useState, useEffect } from "react";
import {
  GlassInput,
  GlassSelect,
  GlassTextarea,
  GlassButton,
  useToast,
} from "@/components/ui/glass";
import { ArrowLeft, Info } from "lucide-react";

interface AddProductFormProps {
  onBack: () => void;
  onSuccess: () => void;
  itemType: "product" | "consumable";
}

interface Warehouse {
  id: string;
  name: string;
}

interface Vendor {
  id: string;
  name: string;
}

export default function AddProductForm({ onBack, onSuccess, itemType }: AddProductFormProps) {
  const { addToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);

  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    description: "",
    category: "",
    productType: itemType === "product" ? "finished_goods" : "consumable",
    costPrice: "",
    unitPrice: "",
    unitOfMeasure: "each",
    reorderPoint: "",
    reorderQuantity: "",
    initialStock: "",
    warehouseId: "",
    primaryVendorId: "",
    vendorSku: "",
    leadTimeDays: "",
    barcode: "",
    trackInventory: true,
    isActive: true,
  });

  useEffect(() => {
    loadWarehouses();
    loadVendors();
  }, []);

  const loadWarehouses = async () => {
    try {
      const res = await fetch("/api/master/warehouses");
      if (res.ok) {
        const data = await res.json();
        setWarehouses(data.warehouses || []);
      }
    } catch (error) {
      console.error("Error loading warehouses:", error);
    }
  };

  const loadVendors = async () => {
    try {
      const res = await fetch("/api/master/parties?type=vendor");
      if (res.ok) {
        const data = await res.json();
        // Map API response fields to expected format
        setVendors((data.items || []).map((p: { id: string; displayName: string }) => ({
          id: p.id,
          name: p.displayName,
        })));
      }
    } catch (error) {
      console.error("Error loading vendors:", error);
    }
  };

  const updateField = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      if (!formData.name) {
        addToast("error", "Product name is required");
        return;
      }

      if (!formData.sku) {
        addToast("error", "SKU is required");
        return;
      }

      const res = await fetch("/api/master/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: itemType,
          name: formData.name,
          sku: formData.sku,
          description: formData.description,
          category: formData.category,
          defaultPurchaseCost: formData.costPrice || null,
          defaultSalesPrice: formData.unitPrice || null,
          unitOfMeasure: formData.unitOfMeasure,
          reorderPoint: formData.reorderPoint ? parseInt(formData.reorderPoint) : null,
          reorderQuantity: formData.reorderQuantity ? parseInt(formData.reorderQuantity) : null,
          trackInventory: formData.trackInventory,
          defaultVendorId: formData.primaryVendorId || null,
          barcode: formData.barcode || null,
          status: formData.isActive ? "active" : "inactive",
        }),
      });

      if (res.ok) {
        onSuccess();
      } else {
        const error = await res.json();
        addToast("error", error.message || "Failed to create item");
      }
    } catch (error) {
      console.error("Error creating item:", error);
      addToast("error", "Failed to create item");
    } finally {
      setIsSubmitting(false);
    }
  };

  const InfoTooltip = ({ text }: { text: string }) => (
    <div className="group relative inline-block ml-2">
      <Info className="w-4 h-4 text-white/40 cursor-help" />
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-50 w-64">
        <div className="bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl border border-white/10">
          {text}
        </div>
      </div>
    </div>
  );

  const warehouseOptions = [
    { value: "", label: "Select warehouse..." },
    ...warehouses.map((w) => ({ value: w.id, label: w.name })),
  ];

  const vendorOptions = [
    { value: "", label: "Select vendor..." },
    ...vendors.map((v) => ({ value: v.id, label: v.name })),
  ];

  const uomOptions = [
    { value: "each", label: "Each" },
    { value: "kg", label: "Kilogram" },
    { value: "lb", label: "Pound" },
    { value: "m", label: "Meter" },
    { value: "ft", label: "Foot" },
    { value: "l", label: "Liter" },
    { value: "gal", label: "Gallon" },
    { value: "box", label: "Box" },
    { value: "pack", label: "Pack" },
  ];

  return (
    <div className="space-y-6">
      <GlassButton onClick={onBack} variant="ghost" size="sm">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to menu
      </GlassButton>

      {/* Basic Info */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Basic Information
          <InfoTooltip text="Required fields for creating the item" />
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <GlassInput
            label="Name *"
            value={formData.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="Enter product name"
          />
          <GlassInput
            label="SKU *"
            value={formData.sku}
            onChange={(e) => updateField("sku", e.target.value)}
            placeholder="e.g., PRD-001"
          />
        </div>

        <GlassTextarea
          label="Description"
          value={formData.description}
          onChange={(e) => updateField("description", e.target.value)}
          rows={3}
          placeholder="Product description..."
        />

        <GlassInput
          label="Category"
          value={formData.category}
          onChange={(e) => updateField("category", e.target.value)}
          placeholder="e.g., Electronics, Office Supplies"
        />
      </div>

      {/* Pricing */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Pricing
          <InfoTooltip text="Cost and selling prices" />
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <GlassInput
            label="Cost Price"
            type="number"
            value={formData.costPrice}
            onChange={(e) => updateField("costPrice", e.target.value)}
            placeholder="0.00"
          />
          <GlassInput
            label="Selling Price"
            type="number"
            value={formData.unitPrice}
            onChange={(e) => updateField("unitPrice", e.target.value)}
            placeholder="0.00"
          />
        </div>
      </div>

      {/* Inventory */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Inventory
          <InfoTooltip text="Stock tracking and reorder settings" />
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <GlassSelect
            label="Unit of Measure"
            options={uomOptions}
            value={formData.unitOfMeasure}
            onChange={(e) => updateField("unitOfMeasure", e.target.value)}
          />
          <GlassInput
            label="Barcode"
            value={formData.barcode}
            onChange={(e) => updateField("barcode", e.target.value)}
            placeholder="UPC/EAN code"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <GlassInput
            label="Reorder Point"
            type="number"
            value={formData.reorderPoint}
            onChange={(e) => updateField("reorderPoint", e.target.value)}
            placeholder="Minimum stock level"
          />
          <GlassInput
            label="Reorder Quantity"
            type="number"
            value={formData.reorderQuantity}
            onChange={(e) => updateField("reorderQuantity", e.target.value)}
            placeholder="Quantity to reorder"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <GlassInput
            label="Initial Stock"
            type="number"
            value={formData.initialStock}
            onChange={(e) => updateField("initialStock", e.target.value)}
            placeholder="0"
          />
          <GlassSelect
            label="Warehouse"
            options={warehouseOptions}
            value={formData.warehouseId}
            onChange={(e) => updateField("warehouseId", e.target.value)}
          />
        </div>
      </div>

      {/* Vendor */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center">
          Vendor
          <InfoTooltip text="Primary supplier for this item" />
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <GlassSelect
            label="Primary Vendor"
            options={vendorOptions}
            value={formData.primaryVendorId}
            onChange={(e) => updateField("primaryVendorId", e.target.value)}
          />
          <GlassInput
            label="Vendor SKU"
            value={formData.vendorSku}
            onChange={(e) => updateField("vendorSku", e.target.value)}
            placeholder="Vendor's item code"
          />
        </div>

        <GlassInput
          label="Lead Time (Days)"
          type="number"
          value={formData.leadTimeDays}
          onChange={(e) => updateField("leadTimeDays", e.target.value)}
          placeholder="Days to receive from vendor"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-6 border-t border-white/10">
        <GlassButton onClick={onBack} variant="ghost">
          Cancel
        </GlassButton>
        <GlassButton onClick={handleSubmit} variant="primary" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : `Create ${itemType === "product" ? "Product" : "Consumable"}`}
        </GlassButton>
      </div>
    </div>
  );
}
